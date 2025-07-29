import { db } from "./db";
import { auditLogs, type InsertAuditLog } from "@shared/schema";
import { Request } from "express";

export class AuditLogger {
  static async log(params: {
    req: Request;
    action: string;
    resourceType: string;
    resourceId?: string;
    resourceName?: string;
    details?: Record<string, any>;
    oldValues?: Record<string, any>;
    newValues?: Record<string, any>;
  }) {
    try {
      const user = (params.req as any).session?.user;
      const userEmail = user?.email || 'system@mazetx.com';
      const userId = user?.id || null;

      const auditLog: InsertAuditLog = {
        userId,
        userEmail,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId || null,
        resourceName: params.resourceName || null,
        details: params.details || {},
        oldValues: params.oldValues || {},
        newValues: params.newValues || {},
        ipAddress: params.req.ip || params.req.connection.remoteAddress || null,
        userAgent: params.req.get('User-Agent') || null,
      };

      await db.insert(auditLogs).values(auditLog);
      
      console.log(`[AUDIT] ${params.action} ${params.resourceType}:`, {
        user: userEmail,
        resource: params.resourceName || params.resourceId,
        details: params.details
      });
    } catch (error) {
      console.error('Failed to log audit event:', error);
    }
  }

  // Convenience methods for common actions
  static async logUserAction(req: Request, action: string, resourceId: string, resourceName: string, details?: Record<string, any>, oldValues?: Record<string, any>, newValues?: Record<string, any>) {
    return this.log({
      req,
      action,
      resourceType: 'USER',
      resourceId,
      resourceName,
      details,
      oldValues,
      newValues
    });
  }

  static async logSiteAccessAction(req: Request, action: string, resourceId: string, resourceName: string, details?: Record<string, any>, oldValues?: Record<string, any>, newValues?: Record<string, any>) {
    return this.log({
      req,
      action,
      resourceType: 'SITE_ACCESS_USER',
      resourceId,
      resourceName,
      details,
      oldValues,
      newValues
    });
  }

  static async logIntegrationAction(req: Request, action: string, resourceId: string, resourceName: string, details?: Record<string, any>, oldValues?: Record<string, any>, newValues?: Record<string, any>) {
    return this.log({
      req,
      action,
      resourceType: 'INTEGRATION',
      resourceId,
      resourceName,
      details,
      oldValues,
      newValues
    });
  }

  static async logAuthAction(req: Request, action: string, details?: Record<string, any>) {
    return this.log({
      req,
      action,
      resourceType: 'AUTH',
      details
    });
  }

  static async logSystemAction(req: Request, action: string, details?: Record<string, any>) {
    return this.log({
      req,
      action,
      resourceType: 'SYSTEM',
      details
    });
  }
}

// Get audit logs with filtering and pagination
export async function getAuditLogs(options?: {
  userId?: number;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}) {
  let query = db.select().from(auditLogs);
  
  // Apply filters
  const conditions = [];
  if (options?.userId) {
    conditions.push(`user_id = ${options.userId}`);
  }
  if (options?.action) {
    conditions.push(`action = '${options.action}'`);
  }
  if (options?.resourceType) {
    conditions.push(`resource_type = '${options.resourceType}'`);
  }
  if (options?.resourceId) {
    conditions.push(`resource_id = '${options.resourceId}'`);
  }
  if (options?.startDate) {
    conditions.push(`timestamp >= '${options.startDate.toISOString()}'`);
  }
  if (options?.endDate) {
    conditions.push(`timestamp <= '${options.endDate.toISOString()}'`);
  }

  // Order by timestamp descending (newest first)
  query = query.orderBy(auditLogs.timestamp);

  if (options?.limit) {
    query = query.limit(options.limit);
  }
  if (options?.offset) {
    query = query.offset(options.offset);
  }

  return await query;
}