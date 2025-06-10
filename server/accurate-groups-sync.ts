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

async function accurateGroupsSync() {
  console.log('Starting accurate groups sync based on actual OKTA group memberships...');
  
  try {
    // Get all users from database that have OKTA IDs
    const allUsers = await storage.getAllUsers({ limit: 1000 });
    const usersWithOktaIds = allUsers.users.filter(user => user.oktaId);
    
    console.log(`Found ${usersWithOktaIds.length} users with OKTA IDs to sync groups for`);
    
    let updated = 0;
    let errors = 0;
    const employeeTypeCounts = {
      EMPLOYEE: 0,
      CONTRACTOR: 0,
      INTERN: 0,
      PART_TIME: 0,
      UNDEFINED: 0
    };
    
    for (const user of usersWithOktaIds) {
      try {
        // Add delay to respect OKTA rate limits
        await new Promise(resolve => setTimeout(resolve, 250));
        
        console.log(`Fetching groups for ${user.email}...`);
        
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
        
        console.log(`Updated ${user.email}: Employee type = ${employeeType || 'UNDEFINED'}, Groups = ${userGroups.length}`);
        updated++;
        
      } catch (error) {
        console.error(`Failed to sync groups for user ${user.email}:`, error);
        errors++;
        
        // If rate limited, wait longer
        if (error instanceof Error && error.message.includes('429')) {
          console.log('Rate limited, waiting 30 seconds...');
          await new Promise(resolve => setTimeout(resolve, 30000));
        }
      }
    }
    
    console.log('Accurate groups sync completed.');
    console.log('Final employee type counts:', employeeTypeCounts);
    console.log(`Updated: ${updated}, Errors: ${errors}`);
    
    return { 
      success: true, 
      updated, 
      errors, 
      employeeTypeCounts 
    };
    
  } catch (error) {
    console.error('Error during accurate groups sync:', error);
    throw error;
  }
}

// Run the accurate sync
accurateGroupsSync()
  .then(result => {
    console.log('Accurate sync result:', result);
    process.exit(0);
  })
  .catch(error => {
    console.error('Accurate sync failed:', error);
    process.exit(1);
  });