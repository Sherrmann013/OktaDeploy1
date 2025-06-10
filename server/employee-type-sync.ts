import { storage } from './storage';
import { oktaService } from './okta-service';

interface EmployeeTypeMapping {
  [key: string]: string;
}

const GROUP_TO_EMPLOYEE_TYPE: EmployeeTypeMapping = {
  'MTX-ET-EMPLOYEE': 'EMPLOYEE',
  'MTX-ET-CONTRACTOR': 'CONTRACTOR', 
  'MTX-ET-INTERN': 'INTERN',
  'MTX-ET-PART_TIME': 'PART_TIME',
  'MTXCW-ET-EMPLOYEE': 'EMPLOYEE'
};

export class EmployeeTypeSync {
  // Sync employee types from OKTA groups and store locally
  static async syncEmployeeTypesFromGroups(): Promise<{
    success: boolean;
    updated: number;
    message: string;
  }> {
    try {
      console.log('Starting employee type sync from OKTA groups...');
      
      // Get all users from database
      const result = await storage.getAllUsers();
      const allLocalUsers = result.users;
      console.log(`Found ${allLocalUsers.length} local users to sync`);
      
      let updatedCount = 0;
      
      for (const user of allLocalUsers) {
        if (!user.oktaId) continue;
        
        try {
          // Get user's groups from OKTA
          const userGroups = await oktaService.getUserGroups(user.oktaId);
          
          // Find employee type group
          let employeeType: string | null = null;
          for (const group of userGroups) {
            if (GROUP_TO_EMPLOYEE_TYPE[group.profile.name]) {
              employeeType = GROUP_TO_EMPLOYEE_TYPE[group.profile.name];
              break;
            }
          }
          
          // Update if different from current
          if (employeeType !== user.employeeType) {
            await storage.updateUser(user.id, { employeeType });
            updatedCount++;
            console.log(`Updated ${user.email}: ${user.employeeType} → ${employeeType}`);
          }
          
        } catch (userError) {
          console.error(`Error syncing employee type for ${user.email}:`, userError);
        }
      }
      
      return {
        success: true,
        updated: updatedCount,
        message: `Employee type sync completed. ${updatedCount} users updated.`
      };
      
    } catch (error) {
      console.error('Employee type sync failed:', error);
      return {
        success: false,
        updated: 0,
        message: `Employee type sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Get employee type counts from local storage (no OKTA calls)
  static async getEmployeeTypeCountsLocal(): Promise<Record<string, number>> {
    const result = await storage.getAllUsers();
    const users = result.users;
    const counts: Record<string, number> = {
      EMPLOYEE: 0,
      CONTRACTOR: 0,
      INTERN: 0,
      PART_TIME: 0
    };
    
    for (const user of users) {
      if (user.employeeType && counts.hasOwnProperty(user.employeeType)) {
        counts[user.employeeType]++;
      }
    }
    
    return counts;
  }

  // Assign employee type when creating new user
  static async assignEmployeeTypeForNewUser(oktaId: string): Promise<string | null> {
    try {
      const userGroups = await oktaService.getUserGroups(oktaId);
      
      for (const group of userGroups) {
        if (GROUP_TO_EMPLOYEE_TYPE[group.profile.name]) {
          return GROUP_TO_EMPLOYEE_TYPE[group.profile.name];
        }
      }
      
      return null;
    } catch (error) {
      console.error(`Error getting employee type for new user ${oktaId}:`, error);
      return null;
    }
  }
}