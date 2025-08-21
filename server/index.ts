import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

// Simple log function for production (replaces vite log)
export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

// Load environment variables
dotenv.config();

// Set required environment variables for production if not already set
if (!process.env.KNOWBE4_BASE_URL) {
  process.env.KNOWBE4_BASE_URL = "https://us.api.knowbe4.com/v1";
}

// Note: OKTA integration now uses client-specific API keys stored in database
// No global OKTA environment variables needed
if (!process.env.SESSION_SECRET) {
  process.env.SESSION_SECRET = "dev-session-secret-change-in-production";
  console.log("SESSION_SECRET not set - using default for local development");
}
if (!process.env.KNOWBE4_GRAPH_API_KEY) {
  process.env.KNOWBE4_GRAPH_API_KEY = "dev-knowbe4-placeholder";
  console.log("KNOWBE4_GRAPH_API_KEY not set - using placeholder for local development");
}

// Check if we should force dev mode (can be set via environment or by creating a .dev file)
if (!process.env.FORCE_DEV_MODE && fs.existsSync('.dev')) {
  process.env.FORCE_DEV_MODE = "true";
  console.log("Found .dev file - enabling live development mode");
}

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Public health check endpoint for Railway deployment (must be before other routes)
app.get("/health", (req, res) => {
  res.status(200).json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    port: process.env.PORT || "5000"
  });
});

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

  // Check if production build exists and serve it
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
  } else {
    log("No production build found, you need to run 'npm run build' first");
    app.use("*", (req, res) => {
      res.status(503).json({ error: "Application not built. Please run 'npm run build' to generate the frontend." });
    });
  }

  // Use Railway's assigned port 3000, fallback to 5000 for local development
  const port = parseInt(process.env.PORT || (process.env.NODE_ENV === "production" ? "3000" : "5000"), 10);
  log(`🔍 Environment PORT: ${process.env.PORT}`);
  log(`🔍 Using port: ${port}`);
  log(`🔍 Node ENV: ${process.env.NODE_ENV}`);
  log(`🔍 Database URL configured: ${process.env.DATABASE_URL ? 'YES' : 'NO'}`);
  log(`🔍 Starting server binding...`);
  
  try {
    server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      log(`✅ Server successfully started on port ${port}`);
      log(`✅ Health endpoint available at http://0.0.0.0:${port}/health`);
    });
  } catch (error) {
    log(`❌ Server startup failed: ${error}`);
    process.exit(1);
  }
  
  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    log(`❌ Uncaught exception: ${error.message}`);
    process.exit(1);
  });
  
  process.on('unhandledRejection', (reason) => {
    log(`❌ Unhandled rejection: ${reason}`);
    process.exit(1);
  });
})();
