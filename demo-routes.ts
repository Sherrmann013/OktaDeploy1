import { Express } from "express";
import { createServer } from "http";
import { demoStorage, type DemoUser, insertDemoUserSchema } from "./storage";
import { z } from "zod";

export function registerRoutes(app: Express) {
  const server = createServer(app);

  // Demo Authentication
  app.post("/api/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password required" });
      }

      const isValid = await demoStorage.authenticateAdmin(username, password);
      
      if (!isValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Create demo admin session
      (req.session as any).userId = 1;
      (req.session as any).user = {
        id: 1,
        role: "admin",
        email: "demo-admin@company.com",
        firstName: "Demo",
        lastName: "Admin"
      };

      res.json({
        id: 1,
        role: "admin",
        email: "demo-admin@company.com",
        firstName: "Demo",
        lastName: "Admin"
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Could not log out" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/user", (req, res) => {
    const user = (req.session as any)?.user;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    res.json(user);
  });

  // User Management Routes
  app.get("/api/users", async (req, res) => {
    try {
      const { search, status, department, employeeType, limit, offset } = req.query;
      
      const options = {
        search: search as string,
        status: status as string,
        department: department as string,
        employeeType: employeeType as string,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      };

      const result = await demoStorage.getAllUsers(options);
      res.json(result);
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = await demoStorage.getUser(id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(user);
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const userData = insertDemoUserSchema.parse(req.body);
      const user = await demoStorage.createUser(userData);
      res.status(201).json(user);
    } catch (error) {
      console.error("Create user error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid user data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.put("/api/users/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = insertDemoUserSchema.partial().parse(req.body);
      
      const user = await demoStorage.updateUser(id, updates);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(user);
    } catch (error) {
      console.error("Update user error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid user data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await demoStorage.deleteUser(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Delete user error:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Dashboard Statistics
  app.get("/api/employee-type-counts", async (req, res) => {
    try {
      const { users } = await demoStorage.getAllUsers();
      const counts = users.reduce((acc, user) => {
        const type = user.employeeType || 'UNKNOWN';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      res.json(counts);
    } catch (error) {
      console.error("Get employee type counts error:", error);
      res.status(500).json({ message: "Failed to fetch employee type counts" });
    }
  });

  app.get("/api/department-counts", async (req, res) => {
    try {
      const { users } = await demoStorage.getAllUsers();
      const counts = users.reduce((acc, user) => {
        const dept = user.department || 'Unknown';
        acc[dept] = (acc[dept] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      res.json(counts);
    } catch (error) {
      console.error("Get department counts error:", error);
      res.status(500).json({ message: "Failed to fetch department counts" });
    }
  });

  app.get("/api/user-status-counts", async (req, res) => {
    try {
      const { users } = await demoStorage.getAllUsers();
      const counts = users.reduce((acc, user) => {
        acc[user.status] = (acc[user.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      res.json(counts);
    } catch (error) {
      console.error("Get user status counts error:", error);
      res.status(500).json({ message: "Failed to fetch user status counts" });
    }
  });

  // Mock security training data
  app.get("/api/security-training/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const user = await demoStorage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Generate mock training data
      const mockTraining = {
        enrollments: [
          {
            campaign_name: "Security Awareness Training 2024",
            status: "Completed",
            start_date: "2024-01-15T00:00:00.000Z",
            completion_date: "2024-01-20T00:00:00.000Z",
            score: 85
          },
          {
            campaign_name: "Phishing Simulation Q1",
            status: "Completed",
            start_date: "2024-03-01T00:00:00.000Z",
            completion_date: "2024-03-15T00:00:00.000Z",
            score: 92
          },
          {
            campaign_name: "Data Protection Training",
            status: "In Progress",
            start_date: "2024-06-01T00:00:00.000Z",
            completion_date: null,
            score: null
          }
        ],
        overallScore: 88,
        completionRate: 67
      };

      res.json(mockTraining);
    } catch (error) {
      console.error("Get security training error:", error);
      res.status(500).json({ message: "Failed to fetch security training data" });
    }
  });

  return server;
}