import type { Express, RequestHandler } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import { oktaService } from "./okta-service";
import { AuditLogger } from "./audit";
import { db } from './db';
import { siteAccessUsers } from '@shared/schema';
import { eq } from 'drizzle-orm';

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
      secure: process.env.NODE_ENV === 'production',
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  // Local admin login route
  app.post("/api/login", async (req, res) => {
    console.log('=== LOCAL ADMIN LOGIN ATTEMPT ===');
    const { username, password } = req.body;
    
    console.log('Username provided:', username);
    
    if (!username || !password) {
      console.log('Missing credentials');
      return res.status(400).json({ error: "Username and password required" });
    }
    
    // Check local admin credentials
    const ADMIN_USERNAME = "CW-Admin";
    const ADMIN_PASSWORD = "YellowDr@g0nFly";
    
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      console.log('Local admin login successful');
      
      const adminUser = {
        id: 1,
        oktaId: null,
        firstName: "CW",
        lastName: "Admin",
        email: "admin@mazetx.com",
        login: ADMIN_USERNAME,
        mobilePhone: null,
        department: "IT",
        title: "System Administrator",
        employeeType: "ADMIN",
        profileImageUrl: null,
        managerId: null,
        manager: null,
        status: "ACTIVE",
        groups: [],
        applications: [],
        created: new Date(),
        lastUpdated: new Date(),
        lastLogin: new Date(),
        passwordChanged: null,
        username: ADMIN_USERNAME,
        role: "admin"
      };
      
      // Store user in session
      (req.session as any).user = adminUser;
      
      // Log the authentication event
      await AuditLogger.logAuthAction(
        req,
        'LOGIN',
        { 
          loginType: 'Local Admin', 
          username: ADMIN_USERNAME,
          success: true
        }
      );
      
      console.log('Session created for admin user');
      res.json(adminUser);
    } else {
      console.log('Invalid credentials provided');
      
      // Log the failed authentication event
      await AuditLogger.logAuthAction(
        req,
        'LOGIN_FAILED',
        { 
          loginType: 'Local Admin', 
          username: username,
          success: false,
          reason: 'Invalid credentials'
        }
      );
      
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  // Direct OKTA login route (GET)
  app.get("/api/login", (req, res) => {
    console.log('Initiating direct OKTA login');
    
    // Generate state parameter for security
    const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    (req.session as any).oauthState = state;
    
    // Build OKTA authorization URL
    const authUrl = new URL(`${process.env.OKTA_DOMAIN}/oauth2/default/v1/authorize`);
    authUrl.searchParams.set('client_id', process.env.CLIENT_ID!);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid email profile');
    authUrl.searchParams.set('redirect_uri', `${req.protocol}://${req.get('host')}/api/okta-callback`);
    authUrl.searchParams.set('state', state);
    
    console.log('Redirecting to OKTA:', authUrl.toString());
    res.redirect(authUrl.toString());
  });

  // OKTA callback route
  app.get("/api/okta-callback", async (req, res) => {
    console.log('Processing OKTA callback with query params:', req.query);
    
    try {
      const { code, state, error, error_description } = req.query;
      
      // Handle OAuth errors
      if (error) {
        console.error('OKTA OAuth error:', error, error_description);
        console.error('Full callback query params:', req.query);
        const errorMsg = Array.isArray(error_description) ? error_description[0] : 
                         Array.isArray(error) ? error[0] : 
                         String(error_description || error);
        return res.redirect(`/?error=oauth_failed&details=${encodeURIComponent(errorMsg)}`);
      }
      
      // Validate state parameter
      const storedState = (req.session as any).oauthState;
      if (!state || !storedState || state !== storedState) {
        console.error('Invalid state parameter');
        return res.redirect('/?error=invalid_state');
      }
      
      // Clear stored state
      delete (req.session as any).oauthState;
      
      if (!code) {
        console.error('No authorization code received');
        return res.redirect('/?error=no_code');
      }
      
      // Exchange code for tokens
      const tokenUrl = `${process.env.OKTA_DOMAIN}/oauth2/default/v1/token`;
      const tokenResponse = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: process.env.CLIENT_ID!,
          client_secret: process.env.CLIENT_SECRET!,
          code: code as string,
          redirect_uri: `${req.protocol}://${req.get('host')}/api/okta-callback`,
        }),
      });
      
      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('Token exchange failed:', errorText);
        return res.redirect('/?error=token_failed');
      }
      
      const tokens = await tokenResponse.json();
      console.log('Token exchange successful');
      
      // Get user profile using access token
      const userResponse = await fetch(`${process.env.OKTA_DOMAIN}/oauth2/default/v1/userinfo`, {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
        },
      });
      
      if (!userResponse.ok) {
        console.error('Failed to fetch user profile');
        return res.redirect('/?error=profile_failed');
      }
      
      const userProfile = await userResponse.json();
      console.log('User profile fetched:', userProfile.sub);
      
      // Get detailed user info from OKTA API
      let detailedUser;
      try {
        detailedUser = await oktaService.getUserByEmail(userProfile.email);
      } catch (error) {
        console.error('Failed to get detailed user from OKTA:', error);
        // Fallback to basic profile data
        detailedUser = {
          id: userProfile.sub,
          profile: {
            firstName: userProfile.given_name || userProfile.name?.split(' ')[0] || 'Unknown',
            lastName: userProfile.family_name || userProfile.name?.split(' ').slice(1).join(' ') || 'User',
            email: userProfile.email,
            login: userProfile.email,
          },
          status: 'ACTIVE',
          created: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
        };
      }
      
      // Create or update user in our system
      const userData = {
        oktaId: detailedUser.id,
        firstName: detailedUser.profile.firstName,
        lastName: detailedUser.profile.lastName,
        email: detailedUser.profile.email,
        login: detailedUser.profile.login,
        title: detailedUser.profile.title || null,
        department: detailedUser.profile.department || null,
        mobilePhone: detailedUser.profile.mobilePhone || null,
        manager: detailedUser.profile.manager || null,
        status: detailedUser.status,
        employeeType: null,
        managerId: null,
        profileImageUrl: null,
        groups: [],
        applications: [],
      };
      
      // Try to find existing user
      let user = await storage.getUserByOktaId(userData.oktaId);
      
      if (user) {
        // Update existing user - only pass fields that match UpdateUser type
        const updateData = {
          firstName: userData.firstName,
          lastName: userData.lastName,
          email: userData.email,
          login: userData.login,
          title: userData.title,
          department: userData.department,
          mobilePhone: userData.mobilePhone,
          manager: userData.manager,
          status: userData.status,
          employeeType: userData.employeeType,
          managerId: userData.managerId,
          profileImageUrl: userData.profileImageUrl,
          groups: userData.groups,
          applications: userData.applications,
        };
        const updatedUser = await storage.updateUser(user.id, updateData);
        user = updatedUser || user;
        console.log('Updated existing user:', user.id);
      } else {
        // Create new user
        user = await storage.createUser(userData);
        console.log('Created new user:', user.id);
      }
      
      if (!user) {
        throw new Error('Failed to create or update user');
      }
      
      // Store user in session
      (req.session as any).userId = user.id;
      (req.session as any).user = user;
      
      // Redirect to users page
      res.redirect('/users');
      
    } catch (error) {
      console.error('OKTA callback error:', error);
      res.redirect('/?error=callback_failed');
    }
  });

  // Logout route
  app.get("/api/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destruction error:', err);
        return res.status(500).json({ error: 'Logout failed' });
      }
      
      // Redirect to OKTA logout
      const oktaLogoutUrl = `${process.env.OKTA_DOMAIN}/login/signout?fromURI=${encodeURIComponent(`${req.protocol}://${req.get('host')}`)}`;
      res.redirect(oktaLogoutUrl);
    });
  });

  // Get current user route
  app.get("/api/auth/user", (req, res) => {
    const user = (req.session as any).user;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    res.json(user);
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  const user = (req.session as any).user;
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
};

export const requireAdmin: RequestHandler = async (req, res, next) => {
  const user = (req.session as any).user;
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  // Check if user has admin access level
  try {
    if (user.role === "admin") {
      // Local admin user
      return next();
    }
    
    // Check site access user level
    const [siteUser] = await db.select().from(siteAccessUsers).where(eq(siteAccessUsers.email, user.email));
    if (siteUser && siteUser.accessLevel === 'admin') {
      return next();
    }
    
    return res.status(403).json({ message: "Admin access required" });
  } catch (error) {
    console.error('Error checking admin access:', error);
    return res.status(500).json({ message: "Internal server error" });
  }
};