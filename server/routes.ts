import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, updateUserSchema } from "@shared/schema";
import { z } from "zod";
import { oktaService } from "./okta-service";
import { syncSpecificUser } from "./okta-sync";
import { knowBe4Service } from "./knowbe4-service";
import { knowBe4GraphService } from "./knowbe4-graph-service";

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
      const oktaUser = await oktaService.getUserByEmail(email);
      
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

  // Get employee type group counts from OKTA
  app.get("/api/employee-type-counts", isAuthenticated, async (req, res) => {
    try {
      const counts = await oktaService.getEmployeeTypeGroupCounts();
      res.json(counts);
    } catch (error) {
      console.error("Error fetching employee type counts:", error);
      res.status(500).json({ error: "Failed to fetch employee type counts" });
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
        
        // Filter by query if provided - search from beginning of names
        if (query && query.trim().length > 0) {
          const searchTerm = query.trim().toLowerCase();
          console.log(`Manager search query: "${searchTerm}", total managers: ${managerList.length}`);
          managerList = managerList.filter(manager => {
            const fullName = manager.toLowerCase();
            const nameParts = fullName.split(' ');
            // Match if query starts any part of the name (first name, last name)
            return nameParts.some(part => part.startsWith(searchTerm)) || fullName.startsWith(searchTerm);
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
      const limit = z.coerce.number().min(1).max(500).default(10).parse(req.query.limit);
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
        });
        
        const totalPages = Math.ceil(result.total / limit);
        
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

      // Create user in OKTA
      const oktaResponse = await fetch(`${process.env.OKTA_DOMAIN}/api/v1/users?activate=${userData.sendActivationEmail}`, {
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
        created: new Date(oktaUser.created),
        lastUpdated: new Date(oktaUser.lastUpdated),
        lastLogin: oktaUser.lastLogin ? new Date(oktaUser.lastLogin) : null,
        passwordChanged: oktaUser.passwordChanged ? new Date(oktaUser.passwordChanged) : null,
        employeeType: userData.employeeType,
        sendActivationEmail: userData.sendActivationEmail,
      });

      // Add user to employee type groups if specified
      if (userData.employeeType) {
        try {
          const groupMapping = {
            'EMPLOYEE': 'MTX-ET-Employee',
            'CONTRACTOR': 'MTX-ET-Contractor', 
            'INTERN': 'MTX-ET-Intern',
            'PART_TIME': 'MTX-ET-Part_Time'
          };
          
          const groupName = groupMapping[userData.employeeType.toUpperCase()];
          if (groupName) {
            // Find the group ID in OKTA
            const groups = await oktaService.getGroups();
            const targetGroup = groups.find(g => g.profile.name === groupName);
            
            if (targetGroup) {
              await oktaService.addUserToGroup(oktaUser.id, targetGroup.id);
              console.log(`Added user to group: ${groupName}`);
            }
          }
        } catch (error) {
          console.error('Error adding user to employee type group:', error);
          // Don't fail the entire request for group assignment issues
        }
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

      // Deactivate user in OKTA first if they have an OKTA ID
      if (user.oktaId) {
        try {
          console.log(`Deactivating user in OKTA: ${user.oktaId}`);
          await oktaService.deactivateUser(user.oktaId);
          console.log(`Successfully deactivated user in OKTA: ${user.oktaId}`);
        } catch (oktaError) {
          console.error(`Failed to deactivate user in OKTA: ${user.oktaId}`, oktaError);
          // Don't fail the entire operation if OKTA deactivation fails
          // Continue with local deletion for data consistency
        }
      } else {
        console.log('User has no OKTA ID, skipping OKTA deactivation');
      }
      
      // Delete from local storage
      const deleted = await storage.deleteUser(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "User not found in local storage" });
      }

      console.log(`Successfully deleted user from local storage: ${user.email}`);
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
            if (oktaUser.profile.email === 'ejimenez@mazetx.com') {
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
              lastUpdated: new Date(oktaUser.lastUpdated),
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
              lastUpdated: new Date(oktaUser.lastUpdated),
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


  // Full OKTA sync - fetch all users with pagination
  app.get("/api/okta/sync-all", requireAdmin, async (req, res) => {
    try {
      console.log("Starting full OKTA sync with pagination...");
      const allUsers = await oktaService.getUsers(200); // This will now paginate through all users
      console.log(`Found ${allUsers.length} users in OKTA`);
      
      let syncedCount = 0;
      let updatedCount = 0;
      
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
              lastUpdated: new Date(oktaUser.lastUpdated),
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
      const susanFields = {};
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
          lastUpdated: transformedUser.lastUpdated,
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
        target: log.target?.map(t => ({
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
                lastLogin: oktaLastLogin,
                lastUpdated: new Date()
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

  const httpServer = createServer(app);
  return httpServer;
}
