import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

// Local admin credentials
const ADMIN_USERNAME = "CW-Admin";
const ADMIN_PASSWORD = "YellowDr@g0nFly";

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // Allow HTTP for development
      maxAge: sessionTtl,
    },
  });
}

export async function setupLocalAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  // Login endpoint
  app.post("/api/login", async (req, res) => {
    console.log('=== LOGIN ATTEMPT ===');
    const { username, password } = req.body;
    
    console.log('Username provided:', username);
    
    if (!username || !password) {
      console.log('Missing credentials');
      return res.status(400).json({ error: "Username and password required" });
    }
    
    // Check local admin credentials
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      console.log('Local admin login successful');
      
      const adminUser = {
        id: 1,
        username: ADMIN_USERNAME,
        email: "admin@mazetx.com",
        firstName: "CW",
        lastName: "Admin",
        title: "System Administrator",
        department: "IT",
        role: "admin"
      };
      
      // Store user in session
      (req as any).session.user = adminUser;
      
      console.log('Session created for admin user');
      res.json(adminUser);
    } else {
      console.log('Invalid credentials provided');
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  // Get current user
  app.get('/api/auth/user', (req, res) => {
    const user = (req as any).session?.user;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    res.json(user);
  });

  // Logout
  app.post("/api/logout", (req, res) => {
    console.log('=== LOGOUT REQUEST ===');
    (req as any).session.destroy((err: any) => {
      if (err) {
        console.error('Session destruction error:', err);
        return res.status(500).json({ error: 'Logout failed' });
      }
      console.log('Session destroyed successfully');
      res.json({ message: "Logged out successfully" });
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = (req as any).session?.user;
  
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  // Add user to request for route handlers
  (req as any).user = user;
  next();
};

export const requireAdmin: RequestHandler = async (req, res, next) => {
  const user = (req as any).session?.user;
  
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  // Check if user is admin
  if (user.role !== 'admin') {
    return res.status(403).json({ message: "Admin access required" });
  }
  
  (req as any).user = user;
  next();
};