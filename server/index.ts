import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

// Load environment variables
dotenv.config();

// Set required environment variables for production if not already set
if (!process.env.KNOWBE4_BASE_URL) {
  process.env.KNOWBE4_BASE_URL = "https://us.api.knowbe4.com/v1";
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;
  
  // Log all requests to authentication endpoints
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

  // Check if production build exists and serve statically if so
  const publicDir = path.resolve(process.cwd(), "dist/public");
  const fallbackPublicDir = path.resolve(process.cwd(), "public");
  const hasProductionBuild = fs.existsSync(path.join(publicDir, "index.html")) || fs.existsSync(path.join(fallbackPublicDir, "index.html"));
  const actualPublicDir = fs.existsSync(path.join(publicDir, "index.html")) ? publicDir : fallbackPublicDir;
  
  if (hasProductionBuild) {
    log("Production build detected, serving static files from " + actualPublicDir);
    
    // Serve static files directly from build directory
    app.use(express.static(actualPublicDir));
    
    // Handle SPA routing - serve index.html for all non-API routes
    app.use("*", (req, res) => {
      if (!req.path.startsWith("/api")) {
        res.sendFile(path.join(actualPublicDir, "index.html"));
      }
    });
  } else if (app.get("env") === "development") {
    log("Development mode, setting up Vite");
    await setupVite(app, server);
  } else {
    log("No production build found, falling back to Vite");
    await setupVite(app, server);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
