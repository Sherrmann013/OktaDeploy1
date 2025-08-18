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
    // Force SSL for all cloud databases (Replit uses Neon which requires SSL)
    const requireSSL = !mspConnectionString.includes('localhost');
    console.log(`MSP DB SSL mode: ${requireSSL ? 'require' : 'disabled'} for ${mspConnectionString.substring(0, 30)}...`);
    const mspClient = postgres(mspConnectionString, { 
      ssl: requireSSL ? 'require' : false,
      transform: { undefined: null }
    });
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

  // Get client-specific database connection (separate database)
  public async getClientDb(clientId: number) {
    // Check if we already have a connection for this client
    if (this.clientDbs.has(clientId)) {
      return this.clientDbs.get(clientId)!;
    }

    // Get client database info from MSP database
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

    try {
      // Create new client database connection
      console.log(`🔌 Connecting to client ${clientId} database...`);
      // Force SSL for all cloud databases (Replit uses Neon which requires SSL)
      const requireSSL = !connectionString.includes('localhost');
      const clientDbClient = postgres(connectionString, {
        ssl: requireSSL ? 'require' : false,
        transform: { undefined: null }
      });
      const clientDb = drizzle(clientDbClient, { 
        schema: clientSchema,
        logger: false
      });
      
      // Test the connection
      await clientDbClient`SELECT 1`;
      console.log(`✅ Successfully connected to client ${clientId} database`);
      
      // Cache the connection
      this.clientDbs.set(clientId, clientDb);
      
      return clientDb;
    } catch (error) {
      console.error(`❌ Failed to connect to client ${clientId} database:`, error);
      throw error;
    }
  }

  // Create a new client database (separate database instance)
  public async createClientDatabase(clientName: string): Promise<{ databaseName: string; databaseUrl: string }> {
    // Generate unique database name for complete client isolation
    const databaseName = `client_${clientName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
    
    // Get base connection info
    const baseUrl = process.env.DATABASE_URL || 'postgresql://localhost:5432/neondb';
    const parsedUrl = new URL(baseUrl);
    
    // Create the new database using superuser connection
    // Force SSL for all cloud databases (Replit uses Neon which requires SSL)
    const requireSSL = !baseUrl.includes('localhost');
    const sql = postgres(baseUrl, {
      ssl: requireSSL ? 'require' : false,
      transform: { undefined: null }
    });
    try {
      console.log(`Creating separate database: ${databaseName}`);
      await sql`CREATE DATABASE ${sql(databaseName)}`;
      console.log(`✅ Successfully created database: ${databaseName}`);
    } catch (error) {
      console.error(`❌ Error creating database ${databaseName}:`, error);
      throw error;
    } finally {
      await sql.end();
    }
    
    // Build the new database URL
    parsedUrl.pathname = `/${databaseName}`;
    const databaseUrl = parsedUrl.toString();
    
    console.log(`🔗 Database URL: ${databaseUrl}`);
    return { databaseName, databaseUrl };
  }

  // Initialize client database with tables (separate database)
  public async initializeClientDatabase(clientId: number) {
    console.log(`🚀 Initializing separate database for client ${clientId}`);
    
    try {
      // Get the client database connection
      const clientDb = await this.getClientDb(clientId);
      
      // Get client info for logging
      const [client] = await this.mspDb
        .select({ databaseName: mspSchema.clients.databaseName })
        .from(mspSchema.clients)
        .where(eq(mspSchema.clients.id, clientId))
        .limit(1);

      if (!client) {
        throw new Error(`Client ${clientId} not found`);
      }

      const databaseName = client.databaseName;
      console.log(`📊 Creating tables in database: ${databaseName}`);
      
      // Get the raw SQL connection from the client database
      const clientConnectionString = this.clientConnectionStrings.get(clientId);
      if (!clientConnectionString) {
        throw new Error(`No connection string found for client ${clientId}`);
      }
      
      // Force SSL for all cloud databases (Replit uses Neon which requires SSL)
      const requireSSL = !clientConnectionString.includes('localhost');
      const sql = postgres(clientConnectionString, {
        ssl: requireSSL ? 'require' : false,
        transform: { undefined: null }
      });
      
      try {
        // Create client-specific tables in the separate database
        console.log(`🔧 Creating users table...`);
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

        console.log(`🔧 Creating integrations table...`);
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

        console.log(`🔧 Creating layout_settings table...`);
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

        console.log(`🔧 Creating dashboard_cards table...`);
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

        console.log(`🔧 Creating audit_logs table...`);
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

        console.log(`🔧 Creating app_mappings table...`);
        await sql`
          CREATE TABLE IF NOT EXISTS app_mappings (
            id SERIAL PRIMARY KEY,
            app_name VARCHAR(200) NOT NULL,
            okta_group_name VARCHAR(200) NOT NULL,
            description TEXT,
            status VARCHAR(20) NOT NULL DEFAULT 'active',
            created TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
          )`;

        console.log(`🔧 Creating department_app_mappings table...`);
        await sql`
          CREATE TABLE IF NOT EXISTS department_app_mappings (
            id SERIAL PRIMARY KEY,
            department_name VARCHAR(100) NOT NULL,
            app_name VARCHAR(200) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
          )`;

        console.log(`🔧 Creating employee_type_app_mappings table...`);
        await sql`
          CREATE TABLE IF NOT EXISTS employee_type_app_mappings (
            id SERIAL PRIMARY KEY,
            employee_type VARCHAR(50) NOT NULL,
            app_name VARCHAR(200) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
          )`;

        console.log(`🔧 Creating department_group_mappings table...`);
        await sql`
          CREATE TABLE IF NOT EXISTS department_group_mappings (
            id SERIAL PRIMARY KEY,
            department_name VARCHAR(100) NOT NULL,
            group_name VARCHAR(200) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
          )`;

        console.log(`🔧 Creating employee_type_group_mappings table...`);
        await sql`
          CREATE TABLE IF NOT EXISTS employee_type_group_mappings (
            id SERIAL PRIMARY KEY,
            employee_type VARCHAR(50) NOT NULL,
            group_name VARCHAR(200) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
          )`;

        console.log(`🔧 Creating monitoring_cards table...`);
        await sql`
          CREATE TABLE IF NOT EXISTS monitoring_cards (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            type VARCHAR(50) NOT NULL,
            enabled BOOLEAN NOT NULL DEFAULT true,
            position INTEGER NOT NULL DEFAULT 0,
            created TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
          )`;

        console.log(`🔧 Creating company_logos table...`);
        await sql`
          CREATE TABLE IF NOT EXISTS company_logos (
            id SERIAL PRIMARY KEY,
            file_name VARCHAR(255) NOT NULL,
            mime_type VARCHAR(100) NOT NULL,
            file_size INTEGER NOT NULL,
            logo_data TEXT NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT false,
            uploaded_by INTEGER,
            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
          )`;

        console.log(`🔧 Creating jira_dashboard_components table...`);
        await sql`
          CREATE TABLE IF NOT EXISTS jira_dashboard_components (
            id SERIAL PRIMARY KEY,
            card_id INTEGER NOT NULL,
            component_type VARCHAR(50) NOT NULL,
            component_name VARCHAR(100) NOT NULL,
            config JSONB NOT NULL DEFAULT '{}',
            position INTEGER NOT NULL DEFAULT 0,
            created TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
          )`;

        console.log(`✅ Successfully created all tables in database ${databaseName} for client ${clientId}`);
      } finally {
        await sql.end();
      }
    } catch (error) {
      console.error(`❌ Error initializing database for client ${clientId}:`, error);
      throw error;
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