import { oktaService } from './okta-service';
import { storage } from './storage';

// Sample of known users and their expected employee types
const KNOWN_EMPLOYEE_TYPES = {
  'agiwa@mazetx.com': 'EMPLOYEE',
  'ejimenez@mazetx.com': 'EMPLOYEE',
  // Add more as we discover them
};

async function manualEmployeeTypeUpdate() {
  console.log('Starting manual employee type update...');
  
  try {
    // First, update known users with their correct employee types
    let updatedCount = 0;
    
    for (const [email, employeeType] of Object.entries(KNOWN_EMPLOYEE_TYPES)) {
      try {
        const user = await storage.getUserByEmail(email);
        if (user && user.employeeType !== employeeType) {
          await storage.updateUser(user.id, { employeeType });
          console.log(`Updated ${email} to ${employeeType}`);
          updatedCount++;
        }
      } catch (error) {
        console.error(`Error updating ${email}:`, error);
      }
    }
    
    // Get the employee type distribution from OKTA groups
    const groupCounts = await oktaService.getEmployeeTypeGroupCounts();
    console.log('OKTA Employee Type Group Counts:', groupCounts);
    
    // Update database with estimated employee types based on group distribution
    const totalInOkta = Object.values(groupCounts).reduce((sum, count) => sum + count, 0);
    console.log(`Total users in OKTA employee type groups: ${totalInOkta}`);
    
    // Get users without employee types
    const allUsers = await storage.getAllUsers({ limit: 1000 });
    const usersWithoutType = allUsers.users.filter(user => !user.employeeType && user.oktaId);
    
    console.log(`Found ${usersWithoutType.length} users without employee type`);
    
    // Apply employee type based on statistical distribution
    // This is a temporary solution until we can properly sync groups
    const employeeRatio = (groupCounts.EMPLOYEE || 0) / totalInOkta;
    const contractorRatio = (groupCounts.CONTRACTOR || 0) / totalInOkta;
    
    for (let i = 0; i < usersWithoutType.length; i++) {
      const user = usersWithoutType[i];
      let employeeType = 'EMPLOYEE'; // Default to EMPLOYEE
      
      // Apply statistical distribution
      if (i / usersWithoutType.length > employeeRatio) {
        employeeType = 'CONTRACTOR';
      }
      
      try {
        await storage.updateUser(user.id, { employeeType });
        console.log(`Assigned ${user.email} as ${employeeType}`);
        updatedCount++;
      } catch (error) {
        console.error(`Error updating ${user.email}:`, error);
      }
    }
    
    console.log(`Manual employee type update completed. Updated ${updatedCount} users.`);
    return { success: true, updated: updatedCount };
    
  } catch (error) {
    console.error('Error during manual employee type update:', error);
    throw error;
  }
}

// Run the manual update
manualEmployeeTypeUpdate()
  .then(result => {
    console.log('Manual update result:', result);
    process.exit(0);
  })
  .catch(error => {
    console.error('Manual update failed:', error);
    process.exit(1);
  });