import { MultiDatabaseManager } from './multi-db';
import { integrations, layoutSettings, jiraDashboardComponents } from '../shared/client-schema';
import { clients } from '../shared/msp-schema';
import { eq, sql } from 'drizzle-orm';

/**
 * Admin Operations Module
 * Handles system-wide administrative operations across all clients
 */

export interface SystemHealth {
  timestamp: string;
  mspDatabase: {
    status: 'healthy' | 'error';
    clientCount: number;
    lastUpdated: string;
    error?: string;
  };
  clientDatabases: Array<{
    clientId: number;
    clientName: string;
    status: 'healthy' | 'error' | 'unreachable';
    integrationCount: number;
    userCount: number;
    lastActivity: string;
    error?: string;
  }>;
  summary: {
    totalClients: number;
    healthyClients: number;
    totalIntegrations: number;
    systemStatus: 'healthy' | 'degraded' | 'critical';
  };
}

export interface IntegrationDeployment {
  integrationName: string;
  version: string;
  description: string;
  schema?: any;
  defaultConfig?: any;
  targetClients?: number[]; // If empty, deploy to all
}

export interface MigrationOperation {
  migrationId: string;
  description: string;
  targetDatabases: 'msp' | 'clients' | 'all';
  sqlStatements: string[];
  rollbackStatements?: string[];
}

/**
 * Health Check Operations
 */
export async function performSystemHealthCheck(): Promise<SystemHealth> {
  const timestamp = new Date().toISOString();
  const multiDb = MultiDatabaseManager.getInstance();
  
  console.log('🏥 Starting system health check...');
  
  const health: SystemHealth = {
    timestamp,
    mspDatabase: {
      status: 'healthy',
      clientCount: 0,
      lastUpdated: '',
      error: undefined
    },
    clientDatabases: [],
    summary: {
      totalClients: 0,
      healthyClients: 0,
      totalIntegrations: 0,
      systemStatus: 'healthy'
    }
  };

  try {
    // Check MSP Database
    console.log('🔍 Checking MSP database...');
    const mspDb = await multiDb.getMspDb();
    
    const clientList = await mspDb.select().from(clients);
    health.mspDatabase.clientCount = clientList.length;
    health.mspDatabase.lastUpdated = new Date().toISOString();
    health.summary.totalClients = clientList.length;
    
    console.log(`✅ MSP database healthy: ${clientList.length} clients`);

    // Check each client database
    for (const client of clientList) {
      console.log(`🔍 Checking client ${client.id} (${client.name}) database...`);
      
      const clientHealth = {
        clientId: client.id,
        clientName: client.name,
        status: 'healthy' as const,
        integrationCount: 0,
        userCount: 0,
        lastActivity: 'unknown',
        error: undefined
      };

      try {
        const clientDb = await multiDb.getClientDb(client.id);
        
        // Count integrations
        const clientIntegrationsList = await clientDb.select().from(integrations);
        clientHealth.integrationCount = clientIntegrationsList.length;
        health.summary.totalIntegrations += clientIntegrationsList.length;
        
        // Get last activity (most recent integration update)
        const lastIntegration = clientIntegrationsList
          .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())[0];
        
        if (lastIntegration) {
          clientHealth.lastActivity = lastIntegration.lastUpdated;
        }
        
        health.summary.healthyClients++;
        console.log(`✅ Client ${client.name} healthy: ${clientIntegrationsList.length} integrations`);
        
      } catch (error) {
        console.error(`❌ Client ${client.name} database error:`, error);
        clientHealth.status = 'error';
        clientHealth.error = error instanceof Error ? error.message : 'Unknown error';
      }
      
      health.clientDatabases.push(clientHealth);
    }

  } catch (error) {
    console.error('❌ MSP database error:', error);
    health.mspDatabase.status = 'error';
    health.mspDatabase.error = error instanceof Error ? error.message : 'Unknown error';
  }

  // Determine overall system status
  const healthyRatio = health.summary.healthyClients / health.summary.totalClients;
  if (health.mspDatabase.status === 'error') {
    health.summary.systemStatus = 'critical';
  } else if (healthyRatio < 0.8) {
    health.summary.systemStatus = 'degraded';
  } else {
    health.summary.systemStatus = 'healthy';
  }

  console.log(`🏥 Health check complete: ${health.summary.systemStatus} (${health.summary.healthyClients}/${health.summary.totalClients} clients healthy)`);
  
  return health;
}

/**
 * Integration Management Operations
 */
export async function deployIntegrationToClients(deployment: IntegrationDeployment): Promise<{
  success: boolean;
  results: Array<{
    clientId: number;
    clientName: string;
    status: 'success' | 'error' | 'skipped';
    message: string;
  }>;
}> {
  console.log(`🚀 Deploying integration: ${deployment.integrationName} v${deployment.version}`);
  
  const multiDb = MultiDatabaseManager.getInstance();
  const results: Array<{
    clientId: number;
    clientName: string;
    status: 'success' | 'error' | 'skipped';
    message: string;
  }> = [];

  try {
    const mspDb = await multiDb.getMspDb();
    const clientList = await mspDb.select().from(clients);
    
    const targetClients = deployment.targetClients?.length 
      ? clientList.filter(c => deployment.targetClients!.includes(c.id))
      : clientList;

    console.log(`📋 Deploying to ${targetClients.length} clients`);

    for (const client of targetClients) {
      console.log(`🔧 Deploying to client ${client.id} (${client.name})`);
      
      try {
        const clientDb = await multiDb.getClientDb(client.id);
        
        // Check if integration already exists
        const existingIntegration = await clientDb.select()
          .from(integrations)
          .where(eq(integrations.name, deployment.integrationName));

        if (existingIntegration.length > 0) {
          // Update existing integration
          await clientDb.update(integrations)
            .set({
              config: deployment.defaultConfig || {}
            })
            .where(eq(integrations.name, deployment.integrationName));
          
          results.push({
            clientId: client.id,
            clientName: client.name,
            status: 'success',
            message: `Updated existing integration to v${deployment.version}`
          });
        } else {
          // Insert new integration
          await clientDb.insert(integrations).values({
            name: deployment.integrationName,
            status: 'disconnected',
            config: deployment.defaultConfig || {},
            apiKeys: {}
          });
          
          results.push({
            clientId: client.id,
            clientName: client.name,
            status: 'success',
            message: `Installed new integration v${deployment.version}`
          });
        }
        
        console.log(`✅ Successfully deployed to ${client.name}`);
        
      } catch (error) {
        console.error(`❌ Failed to deploy to ${client.name}:`, error);
        results.push({
          clientId: client.id,
          clientName: client.name,
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    console.log(`🎯 Deployment complete: ${successCount}/${results.length} successful`);

    return {
      success: successCount > 0,
      results
    };

  } catch (error) {
    console.error('❌ Integration deployment failed:', error);
    throw error;
  }
}

/**
 * Database Migration Operations
 */
export async function executeMigration(migration: MigrationOperation): Promise<{
  success: boolean;
  results: Array<{
    database: string;
    status: 'success' | 'error';
    message: string;
  }>;
}> {
  console.log(`🔄 Executing migration: ${migration.migrationId}`);
  console.log(`📝 Description: ${migration.description}`);
  
  const multiDb = MultiDatabaseManager.getInstance();
  const results: Array<{
    database: string;
    status: 'success' | 'error';
    message: string;
  }> = [];

  try {
    // Execute on MSP database if needed
    if (migration.targetDatabases === 'msp' || migration.targetDatabases === 'all') {
      console.log('🔧 Executing migration on MSP database...');
      
      try {
        const mspDb = await multiDb.getMspDb();
        
        for (const statement of migration.sqlStatements) {
          await mspDb.execute(sql.raw(statement));
        }
        
        results.push({
          database: 'MSP',
          status: 'success',
          message: `Executed ${migration.sqlStatements.length} statements`
        });
        
        console.log('✅ MSP database migration complete');
        
      } catch (error) {
        console.error('❌ MSP database migration failed:', error);
        results.push({
          database: 'MSP',
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Execute on client databases if needed
    if (migration.targetDatabases === 'clients' || migration.targetDatabases === 'all') {
      console.log('🔧 Executing migration on client databases...');
      
      const mspDb = await multiDb.getMspDb();
      const clientList = await mspDb.select().from(clients);
      
      for (const client of clientList) {
        console.log(`🔧 Migrating client ${client.id} (${client.name})`);
        
        try {
          const clientDb = await multiDb.getClientDb(client.id);
          
          for (const statement of migration.sqlStatements) {
            await clientDb.execute(sql.raw(statement));
          }
          
          results.push({
            database: `Client: ${client.name}`,
            status: 'success',
            message: `Executed ${migration.sqlStatements.length} statements`
          });
          
          console.log(`✅ Client ${client.name} migration complete`);
          
        } catch (error) {
          console.error(`❌ Client ${client.name} migration failed:`, error);
          results.push({
            database: `Client: ${client.name}`,
            status: 'error',
            message: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    console.log(`🎯 Migration complete: ${successCount}/${results.length} successful`);

    return {
      success: successCount > 0,
      results
    };

  } catch (error) {
    console.error('❌ Migration execution failed:', error);
    throw error;
  }
}

/**
 * System Information Operations
 */
export async function getSystemInfo(): Promise<{
  version: string;
  environment: string;
  uptime: number;
  databases: {
    msp: {
      connected: boolean;
      clientCount: number;
    };
    clients: Array<{
      id: number;
      name: string;
      connected: boolean;
      integrationCount: number;
    }>;
  };
}> {
  console.log('📊 Gathering system information...');
  
  const multiDb = MultiDatabaseManager.getInstance();
  const info = {
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    databases: {
      msp: {
        connected: false,
        clientCount: 0
      },
      clients: [] as Array<{
        id: number;
        name: string;
        connected: boolean;
        integrationCount: number;
      }>
    }
  };

  try {
    const mspDb = await multiDb.getMspDb();
    info.databases.msp.connected = true;
    
    const clientList = await mspDb.select().from(clients);
    info.databases.msp.clientCount = clientList.length;
    
    for (const client of clientList) {
      const clientInfo = {
        id: client.id,
        name: client.name,
        connected: false,
        integrationCount: 0
      };
      
      try {
        const clientDb = await multiDb.getClientDb(client.id);
        clientInfo.connected = true;
        
        const clientIntegrationsList = await clientDb.select().from(integrations);
        clientInfo.integrationCount = clientIntegrationsList.length;
        
      } catch (error) {
        console.warn(`⚠️ Client ${client.name} database not accessible`);
      }
      
      info.databases.clients.push(clientInfo);
    }
    
  } catch (error) {
    console.error('❌ Failed to gather system info:', error);
  }

  return info;
}