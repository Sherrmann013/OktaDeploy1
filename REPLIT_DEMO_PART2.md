# Security Dashboard Demo - Part 2: Routes & Config Files

## FILE: server/routes.ts
```typescript
import { Express } from "express";
import { createServer } from "http";
import { demoStorage, type DemoUser, insertDemoUserSchema } from "./storage.js";
import { z } from "zod";

export function registerRoutes(app: Express) {
  const server = createServer(app);

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

  return server;
}
```

## FILE: server/vite.ts
```typescript
import { ViteDevServer } from "vite";
import { Express } from "express";
import { createServer as createViteServer } from "vite";
import { Server } from "http";

export function log(msg: string) {
  console.log(`${new Date().toLocaleTimeString()} [express] ${msg}`);
}

export async function setupVite(app: Express, server: Server): Promise<ViteDevServer> {
  const vite = await createViteServer({
    appType: "custom",
    server: { middlewareMode: true },
    root: process.cwd(),
  });

  app.use(vite.middlewares);

  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      if (url.startsWith("/api")) {
        return next();
      }

      let template = await vite.transformIndexHtml(url, `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Security Dashboard Demo</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/client/src/main.tsx"></script>
  </body>
</html>
      `);

      res.status(200).set({ "Content-Type": "text/html" }).end(template);
    } catch (e) {
      if (e instanceof Error) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    }
  });

  return vite;
}
```

## FILE: vite.config.ts
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'client/src'),
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
});
```

## FILE: tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ESNext",
    "lib": ["DOM", "DOM.Iterable", "ESNext"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": {
      "@/*": ["client/src/*"],
      "@shared/*": ["shared/*"]
    }
  },
  "include": [
    "client/src",
    "server",
    "shared"
  ]
}
```

## FILE: tailwind.config.js
```javascript
module.exports = {
  content: ['./client/src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {},
  },
  plugins: [],
};
```

## FILE: postcss.config.js
```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

Continue to Part 3 for React components...