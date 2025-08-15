// NOTE: Global oktaService removed - client-specific OKTA integrations should be used
// import { oktaService } from './okta-service';
import { storage } from './storage';

// Helper function to determine employee type from user groups
function determineEmployeeTypeFromGroups(userGroups: any[]): string | null {
  for (const group of userGroups) {
    const groupName = group.profile?.name || group.name || '';
    console.log(`Checking group: ${groupName}`);
    
    if (groupName.startsWith('MTX-ET-')) {
      if (groupName.includes('EMPLOYEE')) {
        return 'EMPLOYEE';
      } else if (groupName.includes('CONTRACTOR')) {
        return 'CONTRACTOR';
      } else if (groupName.includes('INTERN')) {
        return 'INTERN';
      } else if (groupName.includes('PART_TIME')) {
        return 'PART_TIME';
      }
    }
  }
  return null;
}

export async function syncUserGroupsAndEmployeeType(userId: number, oktaId: string): Promise<void> {
  try {
    console.log(`Syncing groups and employee type for user ${oktaId}...`);
    
    // Get user's groups from OKTA
    const userGroups = await oktaService.getUserGroups(oktaId);
    console.log(`Found ${userGroups.length} groups for user ${oktaId}`);
    
    // Determine employee type from groups
    const employeeType = determineEmployeeTypeFromGroups(userGroups);
    console.log(`Determined employee type: ${employeeType}`);
    
    // Update user with groups and employee type
    await storage.updateUser(userId, {
      groups: userGroups,
      employeeType: employeeType
    });
    
    console.log(`Updated user ${oktaId} with ${userGroups.length} groups and employee type: ${employeeType}`);
    
  } catch (error) {
    console.error(`Error syncing groups for user ${oktaId}:`, error);
    throw error;
  }
}

export async function syncAllUsersGroupsAndEmployeeTypes(): Promise<{updated: number, errors: number}> {
  try {
    console.log("Starting sync of all user groups and employee types...");
    
    // Get all users from database that have OKTA IDs
    const allUsers = await storage.getAllUsers({ limit: 1000 });
    const usersWithOktaIds = allUsers.users.filter(user => user.oktaId);
    
    console.log(`Found ${usersWithOktaIds.length} users with OKTA IDs to sync`);
    
    let updated = 0;
    let errors = 0;
    
    for (const user of usersWithOktaIds) {
      try {
        await syncUserGroupsAndEmployeeType(user.id, user.oktaId!);
        updated++;
        
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`Failed to sync groups for user ${user.email}:`, error);
        errors++;
      }
    }
    
    console.log(`Groups sync completed. Updated: ${updated}, Errors: ${errors}`);
    
    return { updated, errors };
    
  } catch (error) {
    console.error("Error during bulk groups sync:", error);
    throw error;
  }
}