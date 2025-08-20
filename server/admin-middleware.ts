import { Request, Response, NextFunction } from 'express';

// Extend Express Request to include admin info
declare global {
  namespace Express {
    interface Request {
      isAdmin?: boolean;
      adminApiKey?: string;
    }
  }
}

/**
 * Admin API Authentication Middleware
 * Validates admin API keys for management operations
 */
export const validateAdminApiKey = (req: Request, res: Response, next: NextFunction) => {
  const adminApiKey = process.env.ADMIN_API_KEY;
  
  if (!adminApiKey) {
    console.error('⚠️ ADMIN_API_KEY not configured');
    return res.status(503).json({ 
      error: 'Admin API not configured',
      code: 'ADMIN_API_DISABLED'
    });
  }

  // Check for API key in Authorization header or query parameter
  const authHeader = req.headers.authorization;
  const queryApiKey = req.query.admin_key as string;
  
  let providedKey: string | null = null;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    providedKey = authHeader.substring(7);
  } else if (authHeader && authHeader.startsWith('Admin ')) {
    providedKey = authHeader.substring(6);
  } else if (queryApiKey) {
    providedKey = queryApiKey;
  }

  if (!providedKey) {
    console.warn(`🚫 Admin API access denied: No API key provided from ${req.ip}`);
    return res.status(401).json({ 
      error: 'Admin API key required',
      code: 'MISSING_ADMIN_KEY',
      hint: 'Provide key via Authorization: Admin <key> header or admin_key query parameter'
    });
  }

  if (providedKey !== adminApiKey) {
    console.warn(`🚫 Admin API access denied: Invalid API key from ${req.ip}`);
    return res.status(403).json({ 
      error: 'Invalid admin API key',
      code: 'INVALID_ADMIN_KEY'
    });
  }

  // Set admin context
  req.isAdmin = true;
  req.adminApiKey = providedKey;
  
  console.log(`✅ Admin API access granted from ${req.ip} for ${req.method} ${req.path}`);
  next();
};

/**
 * Admin Route Logger Middleware
 * Logs all admin operations for audit trail
 */
export const logAdminOperation = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    
    console.log(`📋 Admin Operation: ${req.method} ${req.path} - ${statusCode} (${duration}ms)`);
    
    // Log request details for audit
    const auditLog = {
      timestamp: new Date().toISOString(),
      ip: req.ip,
      method: req.method,
      path: req.path,
      statusCode,
      duration,
      userAgent: req.headers['user-agent'],
      body: req.method !== 'GET' ? req.body : undefined
    };
    
    console.log(`🔍 Admin Audit:`, JSON.stringify(auditLog, null, 2));
    
    return originalSend.call(this, data);
  };
  
  next();
};

/**
 * Admin Error Handler
 * Provides detailed error responses for admin operations
 */
export const adminErrorHandler = (error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(`❌ Admin API Error: ${error.message}`, error.stack);
  
  // Send detailed error info for admin operations
  res.status(500).json({
    error: 'Admin operation failed',
    message: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    timestamp: new Date().toISOString(),
    operation: `${req.method} ${req.path}`
  });
};