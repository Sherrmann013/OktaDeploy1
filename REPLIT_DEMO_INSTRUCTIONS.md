# Security Dashboard Demo - Complete Replit Setup

## Step 1: Create New Replit Project
1. Go to Replit.com → Create → Node.js template
2. Name: "security-dashboard-demo"

## Step 2: Install Dependencies
Run in Shell:
```bash
npm install express express-session memorystore @tanstack/react-query react react-dom wouter zod @types/express @types/express-session @types/node typescript tsx vite @vitejs/plugin-react tailwindcss autoprefixer postcss @radix-ui/react-slot @radix-ui/react-dialog @radix-ui/react-select @radix-ui/react-label lucide-react clsx tailwind-merge class-variance-authority
```

## Step 3: Create File Structure
Create these directories:
- server/
- client/src/
- shared/

## Step 4: Copy Files (in next sections)

---

## FILE: package.json
Replace entire contents:
```json
{
  "name": "security-dashboard-demo",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "NODE_ENV=development tsx server/index.ts",
    "build": "vite build",
    "start": "NODE_ENV=production node dist/index.js"
  },
  "dependencies": {
    "express": "^4.21.2",
    "express-session": "^1.18.1",
    "memorystore": "^1.6.7",
    "@tanstack/react-query": "^5.60.5",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "wouter": "^3.3.5",
    "zod": "^3.24.2",
    "lucide-react": "^0.453.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.6.0",
    "class-variance-authority": "^0.7.1",
    "@radix-ui/react-slot": "^1.2.0",
    "@radix-ui/react-dialog": "^1.1.7",
    "@radix-ui/react-select": "^2.1.7",
    "@radix-ui/react-label": "^2.1.3"
  },
  "devDependencies": {
    "@types/express": "4.17.21",
    "@types/express-session": "^1.18.0",
    "@types/node": "20.16.11",
    "@types/react": "^18.3.11",
    "@types/react-dom": "^18.3.1",
    "typescript": "5.6.3",
    "tsx": "^4.19.1",
    "vite": "^5.4.14",
    "@vitejs/plugin-react": "^4.3.2",
    "tailwindcss": "^3.4.17",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47"
  }
}
```

---

## FILE: server/index.ts
```typescript
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes.js";
import { setupVite, log } from "./vite.js";
import session from "express-session";
import MemoryStore from "memorystore";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const MemoryStoreSession = MemoryStore(session);
app.use(session({
  secret: 'demo-secret-key',
  resave: false,
  saveUninitialized: false,
  store: new MemoryStoreSession({
    checkPeriod: 86400000
  }),
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }
      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });

  log("Demo mode, setting up Vite");
  await setupVite(app, server);

  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`Demo dashboard serving on port ${port}`);
  });
})();
```

---

## FILE: server/storage.ts
```typescript
import { z } from "zod";

export const demoUserSchema = z.object({
  id: z.number(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
  login: z.string(),
  mobilePhone: z.string().nullable(),
  department: z.string().nullable(),
  title: z.string().nullable(),
  employeeType: z.enum(['EMPLOYEE', 'CONTRACTOR', 'INTERN', 'PART_TIME']).nullable(),
  manager: z.string().nullable(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DEPROVISIONED']).default('ACTIVE'),
  groups: z.array(z.string()).default([]),
  applications: z.array(z.string()).default([]),
  created: z.date(),
  lastUpdated: z.date(),
  lastLogin: z.date().nullable(),
  passwordChanged: z.date().nullable(),
});

export const insertDemoUserSchema = demoUserSchema.omit({ id: true, created: true, lastUpdated: true });

export type DemoUser = z.infer<typeof demoUserSchema>;
export type InsertDemoUser = z.infer<typeof insertDemoUserSchema>;

export interface IDemoStorage {
  getUser(id: number): Promise<DemoUser | undefined>;
  getUserByEmail(email: string): Promise<DemoUser | undefined>;
  getUserByLogin(login: string): Promise<DemoUser | undefined>;
  getAllUsers(options?: {
    search?: string;
    status?: string;
    department?: string;
    employeeType?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ users: DemoUser[]; total: number }>;
  createUser(user: InsertDemoUser): Promise<DemoUser>;
  updateUser(id: number, updates: Partial<InsertDemoUser>): Promise<DemoUser | undefined>;
  deleteUser(id: number): Promise<boolean>;
  authenticateAdmin(username: string, password: string): Promise<boolean>;
}

export class DemoStorage implements IDemoStorage {
  private users: Map<number, DemoUser>;
  private currentId: number;

  constructor() {
    this.users = new Map();
    this.currentId = 1;
    this.seedDemoData();
  }

  private seedDemoData() {
    const demoUsers = [
      {
        firstName: "Christopher", lastName: "Walker", email: "christopher.walker@company.com", login: "christopher.walker",
        mobilePhone: "+1 (555) 123-4567", department: "IT Security", title: "CISO", employeeType: "EMPLOYEE" as const,
        manager: "Sarah Johnson", status: "ACTIVE" as const, groups: ["IT Security", "Executive"], applications: ["Microsoft 365", "Okta"],
        lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000), passwordChanged: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
      },
      {
        firstName: "Sarah", lastName: "Johnson", email: "sarah.johnson@company.com", login: "sarah.johnson",
        mobilePhone: "+1 (555) 234-5678", department: "Executive", title: "CEO", employeeType: "EMPLOYEE" as const,
        manager: null, status: "ACTIVE" as const, groups: ["Executive", "All Staff"], applications: ["Microsoft 365", "Salesforce"],
        lastLogin: new Date(Date.now() - 4 * 60 * 60 * 1000), passwordChanged: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000)
      },
      {
        firstName: "Michael", lastName: "Chen", email: "michael.chen@company.com", login: "michael.chen",
        mobilePhone: "+1 (555) 345-6789", department: "IT Security", title: "Security Engineer", employeeType: "EMPLOYEE" as const,
        manager: "Christopher Walker", status: "ACTIVE" as const, groups: ["IT Security", "Engineering"], applications: ["Microsoft 365", "Splunk"],
        lastLogin: new Date(Date.now() - 1 * 60 * 60 * 1000), passwordChanged: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      },
      {
        firstName: "Emily", lastName: "Rodriguez", email: "emily.rodriguez@company.com", login: "emily.rodriguez",
        mobilePhone: "+1 (555) 456-7890", department: "HR", title: "HR Director", employeeType: "EMPLOYEE" as const,
        manager: "Sarah Johnson", status: "ACTIVE" as const, groups: ["HR", "Management"], applications: ["Microsoft 365", "BambooHR"],
        lastLogin: new Date(Date.now() - 3 * 60 * 60 * 1000), passwordChanged: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
      },
      {
        firstName: "David", lastName: "Thompson", email: "david.thompson@company.com", login: "david.thompson",
        mobilePhone: "+1 (555) 567-8901", department: "IT", title: "IT Manager", employeeType: "EMPLOYEE" as const,
        manager: "Christopher Walker", status: "ACTIVE" as const, groups: ["IT", "Management"], applications: ["Microsoft 365", "ServiceNow"],
        lastLogin: new Date(Date.now() - 6 * 60 * 60 * 1000), passwordChanged: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000)
      }
    ];

    demoUsers.forEach((userData) => {
      const user: DemoUser = {
        id: this.currentId++,
        ...userData,
        created: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000),
        lastUpdated: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
      };
      this.users.set(user.id, user);
    });
  }

  async authenticateAdmin(username: string, password: string): Promise<boolean> {
    return username === "demo-admin" && password === "demo123";
  }

  async getUser(id: number): Promise<DemoUser | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<DemoUser | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async getUserByLogin(login: string): Promise<DemoUser | undefined> {
    return Array.from(this.users.values()).find(user => user.login === login);
  }

  async getAllUsers(options?: {
    search?: string;
    status?: string;
    department?: string;
    employeeType?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ users: DemoUser[]; total: number }> {
    let filteredUsers = Array.from(this.users.values());

    if (options?.search) {
      const search = options.search.toLowerCase();
      filteredUsers = filteredUsers.filter(user =>
        user.firstName.toLowerCase().includes(search) ||
        user.lastName.toLowerCase().includes(search) ||
        user.email.toLowerCase().includes(search) ||
        user.login.toLowerCase().includes(search)
      );
    }

    if (options?.status) {
      filteredUsers = filteredUsers.filter(user => user.status === options.status);
    }

    if (options?.department) {
      filteredUsers = filteredUsers.filter(user => user.department === options.department);
    }

    if (options?.employeeType) {
      filteredUsers = filteredUsers.filter(user => user.employeeType === options.employeeType);
    }

    const total = filteredUsers.length;

    if (options?.offset) {
      filteredUsers = filteredUsers.slice(options.offset);
    }
    if (options?.limit) {
      filteredUsers = filteredUsers.slice(0, options.limit);
    }

    return { users: filteredUsers, total };
  }

  async createUser(insertUser: InsertDemoUser): Promise<DemoUser> {
    const id = this.currentId++;
    const user: DemoUser = {
      id,
      firstName: insertUser.firstName,
      lastName: insertUser.lastName,
      email: insertUser.email,
      login: insertUser.login,
      mobilePhone: insertUser.mobilePhone || null,
      department: insertUser.department || null,
      title: insertUser.title || null,
      employeeType: insertUser.employeeType || null,
      manager: insertUser.manager || null,
      status: insertUser.status || "ACTIVE",
      groups: insertUser.groups || [],
      applications: insertUser.applications || [],
      created: new Date(),
      lastUpdated: new Date(),
      lastLogin: insertUser.lastLogin || null,
      passwordChanged: insertUser.passwordChanged || null,
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: number, updates: Partial<InsertDemoUser>): Promise<DemoUser | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;

    const updatedUser: DemoUser = {
      ...user,
      ...updates,
      lastUpdated: new Date(),
    };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async deleteUser(id: number): Promise<boolean> {
    return this.users.delete(id);
  }
}

export const demoStorage = new DemoStorage();
```

## Next: Continue with routes.ts and frontend files...

Copy this file into your new Replit project and I'll provide the remaining files in the next response.