import { MultiDatabaseManager } from './server/multi-db.js';
import postgres from 'postgres';

async function checkClientUsers() {
  try {
    console.log('🔍 Checking for duplicate Comrad Supreme users in client 13...');
    
    const multiDb = MultiDatabaseManager.getInstance();
    const clientDb = await multiDb.getClientDb(13);
    
    // Use raw SQL query to check for users with "Comrad" or "Supreme" in their names
    const sql = postgres(process.env.DATABASE_URL || 'postgresql://localhost:5432/neondb');
    
    // First, get the client database URL
    const clientQuery = await sql`
      SELECT database_url FROM clients WHERE id = 13
    `;
    
    if (clientQuery.length === 0) {
      console.log('❌ Client 13 not found');
      return;
    }
    
    const clientConnectionString = clientQuery[0].database_url;
    const clientSql = postgres(clientConnectionString, { ssl: 'require' });
    
    // Query for users with "Comrad" or "Supreme" in their names
    const users = await clientSql`
      SELECT id, okta_id, first_name, last_name, email, created, last_updated 
      FROM users 
      WHERE 
        LOWER(first_name) LIKE '%comrad%' OR 
        LOWER(last_name) LIKE '%supreme%' OR 
        LOWER(first_name) LIKE '%supreme%' OR 
        LOWER(last_name) LIKE '%comrad%' OR 
        LOWER(email) LIKE '%comrad%' OR 
        LOWER(email) LIKE '%supreme%'
      ORDER BY created
    `;
    
    console.log(`Found ${users.length} users matching "Comrad" or "Supreme":`);
    users.forEach((user, index) => {
      console.log(`${index + 1}. ID: ${user.id}, Name: ${user.first_name} ${user.last_name}, Email: ${user.email}, OKTA ID: ${user.okta_id}`);
    });
    
    // Also check for any duplicate users (same email or OKTA ID)
    console.log('\n🔍 Checking for duplicate users...');
    const allUsers = await clientSql`
      SELECT id, okta_id, first_name, last_name, email, created 
      FROM users 
      ORDER BY created
    `;
    console.log(`Total users in client 13 database: ${allUsers.length}`);
    
    // Group by email to find duplicates
    const emailGroups = new Map();
    const oktaGroups = new Map();
    
    allUsers.forEach(user => {
      if (user.email) {
        if (!emailGroups.has(user.email)) {
          emailGroups.set(user.email, []);
        }
        emailGroups.get(user.email).push(user);
      }
      
      if (user.okta_id) {
        if (!oktaGroups.has(user.okta_id)) {
          oktaGroups.set(user.okta_id, []);
        }
        oktaGroups.get(user.okta_id).push(user);
      }
    });
    
    // Find duplicates
    const emailDuplicates = Array.from(emailGroups.entries()).filter(([email, users]) => users.length > 1);
    const oktaDuplicates = Array.from(oktaGroups.entries()).filter(([oktaId, users]) => users.length > 1);
    
    if (emailDuplicates.length > 0) {
      console.log('\n❌ Found duplicate users by email:');
      emailDuplicates.forEach(([email, users]) => {
        console.log(`  Email: ${email} (${users.length} users)`);
        users.forEach(user => {
          console.log(`    ID: ${user.id}, Name: ${user.first_name} ${user.last_name}, OKTA ID: ${user.okta_id}, Created: ${user.created}`);
        });
      });
    }
    
    if (oktaDuplicates.length > 0) {
      console.log('\n❌ Found duplicate users by OKTA ID:');
      oktaDuplicates.forEach(([oktaId, users]) => {
        console.log(`  OKTA ID: ${oktaId} (${users.length} users)`);
        users.forEach(user => {
          console.log(`    ID: ${user.id}, Name: ${user.first_name} ${user.last_name}, Email: ${user.email}, Created: ${user.created}`);
        });
      });
    }
    
    if (emailDuplicates.length === 0 && oktaDuplicates.length === 0) {
      console.log('✅ No duplicate users found!');
    }
    
    await sql.end();
    await clientSql.end();
    
  } catch (error) {
    console.error('Error checking client users:', error);
  }
}

checkClientUsers().catch(console.error);

// Clean up function to remove duplicate
async function cleanupDuplicate() {
  try {
    console.log('\n🧹 Cleaning up duplicate user...');
    
    const sql = postgres(process.env.DATABASE_URL || 'postgresql://localhost:5432/neondb');
    const clientQuery = await sql`SELECT database_url FROM clients WHERE id = 13`;
    const clientConnectionString = clientQuery[0].database_url;
    const clientSql = postgres(clientConnectionString, { ssl: 'require' });
    
    // Delete the user without OKTA ID (ID: 6)
    const result = await clientSql`
      DELETE FROM users 
      WHERE id = 6 AND okta_id IS NULL 
      RETURNING id, first_name, last_name, email
    `;
    
    if (result.length > 0) {
      console.log(`✅ Deleted duplicate user: ${result[0].first_name} ${result[0].last_name} (${result[0].email})`);
    } else {
      console.log('❌ No user deleted - user may not exist or has OKTA ID');
    }
    
    await sql.end();
    await clientSql.end();
  } catch (error) {
    console.error('Error cleaning up duplicate:', error);
  }
}

// Uncomment the line below to run the cleanup
// cleanupDuplicate().catch(console.error);