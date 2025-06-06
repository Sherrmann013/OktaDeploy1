import passport from "passport";
import { Strategy as OAuthStrategy } from "passport-oauth2";
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
    secret: process.env.SESSION_SECRET || 'fallback-secret-for-dev',
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

async function getUserProfile(accessToken: string) {
  try {
    console.log('Fetching OKTA user profile');
    const response = await fetch(`${process.env.OKTA_DOMAIN}/api/v1/users/me`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to fetch user profile:', response.status, errorText);
      throw new Error(`Failed to fetch user profile: ${response.status} ${response.statusText}`);
    }

    const userProfile = await response.json();
    console.log('OKTA user profile fetched successfully');
    return userProfile;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    throw error;
  }
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  // Configure OKTA OAuth2 strategy
  const strategy = new OAuthStrategy(
    {
      authorizationURL: `${process.env.OKTA_DOMAIN}/oauth2/v1/authorize`,
      tokenURL: `${process.env.OKTA_DOMAIN}/oauth2/v1/token`,
      clientID: process.env.CLIENT_ID!,
      clientSecret: process.env.CLIENT_SECRET!,
      callbackURL: "/api/okta-callback",
      scope: "openid email profile"
    },
    async (accessToken: string, refreshToken: string, profile: any, done: any) => {
      try {
        console.log('OKTA OAuth callback received');
        
        // Get detailed user profile from OKTA
        const userProfile = await getUserProfile(accessToken);
        
        // Create or update user in our system
        const userData = {
          oktaId: userProfile.id,
          firstName: userProfile.profile.firstName,
          lastName: userProfile.profile.lastName,
          email: userProfile.profile.email,
          login: userProfile.profile.login,
          title: userProfile.profile.title || null,
          department: userProfile.profile.department || null,
          mobilePhone: userProfile.profile.mobilePhone || null,
          manager: userProfile.profile.manager || null,
          status: userProfile.status,
          created: new Date(userProfile.created),
          lastUpdated: new Date(userProfile.lastUpdated),
          lastLogin: userProfile.lastLogin ? new Date(userProfile.lastLogin) : null,
          passwordChanged: userProfile.passwordChanged ? new Date(userProfile.passwordChanged) : null
        };

        // Check if user already exists
        let user = await storage.getUserByOktaId(userProfile.id);
        
        if (user) {
          // Update existing user
          console.log(`Updating existing user: ${userData.email}`);
          user = await storage.updateUser(user.id, userData);
        } else {
          // Create new user
          console.log(`Creating new user: ${userData.email}`);
          user = await storage.createUser(userData);
        }

        return done(null, user);
      } catch (error) {
        console.error('Error in OKTA OAuth callback:', error);
        return done(error, null);
      }
    }
  );

  passport.use('okta', strategy);

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });

  // Login route - redirects to OKTA
  app.get("/api/login", (req, res, next) => {
    console.log('Initiating OKTA login');
    passport.authenticate('okta')(req, res, next);
  });

  // OKTA callback route
  app.get("/api/okta-callback", (req, res, next) => {
    console.log('Processing OKTA callback');
    passport.authenticate('okta', {
      successRedirect: "/",
      failureRedirect: "/login?error=auth_failed"
    })(req, res, next);
  });

  // Logout route
  app.get("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        console.error('Logout error:', err);
        return res.status(500).json({ error: 'Logout failed' });
      }
      
      // Redirect to OKTA logout URL
      const oktaLogoutUrl = `${process.env.OKTA_DOMAIN}/login/signout?fromURI=${encodeURIComponent(`${req.protocol}://${req.get('host')}`)}`;
      res.redirect(oktaLogoutUrl);
    });
  });

  // Get current user route
  app.get("/api/auth/user", (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    res.json(req.user);
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
};

export const requireAdmin: RequestHandler = (req, res, next) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  // For now, all authenticated users are considered admins
  // You can add role-based logic here later
  next();
};