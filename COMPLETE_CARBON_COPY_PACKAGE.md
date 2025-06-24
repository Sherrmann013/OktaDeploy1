# COMPLETE CARBON COPY - Security Dashboard Demo

## EXACT REPLICA INSTRUCTIONS

### Step 1: Create New Replit Project
1. Create Node.js project named "security-dashboard-demo"
2. Copy ALL files below EXACTLY as provided

---

## FILE: package.json
```json
{
  "name": "security-dashboard-demo",
  "version": "1.0.0",
  "type": "module",
  "license": "MIT",
  "scripts": {
    "dev": "NODE_ENV=development tsx server/index.ts",
    "build": "vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
    "start": "NODE_ENV=production node dist/index.js",
    "check": "tsc"
  },
  "dependencies": {
    "@hookform/resolvers": "^3.10.0",
    "@radix-ui/react-alert-dialog": "^1.1.7",
    "@radix-ui/react-avatar": "^1.1.4",
    "@radix-ui/react-checkbox": "^1.1.5",
    "@radix-ui/react-dialog": "^1.1.7",
    "@radix-ui/react-dropdown-menu": "^2.1.7",
    "@radix-ui/react-label": "^2.1.3",
    "@radix-ui/react-select": "^2.1.7",
    "@radix-ui/react-separator": "^1.1.3",
    "@radix-ui/react-slot": "^1.2.0",
    "@radix-ui/react-switch": "^1.1.4",
    "@radix-ui/react-tabs": "^1.1.4",
    "@radix-ui/react-toast": "^1.2.7",
    "@radix-ui/react-tooltip": "^1.2.0",
    "@tanstack/react-query": "^5.60.5",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "date-fns": "^3.6.0",
    "express": "^4.21.2",
    "express-session": "^1.18.1",
    "framer-motion": "^11.13.1",
    "lucide-react": "^0.453.0",
    "memorystore": "^1.6.7",
    "next-themes": "^0.4.6",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-hook-form": "^7.55.0",
    "react-icons": "^5.4.0",
    "tailwind-merge": "^2.6.0",
    "tailwindcss-animate": "^1.0.7",
    "wouter": "^3.3.5",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@tailwindcss/typography": "^0.5.15",
    "@types/express": "4.17.21",
    "@types/express-session": "^1.18.0",
    "@types/node": "20.16.11",
    "@types/react": "^18.3.11",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.2",
    "autoprefixer": "^10.4.20",
    "esbuild": "^0.25.0",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.17",
    "tailwindcss-animate": "^1.0.7",
    "tsx": "^4.19.1",
    "typescript": "5.6.3",
    "vite": "^5.4.14"
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
  secret: 'demo-secret-key-change-in-production',
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

  if (path === '/api/login' || path === '/api/okta-login') {
    console.log('=== REQUEST TO AUTHENTICATION ENDPOINT ===');
    console.log('Path:', path);
    console.log('Method:', req.method);
    console.log('URL:', req.url);
    console.log('Time:', new Date().toISOString());
  }

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
    this.currentId = 324;
    this.seedRealData();
  }

  private seedRealData() {
    // EXACT DATA FROM YOUR CURRENT DATABASE
    const realUsers = [
      { id: 304, firstName: "Sarah", lastName: "Johnson", email: "sarah.johnson@company.com", login: "sarah.johnson@company.com", mobilePhone: "555-0101", department: "IT Security", title: "Chief Information Security Officer", status: "ACTIVE" as const, employeeType: "EMPLOYEE" as const, manager: "David Chen" },
      { id: 305, firstName: "Michael", lastName: "Rodriguez", email: "michael.rodriguez@company.com", login: "michael.rodriguez@company.com", mobilePhone: "555-0102", department: "IT Security", title: "Security Analyst", status: "ACTIVE" as const, employeeType: "EMPLOYEE" as const, manager: "Sarah Johnson" },
      { id: 306, firstName: "Jennifer", lastName: "Wu", email: "jennifer.wu@company.com", login: "jennifer.wu@company.com", mobilePhone: "555-0103", department: "IT Security", title: "Penetration Tester", status: "ACTIVE" as const, employeeType: "CONTRACTOR" as const, manager: "Sarah Johnson" },
      { id: 307, firstName: "David", lastName: "Chen", email: "david.chen@company.com", login: "david.chen@company.com", mobilePhone: "555-0104", department: "Information Technology", title: "IT Director", status: "ACTIVE" as const, employeeType: "EMPLOYEE" as const, manager: "Robert Smith" },
      { id: 308, firstName: "Amanda", lastName: "Taylor", email: "amanda.taylor@company.com", login: "amanda.taylor@company.com", mobilePhone: "555-0105", department: "Legal & Compliance", title: "Compliance Officer", status: "ACTIVE" as const, employeeType: "EMPLOYEE" as const, manager: "Robert Smith" },
      { id: 309, firstName: "James", lastName: "Wilson", email: "james.wilson@company.com", login: "james.wilson@company.com", mobilePhone: "555-0106", department: "Information Technology", title: "Network Administrator", status: "ACTIVE" as const, employeeType: "EMPLOYEE" as const, manager: "David Chen" },
      { id: 310, firstName: "Lisa", lastName: "Anderson", email: "lisa.anderson@company.com", login: "lisa.anderson@company.com", mobilePhone: "555-0107", department: "Human Resources", title: "Security Awareness Trainer", status: "ACTIVE" as const, employeeType: "EMPLOYEE" as const, manager: "Maria Garcia" },
      { id: 311, firstName: "Robert", lastName: "Smith", email: "robert.smith@company.com", login: "robert.smith@company.com", mobilePhone: "555-0108", department: "Executive", title: "Chief Technology Officer", status: "ACTIVE" as const, employeeType: "EMPLOYEE" as const, manager: null },
      { id: 312, firstName: "Maria", lastName: "Garcia", email: "maria.garcia@company.com", login: "maria.garcia@company.com", mobilePhone: "555-0109", department: "Human Resources", title: "HR Director", status: "ACTIVE" as const, employeeType: "EMPLOYEE" as const, manager: "Robert Smith" },
      { id: 313, firstName: "Kevin", lastName: "Brown", email: "kevin.brown@company.com", login: "kevin.brown@company.com", mobilePhone: "555-0110", department: "Information Technology", title: "DevOps Engineer", status: "ACTIVE" as const, employeeType: "CONTRACTOR" as const, manager: "David Chen" },
      { id: 314, firstName: "Emily", lastName: "Davis", email: "emily.davis@company.com", login: "emily.davis@company.com", mobilePhone: "555-0111", department: "IT Security", title: "Incident Response Specialist", status: "ACTIVE" as const, employeeType: "EMPLOYEE" as const, manager: "Sarah Johnson" },
      { id: 315, firstName: "John", lastName: "Miller", email: "john.miller@company.com", login: "john.miller@company.com", mobilePhone: "555-0112", department: "IT Security", title: "Risk Assessment Analyst", status: "ACTIVE" as const, employeeType: "EMPLOYEE" as const, manager: "Sarah Johnson" },
      { id: 316, firstName: "Rachel", lastName: "Thompson", email: "rachel.thompson@company.com", login: "rachel.thompson@company.com", mobilePhone: "555-0113", department: "IT Security", title: "Security Intern", status: "ACTIVE" as const, employeeType: "INTERN" as const, manager: "Michael Rodriguez" },
      { id: 317, firstName: "Carlos", lastName: "Martinez", email: "carlos.martinez@company.com", login: "carlos.martinez@company.com", mobilePhone: "555-0114", department: "Information Technology", title: "Cloud Security Architect", status: "ACTIVE" as const, employeeType: "EMPLOYEE" as const, manager: "David Chen" },
      { id: 318, firstName: "Nicole", lastName: "White", email: "nicole.white@company.com", login: "nicole.white@company.com", mobilePhone: "555-0115", department: "Legal & Compliance", title: "Data Privacy Officer", status: "ACTIVE" as const, employeeType: "EMPLOYEE" as const, manager: "Amanda Taylor" },
      { id: 319, firstName: "Daniel", lastName: "Lee", email: "daniel.lee@company.com", login: "daniel.lee@company.com", mobilePhone: "555-0116", department: "IT Security", title: "Vulnerability Assessment Specialist", status: "ACTIVE" as const, employeeType: "CONTRACTOR" as const, manager: "Sarah Johnson" },
      { id: 320, firstName: "Michelle", lastName: "Harris", email: "michelle.harris@company.com", login: "michelle.harris@company.com", mobilePhone: "555-0117", department: "IT Security", title: "Security Operations Manager", status: "ACTIVE" as const, employeeType: "EMPLOYEE" as const, manager: "Sarah Johnson" },
      { id: 321, firstName: "Brian", lastName: "Clark", email: "brian.clark@company.com", login: "brian.clark@company.com", mobilePhone: "555-0118", department: "Information Technology", title: "Identity Management Specialist", status: "ACTIVE" as const, employeeType: "EMPLOYEE" as const, manager: "David Chen" },
      { id: 322, firstName: "Ashley", lastName: "Lewis", email: "ashley.lewis@company.com", login: "ashley.lewis@company.com", mobilePhone: "555-0119", department: "Human Resources", title: "Security Training Coordinator", status: "ACTIVE" as const, employeeType: "PART_TIME" as const, manager: "Lisa Anderson" },
      { id: 323, firstName: "Christopher", lastName: "Walker", email: "christopher.walker@company.com", login: "christopher.walker@company.com", mobilePhone: "555-0120", department: "IT Security", title: "Forensics Investigator", status: "ACTIVE" as const, employeeType: "CONTRACTOR" as const, manager: "Emily Davis" }
    ];

    realUsers.forEach((userData) => {
      const user: DemoUser = {
        ...userData,
        groups: [],
        applications: [],
        created: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000),
        lastUpdated: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        lastLogin: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        passwordChanged: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000),
      };
      this.users.set(user.id, user);
    });
  }

  async authenticateAdmin(username: string, password: string): Promise<boolean> {
    // EXACT same credentials as your current project
    return username === "CW-Admin" && password === "YellowDr@g0nFly";
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

Continue to Part 2 for routes and configuration files...