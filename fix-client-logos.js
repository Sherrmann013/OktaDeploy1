// Script to fix client database logo table structure
import { MultiDatabaseManager } from './server/multi-db.js';
import { clients } from './shared/msp-schema.js';
import { eq } from 'drizzle-orm';

async function fixClientLogos() {
  console.log('🔧 Starting client logo table fixes...');
  
  const dbManager = MultiDatabaseManager.getInstance();
  const mspDb = dbManager.getMspDb();
  
  try {
    // Get all clients
    const allClients = await mspDb.select({ id: clients.id, name: clients.name }).from(clients);
    console.log(`📋 Found ${allClients.length} clients to fix`);
    
    for (const client of allClients) {
      console.log(`🔧 Fixing client ${client.id} (${client.name})...`);
      
      try {
        const clientDb = await dbManager.getClientDb(client.id);
        
        // Get raw connection to run DDL
        const clientConnectionString = dbManager.clientConnectionStrings.get(client.id);
        if (!clientConnectionString) {
          console.log(`⚠️  No connection string for client ${client.id}, skipping...`);
          continue;
        }
        
        const { default: postgres } = await import('postgres');
        const requireSSL = !clientConnectionString.includes('localhost');
        const sql = postgres(clientConnectionString, {
          ssl: requireSSL ? 'require' : false,
          transform: { undefined: null }
        });
        
        try {
          // Check current table structure
          const columns = await sql`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'company_logos' 
            AND table_schema = 'public'
          `;
          
          const columnNames = columns.map(c => c.column_name);
          console.log(`📊 Current columns for client ${client.id}:`, columnNames);
          
          // Fix the table structure
          if (columnNames.includes('name') && !columnNames.includes('file_name')) {
            console.log(`🔄 Renaming 'name' to 'file_name' for client ${client.id}`);
            await sql`ALTER TABLE company_logos RENAME COLUMN name TO file_name`;
          }
          
          if (!columnNames.includes('mime_type')) {
            console.log(`🔄 Adding 'mime_type' column for client ${client.id}`);
            await sql`ALTER TABLE company_logos ADD COLUMN mime_type VARCHAR(100) DEFAULT 'image/png'`;
          }
          
          if (!columnNames.includes('file_size')) {
            console.log(`🔄 Adding 'file_size' column for client ${client.id}`);
            await sql`ALTER TABLE company_logos ADD COLUMN file_size INTEGER DEFAULT 1000`;
          }
          
          // Make required columns NOT NULL after adding defaults
          await sql`ALTER TABLE company_logos ALTER COLUMN file_name SET NOT NULL`;
          await sql`ALTER TABLE company_logos ALTER COLUMN mime_type SET NOT NULL`;
          await sql`ALTER TABLE company_logos ALTER COLUMN file_size SET NOT NULL`;
          
          console.log(`✅ Fixed client ${client.id} (${client.name}) logo table`);
          
        } finally {
          await sql.end();
        }
        
      } catch (error) {
        console.error(`❌ Error fixing client ${client.id}:`, error);
      }
    }
    
    console.log('✅ Completed client logo table fixes');
    
  } catch (error) {
    console.error('❌ Error in fixClientLogos:', error);
  }
}

// Run the fix
fixClientLogos().then(() => {
  console.log('🎉 Logo table fixes completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Failed to fix logo tables:', error);
  process.exit(1);
});