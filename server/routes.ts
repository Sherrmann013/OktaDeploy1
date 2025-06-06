import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, updateUserSchema } from "@shared/schema";
import { z } from "zod";
import { oktaService } from "./okta-service";
import { syncSpecificUser } from "./okta-sync";
import { setupLocalAuth, isAuthenticated, requireAdmin } from "./local-auth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  await setupLocalAuth(app);

  // Auth routes are handled by setupLocalAuth

  // Logout route is handled by setupLocalAuth

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

  // Get all users with fallback from OKTA to local storage
  app.get("/api/users", isAuthenticated, async (req, res) => {
    try {
      const searchQuery = z.string().optional().parse(req.query.search);
      const statusFilter = z.string().optional().parse(req.query.status);
      const departmentFilter = z.string().optional().parse(req.query.department);
      const page = z.coerce.number().default(1).parse(req.query.page);
      const limit = z.coerce.number().default(10).parse(req.query.limit);
      const sortBy = z.string().default("firstName").parse(req.query.sortBy);
      const sortOrder = z.enum(["asc", "desc"]).default("asc").parse(req.query.sortOrder);

      try {
        // Try to fetch users from OKTA first
        const oktaUsers = await oktaService.getUsers(200);
        
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
        
        // Apply status filter
        if (statusFilter) {
          filteredUsers = filteredUsers.filter(user => user.status === statusFilter);
        }
        
        // Apply department filter
        if (departmentFilter) {
          filteredUsers = filteredUsers.filter(user => 
            user.profile.department?.toLowerCase() === departmentFilter.toLowerCase()
          );
        }
        
        // Apply sorting
        filteredUsers.sort((a, b) => {
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
            case 'status':
              aValue = a.status || '';
              bValue = b.status || '';
              break;
            case 'lastLogin':
              aValue = a.lastLogin || '';
              bValue = b.lastLogin || '';
              break;
            default:
              aValue = a.profile.firstName || '';
              bValue = b.profile.firstName || '';
          }
          
          if (sortOrder === 'desc') {
            return bValue.localeCompare(aValue);
          } else {
            return aValue.localeCompare(bValue);
          }
        });
        
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
      
      // Check if email or login already exists
      const existingEmail = await storage.getUserByEmail(userData.email);
      if (existingEmail) {
        return res.status(400).json({ message: "User with this email already exists" });
      }

      const existingLogin = await storage.getUserByLogin(userData.login);
      if (existingLogin) {
        return res.status(400).json({ message: "User with this login already exists" });
      }

      // In a real implementation, this would create the user in OKTA first
      // const oktaUser = await oktaClient.createUser(userData);
      
      const user = await storage.createUser({
        ...userData,
        oktaId: `okta_${Date.now()}`, // Mock OKTA ID
      });

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
            const oktaUpdateResponse = await fetch(`https://${process.env.OKTA_DOMAIN}/api/v1/users/${currentUser.oktaId}`, {
              method: 'POST',
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `SSWS ${process.env.OKTA_API_TOKEN_ENHANCED}`,
              },
              body: JSON.stringify({
                profile: oktaUpdates
              })
            });

            if (!oktaUpdateResponse.ok) {
              const errorData = await oktaUpdateResponse.text();
              console.error(`Failed to update user in OKTA: ${oktaUpdateResponse.status} ${oktaUpdateResponse.statusText}`, errorData);
              throw new Error(`OKTA update failed: ${oktaUpdateResponse.status} ${oktaUpdateResponse.statusText}`);
            }

            const oktaUpdatedUser = await oktaUpdateResponse.json();
            console.log(`Successfully updated user in OKTA:`, oktaUpdatedUser.profile);
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

      res.json(updatedUser);
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
      
      // In a real implementation, this would deactivate the user in OKTA
      // await oktaClient.deactivateUser(user.oktaId);
      
      const deleted = await storage.deleteUser(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "User not found" });
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

  const httpServer = createServer(app);
  return httpServer;
}
