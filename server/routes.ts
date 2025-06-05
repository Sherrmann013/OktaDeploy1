import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, updateUserSchema } from "@shared/schema";
import { z } from "zod";
import { oktaService } from "./okta-service";
import { syncSpecificUser } from "./okta-sync";

export async function registerRoutes(app: Express): Promise<Server> {
  // Get all users with optional filtering and pagination
  app.get("/api/users", async (req, res) => {
    try {
      const searchQuery = z.string().optional().parse(req.query.search);
      const statusFilter = z.string().optional().parse(req.query.status);
      const departmentFilter = z.string().optional().parse(req.query.department);
      const limit = z.coerce.number().optional().parse(req.query.limit);
      const offset = z.coerce.number().optional().parse(req.query.offset);

      const result = await storage.getAllUsers({
        search: searchQuery,
        status: statusFilter,
        department: departmentFilter,
        limit,
        offset,
      });

      res.json(result);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Get single user by ID
  app.get("/api/users/:id", async (req, res) => {
    try {
      const id = z.coerce.number().parse(req.params.id);
      const user = await storage.getUser(id);
      
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
  app.post("/api/users", async (req, res) => {
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
  app.patch("/api/users/:id", async (req, res) => {
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
  app.delete("/api/users/:id", async (req, res) => {
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
  app.patch("/api/users/:id/status", async (req, res) => {
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
  app.get("/api/okta/test-connection", async (req, res) => {
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
  app.post("/api/okta/sync-user", async (req, res) => {
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

  const httpServer = createServer(app);
  return httpServer;
}
