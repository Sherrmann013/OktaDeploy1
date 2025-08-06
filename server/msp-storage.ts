import { eq, desc, and, or, ilike, count as sqlCount } from 'drizzle-orm';
import { mspDb } from './multi-db';
import * as mspSchema from '../shared/msp-schema';

// Storage interface for MSP-level operations
export class MSPStorage {
  // MSP User management
  async getMspUser(id: number): Promise<mspSchema.MspUser | undefined> {
    const [user] = await mspDb.select().from(mspSchema.mspUsers).where(eq(mspSchema.mspUsers.id, id));
    return user || undefined;
  }

  async getMspUserByEmail(email: string): Promise<mspSchema.MspUser | undefined> {
    const [user] = await mspDb.select().from(mspSchema.mspUsers).where(eq(mspSchema.mspUsers.email, email));
    return user || undefined;
  }

  async getMspUserByLogin(login: string): Promise<mspSchema.MspUser | undefined> {
    const [user] = await mspDb.select().from(mspSchema.mspUsers).where(eq(mspSchema.mspUsers.login, login));
    return user || undefined;
  }

  async getAllMspUsers(): Promise<mspSchema.MspUser[]> {
    return await mspDb.select().from(mspSchema.mspUsers).orderBy(mspSchema.mspUsers.firstName);
  }

  async createMspUser(user: mspSchema.InsertMspUser): Promise<mspSchema.MspUser> {
    const [newUser] = await mspDb.insert(mspSchema.mspUsers).values(user).returning();
    return newUser;
  }

  async updateMspUser(id: number, updates: mspSchema.UpdateMspUser): Promise<mspSchema.MspUser | undefined> {
    const [updatedUser] = await mspDb
      .update(mspSchema.mspUsers)
      .set({ ...updates, lastUpdated: new Date() })
      .where(eq(mspSchema.mspUsers.id, id))
      .returning();
    return updatedUser || undefined;
  }

  async deleteMspUser(id: number): Promise<boolean> {
    const [deletedUser] = await mspDb
      .delete(mspSchema.mspUsers)
      .where(eq(mspSchema.mspUsers.id, id))
      .returning();
    return !!deletedUser;
  }

  // Client management
  async getAllClients(): Promise<mspSchema.Client[]> {
    return await mspDb.select().from(mspSchema.clients).orderBy(mspSchema.clients.name);
  }

  async getClient(id: number): Promise<mspSchema.Client | undefined> {
    const [client] = await mspDb.select().from(mspSchema.clients).where(eq(mspSchema.clients.id, id));
    return client || undefined;
  }

  async createClient(client: mspSchema.InsertClient): Promise<mspSchema.Client> {
    const [newClient] = await mspDb.insert(mspSchema.clients).values(client).returning();
    return newClient;
  }

  async updateClient(id: number, updates: mspSchema.UpdateClient): Promise<mspSchema.Client | undefined> {
    const [updatedClient] = await mspDb
      .update(mspSchema.clients)
      .set({ ...updates, lastUpdated: new Date() })
      .where(eq(mspSchema.clients.id, id))
      .returning();
    return updatedClient || undefined;
  }

  async deleteClient(id: number): Promise<boolean> {
    const [deletedClient] = await mspDb
      .delete(mspSchema.clients)
      .where(eq(mspSchema.clients.id, id))
      .returning();
    return !!deletedClient;
  }

  // Client access management
  async getClientAccess(mspUserId: number): Promise<mspSchema.ClientAccess[]> {
    return await mspDb
      .select()
      .from(mspSchema.clientAccess)
      .where(eq(mspSchema.clientAccess.mspUserId, mspUserId));
  }

  async getUserClientAccess(mspUserId: number): Promise<mspSchema.Client[]> {
    const accessList = await mspDb
      .select({ client: mspSchema.clients })
      .from(mspSchema.clientAccess)
      .innerJoin(mspSchema.clients, eq(mspSchema.clientAccess.clientId, mspSchema.clients.id))
      .where(eq(mspSchema.clientAccess.mspUserId, mspUserId));

    return accessList.map(row => row.client);
  }

  async grantClientAccess(access: mspSchema.InsertClientAccess): Promise<mspSchema.ClientAccess> {
    const [newAccess] = await mspDb.insert(mspSchema.clientAccess).values(access).returning();
    return newAccess;
  }

  async revokeClientAccess(mspUserId: number, clientId: number): Promise<boolean> {
    const [revokedAccess] = await mspDb
      .delete(mspSchema.clientAccess)
      .where(and(
        eq(mspSchema.clientAccess.mspUserId, mspUserId),
        eq(mspSchema.clientAccess.clientId, clientId)
      ))
      .returning();
    return !!revokedAccess;
  }

  async updateClientAccess(mspUserId: number, clientId: number, accessLevel: string): Promise<mspSchema.ClientAccess | undefined> {
    const [updatedAccess] = await mspDb
      .update(mspSchema.clientAccess)
      .set({ accessLevel })
      .where(and(
        eq(mspSchema.clientAccess.mspUserId, mspUserId),
        eq(mspSchema.clientAccess.clientId, clientId)
      ))
      .returning();
    return updatedAccess || undefined;
  }

  // MSP audit logging
  async logMspAudit(logData: mspSchema.InsertMspAuditLog): Promise<mspSchema.MspAuditLog> {
    const [auditLog] = await mspDb.insert(mspSchema.mspAuditLogs).values(logData).returning();
    return auditLog;
  }

  async getMspAuditLogs(options?: {
    clientId?: number;
    mspUserId?: number;
    action?: string;
    resourceType?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: mspSchema.MspAuditLog[]; total: number }> {
    let whereConditions: any[] = [];

    if (options?.clientId) {
      whereConditions.push(eq(mspSchema.mspAuditLogs.clientId, options.clientId));
    }
    if (options?.mspUserId) {
      whereConditions.push(eq(mspSchema.mspAuditLogs.mspUserId, options.mspUserId));
    }
    if (options?.action) {
      whereConditions.push(eq(mspSchema.mspAuditLogs.action, options.action));
    }
    if (options?.resourceType) {
      whereConditions.push(eq(mspSchema.mspAuditLogs.resourceType, options.resourceType));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    // Get total count
    const [{ count: totalCount }] = await mspDb
      .select({ count: sqlCount() })
      .from(mspSchema.mspAuditLogs)
      .where(whereClause);

    // Get logs with pagination
    let query = mspDb
      .select()
      .from(mspSchema.mspAuditLogs)
      .where(whereClause)
      .orderBy(desc(mspSchema.mspAuditLogs.timestamp));

    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.offset(options.offset);
    }

    const logs = await query;

    return { logs, total: totalCount };
  }
}

// Singleton instance
export const mspStorage = new MSPStorage();