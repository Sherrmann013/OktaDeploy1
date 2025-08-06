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

  // Get client-specific database connection with schema isolation
  public async getClientDb(clientId: number) {
    // Check if we already have a connection for this client
    if (this.clientDbs.has(clientId)) {
      return this.clientDbs.get(clientId)!;
    }

    // Get client schema info from MSP database
    let connectionString = this.clientConnectionStrings.get(clientId);
    
    if (!connectionString) {
      // Query MSP database for client connection info
      const [client] = await this.mspDb
        .select({ databaseUrl: mspSchema.clients.databaseUrl, databaseName: mspSchema.clients.databaseName })
        .from(mspSchema.clients)
        .where(eq(mspSchema.clients.id, clientId))
        .limit(1);

      if (!client) {
        throw new Error(`Client ${clientId} not found`);
      }

      connectionString = client.databaseUrl;
      this.clientConnectionStrings.set(clientId, connectionString);
    }

    // Create new client database connection with schema isolation
    const clientDbClient = postgres(connectionString);
    const clientDb = drizzle(clientDbClient, { 
      schema: clientSchema,
      logger: false
    });
    
    // Cache the connection
    this.clientDbs.set(clientId, clientDb);
    
    return clientDb;
  }

  // Create a new client database schema
  public async createClientDatabase(clientName: string): Promise<{ databaseName: string; databaseUrl: string }> {
    // Generate unique schema name for client data isolation
    const schemaName = `client_${clientName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
    
    // Use the same database URL but with client-specific schema
    const baseUrl = process.env.DATABASE_URL || 'postgresql://localhost:5432/neondb';
    const databaseUrl = `${baseUrl}?schema=${schemaName}`;
    
    // Create the schema for client data isolation
    const sql = postgres(baseUrl);
    try {
      await sql`CREATE SCHEMA IF NOT EXISTS ${sql(schemaName)}`;
      console.log(`Created schema ${schemaName} for client data isolation`);
    } catch (error) {
      console.error(`Error creating schema ${schemaName}:`, error);
    } finally {
      await sql.end();
    }
    
    return { databaseName: schemaName, databaseUrl };
  }

  // Initialize client database schema with tables
  public async initializeClientDatabase(clientId: number) {
    // Get client info for schema name
    const [client] = await this.mspDb
      .select({ databaseName: mspSchema.clients.databaseName })
      .from(mspSchema.clients)
      .where(eq(mspSchema.clients.id, clientId))
      .limit(1);

    if (!client) {
      throw new Error(`Client ${clientId} not found`);
    }

    const schemaName = client.databaseName;
    console.log(`Initializing database schema ${schemaName} for client ${clientId}`);
    
    // Create client tables in the schema
    const baseUrl = process.env.DATABASE_URL || 'postgresql://localhost:5432/neondb';
    const sql = postgres(baseUrl);
    
    try {
      // Set search path to client schema
      await sql`SET search_path TO ${sql(schemaName)}`;
      
      // Create client-specific tables in the schema
      await sql`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          okta_id VARCHAR(255) UNIQUE,
          first_name VARCHAR(100) NOT NULL,
          last_name VARCHAR(100) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          login VARCHAR(100) UNIQUE NOT NULL,
          mobile_phone VARCHAR(50),
          department VARCHAR(100),
          title VARCHAR(200),
          employee_type VARCHAR(50),
          status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
          groups TEXT[] DEFAULT '{}',
          applications TEXT[] DEFAULT '{}',
          profile_image_url TEXT,
          manager_id INTEGER,
          manager VARCHAR(200),
          created TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          last_login TIMESTAMP,
          password_changed TIMESTAMP
        )`;

      await sql`
        CREATE TABLE IF NOT EXISTS integrations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL UNIQUE,
          display_name VARCHAR(100),
          description TEXT,
          status VARCHAR(20) NOT NULL DEFAULT 'disconnected',
          api_keys JSONB DEFAULT '{}',
          config JSONB DEFAULT '{}',
          created TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        )`;

      await sql`
        CREATE TABLE IF NOT EXISTS layout_settings (
          id SERIAL PRIMARY KEY,
          setting_key VARCHAR(100) NOT NULL UNIQUE,
          setting_value TEXT,
          setting_type VARCHAR(50) NOT NULL,
          metadata JSONB DEFAULT '{}',
          updated_by INTEGER,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        )`;

      await sql`
        CREATE TABLE IF NOT EXISTS dashboard_cards (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          type VARCHAR(50) NOT NULL,
          enabled BOOLEAN NOT NULL DEFAULT true,
          position INTEGER NOT NULL DEFAULT 0,
          created TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        )`;

      await sql`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id SERIAL PRIMARY KEY,
          user_id INTEGER,
          user_email VARCHAR(255),
          action VARCHAR(50) NOT NULL,
          resource_type VARCHAR(100),
          resource_id VARCHAR(255),
          resource_name VARCHAR(255),
          details JSONB DEFAULT '{}',
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          old_values JSONB DEFAULT '{}',
          new_values JSONB DEFAULT '{}'
        )`;

      console.log(`Successfully created tables in schema ${schemaName} for client ${clientId}`);
    } catch (error) {
      console.error(`Error initializing schema ${schemaName}:`, error);
      throw error;
    } finally {
      await sql.end();
    }
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