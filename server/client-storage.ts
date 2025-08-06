import { eq, desc, and, or, ilike, count, asc } from 'drizzle-orm';
import { getClientDb } from './multi-db';
import * as clientSchema from '../shared/client-schema';

// Storage interface for client-specific database operations
export class ClientStorage {
  private clientId: number;

  constructor(clientId: number) {
    this.clientId = clientId;
  }

  private async getDb() {
    return await getClientDb(this.clientId);
  }

  // User management (within client database)
  async getUser(id: number): Promise<clientSchema.User | undefined> {
    const db = await this.getDb();
    const [user] = await db.select().from(clientSchema.users).where(eq(clientSchema.users.id, id));
    return user || undefined;
  }

  async getUserByOktaId(oktaId: string): Promise<clientSchema.User | undefined> {
    const db = await this.getDb();
    const [user] = await db.select().from(clientSchema.users).where(eq(clientSchema.users.oktaId, oktaId));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<clientSchema.User | undefined> {
    const db = await this.getDb();
    const [user] = await db.select().from(clientSchema.users).where(eq(clientSchema.users.email, email));
    return user || undefined;
  }

  async getAllUsers(options?: {
    search?: string;
    status?: string;
    department?: string;
    employeeType?: string;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ users: clientSchema.User[]; total: number }> {
    const db = await this.getDb();
    let whereConditions: any[] = [];

    // Apply filters
    if (options?.search) {
      const searchTerm = `%${options.search}%`;
      whereConditions.push(
        or(
          ilike(clientSchema.users.firstName, searchTerm),
          ilike(clientSchema.users.lastName, searchTerm),
          ilike(clientSchema.users.email, searchTerm),
          ilike(clientSchema.users.login, searchTerm)
        )
      );
    }

    if (options?.status) {
      whereConditions.push(eq(clientSchema.users.status, options.status));
    }

    if (options?.department) {
      whereConditions.push(eq(clientSchema.users.department, options.department));
    }

    if (options?.employeeType) {
      whereConditions.push(eq(clientSchema.users.employeeType, options.employeeType));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    // Get total count
    const [{ count: totalCount }] = await db
      .select({ count: count() })
      .from(clientSchema.users)
      .where(whereClause);

    // Build query with sorting
    let query = db.select().from(clientSchema.users).where(whereClause);

    // Apply sorting
    if (options?.sortBy && options?.sortOrder) {
      const column = clientSchema.users[options.sortBy as keyof typeof clientSchema.users];
      if (column) {
        query = options.sortOrder === 'asc' ? query.orderBy(asc(column)) : query.orderBy(desc(column));
      }
    } else {
      query = query.orderBy(clientSchema.users.firstName);
    }

    // Apply pagination
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.offset(options.offset);
    }

    const users = await query;
    return { users, total: totalCount };
  }

  async createUser(user: clientSchema.InsertUser): Promise<clientSchema.User> {
    const db = await this.getDb();
    const [newUser] = await db.insert(clientSchema.users).values({
      ...user,
      created: new Date(),
      lastUpdated: new Date(),
    }).returning();
    return newUser;
  }

  async updateUser(id: number, updates: clientSchema.UpdateUser): Promise<clientSchema.User | undefined> {
    const db = await this.getDb();
    const [updatedUser] = await db
      .update(clientSchema.users)
      .set({ ...updates, lastUpdated: new Date() })
      .where(eq(clientSchema.users.id, id))
      .returning();
    return updatedUser || undefined;
  }

  async deleteUser(id: number): Promise<boolean> {
    const db = await this.getDb();
    const [deletedUser] = await db
      .delete(clientSchema.users)
      .where(eq(clientSchema.users.id, id))
      .returning();
    return !!deletedUser;
  }

  // Integration management
  async getAllIntegrations(): Promise<clientSchema.Integration[]> {
    const db = await this.getDb();
    return await db.select().from(clientSchema.integrations).orderBy(clientSchema.integrations.name);
  }

  async getIntegration(id: number): Promise<clientSchema.Integration | undefined> {
    const db = await this.getDb();
    const [integration] = await db.select().from(clientSchema.integrations).where(eq(clientSchema.integrations.id, id));
    return integration || undefined;
  }

  async createIntegration(integration: clientSchema.InsertIntegration): Promise<clientSchema.Integration> {
    const db = await this.getDb();
    const [newIntegration] = await db.insert(clientSchema.integrations).values({
      ...integration,
      created: new Date(),
      lastUpdated: new Date(),
    }).returning();
    return newIntegration;
  }

  async updateIntegration(id: number, updates: clientSchema.UpdateIntegration): Promise<clientSchema.Integration | undefined> {
    const db = await this.getDb();
    const [updatedIntegration] = await db
      .update(clientSchema.integrations)
      .set({ ...updates, lastUpdated: new Date() })
      .where(eq(clientSchema.integrations.id, id))
      .returning();
    return updatedIntegration || undefined;
  }

  async deleteIntegration(id: number): Promise<boolean> {
    const db = await this.getDb();
    const [deletedIntegration] = await db
      .delete(clientSchema.integrations)
      .where(eq(clientSchema.integrations.id, id))
      .returning();
    return !!deletedIntegration;
  }

  // Layout settings
  async getLayoutSetting(settingKey: string): Promise<clientSchema.LayoutSetting | undefined> {
    const db = await this.getDb();
    const [setting] = await db
      .select()
      .from(clientSchema.layoutSettings)
      .where(eq(clientSchema.layoutSettings.settingKey, settingKey));
    return setting || undefined;
  }

  async setLayoutSetting(setting: clientSchema.InsertLayoutSetting): Promise<clientSchema.LayoutSetting> {
    const db = await this.getDb();
    
    // Try to update first
    const [updatedSetting] = await db
      .update(clientSchema.layoutSettings)
      .set({ 
        settingValue: setting.settingValue,
        metadata: setting.metadata,
        updatedBy: setting.updatedBy,
        updatedAt: new Date()
      })
      .where(eq(clientSchema.layoutSettings.settingKey, setting.settingKey))
      .returning();

    if (updatedSetting) {
      return updatedSetting;
    }

    // If no update happened, insert new
    const [newSetting] = await db
      .insert(clientSchema.layoutSettings)
      .values(setting)
      .returning();
    return newSetting;
  }

  // Dashboard cards
  async getAllDashboardCards(): Promise<clientSchema.DashboardCard[]> {
    const db = await this.getDb();
    return await db.select().from(clientSchema.dashboardCards).orderBy(clientSchema.dashboardCards.position);
  }

  async updateDashboardCard(id: number, updates: Partial<clientSchema.DashboardCard>): Promise<clientSchema.DashboardCard | undefined> {
    const db = await this.getDb();
    const [updatedCard] = await db
      .update(clientSchema.dashboardCards)
      .set({ ...updates, updated: new Date() })
      .where(eq(clientSchema.dashboardCards.id, id))
      .returning();
    return updatedCard || undefined;
  }

  // Company logos
  async getAllLogos(): Promise<clientSchema.CompanyLogo[]> {
    const db = await this.getDb();
    return await db.select().from(clientSchema.companyLogos).orderBy(desc(clientSchema.companyLogos.uploadedAt));
  }

  async getActiveLogo(): Promise<clientSchema.CompanyLogo | undefined> {
    const db = await this.getDb();
    const [logo] = await db
      .select()
      .from(clientSchema.companyLogos)
      .where(eq(clientSchema.companyLogos.isActive, true));
    return logo || undefined;
  }

  async createLogo(logo: clientSchema.InsertCompanyLogo): Promise<clientSchema.CompanyLogo> {
    const db = await this.getDb();
    const [newLogo] = await db.insert(clientSchema.companyLogos).values(logo).returning();
    return newLogo;
  }

  async setActiveLogo(id: number): Promise<boolean> {
    const db = await this.getDb();
    
    // First, deactivate all logos
    await db
      .update(clientSchema.companyLogos)
      .set({ isActive: false });

    // Then activate the specified logo
    const [activatedLogo] = await db
      .update(clientSchema.companyLogos)
      .set({ isActive: true })
      .where(eq(clientSchema.companyLogos.id, id))
      .returning();

    return !!activatedLogo;
  }

  // Audit logs
  async logAudit(logData: clientSchema.InsertAuditLog): Promise<clientSchema.AuditLog> {
    const db = await this.getDb();
    const [auditLog] = await db.insert(clientSchema.auditLogs).values(logData).returning();
    return auditLog;
  }

  async getAuditLogs(options?: {
    userId?: number;
    action?: string;
    resourceType?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: clientSchema.AuditLog[]; total: number }> {
    const db = await this.getDb();
    let whereConditions: any[] = [];

    if (options?.userId) {
      whereConditions.push(eq(clientSchema.auditLogs.userId, options.userId));
    }
    if (options?.action) {
      whereConditions.push(eq(clientSchema.auditLogs.action, options.action));
    }
    if (options?.resourceType) {
      whereConditions.push(eq(clientSchema.auditLogs.resourceType, options.resourceType));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    // Get total count
    const [{ count: totalCount }] = await db
      .select({ count: count() })
      .from(clientSchema.auditLogs)
      .where(whereClause);

    // Get logs with pagination
    let query = db
      .select()
      .from(clientSchema.auditLogs)
      .where(whereClause)
      .orderBy(desc(clientSchema.auditLogs.timestamp));

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

// Factory function to create client storage instances
export function createClientStorage(clientId: number): ClientStorage {
  return new ClientStorage(clientId);
}