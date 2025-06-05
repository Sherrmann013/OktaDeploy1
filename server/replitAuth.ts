import passport from "passport";
import { Strategy as OAuthStrategy } from "passport-oauth2";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

if (!process.env.REPLIT_DOMAINS) {
  throw new Error("Environment variable REPLIT_DOMAINS not provided");
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
      secure: true,
      maxAge: sessionTtl,
    },
  });
}

async function getUserProfile(accessToken: string) {
  const response = await fetch(`${process.env.ISSUER_URL}/v1/userinfo`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch user profile: ${response.statusText}`);
  }
  
  return await response.json();
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  // Use the production domain for callback URL
  const domain = 'mazetx.replit.app';
  
  console.log('Using domain for callback:', domain);
  console.log('OKTA Auth URLs:', {
    authorizationURL: `${process.env.ISSUER_URL}/v1/authorize`,
    tokenURL: `${process.env.ISSUER_URL}/v1/token`,
    callbackURL: `https://${domain}/api/callback`
  });

  // Configure OKTA OAuth2 strategy
  const oktaStrategy = new OAuthStrategy({
    authorizationURL: `${process.env.ISSUER_URL}/v1/authorize`,
    tokenURL: `${process.env.ISSUER_URL}/v1/token`,
    clientID: process.env.CLIENT_ID!,
    clientSecret: process.env.CLIENT_SECRET!,
    callbackURL: `https://${domain}/api/callback`,
    scope: 'openid email profile groups'
  }, async (accessToken: string, refreshToken: string, profile: any, done: any) => {
    try {
      // Get user profile from OKTA
      const userProfile = await getUserProfile(accessToken);
      
      // Check if user exists in our system
      const existingUser = await storage.getUserByEmail(userProfile.email);
      
      if (!existingUser) {
        return done(new Error("Access denied: User not found in admin system"));
      }
      
      const sessionUser = {
        id: existingUser.id,
        email: existingUser.email,
        firstName: existingUser.firstName,
        lastName: existingUser.lastName,
        title: existingUser.title,
        department: existingUser.department,
        accessToken,
        refreshToken
      };
      
      return done(null, sessionUser);
    } catch (error) {
      return done(error);
    }
  });

  passport.use('okta', oktaStrategy);

  passport.serializeUser((user: any, done) => {
    done(null, user);
  });

  passport.deserializeUser((user: any, done) => {
    done(null, user);
  });

  app.get("/api/login", (req, res, next) => {
    console.log('=== LOGIN REQUEST RECEIVED ===');
    console.log('Request URL:', req.url);
    console.log('Request headers:', req.headers);
    console.log('Passport strategies:', Object.keys(passport._strategies || {}));
    console.log('Attempting OKTA authentication...');
    
    try {
      passport.authenticate('okta', (err, user, info) => {
        console.log('OKTA authenticate callback:', { err, user, info });
        if (err) {
          console.error('Authentication error:', err);
          return res.status(500).send('Authentication failed');
        }
        if (!user) {
          console.log('No user returned, redirecting to authorization URL');
          // Manually redirect to OKTA authorization URL
          const authUrl = `${process.env.ISSUER_URL}/v1/authorize?` +
            `client_id=${process.env.CLIENT_ID}&` +
            `response_type=code&` +
            `scope=openid email profile groups&` +
            `redirect_uri=${encodeURIComponent('https://mazetx.replit.app/api/callback')}&` +
            `state=oauth_state`;
          console.log('Redirecting to:', authUrl);
          return res.redirect(authUrl);
        }
        req.logIn(user, (err) => {
          if (err) {
            console.error('Login error:', err);
            return res.status(500).send('Login failed');
          }
          return res.redirect('/');
        });
      })(req, res, next);
    } catch (error) {
      console.error('Exception in login handler:', error);
      res.status(500).send('Server error');
    }
  });

  app.get("/api/callback", 
    passport.authenticate('okta', { failureRedirect: '/api/login' }),
    (req, res) => {
      res.redirect('/');
    }
  );

  app.get("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        console.error('Logout error:', err);
      }
      const logoutUrl = `${process.env.ISSUER_URL}/v1/logout?` +
        `post_logout_redirect_uri=${encodeURIComponent(`https://${req.hostname}`)}`;
      res.redirect(logoutUrl);
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
};

export const requireAdmin: RequestHandler = async (req, res, next) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  // All authenticated users in this system are admins
  next();
};