import { oktaService } from './okta-service';
import { storage } from './storage';

// Helper function to determine employee type from user groups
function determineEmployeeTypeFromGroups(userGroups: any[]): string | null {
  for (const group of userGroups) {
    const groupName = group.profile?.name || group.name || '';
    
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

export async function bulkSyncUserGroupsAndEmployeeTypes(): Promise<{updated: number, errors: number, details: string[]}> {
  try {
    console.log("Starting bulk sync of all user groups and employee types...");
    
    // Get all users from database that have OKTA IDs
    const allUsers = await storage.getAllUsers({ limit: 1000 });
    const usersWithOktaIds = allUsers.users.filter(user => user.oktaId);
    
    console.log(`Found ${usersWithOktaIds.length} users with OKTA IDs to sync groups for`);
    
    let updated = 0;
    let errors = 0;
    const details: string[] = [];
    
    for (const user of usersWithOktaIds) {
      try {
        // Add delay to respect OKTA rate limits
        await new Promise(resolve => setTimeout(resolve, 200));
        
        console.log(`Syncing groups for ${user.email} (${user.oktaId})...`);
        
        // Get user's groups from OKTA
        const userGroups = await oktaService.getUserGroups(user.oktaId!);
        
        // Determine employee type from groups
        const employeeType = determineEmployeeTypeFromGroups(userGroups);
        
        // Only update if there's a change
        const hasGroupsChange = JSON.stringify(user.groups) !== JSON.stringify(userGroups);
        const hasEmployeeTypeChange = user.employeeType !== employeeType;
        
        if (hasGroupsChange || hasEmployeeTypeChange) {
          await storage.updateUser(user.id, {
            groups: userGroups,
            employeeType: employeeType
          });
          
          const changeDetails = [];
          if (hasEmployeeTypeChange) {
            changeDetails.push(`employee type: ${user.employeeType || 'null'} → ${employeeType || 'null'}`);
          }
          if (hasGroupsChange) {
            changeDetails.push(`groups: ${userGroups.length} groups`);
          }
          
          details.push(`${user.email}: ${changeDetails.join(', ')}`);
          updated++;
          
          console.log(`Updated ${user.email}: Employee type = ${employeeType}, Groups = ${userGroups.length}`);
        } else {
          console.log(`No changes needed for ${user.email}`);
        }
        
      } catch (error) {
        console.error(`Failed to sync groups for user ${user.email}:`, error);
        details.push(`${user.email}: ERROR - ${error instanceof Error ? error.message : 'Unknown error'}`);
        errors++;
      }
    }
    
    console.log(`Bulk groups sync completed. Updated: ${updated}, Errors: ${errors}`);
    
    return { updated, errors, details };
    
  } catch (error) {
    console.error("Error during bulk groups sync:", error);
    throw error;
  }
}