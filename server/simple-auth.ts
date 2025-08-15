import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

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
      secure: process.env.NODE_ENV === 'production', // Only secure in production
      maxAge: sessionTtl,
    },
  });
}

export async function setupSimpleAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  // OKTA callback handler
  app.get("/api/okta-callback", async (req, res) => {
    console.log('=== OKTA CALLBACK RECEIVED ===');
    console.log('Query params:', req.query);
    
    const { code, state, error } = req.query;
    
    if (error) {
      console.error('OAuth error:', error);
      return res.redirect('/?error=' + encodeURIComponent(error as string));
    }
    
    if (!code) {
      console.error('No authorization code received');
      return res.redirect('/?error=no_code');
    }
    
    try {
      console.log('Exchanging code for tokens...');
      
      // Exchange authorization code for tokens
      const tokenResponse = await fetch(`${process.env.ISSUER_URL}/v1/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: process.env.CLIENT_ID!,
          client_secret: process.env.CLIENT_SECRET!,
          code: code as string,
          redirect_uri: `${req.protocol}://${req.get('host')}/api/okta-callback`
        })
      });
      
      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('Token exchange failed:', tokenResponse.status, errorText);
        return res.redirect('/?error=token_exchange_failed');
      }
      
      const tokens = await tokenResponse.json();
      console.log('Tokens received successfully');
      
      // Get user profile from OKTA
      console.log('Fetching user profile...');
      const profileResponse = await fetch(`${process.env.ISSUER_URL}/v1/userinfo`, {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          'Accept': 'application/json'
        }
      });
      
      if (!profileResponse.ok) {
        const errorText = await profileResponse.text();
        console.error('Profile fetch failed:', profileResponse.status, errorText);
        return res.redirect('/?error=profile_fetch_failed');
      }
      
      const userProfile = await profileResponse.json();
      console.log('User profile received:', { email: userProfile.email, sub: userProfile.sub });
      
      // Create or get user in our system
      let existingUser = await storage.getUserByEmail(userProfile.email);
      
      if (!existingUser) {
        console.log('Creating new admin user:', userProfile.email);
        existingUser = await storage.createUser({
          firstName: userProfile.given_name || userProfile.name?.split(' ')[0] || 'Admin',
          lastName: userProfile.family_name || userProfile.name?.split(' ').slice(1).join(' ') || 'User',
          email: userProfile.email,
          login: userProfile.email,
          status: 'ACTIVE',
          title: 'Administrator',
          department: 'IT',
          oktaId: userProfile.sub
        });
        console.log('Created new admin user:', existingUser.id);
      }
      
      // Create session
      const sessionUser = {
        id: existingUser.id,
        email: existingUser.email,
        firstName: existingUser.firstName,
        lastName: existingUser.lastName,
        title: existingUser.title,
        department: existingUser.department,
        oktaId: existingUser.oktaId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token
      };
      
      // Store user in session
      (req as any).session.user = sessionUser;
      
      console.log('=== LOGIN SUCCESSFUL ===');
      console.log('User logged in:', sessionUser.email);
      res.redirect('/users');
      
    } catch (error) {
      console.error('Callback processing error:', error);
      res.redirect('/?error=callback_failed');
    }
  });

  // Basic login endpoint for local development
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      // Simple hardcoded admin login for development
      if (email === 'admin@mazetx.com' && password === 'admin123') {
        const sessionUser = {
          id: 1,
          email: 'admin@mazetx.com',
          firstName: 'Admin',
          lastName: 'User',
          role: 'admin',
          title: 'System Administrator',
          department: 'IT'
        };
        
        // Store user in session
        (req as any).session.user = sessionUser;
        
        console.log('Admin logged in successfully:', email);
        return res.json(sessionUser);
      }
      
      return res.status(401).json({ message: "Invalid credentials" });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: "Login failed" });
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
  app.get("/api/logout", (req, res) => {
    (req as any).session.destroy((err: any) => {
      if (err) {
        console.error('Session destruction error:', err);
        return res.status(500).send('Logout failed');
      }
      res.redirect('/');
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
  
  // All OKTA authenticated users are admins for now
  (req as any).user = user;
  next();
};