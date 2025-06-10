import { oktaService } from './okta-service';
import { storage } from './storage';

// Function to determine employee type from actual user groups
function determineEmployeeTypeFromGroups(userGroups: any[]): string | null {
  for (const group of userGroups) {
    const groupName = group.profile?.name || group.name || '';
    
    if (groupName === 'MTX-ET-EMPLOYEE') {
      return 'EMPLOYEE';
    } else if (groupName === 'MTX-ET-CONTRACTOR') {
      return 'CONTRACTOR';
    } else if (groupName === 'MTX-ET-INTERN') {
      return 'INTERN';
    } else if (groupName === 'MTX-ET-PART_TIME') {
      return 'PART_TIME';
    }
  }
  return null; // No employee type group found
}

async function fastGroupsSync() {
  console.log('Starting fast groups sync...');
  
  try {
    // Get users that still need syncing 
    const allUsers = await storage.getAllUsers({ limit: 1000 });
    const usersToSync = allUsers.users.filter(user => 
      user.oktaId && (!user.groups || user.groups.length === 0)
    );
    
    console.log(`Found ${usersToSync.length} users that need group sync`);
    
    let processed = 0;
    const batchSize = 25; // Smaller batch size
    
    const employeeTypeCounts = {
      EMPLOYEE: 0,
      CONTRACTOR: 0,
      INTERN: 0,
      PART_TIME: 0,
      UNDEFINED: 0
    };
    
    // Process users in smaller batch
    for (let i = 0; i < Math.min(usersToSync.length, batchSize); i++) {
      const user = usersToSync[i];
      
      try {
        console.log(`[${i + 1}/${Math.min(batchSize, usersToSync.length)}] ${user.email}...`);
        
        // Get user's groups from OKTA
        const userGroups = await oktaService.getUserGroups(user.oktaId!);
        
        // Determine employee type from groups
        const employeeType = determineEmployeeTypeFromGroups(userGroups);
        
        // Update user with groups and employee type
        await storage.updateUser(user.id, {
          groups: userGroups,
          employeeType: employeeType
        });
        
        // Count employee types
        if (employeeType) {
          employeeTypeCounts[employeeType as keyof typeof employeeTypeCounts]++;
        } else {
          employeeTypeCounts.UNDEFINED++;
        }
        
        console.log(`  → ${employeeType || 'UNDEFINED'}`);
        processed++;
        
        // Small delay
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`Failed: ${user.email}:`, error);
        break; // Stop on any error
      }
    }
    
    console.log(`\nBatch completed. Processed: ${processed}`);
    console.log('This batch counts:', employeeTypeCounts);
    
    return { 
      success: true, 
      processed,
      employeeTypeCounts
    };
    
  } catch (error) {
    console.error('Error during fast groups sync:', error);
    throw error;
  }
}

// Run the fast sync
fastGroupsSync()
  .then(result => {
    console.log('Fast sync result:', result);
    process.exit(0);
  })
  .catch(error => {
    console.error('Fast sync failed:', error);
    process.exit(1);
  });