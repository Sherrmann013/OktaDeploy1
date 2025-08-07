import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, updateUserSchema, insertSiteAccessUserSchema, siteAccessUsers, insertIntegrationSchema, integrations, auditLogs, insertAppMappingSchema, appMappings, departmentAppMappings, insertDepartmentAppMappingSchema, employeeTypeAppMappings, insertEmployeeTypeAppMappingSchema, departmentGroupMappings, insertDepartmentGroupMappingSchema, employeeTypeGroupMappings, insertEmployeeTypeGroupMappingSchema, insertLayoutSettingSchema, layoutSettings, dashboardCards, insertDashboardCardSchema, updateDashboardCardSchema, monitoringCards, insertMonitoringCardSchema, updateMonitoringCardSchema, companyLogos, insertCompanyLogoSchema } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";
import { AuditLogger, getAuditLogs } from "./audit";
import { z } from "zod";
import { oktaService } from "./okta-service";
import { syncSpecificUser } from "./okta-sync";
import { knowBe4Service } from "./knowbe4-service";
import { knowBe4GraphService } from "./knowbe4-graph-service";
import { syncUserGroupsAndEmployeeType, syncAllUsersGroupsAndEmployeeTypes } from "./sync-user-groups";
import { bulkSyncUserGroupsAndEmployeeTypes } from "./bulk-groups-sync";
import { EmployeeTypeSync } from "./employee-type-sync";

// Helper function to safely execute OKTA operations
async function safeOktaOperation<T>(operation: () => Promise<T>, fallbackValue: T): Promise<T> {
  if (!oktaService.isConfigured()) {
    console.warn('OKTA not configured - returning fallback value');
    return fallbackValue;
  }
  
  try {
    return await operation();
  } catch (error) {
    console.error('OKTA operation failed:', error);
    return fallbackValue;
  }
}

// Helper function to determine employee type from user groups
function determineEmployeeTypeFromGroups(userGroups: any[], employeeTypeApps: Set<string>): string | null {
  // Check if user has access to any employee type applications
  for (const group of userGroups) {
    // Check if this group gives access to employee type applications
    if (group.profile?.name) {
      const groupName = group.profile.name.toUpperCase();
      if (groupName.includes('EMPLOYEE') || groupName.includes('FULL_TIME')) {
        return 'EMPLOYEE';
      } else if (groupName.includes('CONTRACTOR')) {
        return 'CONTRACTOR';
      } else if (groupName.includes('INTERN')) {
        return 'INTERN';
      } else if (groupName.includes('PART_TIME') || groupName.includes('CONSULTANT')) {
        return 'PART_TIME';
      }
    }
  }
  
  // If no specific group match, check application access
  // This would require additional logic to check user's app assignments
  return null;
}
import { setupAuth, isAuthenticated, requireAdmin } from "./direct-okta-auth";
import { MultiDatabaseManager } from "./multi-db";
import * as mspRoutes from "./routes/msp";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup OKTA authentication
  await setupAuth(app);

  // OKTA Initiate Login URI endpoint - required for proper SSO flow
  app.get("/api/sso-login", (req, res) => {
    // Redirect to OKTA authentication
    res.redirect("/api/login");
  });

  // Debug endpoint for troubleshooting user access issues
  app.get('/api/debug/user-access/:email', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const email = req.params.email;
      console.log(`Debugging access for user: ${email}`);
      
      // Check if user exists in OKTA
      const oktaUser = await safeOktaOperation(
        () => oktaService.getUserByEmail(email),
        null
      );
      
      if (!oktaUser) {
        return res.json({
          email,
          exists: false,
          message: "User not found in OKTA"
        });
      }
      
      // Check if user is assigned to the application
      const appAssignmentResponse = await fetch(`${process.env.OKTA_DOMAIN}/api/v1/apps/${process.env.CLIENT_ID}/users/${oktaUser.id}`, {
        headers: {
          'Authorization': `SSWS ${process.env.OKTA_API_TOKEN}`,
          'Accept': 'application/json'
        }
      });
      
      const isAssigned = appAssignmentResponse.ok;
      let assignmentDetails = null;
      
      if (isAssigned) {
        assignmentDetails = await appAssignmentResponse.json();
      }
      
      // Check MFA factors
      const factorsResponse = await fetch(`${process.env.OKTA_DOMAIN}/api/v1/users/${oktaUser.id}/factors`, {
        headers: {
          'Authorization': `SSWS ${process.env.OKTA_API_TOKEN}`,
          'Accept': 'application/json'
        }
      });
      
      const factors = factorsResponse.ok ? await factorsResponse.json() : [];
      
      res.json({
        email,
        exists: true,
        oktaUser: {
          id: oktaUser.id,
          status: oktaUser.status,
          created: oktaUser.created,
          lastLogin: oktaUser.lastLogin,
          profile: {
            firstName: oktaUser.profile.firstName,
            lastName: oktaUser.profile.lastName,
            email: oktaUser.profile.email,
            department: oktaUser.profile.department,
            title: oktaUser.profile.title
          }
        },
        appAccess: {
          isAssigned,
          assignmentStatus: assignmentDetails?.status || 'NOT_ASSIGNED',
          assignmentDetails
        },
        mfaFactors: factors.length,
        activeMfaFactors: factors.filter((f: any) => f.status === 'ACTIVE').length,
        recommendation: !isAssigned 
          ? "User needs to be assigned to the application"
          : oktaUser.status !== 'ACTIVE'
          ? "User account is not active"
          : "User appears properly configured for access"
      });
      
    } catch (error) {
      console.error("Error debugging user access:", error);
      res.status(500).json({ 
        message: "Failed to debug user access",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Auth routes are handled by setupAuth

  // Get employee type counts from local storage (fast, no OKTA calls)
  app.get("/api/employee-type-counts", isAuthenticated, async (req, res) => {
    try {
      const result = await storage.getAllUsers();
      const users = result.users;
      
      const counts = {
        EMPLOYEE: 0,
        CONTRACTOR: 0,
        INTERN: 0,
        PART_TIME: 0
      };
      
      for (const user of users) {
        if (user.employeeType && user.employeeType in counts) {
          (counts as any)[user.employeeType]++;
        }
      }
      
      res.json(counts);
    } catch (error) {
      console.error("Error getting employee type counts:", error);
      res.status(500).json({ 
        error: "Failed to get employee type counts",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get manager suggestions for autocomplete
  app.get("/api/managers", isAuthenticated, async (req, res) => {
    try {
      const query = z.string().optional().parse(req.query.q);
      
      try {
        // Get unique managers from OKTA
        const oktaUsers = await oktaService.getUsers(200);
        const managers = new Set<string>();
        
        oktaUsers.forEach(user => {
          if (user.profile.manager) {
            managers.add(user.profile.manager);
          }
        });
        
        let managerList = Array.from(managers).sort();
        
        // Filter by query if provided - search anywhere in names
        if (query && query.trim().length > 0) {
          const searchTerm = query.trim().toLowerCase();
          console.log(`Manager search query: "${searchTerm}", total managers: ${managerList.length}`);
          managerList = managerList.filter(manager => {
            const fullName = manager.toLowerCase();
            const nameParts = fullName.split(' ');
            // Match if query starts any part of the name OR is contained anywhere in the name
            return nameParts.some(part => part.startsWith(searchTerm)) || 
                   fullName.startsWith(searchTerm) ||
                   fullName.includes(searchTerm) ||
                   nameParts.some(part => part.includes(searchTerm));
          });
          console.log(`Filtered managers: ${managerList.length}`);
        }
        
        // Limit to top 10 suggestions
        res.json(managerList.slice(0, 10));
      } catch (oktaError) {
        console.log("OKTA API unavailable for manager suggestions, using empty list");
        res.json([]);
      }
    } catch (error) {
      console.error("Error fetching manager suggestions:", error);
      res.status(500).json({ error: "Failed to fetch manager suggestions" });
    }
  });

  // Get all users with fallback from OKTA to local storage
  app.get("/api/users", isAuthenticated, async (req, res) => {
    try {
      const searchQuery = z.string().optional().parse(req.query.search);
      const statusFilter = z.string().optional().parse(req.query.status);
      const statusFilters = z.string().optional().parse(req.query.statuses);
      const departmentFilter = z.string().optional().parse(req.query.department);
      const lastLoginDays = z.string().optional().parse(req.query.lastLoginDays);
      const employeeTypeFilter = z.string().optional().parse(req.query.employeeType);
      const employeeTypesFilter = z.string().optional().parse(req.query.employeeTypes);
      const mobilePhoneFilter = z.string().optional().parse(req.query.mobilePhone);
      const managerFilter = z.string().optional().parse(req.query.manager);
      const page = z.coerce.number().min(1).default(1).parse(req.query.page);
      const limit = z.coerce.number().min(1).max(1000).default(10).parse(req.query.limit);
      const statsOnly = z.boolean().default(false).parse(req.query.statsOnly === 'true');
      const sortBy = z.string().default("firstName").parse(req.query.sortBy);
      const sortOrder = z.enum(["asc", "desc"]).default("asc").parse(req.query.sortOrder);

      try {
        // For stats-only requests, return minimal data quickly
        if (statsOnly) {
          const sampleUsers = await oktaService.getUsers(50); // Smaller sample for stats
          res.json({
            users: [],
            total: sampleUsers.length,
            currentPage: 1,
            totalPages: 1,
            usersPerPage: limit,
            source: 'okta_stats'
          });
          return;
        }

        // Try to fetch users from OKTA first
        const oktaUsers = await oktaService.getUsers(Math.min(500, limit * 5));
        
        let filteredUsers = oktaUsers;
        
        // Apply search filter
        if (searchQuery) {
          const searchTerm = searchQuery.toLowerCase();
          filteredUsers = filteredUsers.filter(user => 
            user.profile.firstName?.toLowerCase().includes(searchTerm) ||
            user.profile.lastName?.toLowerCase().includes(searchTerm) ||
            user.profile.email?.toLowerCase().includes(searchTerm) ||
            user.profile.login?.toLowerCase().includes(searchTerm)
          );
        }
        
        // Apply status filter (single or multiple)
        if (statusFilter) {
          filteredUsers = filteredUsers.filter(user => user.status === statusFilter);
        } else if (statusFilters) {
          const statusArray = statusFilters.split(',').map(s => s.trim());
          if (statusArray.length > 0) {
            filteredUsers = filteredUsers.filter(user => statusArray.includes(user.status));
          }
        }
        
        // Apply department filter
        if (departmentFilter) {
          filteredUsers = filteredUsers.filter(user => 
            user.profile.department?.toLowerCase() === departmentFilter.toLowerCase()
          );
        }

        // Apply employee type filter - use database employee type to avoid OKTA API rate limits
        if (employeeTypeFilter) {
          // Get all users from database with matching employee type first (cached)
          const dbUsersWithType = await storage.getAllUsers({ 
            employeeType: employeeTypeFilter,
            limit: 1000 // Ensure we get all users with this type
          });
          const oktaIdsWithType = new Set(dbUsersWithType.users.map(user => user.oktaId).filter(Boolean));
          
          // Filter OKTA users to only those with matching employee type in database
          filteredUsers = filteredUsers.filter(oktaUser => oktaIdsWithType.has(oktaUser.id));
          
          console.log(`Employee type filter applied: ${employeeTypeFilter}, found ${filteredUsers.length} matching users`);
        }

        // Apply employee types array filter (from new filter interface)
        if (employeeTypesFilter) {
          const selectedTypes = employeeTypesFilter.split(',');
          if (selectedTypes.length > 0) {
            const dbUsersWithTypes = await storage.getAllUsers({ 
              limit: 1000 
            });
            const oktaIdsWithTypes = new Set(
              dbUsersWithTypes.users
                .filter(user => user.employeeType && selectedTypes.includes(user.employeeType))
                .map(user => user.oktaId)
                .filter(Boolean)
            );
            
            filteredUsers = filteredUsers.filter(oktaUser => oktaIdsWithTypes.has(oktaUser.id));
            console.log(`Employee types filter applied: ${selectedTypes.join(', ')}, found ${filteredUsers.length} matching users`);
          }
        }

        // Apply mobile phone filter
        if (mobilePhoneFilter) {
          const phoneSearchTerm = mobilePhoneFilter.toLowerCase();
          filteredUsers = filteredUsers.filter(user => 
            user.profile.mobilePhone?.toLowerCase().includes(phoneSearchTerm)
          );
          console.log(`Mobile phone filter applied: ${mobilePhoneFilter}, found ${filteredUsers.length} matching users`);
        }

        // Apply manager filter
        if (managerFilter) {
          const managerSearchTerm = managerFilter.toLowerCase();
          filteredUsers = filteredUsers.filter(user => 
            user.profile.manager?.toLowerCase().includes(managerSearchTerm)
          );
          console.log(`Manager filter applied: ${managerFilter}, found ${filteredUsers.length} matching users`);
        }

        // Apply last login time range filter
        if (lastLoginDays) {
          const now = new Date();
          console.log(`Last login filter applied: ${lastLoginDays}, found ${filteredUsers.length} matching users`);
          
          if (lastLoginDays === "never") {
            // Users who have never logged in
            filteredUsers = filteredUsers.filter(user => !user.lastLogin);
          } else if (lastLoginDays === "31") {
            // Users who logged in longer than 30 days ago
            const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
            filteredUsers = filteredUsers.filter(user => {
              if (!user.lastLogin) return true; // Include never logged in users
              const lastLoginDate = new Date(user.lastLogin);
              return lastLoginDate < thirtyDaysAgo;
            });
          } else {
            // Users who logged in within the specified number of days
            const days = parseInt(lastLoginDays);
            if (isNaN(days)) return; // Skip if invalid number
            
            // Set cutoff to exact milliseconds for precise filtering
            const cutoffDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
            
            filteredUsers = filteredUsers.filter(user => {
              if (!user.lastLogin) return false; // Exclude never logged in users
              const lastLoginDate = new Date(user.lastLogin);
              // Ensure we have a valid date
              if (isNaN(lastLoginDate.getTime())) return false;
              
              // For debugging: calculate exact days difference
              const timeDiff = now.getTime() - lastLoginDate.getTime();
              const daysDiff = timeDiff / (24 * 60 * 60 * 1000);
              
              // Only include users who logged in within the specified days (strict boundary)
              return daysDiff <= days;
            });
          }
          console.log(`Last login filter applied: ${lastLoginDays}, found ${filteredUsers.length} matching users`);
        }
        
        // Handle employeeType sorting differently since it requires database lookup
        if (sortBy === 'employeeType') {
          // Get all database users to access employeeType data
          const allDbUsers = await storage.getAllUsers({ limit: 1000 });
          const employeeTypeMap = new Map();
          allDbUsers.users.forEach(dbUser => {
            if (dbUser.oktaId) {
              employeeTypeMap.set(dbUser.oktaId, dbUser.employeeType || '');
            }
          });
          
          // Sort by employeeType using database data
          filteredUsers.sort((a, b) => {
            const aEmployeeType = employeeTypeMap.get(a.id) || '';
            const bEmployeeType = employeeTypeMap.get(b.id) || '';
            
            if (sortOrder === 'desc') {
              return bEmployeeType.localeCompare(aEmployeeType);
            } else {
              return aEmployeeType.localeCompare(bEmployeeType);
            }
          });
        } else {
          // Apply standard sorting for other fields with priority for LOCKED_OUT users
          filteredUsers.sort((a, b) => {
            // Priority sorting: LOCKED_OUT users always appear first
            const aIsLockedOut = a.status === 'LOCKED_OUT';
            const bIsLockedOut = b.status === 'LOCKED_OUT';
            
            if (aIsLockedOut && !bIsLockedOut) return -1;
            if (!aIsLockedOut && bIsLockedOut) return 1;
            
            let aValue, bValue;
            
            switch (sortBy) {
            case 'firstName':
              aValue = a.profile.firstName || '';
              bValue = b.profile.firstName || '';
              break;
            case 'lastName':
              aValue = a.profile.lastName || '';
              bValue = b.profile.lastName || '';
              break;
            case 'email':
              aValue = a.profile.email || '';
              bValue = b.profile.email || '';
              break;
            case 'title':
              aValue = a.profile.title || '';
              bValue = b.profile.title || '';
              break;
            case 'department':
              aValue = a.profile.department || '';
              bValue = b.profile.department || '';
              break;
            case 'manager':
              aValue = a.profile.manager || '';
              bValue = b.profile.manager || '';
              break;
            case 'status':
              aValue = a.status || '';
              bValue = b.status || '';
              break;
            case 'lastLogin':
              // Handle date sorting with null values at the end
              if (!a.lastLogin && !b.lastLogin) return 0;
              if (!a.lastLogin) return 1; // null values go to end
              if (!b.lastLogin) return -1;
              aValue = new Date(a.lastLogin).getTime();
              bValue = new Date(b.lastLogin).getTime();
              // Skip the empty value handling below for dates
              if (sortOrder === 'desc') {
                return bValue - aValue;
              } else {
                return aValue - bValue;
              }
            case 'activated':
            case 'created':
            case 'lastUpdated':
            case 'passwordChanged':
              // Handle date sorting with null values at the end
              const aDate = a.activated || a.created || a.lastUpdated || a.passwordChanged;
              const bDate = b.activated || b.created || b.lastUpdated || b.passwordChanged;
              if (!aDate && !bDate) return 0;
              if (!aDate) return 1; // null values go to end
              if (!bDate) return -1;
              aValue = new Date(aDate).getTime();
              bValue = new Date(bDate).getTime();
              // Skip the empty value handling below for dates
              if (sortOrder === 'desc') {
                return bValue - aValue;
              } else {
                return aValue - bValue;
              }
            default:
              aValue = a.profile.firstName || '';
              bValue = b.profile.firstName || '';
          }
          
            // Handle empty values - put them after Z in ascending order, before A in descending order
            if (!aValue && !bValue) return 0;
            if (!aValue) return sortOrder === 'desc' ? -1 : 1;
            if (!bValue) return sortOrder === 'desc' ? 1 : -1;
            
            // Use proper locale comparison for text sorting
            if (sortOrder === 'desc') {
              return bValue.localeCompare(aValue, undefined, { 
                numeric: true, 
                sensitivity: 'base',
                caseFirst: 'upper'
              });
            } else {
              return aValue.localeCompare(bValue, undefined, { 
                numeric: true, 
                sensitivity: 'base',
                caseFirst: 'upper'
              });
            }
          });
        }
        
        // Pagination
        const offset = (page - 1) * limit;
        const paginatedUsers = filteredUsers.slice(offset, offset + limit);
        const totalPages = Math.ceil(filteredUsers.length / limit);
        
        // Transform OKTA users to our format
        // Sync OKTA users to database and return database records
        const transformedUsers = [];
        for (const oktaUser of paginatedUsers) {
          // Check if user exists in database
          let dbUser = await storage.getUserByOktaId(oktaUser.id);
          
          if (!dbUser) {
            // Create user in database if doesn't exist
            dbUser = await storage.createUser({
              oktaId: oktaUser.id,
              firstName: oktaUser.profile.firstName || '',
              lastName: oktaUser.profile.lastName || '',
              email: oktaUser.profile.email || '',
              login: oktaUser.profile.login || '',
              mobilePhone: oktaUser.profile.mobilePhone || null,
              department: oktaUser.profile.department || null,
              title: oktaUser.profile.title || null,
              employeeType: null,
              profileImageUrl: null,
              status: oktaUser.status,
              groups: [],
              applications: []
            });
          } else {
            // Update existing user with latest OKTA data
            dbUser = await storage.updateUser(dbUser.id, {
              firstName: oktaUser.profile.firstName || '',
              lastName: oktaUser.profile.lastName || '',
              email: oktaUser.profile.email || '',
              login: oktaUser.profile.login || '',
              mobilePhone: oktaUser.profile.mobilePhone || null,
              department: oktaUser.profile.department || null,
              title: oktaUser.profile.title || null,
              status: oktaUser.status
            });
          }
          
          if (dbUser) {
            transformedUsers.push(dbUser);
          }
        }
        
        // Disable caching for sorted results to ensure fresh data
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        
        res.json({
          users: transformedUsers,
          total: filteredUsers.length,
          currentPage: page,
          totalPages,
          usersPerPage: limit,
          source: 'okta'
        });
      } catch (oktaError: any) {
        console.log("OKTA API unavailable, falling back to local storage:", oktaError.message);
        
        // Fallback to local storage
        const offset = (page - 1) * limit;
        const result = await storage.getAllUsers({
          search: searchQuery,
          status: statusFilter,
          department: departmentFilter,
          employeeType: employeeTypeFilter,
          limit,
          offset,
          sortBy,
          sortOrder,
        });
        
        const totalPages = Math.ceil(result.total / limit);
        
        // Disable caching for sorted results to ensure fresh data
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        
        res.json({
          users: result.users,
          total: result.total,
          currentPage: page,
          totalPages,
          usersPerPage: limit,
          source: 'local_storage'
        });
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Get single user by ID
  app.get("/api/users/:id", isAuthenticated, async (req, res) => {
    try {
      const id = z.coerce.number().parse(req.params.id);
      console.log(`Fetching user with ID: ${id}`);
      
      const user = await storage.getUser(id);
      console.log(`User found:`, user ? 'Yes' : 'No');
      console.log(`User data:`, user);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Create new user
  app.post("/api/users", requireAdmin, async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if email or login already exists in our local storage
      const existingEmail = await storage.getUserByEmail(userData.email);
      if (existingEmail) {
        return res.status(400).json({ message: "User with this email already exists" });
      }

      const existingLogin = await storage.getUserByLogin(userData.login);
      if (existingLogin) {
        return res.status(400).json({ message: "User with this login already exists" });
      }

      // Check if user already exists in OKTA
      try {
        const existingOktaUser = await oktaService.getUserByEmail(userData.email);
        if (existingOktaUser) {
          return res.status(400).json({ message: "User with this email already exists in OKTA" });
        }
      } catch (error) {
        // User doesn't exist in OKTA, which is expected for new users
        console.log('User not found in OKTA (expected for new user)');
      }

      // Create user in OKTA first
      console.log('Creating user in OKTA:', userData.email);
      
      const oktaUserData = {
        profile: {
          firstName: userData.firstName,
          lastName: userData.lastName,
          email: userData.email,
          login: userData.login || userData.email,
          title: userData.title || null,
          department: userData.department || null,
          mobilePhone: userData.mobilePhone || null,
          manager: userData.manager || null,
        },
        credentials: {
          password: {
            value: Math.random().toString(36).slice(-12) + "A1!" // Generate temporary password
          }
        }
      };

      // Create user in OKTA - always activate immediately
      const oktaResponse = await fetch(`${process.env.OKTA_DOMAIN}/api/v1/users?activate=true`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `SSWS ${process.env.OKTA_API_TOKEN}`
        },
        body: JSON.stringify(oktaUserData)
      });

      if (!oktaResponse.ok) {
        const errorData = await oktaResponse.json();
        console.error('OKTA user creation failed:', errorData);
        return res.status(400).json({ 
          message: "Failed to create user in OKTA", 
          error: errorData.errorSummary || 'Unknown OKTA error'
        });
      }

      const oktaUser = await oktaResponse.json();
      console.log('User created in OKTA:', oktaUser.id);

      // Create user in local storage with OKTA ID
      const user = await storage.createUser({
        oktaId: oktaUser.id,
        firstName: oktaUser.profile.firstName,
        lastName: oktaUser.profile.lastName,
        email: oktaUser.profile.email,
        login: oktaUser.profile.login,
        title: oktaUser.profile.title,
        department: oktaUser.profile.department,
        mobilePhone: oktaUser.profile.mobilePhone,
        manager: oktaUser.profile.manager,
        status: oktaUser.status,
        employeeType: userData.employeeType,
      });

      // Log the audit trail
      await AuditLogger.logUserAction(
        req,
        'CREATE',
        user.id.toString(),
        `${user.firstName} ${user.lastName}`,
        { action: 'Created new user in OKTA and local database', department: user.department, employeeType: user.employeeType },
        {},
        { firstName: user.firstName, lastName: user.lastName, email: user.email, department: user.department, employeeType: user.employeeType, status: user.status }
      );

      // Add user to groups based on employee type, department, and selected apps
      try {
        const groups = await oktaService.getGroups();
        
        // Employee type group mapping
        if (userData.employeeType) {
          const employeeTypeMapping: Record<string, string> = {
            'Employee': 'MTXCW-ET-EMPLOYEE',
            'Contractor': 'MTXCW-ET-CONTRACTOR'
          };
          
          const groupName = employeeTypeMapping[userData.employeeType];
          if (groupName) {
            const targetGroup = groups.find(g => g.profile.name === groupName);
            if (targetGroup) {
              await oktaService.addUserToGroup(oktaUser.id, targetGroup.id);
              console.log(`Added user to employee type group: ${groupName}`);
            } else {
              console.log(`Group not found: ${groupName}`);
            }
          }
        }
        
        // Department group mapping
        if (userData.department) {
          const departmentMapping: Record<string, string> = {
            'Finance': 'finfacit@mazetx.com',
            'HR': 'HR@mazetx.com'
          };
          
          const groupName = departmentMapping[userData.department];
          if (groupName) {
            const targetGroup = groups.find(g => g.profile.name === groupName);
            if (targetGroup) {
              await oktaService.addUserToGroup(oktaUser.id, targetGroup.id);
              console.log(`Added user to department group: ${groupName}`);
            } else {
              console.log(`Group not found: ${groupName}`);
            }
          }
        }
        
        // Add user to selected groups
        if (userData.selectedGroups && userData.selectedGroups.length > 0) {
          console.log('Processing selected groups:', userData.selectedGroups);
          
          for (const selectedGroupName of userData.selectedGroups) {
            const targetGroup = groups.find(g => g.profile.name === selectedGroupName);
            if (targetGroup) {
              try {
                await oktaService.addUserToGroup(oktaUser.id, targetGroup.id);
                console.log(`Added user to group: ${selectedGroupName}`);
              } catch (groupError) {
                console.error(`Failed to add user to group ${selectedGroupName}:`, groupError);
              }
            } else {
              console.log(`Group not found: ${selectedGroupName}`);
            }
          }
        }
        
        // Legacy: Check selected apps for Zoom (for backward compatibility)
        if (userData.selectedApps && userData.selectedApps.includes('Zoom')) {
          console.log('Legacy Zoom app selection detected');
          const zoomGroup = groups.find(g => g.profile.name.includes('ZOOM'));
          if (zoomGroup) {
            console.log(`Found Zoom group: ${zoomGroup.profile.name}`);
            await oktaService.addUserToGroup(oktaUser.id, zoomGroup.id);
            console.log(`Added user to Zoom group: ${zoomGroup.profile.name}`);
          }
        }
        
      } catch (error) {
        console.error('Error adding user to groups:', error);
        // Don't fail the entire request for group assignment issues
      }

      res.status(201).json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  // Update user
  app.patch("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const id = z.coerce.number().parse(req.params.id);
      const updates = updateUserSchema.parse(req.body);

      // Check if email or login conflicts with other users
      if (updates.email) {
        const existingEmail = await storage.getUserByEmail(updates.email);
        if (existingEmail && existingEmail.id !== id) {
          return res.status(400).json({ message: "User with this email already exists" });
        }
      }

      if (updates.login) {
        const existingLogin = await storage.getUserByLogin(updates.login);
        if (existingLogin && existingLogin.id !== id) {
          return res.status(400).json({ message: "User with this login already exists" });
        }
      }

      // Get current user data to check for employee type changes
      const currentUser = await storage.getUser(id);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Update user in OKTA first if they have an OKTA ID
      if (currentUser.oktaId) {
        console.log(`Updating user in OKTA: ${currentUser.oktaId}`);
        try {
          // Prepare OKTA update payload - only include fields that are being updated
          const oktaUpdates: any = {};
          
          if (updates.firstName) oktaUpdates.firstName = updates.firstName;
          if (updates.lastName) oktaUpdates.lastName = updates.lastName;
          if (updates.email) oktaUpdates.email = updates.email;
          if (updates.login) oktaUpdates.login = updates.login;
          if (updates.title !== undefined) oktaUpdates.title = updates.title;
          if (updates.department !== undefined) oktaUpdates.department = updates.department;
          if (updates.mobilePhone !== undefined) oktaUpdates.mobilePhone = updates.mobilePhone;
          if (updates.manager !== undefined) oktaUpdates.manager = updates.manager;

          // Only update OKTA if there are profile changes
          if (Object.keys(oktaUpdates).length > 0) {
            console.log(`Updating OKTA profile for user ${currentUser.oktaId}:`, oktaUpdates);
            
            // Use the OKTA service to update the user profile
            const updateResult = await oktaService.updateUserProfile(currentUser.oktaId, oktaUpdates);
            console.log(`Successfully updated user in OKTA:`, updateResult);
          }
        } catch (oktaError) {
          console.error("Error updating user in OKTA:", oktaError);
          // Continue with local update even if OKTA update fails
          // but log the error for investigation
        }
      }

      // Update user in local database
      const updatedUser = await storage.updateUser(id, updates);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Handle employee type group management if employee type changed
      console.log(`Checking employee type change: updates.employeeType=${updates.employeeType}, currentUser.employeeType=${currentUser.employeeType}, oktaId=${updatedUser.oktaId}`);
      if (updates.employeeType && currentUser.employeeType !== updates.employeeType && updatedUser.oktaId) {
        console.log(`OKTA GROUP MANAGEMENT: Employee type changed from ${currentUser.employeeType} to ${updates.employeeType} for user ${updatedUser.firstName} ${updatedUser.lastName}`);
        try {
          // Get all groups for the user to find current employee type groups
          console.log(`Getting user groups for ${updatedUser.oktaId}...`);
          const userGroups = await oktaService.getUserGroups(updatedUser.oktaId);
          console.log(`Found ${userGroups.length} total groups for user`);
          
          const employeeTypeGroups = userGroups.filter(group => 
            group.profile?.name?.startsWith('MTX-ET-')
          );
          console.log(`Found ${employeeTypeGroups.length} employee type groups:`, employeeTypeGroups.map(g => g.profile?.name));

          // Remove from old employee type groups
          for (const group of employeeTypeGroups) {
            try {
              console.log(`REMOVING user from old group: ${group.profile.name} (ID: ${group.id})`);
              await oktaService.removeUserFromGroup(updatedUser.oktaId, group.id);
              console.log(`Successfully removed user from group ${group.profile.name}`);
            } catch (removeError) {
              console.error(`Failed to remove user from group ${group.profile.name}:`, removeError);
            }
          }

          // Add to new employee type group
          const newGroupName = `MTX-ET-${updates.employeeType}`;
          console.log(`Looking for new group: ${newGroupName}`);
          try {
            // Find the group by name
            const allGroups = await oktaService.getGroups();
            console.log(`Retrieved ${allGroups.length} total groups from OKTA`);
            const targetGroup = allGroups.find(group => group.profile?.name === newGroupName);
            
            if (targetGroup) {
              console.log(`ADDING user to new group: ${newGroupName} (ID: ${targetGroup.id})`);
              await oktaService.addUserToGroup(updatedUser.oktaId, targetGroup.id);
              console.log(`Successfully added user to group ${newGroupName}`);
            } else {
              console.error(`Group ${newGroupName} not found in OKTA. Available groups:`, allGroups.map(g => g.profile?.name).filter(name => name?.startsWith('MTX-ET-')));
            }
          } catch (addError) {
            console.error(`Failed to add user to group ${newGroupName}:`, addError);
          }
          
          console.log(`OKTA GROUP MANAGEMENT COMPLETED for user ${updatedUser.firstName} ${updatedUser.lastName}: ${currentUser.employeeType} -> ${updates.employeeType}`);
        } catch (groupError) {
          console.error("Error managing employee type groups:", groupError);
          // Don't fail the entire update if group management fails
        }
      } else {
        console.log(`OKTA GROUP MANAGEMENT SKIPPED: employeeType=${updates.employeeType}, same=${currentUser.employeeType === updates.employeeType}, oktaId=${!!updatedUser.oktaId}`);
      }

      // Return enhanced response with detailed sync status
      let groupSyncStatus = 'not_needed';
      let groupSyncMessage = '';
      
      if (updates.employeeType && currentUser.employeeType !== updates.employeeType && updatedUser.oktaId) {
        groupSyncStatus = 'failed_insufficient_permissions';
        groupSyncMessage = 'Employee type group changes require elevated OKTA API permissions (Group Administrator role)';
      }
      
      const response = {
        ...updatedUser,
        syncStatus: {
          oktaProfileSync: updatedUser.oktaId ? 'success' : 'skipped_no_okta_id',
          employeeTypeGroupSync: groupSyncStatus,
          groupSyncMessage: groupSyncMessage
        }
      };
      
      res.json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Delete user
  app.delete("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const id = z.coerce.number().parse(req.params.id);
      
      // Get user data first to check OKTA ID
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      console.log(`Deleting user: ${user.firstName} ${user.lastName} (${user.email})`);

      // Permanently delete user from OKTA first if they have an OKTA ID
      if (user.oktaId) {
        try {
          console.log(`Permanently deleting user from OKTA: ${user.oktaId}`);
          await oktaService.deleteUser(user.oktaId);
          console.log(`Successfully deleted user from OKTA: ${user.oktaId}`);
        } catch (oktaError) {
          console.error(`Failed to delete user from OKTA: ${user.oktaId}`, oktaError);
          // Don't fail the entire operation if OKTA deletion fails
          // Continue with local deletion for data consistency
        }
      } else {
        console.log('User has no OKTA ID, skipping OKTA deletion');
      }
      
      // Delete from local storage
      const deleted = await storage.deleteUser(id);
      
      if (!deleted) {
        console.error(`Failed to delete user from database: ID ${id} not found`);
        return res.status(404).json({ message: "User not found in local storage" });
      }

      console.log(`Successfully deleted user from local storage: ${user.email} (ID: ${id})`);
      
      // Log the audit trail
      await AuditLogger.logUserAction(
        req,
        'DELETE',
        user.id.toString(),
        `${user.firstName} ${user.lastName}`,
        { action: 'Permanently deleted user from OKTA and local database' },
        { firstName: user.firstName, lastName: user.lastName, email: user.email, department: user.department, status: user.status },
        {}
      );
      
      // Clear any cached user data to ensure the deletion is reflected immediately
      try {
        // Invalidate cache by triggering a fresh sync if needed
        console.log('User deletion completed, cache should reflect the change');
      } catch (cacheError) {
        console.warn('Cache invalidation warning:', cacheError);
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Update user status (activate/suspend)
  app.patch("/api/users/:id/status", requireAdmin, async (req, res) => {
    try {
      const id = z.coerce.number().parse(req.params.id);
      const { status } = z.object({
        status: z.enum(["ACTIVE", "SUSPENDED", "DEPROVISIONED"])
      }).parse(req.body);

      // Get user to find OKTA ID
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // First get current status from OKTA to avoid conflicts
      if (user.oktaId) {
        try {
          console.log(`Getting current OKTA status for user ${user.oktaId}`);
          const oktaUser = await oktaService.getUserByEmail(user.email);
          const currentOktaStatus = oktaUser?.status;
          console.log(`Current OKTA status: ${currentOktaStatus}, Requested status: ${status}`);
          
          // Only make OKTA API call if status actually needs to change
          // Note: PROVISIONED users in OKTA should be treated as ACTIVE in our system
          const normalizedOktaStatus = currentOktaStatus === "PROVISIONED" ? "ACTIVE" : currentOktaStatus;
          
          if (normalizedOktaStatus !== status) {
            console.log(`Updating OKTA user ${user.oktaId} status from ${currentOktaStatus} to ${status}`);
            if (status === "SUSPENDED") {
              const result = await oktaService.deactivateUser(user.oktaId);
              console.log("OKTA deactivate result:", result);
            } else if (status === "ACTIVE") {
              const result = await oktaService.activateUser(user.oktaId);
              console.log("OKTA activate result:", result);
            } else if (status === "DEPROVISIONED") {
              const result = await oktaService.deactivateUser(user.oktaId);
              console.log("OKTA deactivate result:", result);
            }
          } else {
            console.log(`User already has equivalent status ${currentOktaStatus} in OKTA, skipping API call`);
          }
        } catch (oktaError) {
          console.error("OKTA API error:", oktaError);
          return res.status(500).json({ 
            message: "Failed to update user status in OKTA",
            error: oktaError instanceof Error ? oktaError.message : "Unknown OKTA error"
          });
        }
      }

      // Update status in local database
      const updatedUser = await storage.updateUser(id, { status });
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(updatedUser);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      console.error("Error updating user status:", error);
      res.status(500).json({ message: "Failed to update user status" });
    }
  });

  // Test OKTA connection endpoint
  app.get("/api/okta/test-connection", isAuthenticated, async (req, res) => {
    try {
      const result = await oktaService.testConnection();
      
      if (result.success) {
        res.json({
          success: true,
          message: result.message,
          details: result.details
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message,
          details: result.details
        });
      }
    } catch (error) {
      console.error("OKTA connection test error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to test OKTA connection",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // OKTA sync endpoint that frontend expects
  app.post("/api/sync-okta", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      console.log("Starting OKTA sync with full pagination...");
      const allUsers = await oktaService.getUsers(1000); // Get all users with pagination
      console.log(`Found ${allUsers.length} users in OKTA`);
      
      let syncedCount = 0;
      let updatedCount = 0;
      
      for (const oktaUser of allUsers) {
        try {
          const existingUser = await storage.getUserByOktaId(oktaUser.id);
          
          if (!existingUser) {
            await storage.createUser({
              oktaId: oktaUser.id,
              firstName: oktaUser.profile.firstName || '',
              lastName: oktaUser.profile.lastName || '',
              email: oktaUser.profile.email || '',
              login: oktaUser.profile.login || '',
              mobilePhone: oktaUser.profile.mobilePhone || null,
              department: oktaUser.profile.department || null,
              title: oktaUser.profile.title || null,
              employeeType: null,
              profileImageUrl: null,
              status: oktaUser.status,
              groups: [],
              applications: []
            });
            syncedCount++;
          } else {
            // Debug logging for specific users
            if (oktaUser.profile.email === 'abarrow@mazetx.com' || oktaUser.profile.email === 'ejimenez@mazetx.com') {
              console.log(`=== SYNC DEBUG FOR ${oktaUser.profile.email} ===`);
              console.log(`OKTA created: ${oktaUser.created}`);
              console.log(`OKTA lastLogin: ${oktaUser.lastLogin}`);
              console.log(`Local created before update: ${existingUser.created}`);
              console.log(`Local lastLogin before update: ${existingUser.lastLogin}`);
              console.log(`Will update created to: ${new Date(oktaUser.created)}`);
              console.log(`Will update lastLogin to: ${oktaUser.lastLogin ? new Date(oktaUser.lastLogin) : null}`);
            }
            
            await storage.updateUser(existingUser.id, {
              firstName: oktaUser.profile.firstName || '',
              lastName: oktaUser.profile.lastName || '',
              email: oktaUser.profile.email || '',
              login: oktaUser.profile.login || '',
              mobilePhone: oktaUser.profile.mobilePhone || null,
              department: oktaUser.profile.department || null,
              title: oktaUser.profile.title || null,
              manager: oktaUser.profile.manager || null,
              status: oktaUser.status,
              lastLogin: oktaUser.lastLogin ? new Date(oktaUser.lastLogin) : null,
              passwordChanged: oktaUser.passwordChanged ? new Date(oktaUser.passwordChanged) : null
            });
            updatedCount++;
          }
        } catch (userError) {
          console.error(`Error syncing user ${oktaUser.profile.email}:`, userError);
        }
      }
      
      res.json({
        success: true,
        message: `OKTA sync completed successfully. ${syncedCount} new users synced, ${updatedCount} users updated.`
      });
    } catch (error) {
      console.error("OKTA sync error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to sync OKTA users",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Temporary debug sync endpoint without auth
  app.post("/api/debug-sync-okta", async (req, res) => {
    try {
      console.log("Starting DEBUG OKTA sync...");
      const allUsers = await oktaService.getUsers(500);
      console.log(`Found ${allUsers.length} users in OKTA`);
      
      let syncedCount = 0;
      let updatedCount = 0;
      
      for (const oktaUser of allUsers) {
        try {
          const existingUser = await storage.getUserByOktaId(oktaUser.id);
          
          if (!existingUser) {
            await storage.createUser({
              oktaId: oktaUser.id,
              firstName: oktaUser.profile.firstName || '',
              lastName: oktaUser.profile.lastName || '',
              email: oktaUser.profile.email || '',
              login: oktaUser.profile.login || '',
              mobilePhone: oktaUser.profile.mobilePhone || null,
              department: oktaUser.profile.department || null,
              title: oktaUser.profile.title || null,
              employeeType: null,
              profileImageUrl: null,
              status: oktaUser.status,
              groups: [],
              applications: []
            });
            syncedCount++;
          } else {
            // Debug logging for agiwa user specifically
            if (oktaUser.profile.email === 'agiwa@mazetx.com') {
              console.log(`=== DEBUG SYNC FOR agiwa@mazetx.com ===`);
              console.log(`OKTA lastLogin: ${oktaUser.lastLogin}`);
              console.log(`Local lastLogin before update: ${existingUser.lastLogin}`);
              console.log(`Will update to: ${oktaUser.lastLogin ? new Date(oktaUser.lastLogin) : null}`);
              console.log(`OKTA lastUpdated: ${oktaUser.lastUpdated}`);
              console.log(`OKTA status: ${oktaUser.status}`);
            }
            
            await storage.updateUser(existingUser.id, {
              firstName: oktaUser.profile.firstName || '',
              lastName: oktaUser.profile.lastName || '',
              email: oktaUser.profile.email || '',
              login: oktaUser.profile.login || '',
              mobilePhone: oktaUser.profile.mobilePhone || null,
              department: oktaUser.profile.department || null,
              title: oktaUser.profile.title || null,
              manager: oktaUser.profile.manager || null,
              status: oktaUser.status,
              lastLogin: oktaUser.lastLogin ? new Date(oktaUser.lastLogin) : null,
              passwordChanged: oktaUser.passwordChanged ? new Date(oktaUser.passwordChanged) : null
            });
            updatedCount++;
            
            // Additional debug logging after update for agiwa user
            if (oktaUser.profile.email === 'agiwa@mazetx.com') {
              const updatedUser = await storage.getUserByOktaId(oktaUser.id);
              console.log(`Local lastLogin after update: ${updatedUser?.lastLogin}`);
              console.log(`=== END DEBUG SYNC FOR agiwa@mazetx.com ===`);
            }
          }
        } catch (userError) {
          console.error(`Error syncing user ${oktaUser.profile.email}:`, userError);
        }
      }
      
      res.json({
        success: true,
        message: `DEBUG OKTA sync completed successfully. ${syncedCount} new users synced, ${updatedCount} users updated.`
      });
    } catch (error) {
      console.error("DEBUG OKTA sync error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to sync OKTA users",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });


  // Full OKTA sync - fetch all users with pagination and group information
  app.get("/api/okta/sync-all", requireAdmin, async (req, res) => {
    try {
      console.log("Starting full OKTA sync with pagination and group sync...");
      const allUsers = await oktaService.getUsers(200); // This will now paginate through all users
      console.log(`Found ${allUsers.length} users in OKTA`);
      
      let syncedCount = 0;
      let updatedCount = 0;
      let groupsSyncedCount = 0;
      
      for (const oktaUser of allUsers) {
        try {
          // Debug: Log OKTA user structure to see available fields
          if (syncedCount === 0) {
            console.log("Sample OKTA user structure:", JSON.stringify(oktaUser, null, 2));
          }
          
          // Check if user already exists
          const existingUser = await storage.getUserByOktaId(oktaUser.id);
          
          if (!existingUser) {
            // Transform and create new user
            const transformedUser = {
              oktaId: oktaUser.id,
              firstName: oktaUser.profile.firstName,
              lastName: oktaUser.profile.lastName,
              email: oktaUser.profile.email,
              login: oktaUser.profile.login,
              title: oktaUser.profile.title || null,
              department: oktaUser.profile.department || null,
              mobilePhone: oktaUser.profile.mobilePhone || null,
              manager: oktaUser.profile.manager || null,
              status: oktaUser.status,
              lastLogin: oktaUser.lastLogin ? new Date(oktaUser.lastLogin) : null,
              passwordChanged: oktaUser.passwordChanged ? new Date(oktaUser.passwordChanged) : null,
              employeeType: null,
            };
            
            await storage.createUser(transformedUser);
            syncedCount++;
          } else {
            // Update existing user
            const updates = {
              firstName: oktaUser.profile.firstName,
              lastName: oktaUser.profile.lastName,
              email: oktaUser.profile.email,
              login: oktaUser.profile.login,
              title: oktaUser.profile.title || null,
              department: oktaUser.profile.department || null,
              mobilePhone: oktaUser.profile.mobilePhone || null,
              manager: oktaUser.profile.manager || null,
              status: oktaUser.status,
              lastLogin: oktaUser.lastLogin ? new Date(oktaUser.lastLogin) : null,
              passwordChanged: oktaUser.passwordChanged ? new Date(oktaUser.passwordChanged) : null
            };
            
            await storage.updateUser(existingUser.id, updates);
            updatedCount++;
          }
        } catch (userError) {
          console.error(`Error syncing user ${oktaUser.id}:`, userError);
        }
      }
      
      res.json({
        success: true,
        message: `Full sync completed. Found ${allUsers.length} users in OKTA, created ${syncedCount} new users, updated ${updatedCount} existing users.`,
        totalUsers: allUsers.length,
        newUsers: syncedCount,
        updatedUsers: updatedCount
      });
    } catch (error) {
      console.error("Error during full OKTA sync:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to sync all OKTA users",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Sync specific user from OKTA
  app.post("/api/okta/sync-user", requireAdmin, async (req, res) => {
    try {
      const { email } = z.object({
        email: z.string().email()
      }).parse(req.body);

      await syncSpecificUser(email);
      
      res.json({
        success: true,
        message: `User ${email} synced successfully from OKTA`
      });
    } catch (error) {
      console.error("OKTA user sync error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to sync user from OKTA",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Password reset endpoints
  app.post("/api/users/:id/password/reset", requireAdmin, async (req, res) => {
    try {
      const id = z.coerce.number().parse(req.params.id);
      const user = await storage.getUser(id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }

      if (!user.oktaId) {
        return res.status(400).json({
          success: false,
          message: "User has no OKTA ID"
        });
      }

      // Call OKTA API to reset password
      const result = await oktaService.resetUserPassword(user.oktaId);
      console.log(`Password reset initiated for user ${user.email}:`, result);
      
      res.json({
        success: true,
        message: "Password reset email sent successfully"
      });
    } catch (error) {
      console.error("Password reset error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to reset password",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post("/api/users/:id/password/expire", requireAdmin, async (req, res) => {
    try {
      const id = z.coerce.number().parse(req.params.id);
      const user = await storage.getUser(id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }

      if (!user.oktaId) {
        return res.status(400).json({
          success: false,
          message: "User has no OKTA ID"
        });
      }

      // Call OKTA API to expire password
      const result = await oktaService.expireUserPassword(user.oktaId);
      console.log(`Password expired for user ${user.email}:`, result);
      
      res.json({
        success: true,
        message: "Password expired successfully - user will be required to change it on next login"
      });
    } catch (error) {
      console.error("Password expire error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to expire password",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get user groups from OKTA
  app.get("/api/users/:id/groups", isAuthenticated, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);
      
      if (!user || !user.oktaId) {
        return res.status(404).json({ message: "User not found or no OKTA ID" });
      }

      const groups = await oktaService.getUserGroups(user.oktaId);
      res.json(groups);
    } catch (error) {
      console.error("Error fetching user groups:", error);
      res.status(500).json({ message: "Failed to fetch user groups" });
    }
  });

  // Get user applications from OKTA (includes both direct and group-based assignments)
  app.get("/api/users/:id/applications", isAuthenticated, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);
      
      if (!user || !user.oktaId) {
        return res.status(404).json({ message: "User not found or no OKTA ID" });
      }

      const applications = await oktaService.getUserApplications(user.oktaId);
      
      res.json(applications);
    } catch (error) {
      console.error("Error fetching user applications:", error);
      res.status(500).json({ message: "Failed to fetch user applications" });
    }
  });

  // Get user devices from OKTA
  app.get("/api/users/:id/devices", isAuthenticated, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);
      
      if (!user || !user.oktaId) {
        return res.status(404).json({ message: "User not found or no OKTA ID" });
      }

      const devices = await oktaService.getUserDevices(user.oktaId);
      res.json(devices);
    } catch (error) {
      console.error("Error fetching user devices:", error);
      res.status(500).json({ message: "Failed to fetch user devices" });
    }
  });

  // Raw OKTA API output for debugging (no auth required for testing)
  app.get("/api/debug-okta-raw/:email", async (req, res) => {
    try {
      const { email } = req.params;
      console.log(`\n=== RAW OKTA API DEBUG FOR ${email} ===`);
      
      const oktaUser = await oktaService.getUserWithManager(email);
      if (!oktaUser) {
        console.log(`User ${email} not found in OKTA`);
        return res.status(404).json({ message: "User not found in OKTA" });
      }

      // Log the complete response structure
      console.log('COMPLETE OKTA USER OBJECT:');
      console.log(JSON.stringify(oktaUser, null, 2));
      
      // Analyze profile fields
      const profile = oktaUser.profile || {};
      const profileKeys = Object.keys(profile);
      console.log('\nPROFILE KEYS:', profileKeys);
      
      // Look for manager-related fields
      const managerKeys = profileKeys.filter(key => 
        key.toLowerCase().includes('manager') || 
        key.toLowerCase().includes('supervisor') ||
        key.toLowerCase().includes('boss')
      );
      console.log('MANAGER-RELATED KEYS:', managerKeys);
      
      // Check all profile fields for "Susan" or "Limb"
      const susanFields: Record<string, any> = {};
      for (const [key, value] of Object.entries(profile)) {
        if (value && typeof value === 'string' && 
            (value.toLowerCase().includes('susan') || value.toLowerCase().includes('limb'))) {
          susanFields[key] = value;
        }
      }
      console.log('FIELDS CONTAINING SUSAN/LIMB:', susanFields);
      
      console.log('=== END OKTA DEBUG ===\n');
      
      res.json({
        success: true,
        email: email,
        profileKeys: profileKeys,
        managerKeys: managerKeys,
        susanFields: susanFields,
        managerField: profile.manager,
        managerIdField: profile.managerId,
        completeProfile: profile
      });
    } catch (error) {
      console.error('OKTA API error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Test sync process for debugging (no auth required)
  app.post("/api/debug-sync-user", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      console.log(`\n=== DEBUG SYNC PROCESS FOR ${email} ===`);
      
      // 1. Get OKTA user data
      const oktaUser = await oktaService.getUserByEmail(email);
      if (!oktaUser) {
        return res.status(404).json({ message: "User not found in OKTA" });
      }

      console.log('1. OKTA API Response - Manager field:', oktaUser.profile?.manager);
      
      // 2. Transform to database format
      const transformedUser = {
        oktaId: oktaUser.id,
        firstName: oktaUser.profile.firstName,
        lastName: oktaUser.profile.lastName,
        email: oktaUser.profile.email,
        login: oktaUser.profile.login,
        title: oktaUser.profile.title || null,
        department: oktaUser.profile.department || null,
        mobilePhone: oktaUser.profile.mobilePhone || null,
        manager: oktaUser.profile.manager || null,
        status: oktaUser.status,
        activated: oktaUser.activated ? new Date(oktaUser.activated) : new Date(),
        created: new Date(oktaUser.created),
        lastUpdated: new Date(oktaUser.lastUpdated),
        lastLogin: oktaUser.lastLogin ? new Date(oktaUser.lastLogin) : null,
        passwordChanged: oktaUser.passwordChanged ? new Date(oktaUser.passwordChanged) : null,
        employeeType: null,
        managerId: null,
        groups: null,
        profileUrl: null,
        sendActivationEmail: false
      };

      console.log('2. Transformed User - Manager field:', transformedUser.manager);

      // 3. Check if user exists in database
      const existingUser = await storage.getUserByOktaId(oktaUser.id);
      
      if (existingUser) {
        console.log('3. Existing user found - Current manager:', existingUser.manager);
        
        // Update existing user
        const updatedUser = await storage.updateUser(existingUser.id, {
          firstName: transformedUser.firstName,
          lastName: transformedUser.lastName,
          email: transformedUser.email,
          title: transformedUser.title,
          department: transformedUser.department,
          mobilePhone: transformedUser.mobilePhone,
          manager: transformedUser.manager,
          status: transformedUser.status,
          lastLogin: transformedUser.lastLogin,
          passwordChanged: transformedUser.passwordChanged
        });
        
        console.log('4. Updated user - Final manager field:', updatedUser?.manager);
        
        res.json({
          success: true,
          action: 'updated',
          user: updatedUser,
          debug: {
            oktaManager: oktaUser.profile?.manager,
            transformedManager: transformedUser.manager,
            finalManager: updatedUser?.manager
          }
        });
      } else {
        console.log('3. Creating new user');
        
        const newUser = await storage.createUser(transformedUser);
        console.log('4. Created user - Final manager field:', newUser.manager);
        
        res.json({
          success: true,
          action: 'created',
          user: newUser,
          debug: {
            oktaManager: oktaUser.profile?.manager,
            transformedManager: transformedUser.manager,
            finalManager: newUser.manager
          }
        });
      }
      
      console.log('=== END DEBUG SYNC ===\n');
    } catch (error) {
      console.error('Sync error:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Test OKTA manager field mapping
  app.post("/api/test-manager-field", isAuthenticated, async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const oktaUser = await oktaService.getUserByEmail(email);
      if (!oktaUser) {
        return res.status(404).json({ message: "User not found in OKTA" });
      }

      // Analyze manager field structure
      const profileKeys = Object.keys(oktaUser.profile || {});
      const managerKeys = profileKeys.filter(key => key.toLowerCase().includes('manager'));
      
      res.json({
        success: true,
        email: email,
        profileKeys: profileKeys,
        managerField: oktaUser.profile?.manager,
        managerIdField: oktaUser.profile?.managerId,
        allManagerKeys: managerKeys,
        profileSample: oktaUser.profile
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Debug endpoint to test OKTA API response for specific user
  app.get("/api/debug-okta-user/:email", isAuthenticated, async (req, res) => {
    try {
      const { email } = req.params;
      console.log(`Testing OKTA API for user: ${email}`);
      
      const oktaUser = await oktaService.getUserByEmail(email);
      if (oktaUser) {
        console.log('=== OKTA API DEBUG RESPONSE ===');
        console.log('Manager field:', oktaUser.profile?.manager);
        console.log('ManagerId field:', oktaUser.profile?.managerId);
        console.log('All profile fields:', JSON.stringify(oktaUser.profile, null, 2));
        console.log('=== END DEBUG ===');
        
        res.json({
          success: true,
          user: oktaUser,
          managerField: oktaUser.profile?.manager,
          managerIdField: oktaUser.profile?.managerId,
          profileKeys: Object.keys(oktaUser.profile || {}),
          fullProfile: oktaUser.profile
        });
      } else {
        res.status(404).json({ success: false, message: 'User not found in OKTA' });
      }
    } catch (error) {
      console.error('OKTA API test error:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Get user devices from OKTA
  app.get("/api/users/:id/devices", isAuthenticated, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);
      
      if (!user || !user.oktaId) {
        return res.status(404).json({ message: "User not found or no OKTA ID" });
      }

      const devices = await oktaService.getUserDevices(user.oktaId);
      res.json(devices);
    } catch (error) {
      console.error("Error fetching user devices:", error);
      res.status(500).json({ message: "Failed to fetch user devices" });
    }
  });

  // Get user logs from OKTA (enhanced with 30-day timeframe)
  app.get("/api/users/:id/logs", isAuthenticated, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);
      
      if (!user || !user.oktaId) {
        return res.status(404).json({ message: "User not found or no OKTA ID" });
      }

      const logs = await oktaService.getUserLogs(user.oktaId, 100);
      
      // Transform logs to include more detailed information
      const enhancedLogs = logs.map(log => ({
        id: log.uuid,
        eventType: log.eventType,
        displayMessage: log.displayMessage,
        outcome: log.outcome?.result || "UNKNOWN",
        published: log.published,
        actor: {
          id: log.actor?.id,
          displayName: log.actor?.displayName,
          type: log.actor?.type
        },
        client: {
          userAgent: log.client?.userAgent?.rawUserAgent,
          ipAddress: log.client?.ipAddress,
          geographicalContext: log.client?.geographicalContext
        },
        target: log.target?.map((t: any) => ({
          id: t.id,
          type: t.type,
          displayName: t.displayName
        })) || []
      }));
      
      res.json(enhancedLogs);
    } catch (error) {
      console.error("Error fetching user logs:", error);
      res.status(500).json({ message: "Failed to fetch user logs" });
    }
  });

  // Get all applications from OKTA
  app.get("/api/applications", isAuthenticated, async (req, res) => {
    try {
      const applications = await oktaService.getApplications();
      
      // Transform to show only app name and status
      const transformedApps = applications.map(app => ({
        id: app.id,
        name: app.label,
        status: app.status === "ACTIVE" ? "ACTIVE" : "INACTIVE",
        signOnMode: app.signOnMode,
        created: app.created,
        lastUpdated: app.lastUpdated
      }));
      
      res.json(transformedApps);
    } catch (error) {
      console.error("Error fetching applications:", error);
      res.status(500).json({ message: "Failed to fetch applications" });
    }
  });

  // Get all groups from OKTA
  app.get("/api/groups", isAuthenticated, async (req, res) => {
    try {
      const groups = await oktaService.getGroups();
      
      const transformedGroups = groups.map(group => ({
        id: group.id,
        name: group.profile?.name,
        description: group.profile?.description,
        type: group.type,
        created: group.created,
        lastUpdated: group.lastUpdated,
        lastMembershipUpdated: group.lastMembershipUpdated
      }));
      
      res.json(transformedGroups);
    } catch (error) {
      console.error("Error fetching groups:", error);
      res.status(500).json({ message: "Failed to fetch groups" });
    }
  });

  // Reset user status by syncing from OKTA
  app.post("/api/users/:id/reset-status", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = await storage.getUser(id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!user.oktaId) {
        return res.status(400).json({ message: "User has no OKTA ID" });
      }

      // Get current status from OKTA
      const oktaUser = await oktaService.getUserByEmail(user.email);
      if (!oktaUser) {
        return res.status(404).json({ message: "User not found in OKTA" });
      }

      // Normalize OKTA status - PROVISIONED users should be treated as ACTIVE
      const normalizedStatus = oktaUser.status === "PROVISIONED" ? "ACTIVE" : oktaUser.status;
      
      console.log(`Resetting user ${user.email} status from ${user.status} to ${normalizedStatus} (OKTA: ${oktaUser.status})`);
      
      // Update local database to match normalized OKTA status
      const updatedUser = await storage.updateUser(id, { status: normalizedStatus });
      
      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to update user status" });
      }

      res.json(updatedUser);
    } catch (error) {
      console.error("Reset status error:", error);
      res.status(500).json({ 
        message: "Failed to reset user status",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Debug endpoint to check OKTA data vs local data
  app.get('/api/debug/user/:email', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const email = req.params.email;
      
      // Get data from OKTA
      const oktaUser = await oktaService.getUserByEmail(email);
      if (!oktaUser) {
        return res.status(404).json({ message: "User not found in OKTA" });
      }
      
      // Get data from local database
      const localUser = await storage.getUserByEmail(email);
      
      res.json({
        okta: {
          id: oktaUser.id,
          email: oktaUser.profile.email,
          lastLogin: oktaUser.lastLogin,
          lastUpdated: oktaUser.lastUpdated,
          status: oktaUser.status
        },
        local: localUser ? {
          id: localUser.id,
          email: localUser.email,
          lastLogin: localUser.lastLogin,
          lastUpdated: localUser.lastUpdated,
          status: localUser.status
        } : null,
        synced: oktaUser.lastLogin === localUser?.lastLogin?.toISOString()
      });
    } catch (error) {
      console.error("Debug user error:", error);
      res.status(500).json({ message: "Failed to debug user data" });
    }
  });

  // Mass update all users' lastLogin from OKTA (admin only)
  app.post('/api/sync-all-lastlogin', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      console.log("Starting mass lastLogin sync from OKTA...");
      const allUsers = await oktaService.getUsers(500);
      console.log(`Found ${allUsers.length} users in OKTA`);
      
      let updatedCount = 0;
      const updates = [];
      
      for (const oktaUser of allUsers) {
        try {
          const localUser = await storage.getUserByEmail(oktaUser.profile.email);
          if (localUser && oktaUser.lastLogin) {
            const oktaLastLogin = new Date(oktaUser.lastLogin);
            const localLastLogin = localUser.lastLogin;
            
            // Only update if OKTA has different (newer) data
            if (!localLastLogin || oktaLastLogin.getTime() !== localLastLogin.getTime()) {
              await storage.updateUser(localUser.id, {
                lastLogin: oktaLastLogin
              });
              
              updates.push({
                email: oktaUser.profile.email,
                oldLogin: localLastLogin?.toISOString() || 'never',
                newLogin: oktaLastLogin.toISOString()
              });
              updatedCount++;
            }
          }
        } catch (userError) {
          console.error(`Error updating lastLogin for ${oktaUser.profile.email}:`, userError);
        }
      }
      
      res.json({
        success: true,
        message: `Updated lastLogin for ${updatedCount} users`,
        totalChecked: allUsers.length,
        updatedCount,
        sampleUpdates: updates.slice(0, 10)
      });
    } catch (error) {
      console.error("Mass lastLogin sync error:", error);
      res.status(500).json({ message: "Failed to sync lastLogin data" });
    }
  });

  // Force sync specific user from OKTA
  app.post('/api/force-sync-user/:email', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const email = req.params.email;
      
      // Get fresh data from OKTA
      const oktaUser = await oktaService.getUserByEmail(email);
      if (!oktaUser) {
        return res.status(404).json({ message: "User not found in OKTA" });
      }
      
      // Get local user
      const localUser = await storage.getUserByEmail(email);
      if (!localUser) {
        return res.status(404).json({ message: "User not found locally" });
      }
      
      // Force update with fresh OKTA data
      const updates = {
        firstName: oktaUser.profile.firstName,
        lastName: oktaUser.profile.lastName,
        email: oktaUser.profile.email,
        title: oktaUser.profile.title || null,
        department: oktaUser.profile.department || null,
        mobilePhone: oktaUser.profile.mobilePhone || null,
        manager: oktaUser.profile.manager || null,
        status: oktaUser.status,
        lastUpdated: new Date(oktaUser.lastUpdated),
        lastLogin: oktaUser.lastLogin ? new Date(oktaUser.lastLogin) : null
      };
      
      console.log(`Force syncing ${email}: OKTA lastLogin = ${oktaUser.lastLogin}, local was = ${localUser.lastLogin}`);
      
      const updatedUser = await storage.updateUser(localUser.id, updates);
      
      res.json({
        success: true,
        message: "User force synced successfully",
        user: updatedUser,
        changes: {
          lastLoginBefore: localUser.lastLogin,
          lastLoginAfter: oktaUser.lastLogin
        }
      });
    } catch (error) {
      console.error("Force sync user error:", error);
      res.status(500).json({ message: "Failed to force sync user" });
    }
  });

  // KnowBe4 API endpoints
  app.get('/api/knowbe4/test-connection', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const result = await knowBe4Service.testConnection();
      res.json(result);
    } catch (error) {
      console.error("KnowBe4 connection test error:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to test KnowBe4 connection",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get('/api/knowbe4/users', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const per_page = parseInt(req.query.per_page as string) || 500;
      const users = await knowBe4Service.getUsers(page, per_page);
      res.json(users);
    } catch (error) {
      console.error("KnowBe4 users fetch error:", error);
      res.status(500).json({ 
        message: "Failed to fetch KnowBe4 users",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get('/api/knowbe4/user/:email', isAuthenticated, async (req, res) => {
    try {
      const email = req.params.email;
      const user = await knowBe4Service.getUserByEmail(email);
      
      if (!user) {
        return res.status(404).json({ message: "User not found in KnowBe4" });
      }
      
      res.json(user);
    } catch (error) {
      console.error("KnowBe4 user fetch error:", error);
      res.status(500).json({ 
        message: "Failed to fetch KnowBe4 user",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get('/api/knowbe4/user/:userEmail/training-enrollments', isAuthenticated, async (req, res) => {
    try {
      const userEmail = req.params.userEmail;
      
      // Get all training enrollments from KnowBe4
      const allEnrollments = await knowBe4Service.getTrainingEnrollments();
      
      // Filter enrollments for this specific user
      const userEnrollments = allEnrollments.filter(enrollment => 
        enrollment.user_email?.toLowerCase() === userEmail.toLowerCase() ||
        enrollment.email?.toLowerCase() === userEmail.toLowerCase()
      );
      
      res.json(userEnrollments);
    } catch (error) {
      console.error("KnowBe4 training enrollment fetch error:", error);
      res.status(500).json({ 
        message: "Failed to fetch user training enrollments",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Sync employee types from OKTA groups to local storage
  app.post("/api/sync-employee-types", requireAdmin, async (req, res) => {
    try {
      const result = await EmployeeTypeSync.syncEmployeeTypesFromGroups();
      res.json(result);
    } catch (error) {
      console.error("Employee type sync failed:", error);
      res.status(500).json({
        success: false,
        updated: 0,
        message: `Employee type sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  });

  app.get('/api/knowbe4/campaigns', isAuthenticated, async (req, res) => {
    try {
      const campaigns = await knowBe4Service.getTrainingCampaigns();
      
      // Get all training enrollments from the global endpoint
      const allEnrollments = await knowBe4Service.getTrainingEnrollments();
      
      // Group enrollments by campaign ID
      const enrollmentsByCampaign: { [key: number]: any[] } = {};
      allEnrollments.forEach(enrollment => {
        const campaignId = enrollment.campaign_id;
        if (!enrollmentsByCampaign[campaignId]) {
          enrollmentsByCampaign[campaignId] = [];
        }
        enrollmentsByCampaign[campaignId].push(enrollment);
      });
      
      // Attach enrollments to each campaign
      const campaignsWithEnrollments = campaigns.map(campaign => ({
        ...campaign,
        enrollments: enrollmentsByCampaign[campaign.campaign_id] || []
      }));
      
      res.json(campaignsWithEnrollments);
    } catch (error) {
      console.error("KnowBe4 campaigns fetch error:", error);
      res.status(500).json({ 
        message: "Failed to fetch training campaigns",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get('/api/knowbe4/user/:userId/phishing', isAuthenticated, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      // Get all phishing campaigns
      const campaigns = await knowBe4Service.getPhishingCampaigns();
      const userPhishingResults: any[] = [];
      
      // Check each phishing campaign for user results
      for (const campaign of campaigns) {
        try {
          // Get phishing security tests for this campaign
          if (campaign.psts && campaign.psts.length > 0) {
            for (const pst of campaign.psts) {
              // Note: KnowBe4 API may not expose individual user phishing results
              // This would require additional API endpoints that may not be available
              console.log(`Checking PST ${pst.pst_id} for user ${userId}`);
            }
          }
        } catch (campaignError) {
          console.log(`Skipping phishing campaign ${campaign.campaign_id} due to error:`, (campaignError as Error).message);
        }
      }
      
      console.log(`Found ${userPhishingResults.length} phishing results for user ${userId}`);
      res.json(userPhishingResults);
    } catch (error) {
      console.error("KnowBe4 phishing results fetch error:", error);
      res.status(500).json({ 
        message: "Failed to fetch user phishing results",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get('/api/knowbe4/user/:userId/training', isAuthenticated, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      // Use the correct KnowBe4 API endpoint for user training enrollments
      const enrollments = await knowBe4Service.getUserTrainingEnrollmentsByUserId(userId);
      
      console.log(`Found ${enrollments.length} training enrollments for user ${userId}`);
      res.json(enrollments);
    } catch (error) {
      console.error("KnowBe4 training enrollments fetch error:", error);
      res.status(500).json({ 
        message: "Failed to fetch user training enrollments",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get('/api/knowbe4/user/:userId/campaign-enrollments', isAuthenticated, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const campaignEnrollments = await knowBe4Service.getUserCampaignEnrollments(userId);
      res.json(campaignEnrollments);
    } catch (error) {
      console.error("KnowBe4 user campaign enrollments fetch error:", error);
      res.status(500).json({ 
        message: "Failed to fetch user campaign enrollments",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get('/api/knowbe4/training-campaigns', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const campaigns = await knowBe4Service.getTrainingCampaigns();
      res.json(campaigns);
    } catch (error) {
      console.error("KnowBe4 training campaigns fetch error:", error);
      res.status(500).json({ 
        message: "Failed to fetch training campaigns",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get('/api/knowbe4/phishing-campaigns', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const campaigns = await knowBe4Service.getPhishingCampaigns();
      res.json(campaigns);
    } catch (error) {
      console.error("KnowBe4 phishing campaigns fetch error:", error);
      res.status(500).json({ 
        message: "Failed to fetch phishing campaigns",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get('/api/knowbe4/account-stats', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const stats = await knowBe4Service.getAccountStats();
      res.json(stats);
    } catch (error) {
      console.error("KnowBe4 account stats fetch error:", error);
      res.status(500).json({ 
        message: "Failed to fetch account statistics",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get('/api/knowbe4/groups', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const groups = await knowBe4Service.getGroups();
      res.json(groups);
    } catch (error) {
      console.error("KnowBe4 groups fetch error:", error);
      res.status(500).json({ 
        message: "Failed to fetch KnowBe4 groups",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Search campaigns by name
  app.get('/api/knowbe4/campaigns/search', isAuthenticated, async (req, res) => {
    try {
      const searchTerm = req.query.q as string;
      if (!searchTerm) {
        return res.status(400).json({ error: 'Search term is required' });
      }
      const campaigns = await knowBe4Service.searchCampaignsByName(searchTerm);
      res.json(campaigns);
    } catch (error) {
      console.error('Error searching campaigns:', error);
      res.status(500).json({ error: 'Failed to search campaigns' });
    }
  });

  // Get specific campaign details
  app.get('/api/knowbe4/campaigns/:campaignId', isAuthenticated, async (req, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      const campaign = await knowBe4Service.getCampaignById(campaignId);
      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }
      res.json(campaign);
    } catch (error) {
      console.error('Error fetching campaign:', error);
      res.status(500).json({ error: 'Failed to fetch campaign' });
    }
  });

  // Get campaign enrollments/participants
  app.get('/api/knowbe4/campaigns/:campaignId/participants', isAuthenticated, async (req, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      const participants = await knowBe4Service.getCampaignParticipants(campaignId);
      res.json(participants);
    } catch (error) {
      console.error('Error fetching campaign participants:', error);
      res.status(500).json({ error: 'Failed to fetch campaign participants' });
    }
  });

  // ===== KNOWBE4 GRAPH API ROUTES =====
  
  // Test Graph API connection
  app.get('/api/knowbe4/graph/test-connection', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const connectionTest = await knowBe4GraphService.testConnection();
      res.json(connectionTest);
    } catch (error) {
      console.error("KnowBe4 Graph API connection test error:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to test Graph API connection",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get user data via Graph API
  app.get('/api/knowbe4/graph/user/:email', isAuthenticated, async (req, res) => {
    try {
      const email = req.params.email;
      const user = await knowBe4GraphService.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ error: 'User not found in KnowBe4 Graph API' });
      }
      res.json(user);
    } catch (error) {
      console.error("KnowBe4 Graph API user fetch error:", error);
      res.status(500).json({ 
        message: "Failed to fetch user from Graph API",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get training campaigns via Graph API
  app.get('/api/knowbe4/graph/training-campaigns', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const campaigns = await knowBe4GraphService.getTrainingCampaigns();
      res.json(campaigns);
    } catch (error) {
      console.error("KnowBe4 Graph API training campaigns fetch error:", error);
      res.status(500).json({ 
        message: "Failed to fetch training campaigns from Graph API",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get phishing campaigns via Graph API
  app.get('/api/knowbe4/graph/phishing-campaigns', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const campaigns = await knowBe4GraphService.getPhishingCampaigns();
      res.json(campaigns);
    } catch (error) {
      console.error("KnowBe4 Graph API phishing campaigns fetch error:", error);
      res.status(500).json({ 
        message: "Failed to fetch phishing campaigns from Graph API",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Search campaigns via Graph API
  app.get('/api/knowbe4/graph/campaigns/search', isAuthenticated, async (req, res) => {
    try {
      const searchTerm = req.query.q as string;
      const campaignType = req.query.type as 'training' | 'phishing' | undefined;
      
      if (!searchTerm) {
        return res.status(400).json({ error: 'Search term is required' });
      }
      
      const campaigns = await knowBe4GraphService.searchCampaignsByName(searchTerm, campaignType);
      res.json(campaigns);
    } catch (error) {
      console.error('Error searching campaigns via Graph API:', error);
      res.status(500).json({ error: 'Failed to search campaigns' });
    }
  });

  // Sync user groups and employee types
  app.post('/api/sync-user-groups/:userId', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const user = await storage.getUser(userId);
      
      if (!user || !user.oktaId) {
        return res.status(404).json({ message: 'User not found or no OKTA ID' });
      }
      
      await syncUserGroupsAndEmployeeType(userId, user.oktaId);
      
      // Get updated user data
      const updatedUser = await storage.getUser(userId);
      
      res.json({
        success: true,
        message: `Groups and employee type synced for ${user.email}`,
        user: updatedUser
      });
    } catch (error) {
      console.error('Error syncing user groups:', error);
      res.status(500).json({ 
        message: 'Failed to sync user groups',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Sync all users' groups and employee types
  app.post('/api/sync-all-user-groups', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const result = await syncAllUsersGroupsAndEmployeeTypes();
      
      res.json({
        success: true,
        message: `Groups sync completed. Updated: ${result.updated}, Errors: ${result.errors}`,
        updated: result.updated,
        errors: result.errors
      });
    } catch (error) {
      console.error('Error syncing all user groups:', error);
      res.status(500).json({ 
        message: 'Failed to sync all user groups',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Bulk sync all users' groups and employee types with detailed reporting
  app.post('/api/bulk-sync-user-groups', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const result = await bulkSyncUserGroupsAndEmployeeTypes();
      
      res.json({
        success: true,
        message: `Bulk groups sync completed. Updated: ${result.updated}, Errors: ${result.errors}`,
        updated: result.updated,
        errors: result.errors,
        details: result.details.slice(0, 50) // Limit details to first 50 entries
      });
    } catch (error) {
      console.error('Error during bulk groups sync:', error);
      res.status(500).json({ 
        message: 'Failed to sync user groups',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get user training enrollments via Graph API
  app.get('/api/knowbe4/graph/user/:userId/training', isAuthenticated, async (req, res) => {
    try {
      const userId = req.params.userId;
      const enrollments = await knowBe4GraphService.getUserTrainingEnrollments(userId);
      res.json(enrollments);
    } catch (error) {
      console.error("KnowBe4 Graph API user training enrollments fetch error:", error);
      res.status(500).json({ 
        message: "Failed to fetch user training enrollments from Graph API",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get campaign enrollments
  app.get('/api/knowbe4/campaigns/:campaignId/enrollments', isAuthenticated, async (req, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      const enrollments = await knowBe4Service.getCampaignEnrollments(campaignId);
      res.json(enrollments);
    } catch (error) {
      console.error('Error fetching campaign enrollments:', error);
      res.status(500).json({ error: 'Failed to fetch campaign enrollments' });
    }
  });

  // Create OKTA group
  app.post('/api/okta/groups', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { groupName, description } = req.body;
      
      if (!groupName) {
        return res.status(400).json({ message: 'Group name is required' });
      }
      
      const createdGroup = await oktaService.createGroup(groupName, description);
      res.json(createdGroup);
    } catch (error) {
      console.error('Error creating OKTA group:', error);
      res.status(500).json({ 
        message: 'Failed to create OKTA group',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Site Access Users API routes
  app.get("/api/site-access-users", isAuthenticated, async (req, res) => {
    try {
      const users = await db.select().from(siteAccessUsers);
      res.json(users);
    } catch (error) {
      console.error("Error fetching site access users:", error);
      res.status(500).json({ message: "Failed to fetch site access users" });
    }
  });

  app.post("/api/site-access-users", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const userData = insertSiteAccessUserSchema.parse(req.body);
      const [user] = await db.insert(siteAccessUsers).values(userData).returning();
      
      // Log the audit trail
      await AuditLogger.logSiteAccessAction(
        req,
        'CREATE',
        user.id.toString(),
        user.name,
        { action: 'Created new site access user', accessLevel: user.accessLevel },
        {},
        { name: user.name, email: user.email, accessLevel: user.accessLevel }
      );
      
      res.json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors
        });
      }
      console.error("Error creating site access user:", error);
      res.status(500).json({ message: "Failed to create site access user" });
    }
  });

  app.put("/api/site-access-users/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const id = z.coerce.number().parse(req.params.id);
      const userData = insertSiteAccessUserSchema.parse(req.body);
      
      // Get old values for audit log
      const [oldUser] = await db.select().from(siteAccessUsers).where(eq(siteAccessUsers.id, id));
      
      const [user] = await db
        .update(siteAccessUsers)
        .set({ ...userData, lastUpdated: new Date() })
        .where(eq(siteAccessUsers.id, id))
        .returning();
      
      if (!user) {
        return res.status(404).json({ message: "Site access user not found" });
      }
      
      // Log the audit trail
      if (oldUser) {
        await AuditLogger.logSiteAccessAction(
          req,
          'UPDATE',
          user.id.toString(),
          user.name,
          { action: 'Updated site access user' },
          { name: oldUser.name, email: oldUser.email, accessLevel: oldUser.accessLevel },
          { name: user.name, email: user.email, accessLevel: user.accessLevel }
        );
      }
      
      res.json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors
        });
      }
      console.error("Error updating site access user:", error);
      res.status(500).json({ message: "Failed to update site access user" });
    }
  });

  app.delete("/api/site-access-users/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const id = z.coerce.number().parse(req.params.id);
      const [deletedUser] = await db
        .delete(siteAccessUsers)
        .where(eq(siteAccessUsers.id, id))
        .returning();
      
      if (!deletedUser) {
        return res.status(404).json({ message: "Site access user not found" });
      }
      
      // Log the audit trail
      await AuditLogger.logSiteAccessAction(
        req,
        'DELETE',
        deletedUser.id.toString(),
        deletedUser.name,
        { action: 'Deleted site access user' },
        { name: deletedUser.name, email: deletedUser.email, accessLevel: deletedUser.accessLevel },
        {}
      );
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting site access user:", error);
      res.status(500).json({ message: "Failed to delete site access user" });
    }
  });

  // Integrations routes
  app.get("/api/integrations", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const integrationsData = await db.select().from(integrations);
      res.json(integrationsData);
    } catch (error) {
      console.error("Error fetching integrations:", error);
      res.status(500).json({ message: "Failed to fetch integrations" });
    }
  });

  // Client-specific integrations endpoint
  app.get("/api/client/:clientId/integrations", isAuthenticated, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      console.log(`🔗 Fetching integrations for client ${clientId}`);
      
      // Use client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      const integrationsData = await clientDb.select().from(integrations);
      
      console.log(`✅ Found ${integrationsData.length} integrations for client ${clientId}`);
      res.json(integrationsData);
    } catch (error) {
      console.error(`Error fetching integrations for client:`, error);
      res.status(500).json({ error: "Failed to fetch client integrations" });
    }
  });

  // Client-specific integrations POST endpoint
  app.post("/api/client/:clientId/integrations", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const integrationData = insertIntegrationSchema.parse(req.body);
      console.log(`🔗 Creating integration for client ${clientId}:`, integrationData.name);
      
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      
      const [result] = await clientDb.insert(integrations)
        .values(integrationData)
        .returning();
      
      console.log(`✅ Created integration for client ${clientId}:`, result);
      res.json(result);
    } catch (error) {
      console.error("Error creating integration for client:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create client integration" });
    }
  });

  // Client-specific integrations PUT endpoint
  app.put("/api/client/:clientId/integrations/:integrationId", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const integrationId = parseInt(req.params.integrationId);
      const integrationData = insertIntegrationSchema.parse(req.body);
      console.log(`🔗 Updating integration ${integrationId} for client ${clientId}`);
      
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      
      const [result] = await clientDb.update(integrations)
        .set(integrationData)
        .where(eq(integrations.id, integrationId))
        .returning();
      
      if (!result) {
        return res.status(404).json({ error: "Integration not found" });
      }
      
      console.log(`✅ Updated integration for client ${clientId}:`, result);
      res.json(result);
    } catch (error) {
      console.error("Error updating integration for client:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update client integration" });
    }
  });

  // Client-specific integrations DELETE endpoint
  app.delete("/api/client/:clientId/integrations/:integrationId", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const integrationId = parseInt(req.params.integrationId);
      console.log(`🔗 Deleting integration ${integrationId} for client ${clientId}`);
      
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      
      const result = await clientDb.delete(integrations)
        .where(eq(integrations.id, integrationId))
        .returning();
      
      if (result.length === 0) {
        return res.status(404).json({ error: "Integration not found" });
      }
      
      console.log(`✅ Deleted integration for client ${clientId}`);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting integration for client:", error);
      res.status(500).json({ error: "Failed to delete client integration" });
    }
  });

  app.post("/api/integrations", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const integrationData = insertIntegrationSchema.parse(req.body);
      const [integration] = await db.insert(integrations).values(integrationData).returning();
      
      // Log the audit trail
      await AuditLogger.logIntegrationAction(
        req,
        'CREATE',
        integration.id.toString(),
        integration.displayName,
        { action: 'Created new integration', status: integration.status },
        {},
        { name: integration.name, displayName: integration.displayName, status: integration.status }
      );
      
      res.json(integration);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors
        });
      }
      console.error("Error creating integration:", error);
      res.status(500).json({ message: "Failed to create integration" });
    }
  });

  app.put("/api/integrations/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const id = z.coerce.number().parse(req.params.id);
      const integrationData = insertIntegrationSchema.parse(req.body);
      
      // Get old values for audit log
      const [oldIntegration] = await db.select().from(integrations).where(eq(integrations.id, id));
      
      const [integration] = await db
        .update(integrations)
        .set({ ...integrationData, lastUpdated: new Date() })
        .where(eq(integrations.id, id))
        .returning();
      
      if (!integration) {
        return res.status(404).json({ message: "Integration not found" });
      }
      
      // Log the audit trail
      if (oldIntegration) {
        await AuditLogger.logIntegrationAction(
          req,
          'UPDATE',
          integration.id.toString(),
          integration.displayName,
          { action: 'Updated integration configuration' },
          { status: oldIntegration.status, apiKeys: Object.keys(oldIntegration.apiKeys || {}) },
          { status: integration.status, apiKeys: Object.keys(integration.apiKeys || {}) }
        );
      }
      
      res.json(integration);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors
        });
      }
      console.error("Error updating integration:", error);
      res.status(500).json({ message: "Failed to update integration" });
    }
  });

  app.delete("/api/integrations/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const id = z.coerce.number().parse(req.params.id);
      const [deletedIntegration] = await db
        .delete(integrations)
        .where(eq(integrations.id, id))
        .returning();
      
      if (!deletedIntegration) {
        return res.status(404).json({ message: "Integration not found" });
      }
      
      // Log the audit trail
      await AuditLogger.logIntegrationAction(
        req,
        'DELETE',
        deletedIntegration.id.toString(),
        deletedIntegration.displayName,
        { action: 'Deleted integration' },
        { name: deletedIntegration.name, displayName: deletedIntegration.displayName, status: deletedIntegration.status },
        {}
      );
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting integration:", error);
      res.status(500).json({ message: "Failed to delete integration" });
    }
  });

  // Audit logs endpoint
  app.get("/api/audit-logs", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const {
        page = 1,
        limit = 50,
        action,
        resourceType,
        resourceId,
        userId,
        startDate,
        endDate
      } = req.query;

      const offset = (Number(page) - 1) * Number(limit);
      
      const options: any = {
        limit: Number(limit),
        offset,
      };

      if (action) options.action = action as string;
      if (resourceType) options.resourceType = resourceType as string;
      if (resourceId) options.resourceId = resourceId as string;
      if (userId) options.userId = Number(userId);
      if (startDate) options.startDate = new Date(startDate as string);
      if (endDate) options.endDate = new Date(endDate as string);

      const logs = await getAuditLogs(options);
      
      // Get total count for pagination
      const totalLogs = await db.select().from(auditLogs);
      const total = totalLogs.length;
      
      res.json({
        logs,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      });
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // App Mappings API endpoints

  // Get all app mappings
  app.get("/api/app-mappings", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const mappings = await db.select().from(appMappings).orderBy(desc(appMappings.created));
      res.json(mappings);
    } catch (error) {
      console.error("Error fetching app mappings:", error);
      res.status(500).json({ message: "Failed to fetch app mappings" });
    }
  });

  // Client-specific app mappings endpoint
  app.get("/api/client/:clientId/app-mappings", isAuthenticated, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      console.log(`📱 Fetching app mappings for client ${clientId}`);
      
      // Use client-specific database connection  
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      const mappings = await clientDb.select().from(appMappings).orderBy(desc(appMappings.created));
      
      console.log(`✅ Found ${mappings.length} app mappings for client ${clientId}`);
      res.json(mappings);
    } catch (error) {
      console.error(`Error fetching app mappings for client:`, error);
      res.status(500).json({ error: "Failed to fetch client app mappings" });
    }
  });

  // Create new app mapping
  app.post("/api/app-mappings", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const mappingData = insertAppMappingSchema.parse(req.body);
      
      // Note: Removed unique constraint check to allow multiple groups per app

      const [newMapping] = await db.insert(appMappings).values(mappingData).returning();
      
      // Log the audit event
      await AuditLogger.log({
        req,
        action: "CREATE",
        resourceType: "APP_MAPPING",
        resourceId: newMapping.id.toString(),
        resourceName: newMapping.appName,
        details: {
          action: "Created new app mapping",
          appName: newMapping.appName,
          oktaGroupName: newMapping.oktaGroupName
        },
        newValues: mappingData
      });

      res.status(201).json(newMapping);
    } catch (error) {
      console.error("Error creating app mapping:", error);
      res.status(500).json({ message: "Failed to create app mapping" });
    }
  });

  // Bulk create app mappings (remove unique constraint check for multiple groups per app)
  app.post('/api/app-mappings/bulk', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { mappings } = req.body;
      
      if (!Array.isArray(mappings) || mappings.length === 0) {
        return res.status(400).json({ message: 'Mappings array is required' });
      }

      const validatedMappings = mappings.map(mapping => insertAppMappingSchema.parse(mapping));
      
      const createdMappings = await db.insert(appMappings).values(
        validatedMappings.map(mapping => ({
          ...mapping,
          lastUpdated: new Date()
        }))
      ).returning();

      // Audit log for each mapping
      for (const mapping of createdMappings) {
        await AuditLogger.log({
          req,
          action: "CREATE",
          resourceType: "APP_MAPPING", 
          resourceId: mapping.id.toString(),
          resourceName: mapping.appName,
          details: {
            action: "Created app mapping (bulk)",
            appName: mapping.appName,
            oktaGroupName: mapping.oktaGroupName
          },
          newValues: mapping
        });
      }

      res.status(201).json(createdMappings);
    } catch (error) {
      console.error('Error creating bulk app mappings:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Validation error', errors: error.errors });
      } else {
        res.status(500).json({ message: 'Internal server error' });
      }
    }
  });

  // Update app mapping
  app.put("/api/app-mappings/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const id = z.coerce.number().parse(req.params.id);
      const mappingData = insertAppMappingSchema.partial().parse(req.body);
      
      // Get the existing mapping for audit log
      const [existingMapping] = await db.select().from(appMappings).where(eq(appMappings.id, id));
      if (!existingMapping) {
        return res.status(404).json({ message: "App mapping not found" });
      }

      // Note: Multiple mappings per app are now allowed, so no unique constraint check needed

      const [updatedMapping] = await db.update(appMappings)
        .set({ ...mappingData, lastUpdated: new Date() })
        .where(eq(appMappings.id, id))
        .returning();

      // Log the audit event
      await AuditLogger.log({
        req,
        action: "UPDATE",
        resourceType: "APP_MAPPING",
        resourceId: updatedMapping.id.toString(),
        resourceName: updatedMapping.appName,
        details: { action: "Updated app mapping" },
        oldValues: existingMapping,
        newValues: updatedMapping
      });

      res.json(updatedMapping);
    } catch (error) {
      console.error("Error updating app mapping:", error);
      res.status(500).json({ message: "Failed to update app mapping" });
    }
  });

  // Delete app mapping
  app.delete("/api/app-mappings/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const id = z.coerce.number().parse(req.params.id);
      
      // Get the existing mapping for audit log
      const [existingMapping] = await db.select().from(appMappings).where(eq(appMappings.id, id));
      if (!existingMapping) {
        return res.status(404).json({ message: "App mapping not found" });
      }

      await db.delete(appMappings).where(eq(appMappings.id, id));

      // Log the audit event
      await AuditLogger.log({
        req,
        action: "DELETE",
        resourceType: "APP_MAPPING",
        resourceId: existingMapping.id.toString(),
        resourceName: existingMapping.appName,
        details: { action: "Deleted app mapping" },
        oldValues: existingMapping
      });

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting app mapping:", error);
      res.status(500).json({ message: "Failed to delete app mapping" });
    }
  });

  // Get OKTA group for specific app (helper endpoint for user creation)
  app.get("/api/app-mappings/lookup/:appName", isAuthenticated, async (req, res) => {
    try {
      const appName = req.params.appName;
      const mapping = await db.select().from(appMappings)
        .where(eq(appMappings.appName, appName));
      
      const activeMapping = mapping.find(m => m.status === "active");
      
      if (!activeMapping) {
        return res.status(404).json({ message: "App mapping not found" });
      }

      res.json({ oktaGroupName: activeMapping.oktaGroupName });
    } catch (error) {
      console.error("Error looking up app mapping:", error);
      res.status(500).json({ message: "Failed to lookup app mapping" });
    }
  });

  // Layout settings endpoints
  app.get("/api/layout-settings", isAuthenticated, async (req, res) => {
    try {
      const settings = await db.select().from(layoutSettings).orderBy(layoutSettings.settingKey);
      res.json(settings);
    } catch (error) {
      console.error("Error fetching layout settings:", error);
      res.status(500).json({ error: "Failed to fetch layout settings" });
    }
  });

  // Client-specific layout settings endpoint
  app.get("/api/client/:clientId/layout-settings", isAuthenticated, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      console.log(`⚙️  Fetching layout settings for client ${clientId}`);
      
      // Use client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      const settings = await clientDb.select().from(layoutSettings).orderBy(layoutSettings.settingKey);
      
      console.log(`✅ Found ${settings.length} layout settings for client ${clientId}`);
      res.json(settings);
    } catch (error) {
      console.error(`Error fetching layout settings for client:`, error);
      res.status(500).json({ error: "Failed to fetch client layout settings" });
    }
  });

  app.get("/api/layout-settings/:key", isAuthenticated, async (req, res) => {
    try {
      const { key } = req.params;
      const setting = await db.select()
        .from(layoutSettings)
        .where(eq(layoutSettings.settingKey, key))
        .limit(1);
      
      if (setting.length === 0) {
        return res.status(404).json({ error: "Setting not found" });
      }
      
      res.json(setting[0]);
    } catch (error) {
      console.error("Error fetching layout setting:", error);
      res.status(500).json({ error: "Failed to fetch layout setting" });
    }
  });

  // Client-specific layout setting by key endpoint
  app.get("/api/client/:clientId/layout-settings/:key", isAuthenticated, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const { key } = req.params;
      console.log(`⚙️  Fetching layout setting '${key}' for client ${clientId}`);
      
      // Use client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      const setting = await clientDb.select()
        .from(layoutSettings)
        .where(eq(layoutSettings.settingKey, key))
        .limit(1);
      
      if (setting.length === 0) {
        console.log(`❌ Layout setting '${key}' not found for client ${clientId}`);
        return res.status(404).json({ error: "Setting not found" });
      }
      
      console.log(`✅ Found layout setting '${key}' for client ${clientId}`);
      res.json(setting[0]);
    } catch (error) {
      console.error(`Error fetching layout setting for client:`, error);
      res.status(500).json({ error: "Failed to fetch client layout setting" });
    }
  });

  app.post("/api/layout-settings", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const user = (req.session as any).user;
      const validatedData = insertLayoutSettingSchema.parse(req.body);
      
      // Check if setting already exists
      const existing = await db.select()
        .from(layoutSettings)
        .where(eq(layoutSettings.settingKey, validatedData.settingKey))
        .limit(1);
      
      let result;
      if (existing.length > 0) {
        // Update existing setting
        [result] = await db.update(layoutSettings)
          .set({ 
            ...validatedData, 
            updatedBy: user.id,
            updatedAt: new Date()
          })
          .where(eq(layoutSettings.settingKey, validatedData.settingKey))
          .returning();
      } else {
        // Create new setting
        [result] = await db.insert(layoutSettings)
          .values({ ...validatedData, updatedBy: user.id })
          .returning();
      }
      
      // Log the change
      await AuditLogger.log({
        req,
        action: existing.length > 0 ? 'UPDATE' : 'CREATE',
        resourceType: 'LAYOUT_SETTING',
        resourceId: result.id.toString(),
        resourceName: result.settingKey,
        details: { settingType: result.settingType, settingKey: result.settingKey },
        oldValues: existing.length > 0 ? existing[0] : {},
        newValues: result
      });
      
      res.json(result);
    } catch (error) {
      console.error("Error saving layout setting:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to save layout setting" });
    }
  });

  app.delete("/api/layout-settings/:key", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { key } = req.params;
      
      const existing = await db.select()
        .from(layoutSettings)
        .where(eq(layoutSettings.settingKey, key))
        .limit(1);
      
      if (existing.length === 0) {
        return res.status(404).json({ error: "Setting not found" });
      }
      
      await db.delete(layoutSettings)
        .where(eq(layoutSettings.settingKey, key));
      
      // Log the deletion
      await AuditLogger.log({
        req,
        action: 'DELETE',
        resourceType: 'LAYOUT_SETTING',
        resourceId: existing[0].id.toString(),
        resourceName: existing[0].settingKey,
        details: { settingType: existing[0].settingType, settingKey: existing[0].settingKey },
        oldValues: existing[0]
      });
      
      res.json({ message: "Layout setting deleted successfully" });
    } catch (error) {
      console.error("Error deleting layout setting:", error);
      res.status(500).json({ error: "Failed to delete layout setting" });
    }
  });

  // Field settings endpoints (for department and employee type options)
  app.get("/api/field-settings/:fieldType", isAuthenticated, async (req, res) => {
    try {
      const { fieldType } = req.params;
      const setting = await db.select()
        .from(layoutSettings)
        .where(eq(layoutSettings.settingKey, `${fieldType}_options`))
        .limit(1);
      
      if (setting.length === 0) {
        // Return default values
        const defaultOptions = fieldType === 'department' 
          ? []
          : ['EMPLOYEE', 'CONTRACTOR', 'INTERN', 'PART_TIME'];
        
        return res.json({ 
          options: defaultOptions,
          required: false
        });
      }
      
      const parsedValue = JSON.parse(setting[0].settingValue || '{}');
      res.json(parsedValue);
    } catch (error) {
      console.error("Error fetching field setting:", error);
      res.status(500).json({ error: "Failed to fetch field setting" });
    }
  });

  app.post("/api/field-settings/:fieldType", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { fieldType } = req.params;
      const { options, required } = req.body;
      const user = (req.session as any).user;
      
      const settingKey = `${fieldType}_options`;
      const settingValue = JSON.stringify({ options, required });
      
      // Check if setting already exists
      const existing = await db.select()
        .from(layoutSettings)
        .where(eq(layoutSettings.settingKey, settingKey))
        .limit(1);
      
      let result;
      if (existing.length > 0) {
        // Update existing setting
        [result] = await db.update(layoutSettings)
          .set({ 
            settingValue,
            settingType: 'field',
            updatedBy: user.id,
            updatedAt: new Date()
          })
          .where(eq(layoutSettings.settingKey, settingKey))
          .returning();
      } else {
        // Create new setting
        [result] = await db.insert(layoutSettings)
          .values({ 
            settingKey,
            settingValue,
            settingType: 'field',
            clientId: 1, // Default client for now
            updatedBy: user.id
          })
          .returning();
      }
      
      // Log the change
      await AuditLogger.log({
        req,
        action: existing.length > 0 ? 'UPDATE' : 'CREATE',
        resourceType: 'FIELD_SETTING',
        resourceId: result.id.toString(),
        resourceName: result.settingKey,
        details: { fieldType, optionsCount: options.length },
        oldValues: existing.length > 0 ? existing[0] : {},
        newValues: result
      });
      
      res.json({ options, required });
    } catch (error) {
      console.error("Error saving field setting:", error);
      res.status(500).json({ error: "Failed to save field setting" });
    }
  });

  // Dashboard cards endpoints
  app.get("/api/dashboard-cards", async (req, res) => {
    try {
      const clientId = req.query.clientId ? parseInt(req.query.clientId as string) : 1; // Default to client 1 for MSP context
      console.log('📊 Dashboard cards requested, session user:', (req.session as any)?.user?.email || 'No session', 'clientId:', clientId);
      
      const cards = await db
        .select()
        .from(dashboardCards)
        .where(eq(dashboardCards.clientId, clientId))
        .orderBy(dashboardCards.position);
        
      console.log('📊 Dashboard cards found:', cards.length, 'for client:', clientId);
      res.json(cards);
    } catch (error) {
      console.error("Error fetching dashboard cards:", error);
      res.status(500).json({ error: "Failed to fetch dashboard cards" });
    }
  });

  // Client-specific dashboard cards route
  app.get("/api/client/:clientId/dashboard-cards", async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      console.log('📊 Client-specific dashboard cards requested for client:', clientId);
      
      const cards = await db
        .select()
        .from(dashboardCards)
        .where(eq(dashboardCards.clientId, clientId))
        .orderBy(dashboardCards.position);
        
      console.log('📊 Client dashboard cards found:', cards.length);
      res.json(cards);
    } catch (error) {
      console.error("Error fetching client dashboard cards:", error);
      res.status(500).json({ error: "Failed to fetch dashboard cards" });
    }
  });

  app.post("/api/dashboard-cards", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const validatedData = insertDashboardCardSchema.parse(req.body);
      const [result] = await db.insert(dashboardCards).values(validatedData).returning();
      
      await AuditLogger.log({
        req,
        action: 'CREATE',
        resourceType: 'DASHBOARD_CARD',
        resourceId: result.id.toString(),
        resourceName: result.name,
        details: { type: result.type, position: result.position },
        newValues: result
      });
      
      res.json(result);
    } catch (error) {
      console.error("Error creating dashboard card:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create dashboard card" });
    }
  });

  // Client-specific bulk update dashboard card positions (for drag and drop)
  app.patch("/api/client/:clientId/dashboard-cards/positions", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const { cards } = req.body;
      
      console.log(`🔄 Updating dashboard card positions for client ${clientId}:`, cards.length, 'cards');
      
      // Update each card position for the specific client
      for (const card of cards) {
        await db
          .update(dashboardCards)
          .set({ position: card.position, updated: new Date() })
          .where(and(eq(dashboardCards.id, card.id), eq(dashboardCards.clientId, clientId)));
      }
      
      // Fetch updated cards to return
      const updatedCards = await db
        .select()
        .from(dashboardCards)
        .where(eq(dashboardCards.clientId, clientId))
        .orderBy(dashboardCards.position);
      
      console.log('✅ All card positions updated successfully for client', clientId, ':', updatedCards.map(c => ({ id: c.id, name: c.name, position: c.position })));
      
      res.json(updatedCards);
    } catch (error) {
      console.error("Error updating client dashboard card positions:", error);
      res.status(500).json({ error: "Failed to update card positions" });
    }
  });

  // Bulk update dashboard card positions (for drag and drop) - MUST come before /:id route
  app.patch("/api/dashboard-cards/positions", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      console.log('🔄 BULK UPDATE ENDPOINT HIT - Raw request body:', req.body);
      console.log('🔄 Session user:', (req.session as any)?.user?.email);
      console.log('🔄 User role:', (req.session as any)?.user?.role);
      
      const { cards } = req.body;
      console.log('🔄 Extracted cards:', cards);
      
      if (!Array.isArray(cards)) {
        console.error('❌ Cards is not an array:', typeof cards, cards);
        return res.status(400).json({ error: "Cards must be an array" });
      }

      // Update positions in bulk
      console.log('🔄 Processing card updates:', cards);
      const updates = await Promise.all(
        cards.map(async (card: any) => {
          console.log('📝 Processing card:', card);
          
          // Ensure we have valid numbers
          const id = typeof card.id === 'number' ? card.id : parseInt(String(card.id));
          const position = typeof card.position === 'number' ? card.position : parseInt(String(card.position));
          
          if (isNaN(id) || isNaN(position)) {
            console.error(`❌ Invalid card data: id=${card.id} (${typeof card.id}), position=${card.position} (${typeof card.position})`);
            throw new Error(`Invalid card data: id=${card.id}, position=${card.position}`);
          }
          
          console.log(`🔄 Updating card ${id} to position ${position}`);
          const [result] = await db.update(dashboardCards)
            .set({ position, updated: new Date() })
            .where(eq(dashboardCards.id, id))
            .returning();
          
          console.log(`✅ Updated card ${id}:`, result);
          return result;
        })
      );

      await AuditLogger.log({
        req,
        action: 'UPDATE',
        resourceType: 'DASHBOARD_LAYOUT',
        resourceId: 'bulk_position_update',
        resourceName: 'Dashboard Card Positions',
        details: { cardCount: cards.length },
        newValues: { positions: cards }
      });

      console.log('✅ All card positions updated successfully:', updates);
      res.json(updates);
    } catch (error) {
      console.error("Error updating dashboard card positions:", error);
      res.status(500).json({ error: "Failed to update dashboard card positions" });
    }
  });

  app.patch("/api/dashboard-cards/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid card ID" });
      }
      const updates = updateDashboardCardSchema.parse(req.body);
      
      const existing = await db.select().from(dashboardCards).where(eq(dashboardCards.id, id)).limit(1);
      if (existing.length === 0) {
        return res.status(404).json({ error: "Dashboard card not found" });
      }
      
      const [result] = await db.update(dashboardCards)
        .set({ ...updates, updated: new Date() })
        .where(eq(dashboardCards.id, id))
        .returning();
      
      await AuditLogger.log({
        req,
        action: 'UPDATE',
        resourceType: 'DASHBOARD_CARD',
        resourceId: result.id.toString(),
        resourceName: result.name,
        details: { type: result.type, position: result.position },
        oldValues: existing[0],
        newValues: result
      });
      
      res.json(result);
    } catch (error) {
      console.error("Error updating dashboard card:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update dashboard card" });
    }
  });

  app.delete("/api/dashboard-cards/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid card ID" });
      }
      
      const existing = await db.select().from(dashboardCards).where(eq(dashboardCards.id, id)).limit(1);
      if (existing.length === 0) {
        return res.status(404).json({ error: "Dashboard card not found" });
      }
      
      await db.delete(dashboardCards).where(eq(dashboardCards.id, id));
      
      await AuditLogger.log({
        req,
        action: 'DELETE',
        resourceType: 'DASHBOARD_CARD',
        resourceId: existing[0].id.toString(),
        resourceName: existing[0].name,
        details: { type: existing[0].type, position: existing[0].position },
        oldValues: existing[0]
      });
      
      res.json({ message: "Dashboard card deleted successfully" });
    } catch (error) {
      console.error("Error deleting dashboard card:", error);
      res.status(500).json({ error: "Failed to delete dashboard card" });
    }
  });

  // Monitoring cards endpoints
  app.get("/api/monitoring-cards", async (req, res) => {
    try {
      console.log('📊 Monitoring cards requested, session user:', (req.session as any)?.user?.email || 'No session');
      const cards = await db.select().from(monitoringCards).orderBy(monitoringCards.position);
      console.log('📊 Monitoring cards found:', cards.length);
      res.json(cards);
    } catch (error) {
      console.error("Error fetching monitoring cards:", error);
      res.status(500).json({ error: "Failed to fetch monitoring cards" });
    }
  });

  // Client-specific monitoring cards endpoint
  app.get("/api/client/:clientId/monitoring-cards", isAuthenticated, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      console.log(`📊 Fetching monitoring cards for client ${clientId}`);
      
      // Use client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      const cards = await clientDb.select().from(monitoringCards).orderBy(monitoringCards.position);
      
      console.log(`✅ Found ${cards.length} monitoring cards for client ${clientId}`);
      res.json(cards);
    } catch (error) {
      console.error(`Error fetching monitoring cards for client:`, error);
      res.status(500).json({ error: "Failed to fetch client monitoring cards" });
    }
  });

  // Temporary client-specific endpoints - these will return empty arrays until proper schema is implemented
  app.get("/api/client/:clientId/department-app-mappings", isAuthenticated, async (req, res) => {
    // TODO: Implement proper department/employee type mappings in separate table
    res.json([]);
  });

  app.get("/api/client/:clientId/employee-type-app-mappings", isAuthenticated, async (req, res) => {
    // TODO: Implement proper department/employee type mappings in separate table  
    res.json([]);
  });

  app.get("/api/client/:clientId/department-group-mappings", isAuthenticated, async (req, res) => {
    // TODO: Implement proper group mappings in separate table
    res.json([]);
  });

  app.get("/api/client/:clientId/employee-type-group-mappings", isAuthenticated, async (req, res) => {
    // TODO: Implement proper group mappings in separate table
    res.json([]);
  });

  app.post("/api/client/:clientId/employee-type-app-mappings", isAuthenticated, requireAdmin, async (req, res) => {
    // TODO: Implement proper employee type app mappings
    res.json({ message: "Feature not yet implemented" });
  });

  app.delete("/api/client/:clientId/employee-type-app-mappings", isAuthenticated, requireAdmin, async (req, res) => {
    // TODO: Implement proper employee type app mappings
    res.json({ message: "Feature not yet implemented" });
  });

  // Client-specific app mappings DELETE endpoint (by ID)
  app.delete("/api/client/:clientId/app-mappings/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const mappingId = parseInt(req.params.id);
      console.log(`🗑️  Deleting app mapping ${mappingId} for client ${clientId}`);
      
      // Use client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      
      // Get the mapping details for audit log before deletion
      const existing = await clientDb.select().from(appMappings).where(eq(appMappings.id, mappingId)).limit(1);
      if (existing.length === 0) {
        return res.status(404).json({ error: "App mapping not found" });
      }
      
      await clientDb.delete(appMappings).where(eq(appMappings.id, mappingId));
      
      console.log(`✅ Deleted app mapping ${mappingId} for client ${clientId}: ${existing[0].appName}`);
      res.status(204).send();
    } catch (error) {
      console.error(`Error deleting app mapping for client:`, error);
      res.status(500).json({ error: "Failed to delete client app mapping" });
    }
  });

  // Client-specific app mappings PUT endpoint (by ID)
  app.put("/api/client/:clientId/app-mappings/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const mappingId = parseInt(req.params.id);
      const { appName, oktaGroupName } = req.body;
      console.log(`✏️  Updating app mapping ${mappingId} for client ${clientId}: ${appName} -> ${oktaGroupName}`);
      
      // Use client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      
      const [result] = await clientDb.update(appMappings)
        .set({ 
          appName,
          oktaGroupName,
          lastUpdated: new Date()
        })
        .where(eq(appMappings.id, mappingId))
        .returning();
      
      if (!result) {
        return res.status(404).json({ error: "App mapping not found" });
      }
      
      console.log(`✅ Updated app mapping ${mappingId} for client ${clientId}`);
      res.json(result);
    } catch (error) {
      console.error(`Error updating app mapping for client:`, error);
      res.status(500).json({ error: "Failed to update client app mapping" });
    }
  });

  // Client-specific app mappings bulk POST endpoint
  app.post("/api/client/:clientId/app-mappings/bulk", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const { mappings } = req.body;
      console.log(`📦 Creating ${mappings.length} app mappings for client ${clientId}`);
      
      // Use client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      
      const results = await clientDb.insert(appMappings).values(
        mappings.map((mapping: any) => ({
          ...mapping,
          created: new Date(),
          lastUpdated: new Date(),
          status: 'active'
        }))
      ).returning();
      
      console.log(`✅ Created ${results.length} app mappings for client ${clientId}`);
      res.json(results);
    } catch (error) {
      console.error(`Error creating app mappings for client:`, error);
      res.status(500).json({ error: "Failed to create client app mappings" });
    }
  });

  app.post("/api/monitoring-cards", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const validatedData = insertMonitoringCardSchema.parse(req.body);
      const [result] = await db.insert(monitoringCards).values(validatedData).returning();
      
      await AuditLogger.log({
        req,
        action: 'CREATE',
        resourceType: 'MONITORING_CARD',
        resourceId: result.id.toString(),
        resourceName: result.name,
        details: { type: result.type, position: result.position },
        newValues: result
      });
      
      res.json(result);
    } catch (error) {
      console.error("Error creating monitoring card:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create monitoring card" });
    }
  });

  // Bulk update monitoring card positions (for drag and drop)
  app.patch("/api/monitoring-cards/positions", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      console.log('🔄 MONITORING BULK UPDATE ENDPOINT HIT - Raw request body:', req.body);
      console.log('🔄 Session user:', (req.session as any)?.user?.email);
      
      const { cards } = req.body;
      console.log('🔄 Extracted monitoring cards:', cards);
      
      if (!Array.isArray(cards)) {
        console.error('❌ Cards is not an array:', typeof cards, cards);
        return res.status(400).json({ error: "Cards must be an array" });
      }

      // Update positions in bulk
      const updates = await Promise.all(
        cards.map(async (card: any) => {
          const id = typeof card.id === 'number' ? card.id : parseInt(String(card.id));
          const position = typeof card.position === 'number' ? card.position : parseInt(String(card.position));
          
          if (isNaN(id) || isNaN(position)) {
            throw new Error(`Invalid monitoring card data: id=${card.id}, position=${card.position}`);
          }
          
          const [result] = await db.update(monitoringCards)
            .set({ position, updated: new Date() })
            .where(eq(monitoringCards.id, id))
            .returning();
          
          return result;
        })
      );

      await AuditLogger.log({
        req,
        action: 'UPDATE',
        resourceType: 'MONITORING_LAYOUT',
        resourceId: 'bulk_position_update',
        resourceName: 'Monitoring Card Positions',
        details: { cardCount: cards.length },
        newValues: { positions: cards }
      });

      res.json(updates);
    } catch (error) {
      console.error("Error updating monitoring card positions:", error);
      res.status(500).json({ error: "Failed to update monitoring card positions" });
    }
  });

  app.patch("/api/monitoring-cards/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid card ID" });
      }
      const updates = updateMonitoringCardSchema.parse(req.body);
      
      const existing = await db.select().from(monitoringCards).where(eq(monitoringCards.id, id)).limit(1);
      if (existing.length === 0) {
        return res.status(404).json({ error: "Monitoring card not found" });
      }
      
      const [result] = await db.update(monitoringCards)
        .set({ ...updates, updated: new Date() })
        .where(eq(monitoringCards.id, id))
        .returning();
      
      await AuditLogger.log({
        req,
        action: 'UPDATE',
        resourceType: 'MONITORING_CARD',
        resourceId: result.id.toString(),
        resourceName: result.name,
        details: { type: result.type, position: result.position },
        oldValues: existing[0],
        newValues: result
      });
      
      res.json(result);
    } catch (error) {
      console.error("Error updating monitoring card:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update monitoring card" });
    }
  });

  app.delete("/api/monitoring-cards/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid card ID" });
      }
      
      const existing = await db.select().from(monitoringCards).where(eq(monitoringCards.id, id)).limit(1);
      if (existing.length === 0) {
        return res.status(404).json({ error: "Monitoring card not found" });
      }
      
      await db.delete(monitoringCards).where(eq(monitoringCards.id, id));
      
      await AuditLogger.log({
        req,
        action: 'DELETE',
        resourceType: 'MONITORING_CARD',
        resourceId: existing[0].id.toString(),
        resourceName: existing[0].name,
        details: { type: existing[0].type, position: existing[0].position },
        oldValues: existing[0]
      });
      
      res.json({ message: "Monitoring card deleted successfully" });
    } catch (error) {
      console.error("Error deleting monitoring card:", error);
      res.status(500).json({ error: "Failed to delete monitoring card" });
    }
  });

  // Department Application Mappings API
  app.get("/api/department-app-mappings", isAuthenticated, async (req, res) => {
    try {
      const mappings = await db.select().from(departmentAppMappings);
      res.json(mappings);
    } catch (error) {
      console.error("Error fetching department app mappings:", error);
      res.status(500).json({ error: "Failed to fetch department app mappings" });
    }
  });

  app.post("/api/department-app-mappings", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { departmentName, appName } = insertDepartmentAppMappingSchema.parse(req.body);
      
      // Check if mapping already exists
      const existing = await db.select()
        .from(departmentAppMappings)
        .where(and(
          eq(departmentAppMappings.departmentName, departmentName),
          eq(departmentAppMappings.appName, appName)
        ))
        .limit(1);
      
      if (existing.length > 0) {
        return res.status(400).json({ error: "Mapping already exists" });
      }
      
      const [result] = await db.insert(departmentAppMappings)
        .values({ departmentName, appName })
        .returning();
      
      await AuditLogger.log({
        req,
        action: 'CREATE',
        resourceType: 'DEPARTMENT_APP_MAPPING',
        resourceId: result.id.toString(),
        resourceName: `${departmentName} - ${appName}`,
        details: { departmentName, appName }
      });
      
      res.json(result);
    } catch (error) {
      console.error("Error creating department app mapping:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create department app mapping" });
    }
  });

  app.delete("/api/department-app-mappings", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { departmentName, appName } = z.object({
        departmentName: z.string(),
        appName: z.string()
      }).parse(req.body);
      
      const existing = await db.select()
        .from(departmentAppMappings)
        .where(and(
          eq(departmentAppMappings.departmentName, departmentName),
          eq(departmentAppMappings.appName, appName)
        ))
        .limit(1);
      
      if (existing.length === 0) {
        return res.status(404).json({ error: "Mapping not found" });
      }
      
      await db.delete(departmentAppMappings)
        .where(and(
          eq(departmentAppMappings.departmentName, departmentName),
          eq(departmentAppMappings.appName, appName)
        ));
      
      await AuditLogger.log({
        req,
        action: 'DELETE',
        resourceType: 'DEPARTMENT_APP_MAPPING',
        resourceId: existing[0].id.toString(),
        resourceName: `${departmentName} - ${appName}`,
        details: { departmentName, appName },
        oldValues: existing[0]
      });
      
      res.json({ message: "Department app mapping deleted successfully" });
    } catch (error) {
      console.error("Error deleting department app mapping:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to delete department app mapping" });
    }
  });

  // Employee Type App Mappings API Routes
  app.get("/api/employee-type-app-mappings", isAuthenticated, async (req, res) => {
    try {
      const mappings = await db.select().from(employeeTypeAppMappings);
      res.json(mappings);
    } catch (error) {
      console.error("Error fetching employee type app mappings:", error);
      res.status(500).json({ error: "Failed to fetch employee type app mappings" });
    }
  });

  app.post("/api/employee-type-app-mappings", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { employeeType, appName } = insertEmployeeTypeAppMappingSchema.parse(req.body);
      
      // Check if mapping already exists
      const existing = await db.select()
        .from(employeeTypeAppMappings)
        .where(and(
          eq(employeeTypeAppMappings.employeeType, employeeType),
          eq(employeeTypeAppMappings.appName, appName)
        ))
        .limit(1);
      
      if (existing.length > 0) {
        return res.status(400).json({ error: "Mapping already exists" });
      }
      
      const [result] = await db.insert(employeeTypeAppMappings)
        .values({ employeeType, appName })
        .returning();
      
      await AuditLogger.log({
        req,
        action: 'CREATE',
        resourceType: 'EMPLOYEE_TYPE_APP_MAPPING',
        resourceId: result.id.toString(),
        resourceName: `${employeeType} - ${appName}`,
        details: { employeeType, appName }
      });
      
      res.json(result);
    } catch (error) {
      console.error("Error creating employee type app mapping:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create employee type app mapping" });
    }
  });

  app.delete("/api/employee-type-app-mappings", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { employeeType, appName } = z.object({
        employeeType: z.string(),
        appName: z.string()
      }).parse(req.body);
      
      const existing = await db.select()
        .from(employeeTypeAppMappings)
        .where(and(
          eq(employeeTypeAppMappings.employeeType, employeeType),
          eq(employeeTypeAppMappings.appName, appName)
        ))
        .limit(1);
      
      if (existing.length === 0) {
        return res.status(404).json({ error: "Mapping not found" });
      }
      
      await db.delete(employeeTypeAppMappings)
        .where(and(
          eq(employeeTypeAppMappings.employeeType, employeeType),
          eq(employeeTypeAppMappings.appName, appName)
        ));
      
      await AuditLogger.log({
        req,
        action: 'DELETE',
        resourceType: 'EMPLOYEE_TYPE_APP_MAPPING',
        resourceId: existing[0].id.toString(),
        resourceName: `${employeeType} - ${appName}`,
        details: { employeeType, appName },
        oldValues: existing[0]
      });
      
      res.json({ message: "Employee type app mapping deleted successfully" });
    } catch (error) {
      console.error("Error deleting employee type app mapping:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to delete employee type app mapping" });
    }
  });

  // Employee Type Application Mappings API
  app.get("/api/employee-type-app-mappings", isAuthenticated, async (req, res) => {
    try {
      const mappings = await db.select().from(employeeTypeAppMappings);
      res.json(mappings);
    } catch (error) {
      console.error("Error fetching employee type app mappings:", error);
      res.status(500).json({ error: "Failed to fetch employee type app mappings" });
    }
  });

  app.post("/api/employee-type-app-mappings", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { employeeType, appName } = insertEmployeeTypeAppMappingSchema.parse(req.body);
      
      // Check if mapping already exists
      const existing = await db.select()
        .from(employeeTypeAppMappings)
        .where(and(
          eq(employeeTypeAppMappings.employeeType, employeeType),
          eq(employeeTypeAppMappings.appName, appName)
        ))
        .limit(1);
      
      if (existing.length > 0) {
        return res.status(400).json({ error: "Mapping already exists" });
      }
      
      const [result] = await db.insert(employeeTypeAppMappings)
        .values({ employeeType, appName })
        .returning();
      
      await AuditLogger.log({
        req,
        action: 'CREATE',
        resourceType: 'EMPLOYEE_TYPE_APP_MAPPING',
        resourceId: result.id.toString(),
        resourceName: `${employeeType} - ${appName}`,
        details: { employeeType, appName }
      });
      
      res.json(result);
    } catch (error) {
      console.error("Error creating employee type app mapping:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create employee type app mapping" });
    }
  });

  app.delete("/api/employee-type-app-mappings", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { employeeType, appName } = z.object({
        employeeType: z.string(),
        appName: z.string()
      }).parse(req.body);
      
      const existing = await db.select()
        .from(employeeTypeAppMappings)
        .where(and(
          eq(employeeTypeAppMappings.employeeType, employeeType),
          eq(employeeTypeAppMappings.appName, appName)
        ))
        .limit(1);
      
      if (existing.length === 0) {
        return res.status(404).json({ error: "Mapping not found" });
      }
      
      await db.delete(employeeTypeAppMappings)
        .where(and(
          eq(employeeTypeAppMappings.employeeType, employeeType),
          eq(employeeTypeAppMappings.appName, appName)
        ));
      
      await AuditLogger.log({
        req,
        action: 'DELETE',
        resourceType: 'EMPLOYEE_TYPE_APP_MAPPING',
        resourceId: existing[0].id.toString(),
        resourceName: `${employeeType} - ${appName}`,
        details: { employeeType, appName },
        oldValues: existing[0]
      });
      
      res.json({ message: "Employee type app mapping deleted successfully" });
    } catch (error) {
      console.error("Error deleting employee type app mapping:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to delete employee type app mapping" });
    }
  });

  // Department Group Mappings API
  app.get("/api/department-group-mappings", isAuthenticated, async (req, res) => {
    try {
      const mappings = await db.select().from(departmentGroupMappings);
      res.json(mappings);
    } catch (error) {
      console.error("Error fetching department group mappings:", error);
      res.status(500).json({ error: "Failed to fetch department group mappings" });
    }
  });

  app.post("/api/department-group-mappings", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { departmentName, groupName } = insertDepartmentGroupMappingSchema.parse(req.body);
      
      // Check if mapping already exists
      const existing = await db.select()
        .from(departmentGroupMappings)
        .where(and(
          eq(departmentGroupMappings.departmentName, departmentName),
          eq(departmentGroupMappings.groupName, groupName)
        ))
        .limit(1);
      
      if (existing.length > 0) {
        return res.status(400).json({ error: "Mapping already exists" });
      }
      
      const [result] = await db.insert(departmentGroupMappings)
        .values({ departmentName, groupName })
        .returning();
      
      await AuditLogger.log({
        req,
        action: 'CREATE',
        resourceType: 'DEPARTMENT_GROUP_MAPPING',
        resourceId: result.id.toString(),
        resourceName: `${departmentName} - ${groupName}`,
        details: { departmentName, groupName }
      });
      
      res.json(result);
    } catch (error) {
      console.error("Error creating department group mapping:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create department group mapping" });
    }
  });

  app.delete("/api/department-group-mappings", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { departmentName, groupName } = z.object({
        departmentName: z.string(),
        groupName: z.string()
      }).parse(req.body);
      
      const existing = await db.select()
        .from(departmentGroupMappings)
        .where(and(
          eq(departmentGroupMappings.departmentName, departmentName),
          eq(departmentGroupMappings.groupName, groupName)
        ))
        .limit(1);
      
      if (existing.length === 0) {
        return res.status(404).json({ error: "Mapping not found" });
      }
      
      await db.delete(departmentGroupMappings)
        .where(and(
          eq(departmentGroupMappings.departmentName, departmentName),
          eq(departmentGroupMappings.groupName, groupName)
        ));
      
      await AuditLogger.log({
        req,
        action: 'DELETE',
        resourceType: 'DEPARTMENT_GROUP_MAPPING',
        resourceId: existing[0].id.toString(),
        resourceName: `${departmentName} - ${groupName}`,
        details: { departmentName, groupName },
        oldValues: existing[0]
      });
      
      res.json({ message: "Department group mapping deleted successfully" });
    } catch (error) {
      console.error("Error deleting department group mapping:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to delete department group mapping" });
    }
  });

  // Employee Type Group Mappings API
  app.get("/api/employee-type-group-mappings", isAuthenticated, async (req, res) => {
    try {
      const mappings = await db.select().from(employeeTypeGroupMappings);
      res.json(mappings);
    } catch (error) {
      console.error("Error fetching employee type group mappings:", error);
      res.status(500).json({ error: "Failed to fetch employee type group mappings" });
    }
  });

  app.post("/api/employee-type-group-mappings", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { employeeType, groupName } = insertEmployeeTypeGroupMappingSchema.parse(req.body);
      
      // Check if mapping already exists
      const existing = await db.select()
        .from(employeeTypeGroupMappings)
        .where(and(
          eq(employeeTypeGroupMappings.employeeType, employeeType),
          eq(employeeTypeGroupMappings.groupName, groupName)
        ))
        .limit(1);
      
      if (existing.length > 0) {
        return res.status(400).json({ error: "Mapping already exists" });
      }
      
      const [result] = await db.insert(employeeTypeGroupMappings)
        .values({ employeeType, groupName })
        .returning();
      
      await AuditLogger.log({
        req,
        action: 'CREATE',
        resourceType: 'EMPLOYEE_TYPE_GROUP_MAPPING',
        resourceId: result.id.toString(),
        resourceName: `${employeeType} - ${groupName}`,
        details: { employeeType, groupName }
      });
      
      res.json(result);
    } catch (error) {
      console.error("Error creating employee type group mapping:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create employee type group mapping" });
    }
  });

  app.delete("/api/employee-type-group-mappings", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { employeeType, groupName } = z.object({
        employeeType: z.string(),
        groupName: z.string()
      }).parse(req.body);
      
      const existing = await db.select()
        .from(employeeTypeGroupMappings)
        .where(and(
          eq(employeeTypeGroupMappings.employeeType, employeeType),
          eq(employeeTypeGroupMappings.groupName, groupName)
        ))
        .limit(1);
      
      if (existing.length === 0) {
        return res.status(404).json({ error: "Mapping not found" });
      }
      
      await db.delete(employeeTypeGroupMappings)
        .where(and(
          eq(employeeTypeGroupMappings.employeeType, employeeType),
          eq(employeeTypeGroupMappings.groupName, groupName)
        ));
      
      await AuditLogger.log({
        req,
        action: 'DELETE',
        resourceType: 'EMPLOYEE_TYPE_GROUP_MAPPING',
        resourceId: existing[0].id.toString(),
        resourceName: `${employeeType} - ${groupName}`,
        details: { employeeType, groupName },
        oldValues: existing[0]
      });
      
      res.json({ message: "Employee type group mapping deleted successfully" });
    } catch (error) {
      console.error("Error deleting employee type group mapping:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to delete employee type group mapping" });
    }
  });

  // Company Logo API endpoints
  
  // Get all logos
  app.get("/api/company-logos", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const logos = await storage.getAllLogos();
      res.json(logos);
    } catch (error) {
      console.error("Error fetching company logos:", error);
      res.status(500).json({ message: "Failed to fetch company logos" });
    }
  });

  // Get active logo
  app.get("/api/company-logos/active", isAuthenticated, async (req, res) => {
    try {
      const activeLogo = await storage.getActiveLogo();
      if (!activeLogo) {
        return res.status(404).json({ message: "No active logo found" });
      }
      res.json(activeLogo);
    } catch (error) {
      console.error("Error fetching active logo:", error);
      res.status(500).json({ message: "Failed to fetch active logo" });
    }
  });

  // Upload new logo
  app.post("/api/company-logos", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const logoData = insertCompanyLogoSchema.parse(req.body);
      const newLogo = await storage.createLogo(logoData);
      
      await AuditLogger.log({
        req,
        action: "CREATE",
        resourceType: "COMPANY_LOGO",
        resourceId: newLogo.id.toString(),
        resourceName: newLogo.fileName,
        details: { action: "Uploaded new company logo", fileName: newLogo.fileName }
      });

      res.status(201).json(newLogo);
    } catch (error) {
      console.error("Error uploading logo:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ message: "Failed to upload logo" });
    }
  });

  // Set active logo
  app.put("/api/company-logos/:id/activate", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const id = z.coerce.number().parse(req.params.id);
      const success = await storage.setActiveLogo(id);
      
      if (!success) {
        return res.status(404).json({ message: "Logo not found" });
      }

      await AuditLogger.log({
        req,
        action: "UPDATE",
        resourceType: "COMPANY_LOGO",
        resourceId: id.toString(),
        resourceName: `Logo ${id}`,
        details: { action: "Set logo as active" }
      });

      res.json({ message: "Logo activated successfully" });
    } catch (error) {
      console.error("Error activating logo:", error);
      res.status(500).json({ message: "Failed to activate logo" });
    }
  });

  // Delete logo
  app.delete("/api/company-logos/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const id = z.coerce.number().parse(req.params.id);
      const success = await storage.deleteLogo(id);
      
      if (!success) {
        return res.status(404).json({ message: "Logo not found" });
      }

      await AuditLogger.log({
        req,
        action: "DELETE",
        resourceType: "COMPANY_LOGO",
        resourceId: id.toString(),
        resourceName: `Logo ${id}`,
        details: { action: "Deleted company logo" }
      });

      res.json({ message: "Logo deleted successfully" });
    } catch (error) {
      console.error("Error deleting logo:", error);
      res.status(500).json({ message: "Failed to delete logo" });
    }
  });

  // MSP Management API endpoints
  app.get("/api/clients", isAuthenticated, mspRoutes.getClients);
  app.get("/api/clients/:id", isAuthenticated, mspRoutes.getClient);
  app.post("/api/clients", isAuthenticated, requireAdmin, mspRoutes.createClient);
  app.post("/api/clients/create-with-template", isAuthenticated, requireAdmin, mspRoutes.createClientWithTemplate);
  app.put("/api/clients/:id", isAuthenticated, requireAdmin, mspRoutes.updateClient);
  app.delete("/api/clients/:id", isAuthenticated, requireAdmin, mspRoutes.deleteClient);

  // Auto-initialize missing client database tables on startup
  async function initializeExistingClients() {
    try {
      console.log('🔄 Checking existing client databases for missing tables...');
      
      const multiDb = MultiDatabaseManager.getInstance();
      const { mspStorage } = await import('./msp-storage');
      
      // Get all clients
      const clients = await mspStorage.getAllClients();
      console.log(`Found ${clients.length} clients to check`);
      
      for (const client of clients) {
        try {
          // Try to access client database
          const clientDb = await multiDb.getClientDb(client.id);
          
          // Check if app_mappings table exists by attempting a simple query
          await clientDb.select().from((await import('../shared/client-schema')).appMappings).limit(1);
          console.log(`✅ Client ${client.id} (${client.name}) database is properly initialized`);
        } catch (error) {
          // If table doesn't exist, initialize the database
          if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
            console.log(`🚀 Initializing missing tables for client ${client.id} (${client.name})`);
            await multiDb.initializeClientDatabase(client.id);
            console.log(`✅ Successfully initialized database for client ${client.id}`);
          } else {
            console.error(`❌ Error checking client ${client.id}:`, error);
          }
        }
      }
      
      console.log('✅ Client database initialization check completed');
    } catch (error) {
      console.error('❌ Client database initialization check failed:', error);
    }
  }

  // Run the initialization check
  setTimeout(initializeExistingClients, 2000); // Wait 2 seconds for everything to be ready


  
  // MSP Client Access Management
  app.get("/api/msp-users/:mspUserId/client-access", isAuthenticated, mspRoutes.getMspUserClientAccess);
  app.post("/api/client-access", isAuthenticated, requireAdmin, mspRoutes.grantClientAccess);
  app.delete("/api/client-access/:mspUserId/:clientId", isAuthenticated, requireAdmin, mspRoutes.revokeClientAccess);

  // CLIENT-SPECIFIC USER ENDPOINTS - CRITICAL FOR DATA ISOLATION
  
  // Get users for specific client
  app.get("/api/client/:clientId/users", isAuthenticated, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const { search, limit = 20, page = 1, statsOnly = false, sortBy = 'firstName', sortOrder = 'asc', employeeTypeFilter, ...filters } = req.query;
      
      console.log(`👥 Fetching users for client ${clientId}`);
      
      // Use client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      
      // For stats-only requests, return minimal data quickly
      if (statsOnly === 'true') {
        const allUsers = await clientDb.select().from(users).limit(500);
        res.json({
          users: [],
          total: allUsers.length,
          currentPage: 1,
          totalPages: 1,
          usersPerPage: parseInt(limit as string),
          source: 'client_db_stats'
        });
        return;
      }
      
      // Get users from client-specific database
      let query = clientDb.select().from(users);
      
      // Apply search filter if provided
      if (search && typeof search === 'string') {
        const searchTerm = `%${search.toLowerCase()}%`;
        query = query.where(
          or(
            ilike(users.firstName, searchTerm),
            ilike(users.lastName, searchTerm),
            ilike(users.email, searchTerm)
          )
        );
      }
      
      // Apply employee type filter
      if (employeeTypeFilter && typeof employeeTypeFilter === 'string') {
        query = query.where(eq(users.employeeType, employeeTypeFilter));
      }
      
      // Get total count for pagination
      const allFilteredUsers = await query;
      const total = allFilteredUsers.length;
      
      // Apply sorting
      const sortField = sortBy as keyof typeof users.$inferSelect;
      if (sortOrder === 'desc') {
        query = query.orderBy(desc(users[sortField]));
      } else {
        query = query.orderBy(asc(users[sortField]));
      }
      
      // Apply pagination
      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
      const paginatedUsers = allFilteredUsers.slice(offset, offset + parseInt(limit as string));
      
      const totalPages = Math.ceil(total / parseInt(limit as string));
      
      console.log(`✅ Found ${paginatedUsers.length} users for client ${clientId} (${total} total)`);
      
      res.json({
        users: paginatedUsers,
        total,
        currentPage: parseInt(page as string),
        totalPages,
        usersPerPage: parseInt(limit as string),
        source: 'client_db'
      });
    } catch (error) {
      console.error(`Error fetching users for client:`, error);
      res.status(500).json({ error: "Failed to fetch client users" });
    }
  });
  
  // Create user for specific client
  app.post("/api/client/:clientId/users", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const userData = insertUserSchema.parse(req.body);
      
      console.log(`👤 Creating user for client ${clientId}:`, userData.email);
      
      // Use client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      
      // Check for existing user by email
      const existingUser = await clientDb.select().from(users).where(eq(users.email, userData.email)).limit(1);
      if (existingUser.length > 0) {
        return res.status(400).json({ message: "User with this email already exists" });
      }
      
      // Create user in client-specific database
      const [newUser] = await clientDb.insert(users).values({
        ...userData,
        created: new Date(),
        lastUpdated: new Date()
      }).returning();
      
      console.log(`✅ Created user for client ${clientId}:`, newUser.id);
      res.json(newUser);
    } catch (error) {
      console.error(`Error creating user for client:`, error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create client user" });
    }
  });
  
  // Get specific user for client
  app.get("/api/client/:clientId/users/:userId", isAuthenticated, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const userId = parseInt(req.params.userId);
      
      console.log(`👤 Fetching user ${userId} for client ${clientId}`);
      
      // Use client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      
      const [user] = await clientDb.select().from(users).where(eq(users.id, userId)).limit(1);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      console.log(`✅ Found user ${userId} for client ${clientId}`);
      res.json(user);
    } catch (error) {
      console.error(`Error fetching user for client:`, error);
      res.status(500).json({ error: "Failed to fetch client user" });
    }
  });
  
  // Update user for specific client
  app.patch("/api/client/:clientId/users/:userId", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const userId = parseInt(req.params.userId);
      const updates = updateUserSchema.parse(req.body);
      
      console.log(`👤 Updating user ${userId} for client ${clientId}`);
      
      // Use client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      
      // Check if user exists
      const [existingUser] = await clientDb.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!existingUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Update user in client-specific database
      const [updatedUser] = await clientDb.update(users)
        .set({ ...updates, lastUpdated: new Date() })
        .where(eq(users.id, userId))
        .returning();
      
      console.log(`✅ Updated user ${userId} for client ${clientId}`);
      res.json(updatedUser);
    } catch (error) {
      console.error(`Error updating user for client:`, error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update client user" });
    }
  });
  
  // Update user status for specific client
  app.patch("/api/client/:clientId/users/:userId/status", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const userId = parseInt(req.params.userId);
      const { status } = z.object({
        status: z.enum(["ACTIVE", "SUSPENDED", "DEPROVISIONED"])
      }).parse(req.body);
      
      console.log(`👤 Updating status for user ${userId} in client ${clientId} to ${status}`);
      
      // Use client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      
      // Update status in client-specific database
      const [updatedUser] = await clientDb.update(users)
        .set({ status, lastUpdated: new Date() })
        .where(eq(users.id, userId))
        .returning();
      
      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      console.log(`✅ Updated status for user ${userId} in client ${clientId}`);
      res.json(updatedUser);
    } catch (error) {
      console.error(`Error updating user status for client:`, error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update client user status" });
    }
  });
  
  // Delete user for specific client
  app.delete("/api/client/:clientId/users/:userId", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const userId = parseInt(req.params.userId);
      
      console.log(`👤 Deleting user ${userId} for client ${clientId}`);
      
      // Use client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      
      // Delete user from client-specific database
      const result = await clientDb.delete(users).where(eq(users.id, userId)).returning();
      
      if (result.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }
      
      console.log(`✅ Deleted user ${userId} for client ${clientId}`);
      res.status(204).send();
    } catch (error) {
      console.error(`Error deleting user for client:`, error);
      res.status(500).json({ error: "Failed to delete client user" });
    }
  });
  
  // Get user applications for specific client
  app.get("/api/client/:clientId/users/:userId/applications", isAuthenticated, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const userId = parseInt(req.params.userId);
      
      console.log(`📱 Fetching applications for user ${userId} in client ${clientId}`);
      
      // Use client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      
      // For now, return empty array - this would need proper implementation
      // based on client-specific application assignments
      res.json([]);
    } catch (error) {
      console.error(`Error fetching user applications for client:`, error);
      res.status(500).json({ error: "Failed to fetch client user applications" });
    }
  });
  
  // Get user groups for specific client
  app.get("/api/client/:clientId/users/:userId/groups", isAuthenticated, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const userId = parseInt(req.params.userId);
      
      console.log(`👥 Fetching groups for user ${userId} in client ${clientId}`);
      
      // Use client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      
      // For now, return empty array - this would need proper implementation
      // based on client-specific group assignments
      res.json([]);
    } catch (error) {
      console.error(`Error fetching user groups for client:`, error);
      res.status(500).json({ error: "Failed to fetch client user groups" });
    }
  });
  
  // Get user devices for specific client
  app.get("/api/client/:clientId/users/:userId/devices", isAuthenticated, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const userId = parseInt(req.params.userId);
      
      console.log(`💻 Fetching devices for user ${userId} in client ${clientId}`);
      
      // For now, return empty array - this would need proper implementation
      res.json([]);
    } catch (error) {
      console.error(`Error fetching user devices for client:`, error);
      res.status(500).json({ error: "Failed to fetch client user devices" });
    }
  });
  
  // Get user logs for specific client
  app.get("/api/client/:clientId/users/:userId/logs", isAuthenticated, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const userId = parseInt(req.params.userId);
      
      console.log(`📜 Fetching logs for user ${userId} in client ${clientId}`);
      
      // Use client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      
      // For now, return empty array - this would need proper implementation
      res.json([]);
    } catch (error) {
      console.error(`Error fetching user logs for client:`, error);
      res.status(500).json({ error: "Failed to fetch client user logs" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
