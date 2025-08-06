import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as mspSchema from '../shared/msp-schema';
import * as clientSchema from '../shared/client-schema';
import { eq } from 'drizzle-orm';

// Database connection management for multi-tenant MSP architecture
export class MultiDatabaseManager {
  private static instance: MultiDatabaseManager;
  private mspDb: ReturnType<typeof drizzle>;
  private clientDbs: Map<number, ReturnType<typeof drizzle>> = new Map();
  private clientConnectionStrings: Map<number, string> = new Map();

  private constructor() {
    // Initialize MSP database connection
    const mspConnectionString = process.env.MSP_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://localhost:5432/msp_db';
    const mspClient = postgres(mspConnectionString);
    this.mspDb = drizzle(mspClient, { schema: mspSchema });
  }

  public static getInstance(): MultiDatabaseManager {
    if (!MultiDatabaseManager.instance) {
      MultiDatabaseManager.instance = new MultiDatabaseManager();
    }
    return MultiDatabaseManager.instance;
  }

  // Get MSP database connection
  public getMspDb() {
    return this.mspDb;
  }

  // Get client-specific database connection
  public async getClientDb(clientId: number) {
    // Check if we already have a connection for this client
    if (this.clientDbs.has(clientId)) {
      return this.clientDbs.get(clientId)!;
    }

    // Get client connection string from MSP database
    let connectionString = this.clientConnectionStrings.get(clientId);
    
    if (!connectionString) {
      // Query MSP database for client connection info
      const [client] = await this.mspDb
        .select({ databaseUrl: mspSchema.clients.databaseUrl })
        .from(mspSchema.clients)
        .where(eq(mspSchema.clients.id, clientId))
        .limit(1);

      if (!client) {
        throw new Error(`Client ${clientId} not found`);
      }

      connectionString = client.databaseUrl;
      this.clientConnectionStrings.set(clientId, connectionString);
    }

    // Create new client database connection
    const clientDbClient = postgres(connectionString);
    const clientDb = drizzle(clientDbClient, { schema: clientSchema });
    
    // Cache the connection
    this.clientDbs.set(clientId, clientDb);
    
    return clientDb;
  }

  // Create a new client database
  public async createClientDatabase(clientName: string): Promise<{ databaseName: string; databaseUrl: string }> {
    // Generate unique database name
    const databaseName = `client_${clientName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
    
    // For development, we'll use the same PostgreSQL instance with different database names
    // In production, this could be separate database instances
    const baseConnectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/';
    const databaseUrl = `${baseConnectionString.replace(/\/[^\/]*$/, '')}/${databaseName}`;

    // Create the database (this would need to be done with superuser privileges)
    // For now, we'll assume it's created externally and just return the connection info
    
    return { databaseName, databaseUrl };
  }

  // Initialize client database with schema
  public async initializeClientDatabase(clientId: number) {
    const clientDb = await this.getClientDb(clientId);
    
    // Run client schema migration
    // This would typically be done with drizzle-kit migrate
    console.log(`Initializing database schema for client ${clientId}`);
    
    // TODO: Run migrations for client database
    // await migrate(clientDb, { migrationsFolder: './client-migrations' });
  }

  // Close all database connections
  public async closeAll() {
    // Close all client connections
    const clientEntries = Array.from(this.clientDbs.entries());
    for (const [clientId, db] of clientEntries) {
      console.log(`Closing database connection for client ${clientId}`);
      // Close connection (implementation depends on the driver)
    }
    
    this.clientDbs.clear();
    this.clientConnectionStrings.clear();
    
    console.log('Closing MSP database connection');
    // Close MSP connection
  }

  // Health check for all database connections
  public async healthCheck(): Promise<{ msp: boolean; clients: Record<number, boolean> }> {
    const result: { msp: boolean; clients: Record<number, boolean> } = {
      msp: false,
      clients: {}
    };

    try {
      // Test MSP database
      await this.mspDb.select().from(mspSchema.clients).limit(1);
      result.msp = true;
    } catch (error) {
      console.error('MSP database health check failed:', error);
      result.msp = false;
    }

    // Test each client database
    const clientEntries = Array.from(this.clientDbs.entries());
    for (const [clientId, db] of clientEntries) {
      try {
        await db.select().from(clientSchema.users).limit(1);
        result.clients[clientId] = true;
      } catch (error) {
        console.error(`Client ${clientId} database health check failed:`, error);
        result.clients[clientId] = false;
      }
    }

    return result;
  }
}

// Singleton instance
export const dbManager = MultiDatabaseManager.getInstance();

// Convenience exports
export const mspDb = dbManager.getMspDb();
export const getClientDb = (clientId: number) => dbManager.getClientDb(clientId);