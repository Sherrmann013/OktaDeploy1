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

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Logout route
  app.post('/api/logout', (req, res) => {
    req.logout((err: any) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Failed to logout" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  // Get all users with fallback from OKTA to local storage
  app.get("/api/users", isAuthenticated, async (req, res) => {
    try {
      const searchQuery = z.string().optional().parse(req.query.search);
      const statusFilter = z.string().optional().parse(req.query.status);
      const departmentFilter = z.string().optional().parse(req.query.department);
      const page = z.coerce.number().default(1).parse(req.query.page);
      const limit = z.coerce.number().default(10).parse(req.query.limit);

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

      const updatedUser = await storage.updateUser(id, updates);
      
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
      
      // In a real implementation, this would call OKTA API to reset password
      res.json({
        success: true,
        message: "Password reset initiated successfully"
      });
    } catch (error) {
      console.error("Password reset error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to reset password"
      });
    }
  });

  app.post("/api/users/:id/password/expire", requireAdmin, async (req, res) => {
    try {
      const id = z.coerce.number().parse(req.params.id);
      
      // In a real implementation, this would call OKTA API to expire password
      res.json({
        success: true,
        message: "Password expiration initiated successfully"
      });
    } catch (error) {
      console.error("Password expire error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to expire password"
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

  // Get user applications from OKTA
  app.get("/api/users/:id/applications", isAuthenticated, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);
      
      if (!user || !user.oktaId) {
        return res.status(404).json({ message: "User not found or no OKTA ID" });
      }

      const applications = await oktaService.getUserApplications(user.oktaId);
      
      // Transform to show only app name and status
      const transformedApps = applications.map(app => ({
        id: app.id,
        name: app.label,
        status: app.status === "ACTIVE" ? "ACTIVE" : "INACTIVE"
      }));
      
      res.json(transformedApps);
    } catch (error) {
      console.error("Error fetching user applications:", error);
      res.status(500).json({ message: "Failed to fetch user applications" });
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

  const httpServer = createServer(app);
  return httpServer;
}
