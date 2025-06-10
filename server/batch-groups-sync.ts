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

async function batchGroupsSync() {
  console.log('Starting batch groups sync...');
  
  try {
    // Get users that still need syncing (either no groups or already processed)
    const allUsers = await storage.getAllUsers({ limit: 1000 });
    const usersToSync = allUsers.users.filter(user => 
      user.oktaId && (!user.groups || user.groups.length === 0)
    );
    
    console.log(`Found ${usersToSync.length} users that need group sync`);
    
    let processed = 0;
    const batchSize = 50; // Process in smaller batches
    
    const employeeTypeCounts = {
      EMPLOYEE: 0,
      CONTRACTOR: 0,
      INTERN: 0,
      PART_TIME: 0,
      UNDEFINED: 0
    };
    
    // Process users in batches
    for (let i = 0; i < usersToSync.length && i < batchSize; i++) {
      const user = usersToSync[i];
      
      try {
        // Add delay to respect OKTA rate limits
        await new Promise(resolve => setTimeout(resolve, 300));
        
        console.log(`[${i + 1}/${Math.min(batchSize, usersToSync.length)}] Syncing ${user.email}...`);
        
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
        
        console.log(`  → ${employeeType || 'UNDEFINED'} (${userGroups.length} groups)`);
        processed++;
        
      } catch (error) {
        console.error(`Failed to sync groups for user ${user.email}:`, error);
        
        // If rate limited, wait longer and break
        if (error instanceof Error && error.message.includes('429')) {
          console.log('Rate limited, stopping batch');
          break;
        }
      }
    }
    
    console.log(`Batch completed. Processed: ${processed}`);
    console.log('Employee type counts in this batch:', employeeTypeCounts);
    
    // Get overall stats
    const allUsersAfter = await storage.getAllUsers({ limit: 1000 });
    const allTypeCounts = {
      EMPLOYEE: 0,
      CONTRACTOR: 0,
      INTERN: 0,
      PART_TIME: 0,
      UNDEFINED: 0
    };
    
    allUsersAfter.users.forEach(user => {
      if (user.oktaId) {
        if (user.employeeType) {
          allTypeCounts[user.employeeType as keyof typeof allTypeCounts]++;
        } else {
          allTypeCounts.UNDEFINED++;
        }
      }
    });
    
    console.log('Overall employee type distribution:', allTypeCounts);
    
    return { 
      success: true, 
      processed,
      batchTypeCounts: employeeTypeCounts,
      overallTypeCounts: allTypeCounts
    };
    
  } catch (error) {
    console.error('Error during batch groups sync:', error);
    throw error;
  }
}

// Run the batch sync
batchGroupsSync()
  .then(result => {
    console.log('Batch sync result:', result);
    process.exit(0);
  })
  .catch(error => {
    console.error('Batch sync failed:', error);
    process.exit(1);
  });