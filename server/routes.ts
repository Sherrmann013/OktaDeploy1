import type { Express } from "express";
import { createServer, type Server } from "http";
import postgres from "postgres";
import { storage } from "./storage";
import { insertUserSchema, updateUserSchema, insertSiteAccessUserSchema, siteAccessUsers, insertIntegrationSchema, integrations, auditLogs, insertAppMappingSchema, appMappings, departmentAppMappings, insertDepartmentAppMappingSchema, employeeTypeAppMappings, insertEmployeeTypeAppMappingSchema, departmentGroupMappings, insertDepartmentGroupMappingSchema, employeeTypeGroupMappings, insertEmployeeTypeGroupMappingSchema, insertLayoutSettingSchema, layoutSettings, dashboardCards, insertDashboardCardSchema, updateDashboardCardSchema, monitoringCards, insertMonitoringCardSchema, updateMonitoringCardSchema, companyLogos, insertCompanyLogoSchema, insertMspLogoSchema, clients, clientAccess } from "@shared/schema";
import { users as clientUsers, departmentAppMappings as clientDepartmentAppMappings, insertDepartmentAppMappingSchema as clientInsertDepartmentAppMappingSchema, employeeTypeAppMappings as clientEmployeeTypeAppMappings, insertEmployeeTypeAppMappingSchema as clientInsertEmployeeTypeAppMappingSchema, departmentGroupMappings as clientDepartmentGroupMappings, insertDepartmentGroupMappingSchema as clientInsertDepartmentGroupMappingSchema, employeeTypeGroupMappings as clientEmployeeTypeGroupMappings, insertEmployeeTypeGroupMappingSchema as clientInsertEmployeeTypeGroupMappingSchema } from "@shared/client-schema";
import { db } from "./db";
import { eq, desc, and, or, ilike, asc } from "drizzle-orm";
import { AuditLogger, getAuditLogs } from "./audit";
import { z } from "zod";
import { oktaService } from "./okta-service";
import { syncSpecificUser } from "./okta-sync";
import { knowBe4Service } from "./knowbe4-service";
import { knowBe4GraphService } from "./knowbe4-graph-service";
import { syncUserGroupsAndEmployeeType, syncAllUsersGroupsAndEmployeeTypes } from "./sync-user-groups";
import { bulkSyncUserGroupsAndEmployeeTypes } from "./bulk-groups-sync";
import { EmployeeTypeSync } from "./employee-type-sync";

// Helper function to safely execute OKTA operations
async function safeOktaOperation<T>(operation: () => Promise<T>, fallbackValue: T): Promise<T> {
  if (!oktaService.isConfigured()) {
    console.warn('OKTA not configured - returning fallback value');
    return fallbackValue;
  }
  
  try {
    return await operation();
  } catch (error) {
    console.error('OKTA operation failed:', error);
    return fallbackValue;
  }
}

// Helper function to determine employee type from user groups
function determineEmployeeTypeFromGroups(userGroups: any[], employeeTypeApps: Set<string>): string | null {
  // Check if user has access to any employee type applications
  for (const group of userGroups) {
    // Check if this group gives access to employee type applications
    if (group.profile?.name) {
      const groupName = group.profile.name.toUpperCase();
      if (groupName.includes('EMPLOYEE') || groupName.includes('FULL_TIME')) {
        return 'EMPLOYEE';
      } else if (groupName.includes('CONTRACTOR')) {
        return 'CONTRACTOR';
      } else if (groupName.includes('INTERN')) {
        return 'INTERN';
      } else if (groupName.includes('PART_TIME') || groupName.includes('CONSULTANT')) {
        return 'PART_TIME';
      }
    }
  }
  
  // If no specific group match, check application access
  // This would require additional logic to check user's app assignments
  return null;
}
import { setupAuth, isAuthenticated, requireAdmin } from "./direct-okta-auth";

// Helper function to reset OKTA user authenticators
async function resetOktaUserAuthenticators(apiKeys: Record<string, string>, oktaId: string) {
  if (!apiKeys.domain || !apiKeys.apiToken) {
    throw new Error('OKTA domain and API token are required');
  }

  try {
    const response = await fetch(`https://${apiKeys.domain}/api/v1/users/${oktaId}/lifecycle/reset_factors`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `SSWS ${apiKeys.apiToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OKTA API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return {
      success: true,
      message: 'Authenticators reset successfully'
    };
  } catch (error) {
    throw new Error(`Failed to reset authenticators: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Helper function to clear OKTA user sessions
async function clearOktaUserSessions(apiKeys: Record<string, string>, oktaId: string) {
  if (!apiKeys.domain || !apiKeys.apiToken) {
    throw new Error('OKTA domain and API token are required');
  }

  try {
    const response = await fetch(`https://${apiKeys.domain}/api/v1/users/${oktaId}/sessions`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'Authorization': `SSWS ${apiKeys.apiToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OKTA API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return {
      success: true,
      message: 'Sessions cleared successfully'
    };
  } catch (error) {
    throw new Error(`Failed to clear sessions: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Helper function to reset OKTA user behavior profile
async function resetOktaUserBehaviorProfile(apiKeys: Record<string, string>, oktaId: string) {
  if (!apiKeys.domain || !apiKeys.apiToken) {
    throw new Error('OKTA domain and API token are required');
  }

  try {
    // OKTA doesn't have a direct "reset behavior profile" endpoint
    // This typically involves clearing trusted networks, devices, and behavior patterns
    // We can achieve this by clearing sessions and resetting factors as behavior is learned over time
    
    // Clear sessions first
    await clearOktaUserSessions(apiKeys, oktaId);
    
    // Reset factors to clear device trust
    await resetOktaUserAuthenticators(apiKeys, oktaId);

    return {
      success: true,
      message: 'Behavior profile reset successfully'
    };
  } catch (error) {
    throw new Error(`Failed to reset behavior profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Helper function to reset OKTA user password
async function resetOktaUserPassword(apiKeys: Record<string, string>, oktaId: string) {
  if (!apiKeys.domain || !apiKeys.apiToken) {
    throw new Error('OKTA domain and API token are required');
  }

  try {
    const response = await fetch(`https://${apiKeys.domain}/api/v1/users/${oktaId}/lifecycle/reset_password`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `SSWS ${apiKeys.apiToken}`,
      },
      body: JSON.stringify({
        sendEmail: true
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OKTA API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return {
      success: true,
      message: 'Password reset email sent successfully'
    };
  } catch (error) {
    throw new Error(`Failed to reset password: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Helper function to create OKTA user with client-specific API keys
async function createOktaUser(apiKeys: Record<string, string>, userData: any) {
  if (!apiKeys.domain || !apiKeys.apiToken) {
    throw new Error('OKTA domain and API token are required');
  }

  try {
    console.log(`🔐 Creating OKTA user '${userData.email}' using client-specific credentials for domain: ${apiKeys.domain}`);
    
    // Check if user already exists in OKTA first
    const existingUser = await checkOktaUserExists(apiKeys, userData.email);
    if (existingUser.exists) {
      return {
        success: false,
        message: `User with email '${userData.email}' already exists in OKTA`
      };
    }
    
    const https = await import('https');
    
    const domain = apiKeys.domain.replace(/^https?:\/\//, ''); // Remove protocol if present
    // OKTA typically requires login to be the email address for most configurations
    const loginValue = userData.email; // Always use email as login for OKTA compatibility
    
    // Validate required fields
    if (!userData.firstName || !userData.lastName || !userData.email) {
      return {
        success: false,
        message: 'First name, last name, and email are required fields'
      };
    }
    
    // Ensure email format is valid
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userData.email)) {
      return {
        success: false,
        message: 'Invalid email format'
      };
    }
    
    const oktaUserData = {
      profile: {
        firstName: userData.firstName.trim(),
        lastName: userData.lastName.trim(),
        email: userData.email.trim().toLowerCase(),
        login: loginValue.trim().toLowerCase(), // Using email as login for OKTA
        title: userData.title ? userData.title.trim() : undefined,
        department: userData.department ? userData.department.trim() : undefined,
        mobilePhone: userData.mobilePhone ? userData.mobilePhone.trim() : undefined,
        manager: userData.manager ? userData.manager.trim() : undefined,
      },
      credentials: {
        password: {
          value: userData.password || Math.random().toString(36).slice(-12) + "A1!" // Use provided password or generate temporary
        }
      }
    };
    
    const postData = JSON.stringify(oktaUserData);
    console.log(`🔍 OKTA User Data:`, JSON.stringify(oktaUserData, null, 2));
    
    return new Promise((resolve, reject) => {
      const requestOptions = {
        hostname: domain,
        port: 443,
        path: '/api/v1/users?activate=true', // Always activate immediately
        method: 'POST',
        headers: {
          'Authorization': `SSWS ${apiKeys.apiToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(requestOptions, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const responseData = JSON.parse(data);
            
            if (res.statusCode === 200 || res.statusCode === 201) {
              // User created successfully
              resolve({
                success: true,
                oktaUser: responseData,
                message: `User '${userData.email}' created successfully in OKTA`
              });
            } else {
              // User creation failed
              resolve({
                success: false,
                message: `Failed to create user in OKTA: ${responseData.errorSummary || data}`,
                error: responseData
              });
            }
          } catch (parseError) {
            // Failed to parse response
            resolve({
              success: false,
              message: `Failed to parse OKTA response: ${data}`
            });
          }
        });
      });

      req.on('error', (error) => {
        resolve({
          success: false,
          message: `Network error: ${error.message}`
        });
      });

      req.write(postData);
      req.end();
    });
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Helper function to check if user exists in OKTA
async function checkOktaUserExists(apiKeys: Record<string, string>, email: string) {
  if (!apiKeys.domain || !apiKeys.apiToken) {
    return { exists: false, error: 'OKTA credentials missing' };
  }

  try {
    const https = await import('https');
    const domain = apiKeys.domain.replace(/^https?:\/\//, '');
    
    return new Promise((resolve) => {
      const searchOptions = {
        hostname: domain,
        port: 443,
        path: `/api/v1/users?q=${encodeURIComponent(email)}&limit=1`,
        method: 'GET',
        headers: {
          'Authorization': `SSWS ${apiKeys.apiToken}`,
          'Accept': 'application/json'
        }
      };

      const searchReq = https.request(searchOptions, (searchRes) => {
        let searchData = '';
        
        searchRes.on('data', (chunk) => {
          searchData += chunk;
        });
        
        searchRes.on('end', () => {
          try {
            if (searchRes.statusCode === 200) {
              const users = JSON.parse(searchData);
              const userExists = Array.isArray(users) && users.length > 0 && 
                users.some((u: any) => u.profile.email === email || u.profile.login === email);
              
              resolve({ exists: userExists });
            } else {
              resolve({ exists: false, error: `HTTP ${searchRes.statusCode}` });
            }
          } catch (parseError) {
            resolve({ exists: false, error: 'Parse error' });
          }
        });
      });

      searchReq.on('error', (error) => {
        resolve({ exists: false, error: error.message });
      });

      searchReq.end();
    });
  } catch (error) {
    return { exists: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Helper function to add user to OKTA group with client-specific API keys
async function addUserToOktaGroup(apiKeys: Record<string, string>, oktaUserId: string, groupName: string) {
  if (!apiKeys.domain || !apiKeys.apiToken) {
    throw new Error('OKTA domain and API token are required');
  }

  try {
    console.log(`🔐 Adding user ${oktaUserId} to group '${groupName}' using client-specific credentials for domain: ${apiKeys.domain}`);
    
    const https = await import('https');
    
    const domain = apiKeys.domain.replace(/^https?:\/\//, ''); // Remove protocol if present
    
    // First, find the group by name to get its ID
    return new Promise((resolve, reject) => {
      const searchOptions = {
        hostname: domain,
        port: 443,
        path: `/api/v1/groups?q=${encodeURIComponent(groupName)}&limit=1`,
        method: 'GET',
        headers: {
          'Authorization': `SSWS ${apiKeys.apiToken}`,
          'Accept': 'application/json'
        }
      };

      const searchReq = https.request(searchOptions, (searchRes) => {
        let searchData = '';
        
        searchRes.on('data', (chunk) => {
          searchData += chunk;
        });
        
        searchRes.on('end', () => {
          try {
            const groups = JSON.parse(searchData);
            
            if (searchRes.statusCode !== 200 || !Array.isArray(groups) || groups.length === 0) {
              resolve({
                success: false,
                message: `Group '${groupName}' not found in OKTA`
              });
              return;
            }
            
            const group = groups.find(g => g.profile.name === groupName);
            if (!group) {
              resolve({
                success: false,
                message: `Group '${groupName}' not found in OKTA`
              });
              return;
            }
            
            // Now add the user to the group
            const addUserOptions = {
              hostname: domain,
              port: 443,
              path: `/api/v1/groups/${group.id}/users/${oktaUserId}`,
              method: 'PUT',
              headers: {
                'Authorization': `SSWS ${apiKeys.apiToken}`,
                'Accept': 'application/json'
              }
            };

            const addUserReq = https.request(addUserOptions, (addUserRes) => {
              let addUserData = '';
              
              addUserRes.on('data', (chunk) => {
                addUserData += chunk;
              });
              
              addUserRes.on('end', () => {
                if (addUserRes.statusCode === 204 || addUserRes.statusCode === 200) {
                  // User added successfully
                  resolve({
                    success: true,
                    message: `User added to group '${groupName}' successfully`,
                    groupId: group.id
                  });
                } else if (addUserRes.statusCode === 400 && addUserData.includes('already a member')) {
                  // User is already in the group - treat as success
                  resolve({
                    success: true,
                    message: `User is already a member of group '${groupName}'`,
                    groupId: group.id
                  });
                } else {
                  // Other error
                  try {
                    const errorData = JSON.parse(addUserData);
                    resolve({
                      success: false,
                      message: `Failed to add user to group: ${errorData.errorSummary || addUserData}`
                    });
                  } catch (parseError) {
                    resolve({
                      success: false,
                      message: `Failed to add user to group: ${addUserRes.statusCode} ${addUserRes.statusMessage}`
                    });
                  }
                }
              });
            });

            addUserReq.on('error', (error) => {
              resolve({
                success: false,
                message: `Network error adding user to group: ${error.message}`
              });
            });

            addUserReq.end();
            
          } catch (parseError) {
            resolve({
              success: false,
              message: `Failed to parse group search response: ${searchData}`
            });
          }
        });
      });

      searchReq.on('error', (error) => {
        resolve({
          success: false,
          message: `Network error searching for group: ${error.message}`
        });
      });

      searchReq.end();
    });
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Helper function to create OKTA group
async function createOktaGroup(apiKeys: Record<string, string>, groupName: string, description?: string) {
  if (!apiKeys.domain || !apiKeys.apiToken) {
    throw new Error('OKTA domain and API token are required');
  }

  // Use client-specific credentials directly without environment variable manipulation
  try {
    console.log(`🔐 Creating OKTA group '${groupName}' using client-specific credentials for domain: ${apiKeys.domain}`);
    
    const https = await import('https');
    
    const domain = apiKeys.domain.replace(/^https?:\/\//, ''); // Remove protocol if present
    const groupData = {
      profile: {
        name: groupName,
        description: description || `Security group: ${groupName}`
      }
    };
    
    const postData = JSON.stringify(groupData);
    
    return new Promise((resolve, reject) => {
      const requestOptions = {
        hostname: domain,
        port: 443,
        path: '/api/v1/groups',
        method: 'POST',
        headers: {
          'Authorization': `SSWS ${apiKeys.apiToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(requestOptions, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const responseData = JSON.parse(data);
            
            if (res.statusCode === 200 || res.statusCode === 201) {
              // Group created successfully
              resolve({
                success: true,
                exists: false,
                groupId: responseData.id,
                message: `Group '${groupName}' created successfully`
              });
            } else if (res.statusCode === 400 && data.includes('already exists')) {
              // Group already exists - treat as success
              resolve({
                success: true,
                exists: true,
                message: `Group '${groupName}' already exists`
              });
            } else {
              // Other error
              resolve({
                success: false,
                exists: false,
                message: `Failed to create group: ${responseData.errorSummary || data}`
              });
            }
          } catch (parseError) {
            // Failed to parse response
            resolve({
              success: false,
              exists: false,
              message: `Failed to parse OKTA response: ${data}`
            });
          }
        });
      });

      req.on('error', (error) => {
        resolve({
          success: false,
          exists: false,
          message: `Network error: ${error.message}`
        });
      });

      req.write(postData);
      req.end();
    });
  } catch (error) {
    return {
      success: false,
      exists: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Integration testing functions
async function testOktaConnection(apiKeys: Record<string, string>): Promise<{ success: boolean; message: string }> {
  try {
    if (!apiKeys.domain || !apiKeys.apiToken) {
      return { success: false, message: "Missing OKTA domain or API token" };
    }

    const domain = apiKeys.domain.replace(/^https?:\/\//, '');
    const response = await fetch(`https://${domain}/api/v1/users/me`, {
      headers: {
        'Authorization': `SSWS ${apiKeys.apiToken}`,
        'Accept': 'application/json'
      }
    });

    if (response.ok) {
      const userData = await response.json();
      return { 
        success: true, 
        message: `Connected successfully as ${userData.profile?.firstName || 'user'}` 
      };
    } else {
      return { 
        success: false, 
        message: `Failed to connect: ${response.status} ${response.statusText}` 
      };
    }
  } catch (error) {
    return { 
      success: false, 
      message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

async function testSentinelOneConnection(apiKeys: Record<string, string>): Promise<{ success: boolean; message: string }> {
  try {
    if (!apiKeys.managementUrl || !apiKeys.apiToken) {
      return { success: false, message: "Missing SentinelOne management URL or API token" };
    }

    const response = await fetch(`${apiKeys.managementUrl}/web/api/v2.1/system/info`, {
      headers: {
        'Authorization': `ApiToken ${apiKeys.apiToken}`,
        'Accept': 'application/json'
      }
    });

    if (response.ok) {
      return { success: true, message: "SentinelOne connection successful" };
    } else {
      return { 
        success: false, 
        message: `Failed to connect: ${response.status} ${response.statusText}` 
      };
    }
  } catch (error) {
    return { 
      success: false, 
      message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

async function testJiraConnection(apiKeys: Record<string, string>): Promise<{ success: boolean; message: string }> {
  try {
    if (!apiKeys.baseUrl || !apiKeys.username || !apiKeys.apiToken) {
      return { success: false, message: "Missing Jira configuration (baseUrl, username, or API token)" };
    }

    const auth = Buffer.from(`${apiKeys.username}:${apiKeys.apiToken}`).toString('base64');
    const response = await fetch(`${apiKeys.baseUrl}/rest/api/2/myself`, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    });

    if (response.ok) {
      const userData = await response.json();
      return { 
        success: true, 
        message: `Connected successfully as ${userData.displayName || 'user'}` 
      };
    } else {
      return { 
        success: false, 
        message: `Failed to connect: ${response.status} ${response.statusText}` 
      };
    }
  } catch (error) {
    return { 
      success: false, 
      message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

// OKTA user fetching and syncing functions
async function fetchOktaUsers(apiKeys: Record<string, string>): Promise<{ success: boolean; users?: any[]; message: string }> {
  try {
    if (!apiKeys.domain || !apiKeys.apiToken) {
      return { success: false, message: "Missing OKTA domain or API token" };
    }

    const domain = apiKeys.domain.replace(/^https?:\/\//, '');
    const allUsers: any[] = [];
    let nextUrl = `https://${domain}/api/v1/users?limit=200`;

    // Fetch all users with pagination
    while (nextUrl) {
      console.log(`🔄 Fetching OKTA users from: ${nextUrl}`);
      
      const response = await fetch(nextUrl, {
        headers: {
          'Authorization': `SSWS ${apiKeys.apiToken}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        return { 
          success: false, 
          message: `Failed to fetch users: ${response.status} ${response.statusText}` 
        };
      }

      const users = await response.json();
      allUsers.push(...users);

      // Check for next page link in Link header
      const linkHeader = response.headers.get('Link');
      nextUrl = null;
      
      if (linkHeader) {
        const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
        if (nextMatch) {
          nextUrl = nextMatch[1];
        }
      }
    }

    console.log(`✅ Fetched ${allUsers.length} users from OKTA`);

    // Transform OKTA users to our schema
    const transformedUsers = allUsers.map(oktaUser => ({
      id: oktaUser.id,
      login: oktaUser.profile.login,
      email: oktaUser.profile.email,
      firstName: oktaUser.profile.firstName,
      lastName: oktaUser.profile.lastName || '',
      displayName: oktaUser.profile.displayName || `${oktaUser.profile.firstName || ''} ${oktaUser.profile.lastName || ''}`,
      title: oktaUser.profile.title || '',
      department: oktaUser.profile.department || '',
      manager: oktaUser.profile.manager || '',
      employeeType: oktaUser.profile.employeeType || '',
      mobilePhone: oktaUser.profile.mobilePhone || '',
      status: oktaUser.status,
      created: new Date(oktaUser.created),
      lastLogin: oktaUser.lastLogin ? new Date(oktaUser.lastLogin) : null,
      lastUpdated: new Date(oktaUser.lastUpdated)
    }));

    return { 
      success: true, 
      users: transformedUsers, 
      message: `Successfully fetched ${transformedUsers.length} users from OKTA` 
    };
  } catch (error) {
    return { 
      success: false, 
      message: `Error fetching OKTA users: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

async function syncUsersToDatabase(clientDb: any, oktaUsers: any[]): Promise<{ newUsers: number; updatedUsers: number }> {
  let newUsers = 0;
  let updatedUsers = 0;

  for (const oktaUser of oktaUsers) {
    try {
      // Check if user already exists
      const [existingUser] = await clientDb.select()
        .from(clientUsers)
        .where(eq(clientUsers.login, oktaUser.login));

      if (existingUser) {
        // Update existing user
        await clientDb.update(clientUsers)
          .set({
            email: oktaUser.email,
            firstName: oktaUser.firstName,
            lastName: oktaUser.lastName,
            displayName: oktaUser.displayName,
            title: oktaUser.title,
            department: oktaUser.department,
            manager: oktaUser.manager,
            employeeType: oktaUser.employeeType,
            mobilePhone: oktaUser.mobilePhone,
            status: oktaUser.status,
            lastLogin: oktaUser.lastLogin,
            lastUpdated: oktaUser.lastUpdated
          })
          .where(eq(clientUsers.login, oktaUser.login));
        
        updatedUsers++;
      } else {
        // Insert new user
        await clientDb.insert(clientUsers)
          .values({
            login: oktaUser.login,
            email: oktaUser.email,
            firstName: oktaUser.firstName,
            lastName: oktaUser.lastName,
            displayName: oktaUser.displayName,
            title: oktaUser.title || '',
            department: oktaUser.department || '',
            manager: oktaUser.manager || '',
            employeeType: oktaUser.employeeType || '',
            mobilePhone: oktaUser.mobilePhone || '',
            status: oktaUser.status,
            created: oktaUser.created,
            lastLogin: oktaUser.lastLogin,
            lastUpdated: oktaUser.lastUpdated
          });
        
        newUsers++;
      }
    } catch (error) {
      console.error(`Error syncing user ${oktaUser.login}:`, error);
      // Continue with other users even if one fails
    }
  }

  return { newUsers, updatedUsers };
}

// Import client-specific schemas
import { 
  users as clientUsers,
  siteAccessUsers as clientSiteAccessUsers,
  integrations as clientIntegrations,
  insertIntegrationSchema as clientInsertIntegrationSchema,
  auditLogs as clientAuditLogs,
  layoutSettings as clientLayoutSettings, 
  dashboardCards as clientDashboardCards, 
  insertLayoutSettingSchema as clientInsertLayoutSettingSchema,
  insertDashboardCardSchema as clientInsertDashboardCardSchema,
  companyLogos as clientCompanyLogos,
  insertCompanyLogoSchema as clientInsertCompanyLogoSchema,
  appMappings as clientAppMappings,
  insertAppMappingSchema as clientInsertAppMappingSchema
} from "../shared/client-schema";
import { MultiDatabaseManager } from "./multi-db";
import * as mspRoutes from "./routes/msp";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup OKTA authentication
  await setupAuth(app);

  // OKTA Initiate Login URI endpoint - required for proper SSO flow
  app.get("/api/sso-login", (req, res) => {
    // Redirect to OKTA authentication
    res.redirect("/api/login");
  });

  // Debug endpoint for troubleshooting user access issues
  app.get('/api/debug/user-access/:email', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const email = req.params.email;
      console.log(`Debugging access for user: ${email}`);
      
      // Check if user exists in OKTA
      const oktaUser = await safeOktaOperation(
        () => oktaService.getUserByEmail(email),
        null
      );
      
      if (!oktaUser) {
        return res.json({
          email,
          exists: false,
          message: "User not found in OKTA"
        });
      }
      
      // Check if user is assigned to the application
      const appAssignmentResponse = await fetch(`${process.env.OKTA_DOMAIN}/api/v1/apps/${process.env.CLIENT_ID}/users/${oktaUser.id}`, {
        headers: {
          'Authorization': `SSWS ${process.env.OKTA_API_TOKEN}`,
          'Accept': 'application/json'
        }
      });
      
      const isAssigned = appAssignmentResponse.ok;
      let assignmentDetails = null;
      
      if (isAssigned) {
        assignmentDetails = await appAssignmentResponse.json();
      }
      
      // Check MFA factors
      const factorsResponse = await fetch(`${process.env.OKTA_DOMAIN}/api/v1/users/${oktaUser.id}/factors`, {
        headers: {
          'Authorization': `SSWS ${process.env.OKTA_API_TOKEN}`,
          'Accept': 'application/json'
        }
      });
      
      const factors = factorsResponse.ok ? await factorsResponse.json() : [];
      
      res.json({
        email,
        exists: true,
        oktaUser: {
          id: oktaUser.id,
          status: oktaUser.status,
          created: oktaUser.created,
          lastLogin: oktaUser.lastLogin,
          profile: {
            firstName: oktaUser.profile.firstName,
            lastName: oktaUser.profile.lastName,
            email: oktaUser.profile.email,
            department: oktaUser.profile.department,
            title: oktaUser.profile.title
          }
        },
        appAccess: {
          isAssigned,
          assignmentStatus: assignmentDetails?.status || 'NOT_ASSIGNED',
          assignmentDetails
        },
        mfaFactors: factors.length,
        activeMfaFactors: factors.filter((f: any) => f.status === 'ACTIVE').length,
        recommendation: !isAssigned 
          ? "User needs to be assigned to the application"
          : oktaUser.status !== 'ACTIVE'
          ? "User account is not active"
          : "User appears properly configured for access"
      });
      
    } catch (error) {
      console.error("Error debugging user access:", error);
      res.status(500).json({ 
        message: "Failed to debug user access",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Auth routes are handled by setupAuth

  // REMOVED: Global employee type counts - Each client should have their own employee counts via client-specific endpoints

  // Get manager suggestions for autocomplete
  app.get("/api/managers", isAuthenticated, async (req, res) => {
    try {
      const query = z.string().optional().parse(req.query.q);
      
      try {
        // Get unique managers from OKTA
        const oktaUsers = await oktaService.getUsers(200);
        const managers = new Set<string>();
        
        oktaUsers.forEach(user => {
          if (user.profile.manager) {
            managers.add(user.profile.manager);
          }
        });
        
        let managerList = Array.from(managers).sort();
        
        // Filter by query if provided - search anywhere in names
        if (query && query.trim().length > 0) {
          const searchTerm = query.trim().toLowerCase();
          console.log(`Manager search query: "${searchTerm}", total managers: ${managerList.length}`);
          managerList = managerList.filter(manager => {
            const fullName = manager.toLowerCase();
            const nameParts = fullName.split(' ');
            // Match if query starts any part of the name OR is contained anywhere in the name
            return nameParts.some(part => part.startsWith(searchTerm)) || 
                   fullName.startsWith(searchTerm) ||
                   fullName.includes(searchTerm) ||
                   nameParts.some(part => part.includes(searchTerm));
          });
          console.log(`Filtered managers: ${managerList.length}`);
        }
        
        // Limit to top 10 suggestions
        res.json(managerList.slice(0, 10));
      } catch (oktaError) {
        console.log("OKTA API unavailable for manager suggestions, using empty list");
        res.json([]);
      }
    } catch (error) {
      console.error("Error fetching manager suggestions:", error);
      res.status(500).json({ error: "Failed to fetch manager suggestions" });
    }
  });

  // Get all users with fallback from OKTA to local storage
  app.get("/api/users", isAuthenticated, async (req, res) => {
    try {
      const searchQuery = z.string().optional().parse(req.query.search);
      const statusFilter = z.string().optional().parse(req.query.status);
      const statusFilters = z.string().optional().parse(req.query.statuses);
      const departmentFilter = z.string().optional().parse(req.query.department);
      const lastLoginDays = z.string().optional().parse(req.query.lastLoginDays);
      const employeeTypeFilter = z.string().optional().parse(req.query.employeeType);
      const employeeTypesFilter = z.string().optional().parse(req.query.employeeTypes);
      const mobilePhoneFilter = z.string().optional().parse(req.query.mobilePhone);
      const managerFilter = z.string().optional().parse(req.query.manager);
      const page = z.coerce.number().min(1).default(1).parse(req.query.page);
      const limit = z.coerce.number().min(1).max(1000).default(10).parse(req.query.limit);
      const statsOnly = z.boolean().default(false).parse(req.query.statsOnly === 'true');
      const sortBy = z.string().default("firstName").parse(req.query.sortBy);
      const sortOrder = z.enum(["asc", "desc"]).default("asc").parse(req.query.sortOrder);

      try {
        // For stats-only requests, return minimal data quickly
        if (statsOnly) {
          const sampleUsers = await oktaService.getUsers(50); // Smaller sample for stats
          res.json({
            users: [],
            total: sampleUsers.length,
            currentPage: 1,
            totalPages: 1,
            usersPerPage: limit,
            source: 'okta_stats'
          });
          return;
        }

        // Try to fetch users from OKTA first
        const oktaUsers = await oktaService.getUsers(Math.min(500, limit * 5));
        
        let filteredUsers = oktaUsers;
        
        // Apply search filter
        if (searchQuery) {
          const searchTerm = searchQuery.toLowerCase();
          filteredUsers = filteredUsers.filter(user => 
            user.profile.firstName?.toLowerCase().includes(searchTerm) ||
            user.profile.lastName?.toLowerCase().includes(searchTerm) ||
            user.profile.email?.toLowerCase().includes(searchTerm) ||
            user.profile.login?.toLowerCase().includes(searchTerm)
          );
        }
        
        // Apply status filter (single or multiple)
        if (statusFilter) {
          filteredUsers = filteredUsers.filter(user => user.status === statusFilter);
        } else if (statusFilters) {
          const statusArray = statusFilters.split(',').map(s => s.trim());
          if (statusArray.length > 0) {
            filteredUsers = filteredUsers.filter(user => statusArray.includes(user.status));
          }
        }
        
        // Apply department filter
        if (departmentFilter) {
          filteredUsers = filteredUsers.filter(user => 
            user.profile.department?.toLowerCase() === departmentFilter.toLowerCase()
          );
        }

        // Apply employee type filter - use database employee type to avoid OKTA API rate limits
        if (employeeTypeFilter) {
          // Get all users from database with matching employee type first (cached)
          const dbUsersWithType = await storage.getAllUsers({ 
            employeeType: employeeTypeFilter,
            limit: 1000 // Ensure we get all users with this type
          });
          const oktaIdsWithType = new Set(dbUsersWithType.users.map(user => user.oktaId).filter(Boolean));
          
          // Filter OKTA users to only those with matching employee type in database
          filteredUsers = filteredUsers.filter(oktaUser => oktaIdsWithType.has(oktaUser.id));
          
          console.log(`Employee type filter applied: ${employeeTypeFilter}, found ${filteredUsers.length} matching users`);
        }

        // Apply employee types array filter (from new filter interface)
        if (employeeTypesFilter) {
          const selectedTypes = employeeTypesFilter.split(',');
          if (selectedTypes.length > 0) {
            const dbUsersWithTypes = await storage.getAllUsers({ 
              limit: 1000 
            });
            const oktaIdsWithTypes = new Set(
              dbUsersWithTypes.users
                .filter(user => user.employeeType && selectedTypes.includes(user.employeeType))
                .map(user => user.oktaId)
                .filter(Boolean)
            );
            
            filteredUsers = filteredUsers.filter(oktaUser => oktaIdsWithTypes.has(oktaUser.id));
            console.log(`Employee types filter applied: ${selectedTypes.join(', ')}, found ${filteredUsers.length} matching users`);
          }
        }

        // Apply mobile phone filter
        if (mobilePhoneFilter) {
          const phoneSearchTerm = mobilePhoneFilter.toLowerCase();
          filteredUsers = filteredUsers.filter(user => 
            user.profile.mobilePhone?.toLowerCase().includes(phoneSearchTerm)
          );
          console.log(`Mobile phone filter applied: ${mobilePhoneFilter}, found ${filteredUsers.length} matching users`);
        }

        // Apply manager filter
        if (managerFilter) {
          const managerSearchTerm = managerFilter.toLowerCase();
          filteredUsers = filteredUsers.filter(user => 
            user.profile.manager?.toLowerCase().includes(managerSearchTerm)
          );
          console.log(`Manager filter applied: ${managerFilter}, found ${filteredUsers.length} matching users`);
        }

        // Apply last login time range filter
        if (lastLoginDays) {
          const now = new Date();
          console.log(`Last login filter applied: ${lastLoginDays}, found ${filteredUsers.length} matching users`);
          
          if (lastLoginDays === "never") {
            // Users who have never logged in
            filteredUsers = filteredUsers.filter(user => !user.lastLogin);
          } else if (lastLoginDays === "31") {
            // Users who logged in longer than 30 days ago
            const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
            filteredUsers = filteredUsers.filter(user => {
              if (!user.lastLogin) return true; // Include never logged in users
              const lastLoginDate = new Date(user.lastLogin);
              return lastLoginDate < thirtyDaysAgo;
            });
          } else {
            // Users who logged in within the specified number of days
            const days = parseInt(lastLoginDays);
            if (isNaN(days)) return; // Skip if invalid number
            
            // Set cutoff to exact milliseconds for precise filtering
            const cutoffDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
            
            filteredUsers = filteredUsers.filter(user => {
              if (!user.lastLogin) return false; // Exclude never logged in users
              const lastLoginDate = new Date(user.lastLogin);
              // Ensure we have a valid date
              if (isNaN(lastLoginDate.getTime())) return false;
              
              // For debugging: calculate exact days difference
              const timeDiff = now.getTime() - lastLoginDate.getTime();
              const daysDiff = timeDiff / (24 * 60 * 60 * 1000);
              
              // Only include users who logged in within the specified days (strict boundary)
              return daysDiff <= days;
            });
          }
          console.log(`Last login filter applied: ${lastLoginDays}, found ${filteredUsers.length} matching users`);
        }
        
        // Handle employeeType sorting differently since it requires database lookup
        if (sortBy === 'employeeType') {
          // Get all database users to access employeeType data
          const allDbUsers = await storage.getAllUsers({ limit: 1000 });
          const employeeTypeMap = new Map();
          allDbUsers.users.forEach(dbUser => {
            if (dbUser.oktaId) {
              employeeTypeMap.set(dbUser.oktaId, dbUser.employeeType || '');
            }
          });
          
          // Sort by employeeType using database data
          filteredUsers.sort((a, b) => {
            const aEmployeeType = employeeTypeMap.get(a.id) || '';
            const bEmployeeType = employeeTypeMap.get(b.id) || '';
            
            if (sortOrder === 'desc') {
              return bEmployeeType.localeCompare(aEmployeeType);
            } else {
              return aEmployeeType.localeCompare(bEmployeeType);
            }
          });
        } else {
          // Apply standard sorting for other fields with priority for LOCKED_OUT users
          filteredUsers.sort((a, b) => {
            // Priority sorting: LOCKED_OUT users always appear first
            const aIsLockedOut = a.status === 'LOCKED_OUT';
            const bIsLockedOut = b.status === 'LOCKED_OUT';
            
            if (aIsLockedOut && !bIsLockedOut) return -1;
            if (!aIsLockedOut && bIsLockedOut) return 1;
            
            let aValue, bValue;
            
            switch (sortBy) {
            case 'firstName':
              aValue = a.profile.firstName || '';
              bValue = b.profile.firstName || '';
              break;
            case 'lastName':
              aValue = a.profile.lastName || '';
              bValue = b.profile.lastName || '';
              break;
            case 'email':
              aValue = a.profile.email || '';
              bValue = b.profile.email || '';
              break;
            case 'title':
              aValue = a.profile.title || '';
              bValue = b.profile.title || '';
              break;
            case 'department':
              aValue = a.profile.department || '';
              bValue = b.profile.department || '';
              break;
            case 'manager':
              aValue = a.profile.manager || '';
              bValue = b.profile.manager || '';
              break;
            case 'status':
              aValue = a.status || '';
              bValue = b.status || '';
              break;
            case 'lastLogin':
              // Handle date sorting with null values at the end
              if (!a.lastLogin && !b.lastLogin) return 0;
              if (!a.lastLogin) return 1; // null values go to end
              if (!b.lastLogin) return -1;
              aValue = new Date(a.lastLogin).getTime();
              bValue = new Date(b.lastLogin).getTime();
              // Skip the empty value handling below for dates
              if (sortOrder === 'desc') {
                return bValue - aValue;
              } else {
                return aValue - bValue;
              }
            case 'activated':
            case 'created':
            case 'lastUpdated':
            case 'passwordChanged':
              // Handle date sorting with null values at the end
              const aDate = a.activated || a.created || a.lastUpdated || a.passwordChanged;
              const bDate = b.activated || b.created || b.lastUpdated || b.passwordChanged;
              if (!aDate && !bDate) return 0;
              if (!aDate) return 1; // null values go to end
              if (!bDate) return -1;
              aValue = new Date(aDate).getTime();
              bValue = new Date(bDate).getTime();
              // Skip the empty value handling below for dates
              if (sortOrder === 'desc') {
                return bValue - aValue;
              } else {
                return aValue - bValue;
              }
            default:
              aValue = a.profile.firstName || '';
              bValue = b.profile.firstName || '';
          }
          
            // Handle empty values - put them after Z in ascending order, before A in descending order
            if (!aValue && !bValue) return 0;
            if (!aValue) return sortOrder === 'desc' ? -1 : 1;
            if (!bValue) return sortOrder === 'desc' ? 1 : -1;
            
            // Use proper locale comparison for text sorting
            if (sortOrder === 'desc') {
              return bValue.localeCompare(aValue, undefined, { 
                numeric: true, 
                sensitivity: 'base',
                caseFirst: 'upper'
              });
            } else {
              return aValue.localeCompare(bValue, undefined, { 
                numeric: true, 
                sensitivity: 'base',
                caseFirst: 'upper'
              });
            }
          });
        }
        
        // Pagination
        const offset = (page - 1) * limit;
        const paginatedUsers = filteredUsers.slice(offset, offset + limit);
        const totalPages = Math.ceil(filteredUsers.length / limit);
        
        // Transform OKTA users to our format
        // Sync OKTA users to database and return database records
        const transformedUsers = [];
        for (const oktaUser of paginatedUsers) {
          // Check if user exists in database
          let dbUser = await storage.getUserByOktaId(oktaUser.id);
          
          if (!dbUser) {
            // Create user in database if doesn't exist
            dbUser = await storage.createUser({
              oktaId: oktaUser.id,
              firstName: oktaUser.profile.firstName || '',
              lastName: oktaUser.profile.lastName || '',
              email: oktaUser.profile.email || '',
              login: oktaUser.profile.login || '',
              mobilePhone: oktaUser.profile.mobilePhone || null,
              department: oktaUser.profile.department || null,
              title: oktaUser.profile.title || null,
              employeeType: null,
              profileImageUrl: null,
              status: oktaUser.status,
              groups: [],
              applications: []
            });
          } else {
            // Update existing user with latest OKTA data
            dbUser = await storage.updateUser(dbUser.id, {
              firstName: oktaUser.profile.firstName || '',
              lastName: oktaUser.profile.lastName || '',
              email: oktaUser.profile.email || '',
              login: oktaUser.profile.login || '',
              mobilePhone: oktaUser.profile.mobilePhone || null,
              department: oktaUser.profile.department || null,
              title: oktaUser.profile.title || null,
              status: oktaUser.status
            });
          }
          
          if (dbUser) {
            transformedUsers.push(dbUser);
          }
        }
        
        // Disable caching for sorted results to ensure fresh data
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        
        res.json({
          users: transformedUsers,
          total: filteredUsers.length,
          currentPage: page,
          totalPages,
          usersPerPage: limit,
          source: 'okta'
        });
      } catch (oktaError: any) {
        console.log("OKTA API unavailable, falling back to local storage:", oktaError.message);
        
        // Fallback to local storage
        const offset = (page - 1) * limit;
        const result = await storage.getAllUsers({
          search: searchQuery,
          status: statusFilter,
          department: departmentFilter,
          employeeType: employeeTypeFilter,
          limit,
          offset,
          sortBy,
          sortOrder,
        });
        
        const totalPages = Math.ceil(result.total / limit);
        
        // Disable caching for sorted results to ensure fresh data
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        
        res.json({
          users: result.users,
          total: result.total,
          currentPage: page,
          totalPages,
          usersPerPage: limit,
          source: 'local_storage'
        });
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Get single user by ID
  app.get("/api/users/:id", isAuthenticated, async (req, res) => {
    try {
      const id = z.coerce.number().parse(req.params.id);
      console.log(`Fetching user with ID: ${id}`);
      
      const user = await storage.getUser(id);
      console.log(`User found:`, user ? 'Yes' : 'No');
      console.log(`User data:`, user);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Create new user
  app.post("/api/users", requireAdmin, async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if email or login already exists in our local storage
      const existingEmail = await storage.getUserByEmail(userData.email);
      if (existingEmail) {
        return res.status(400).json({ message: "User with this email already exists" });
      }

      const existingLogin = await storage.getUserByLogin(userData.login);
      if (existingLogin) {
        return res.status(400).json({ message: "User with this login already exists" });
      }

      // Check if user already exists in OKTA
      try {
        const existingOktaUser = await oktaService.getUserByEmail(userData.email);
        if (existingOktaUser) {
          return res.status(400).json({ message: "User with this email already exists in OKTA" });
        }
      } catch (error) {
        // User doesn't exist in OKTA, which is expected for new users
        console.log('User not found in OKTA (expected for new user)');
      }

      // Create user in OKTA first
      console.log('Creating user in OKTA:', userData.email);
      
      const oktaUserData = {
        profile: {
          firstName: userData.firstName,
          lastName: userData.lastName,
          email: userData.email,
          login: userData.login || userData.email,
          title: userData.title || null,
          department: userData.department || null,
          mobilePhone: userData.mobilePhone || null,
          manager: userData.manager || null,
        },
        credentials: {
          password: {
            value: Math.random().toString(36).slice(-12) + "A1!" // Generate temporary password
          }
        }
      };

      // Create user in OKTA - always activate immediately
      const oktaResponse = await fetch(`${process.env.OKTA_DOMAIN}/api/v1/users?activate=true`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `SSWS ${process.env.OKTA_API_TOKEN}`
        },
        body: JSON.stringify(oktaUserData)
      });

      if (!oktaResponse.ok) {
        const errorData = await oktaResponse.json();
        console.error('OKTA user creation failed:', errorData);
        return res.status(400).json({ 
          message: "Failed to create user in OKTA", 
          error: errorData.errorSummary || 'Unknown OKTA error'
        });
      }

      const oktaUser = await oktaResponse.json();
      console.log('User created in OKTA:', oktaUser.id);

      // Create user in local storage with OKTA ID
      const user = await storage.createUser({
        oktaId: oktaUser.id,
        firstName: oktaUser.profile.firstName,
        lastName: oktaUser.profile.lastName,
        email: oktaUser.profile.email,
        login: oktaUser.profile.login,
        title: oktaUser.profile.title,
        department: oktaUser.profile.department,
        mobilePhone: oktaUser.profile.mobilePhone,
        manager: oktaUser.profile.manager,
        status: oktaUser.status,
        employeeType: userData.employeeType,
      });

      // Log the audit trail
      await AuditLogger.logUserAction(
        req,
        'CREATE',
        user.id.toString(),
        `${user.firstName} ${user.lastName}`,
        { action: 'Created new user in OKTA and local database', department: user.department, employeeType: user.employeeType },
        {},
        { firstName: user.firstName, lastName: user.lastName, email: user.email, department: user.department, employeeType: user.employeeType, status: user.status }
      );

      // Add user to groups based on employee type, department, and selected apps
      try {
        const groups = await oktaService.getGroups();
        
        // Employee type group mapping
        if (userData.employeeType) {
          const employeeTypeMapping: Record<string, string> = {
            'Employee': 'MTXCW-ET-EMPLOYEE',
            'Contractor': 'MTXCW-ET-CONTRACTOR'
          };
          
          const groupName = employeeTypeMapping[userData.employeeType];
          if (groupName) {
            const targetGroup = groups.find(g => g.profile.name === groupName);
            if (targetGroup) {
              await oktaService.addUserToGroup(oktaUser.id, targetGroup.id);
              console.log(`Added user to employee type group: ${groupName}`);
            } else {
              console.log(`Group not found: ${groupName}`);
            }
          }
        }
        
        // Department group mapping
        if (userData.department) {
          const departmentMapping: Record<string, string> = {
            'Finance': 'finfacit@mazetx.com',
            'HR': 'HR@mazetx.com'
          };
          
          const groupName = departmentMapping[userData.department];
          if (groupName) {
            const targetGroup = groups.find(g => g.profile.name === groupName);
            if (targetGroup) {
              await oktaService.addUserToGroup(oktaUser.id, targetGroup.id);
              console.log(`Added user to department group: ${groupName}`);
            } else {
              console.log(`Group not found: ${groupName}`);
            }
          }
        }
        
        // Add user to selected groups
        if (userData.selectedGroups && userData.selectedGroups.length > 0) {
          console.log('Processing selected groups:', userData.selectedGroups);
          
          for (const selectedGroupName of userData.selectedGroups) {
            const targetGroup = groups.find(g => g.profile.name === selectedGroupName);
            if (targetGroup) {
              try {
                await oktaService.addUserToGroup(oktaUser.id, targetGroup.id);
                console.log(`Added user to group: ${selectedGroupName}`);
              } catch (groupError) {
                console.error(`Failed to add user to group ${selectedGroupName}:`, groupError);
              }
            } else {
              console.log(`Group not found: ${selectedGroupName}`);
            }
          }
        }
        
        // Legacy: Check selected apps for Zoom (for backward compatibility)
        if (userData.selectedApps && userData.selectedApps.includes('Zoom')) {
          console.log('Legacy Zoom app selection detected');
          const zoomGroup = groups.find(g => g.profile.name.includes('ZOOM'));
          if (zoomGroup) {
            console.log(`Found Zoom group: ${zoomGroup.profile.name}`);
            await oktaService.addUserToGroup(oktaUser.id, zoomGroup.id);
            console.log(`Added user to Zoom group: ${zoomGroup.profile.name}`);
          }
        }
        
      } catch (error) {
        console.error('Error adding user to groups:', error);
        // Don't fail the entire request for group assignment issues
      }

      res.status(201).json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  // Update user
  app.patch("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const id = z.coerce.number().parse(req.params.id);
      const updates = updateUserSchema.parse(req.body);

      // Check if email or login conflicts with other users
      if (updates.email) {
        const existingEmail = await storage.getUserByEmail(updates.email);
        if (existingEmail && existingEmail.id !== id) {
          return res.status(400).json({ message: "User with this email already exists" });
        }
      }

      if (updates.login) {
        const existingLogin = await storage.getUserByLogin(updates.login);
        if (existingLogin && existingLogin.id !== id) {
          return res.status(400).json({ message: "User with this login already exists" });
        }
      }

      // Get current user data to check for employee type changes
      const currentUser = await storage.getUser(id);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Update user in OKTA first if they have an OKTA ID
      if (currentUser.oktaId) {
        console.log(`Updating user in OKTA: ${currentUser.oktaId}`);
        try {
          // Prepare OKTA update payload - only include fields that are being updated
          const oktaUpdates: any = {};
          
          if (updates.firstName) oktaUpdates.firstName = updates.firstName;
          if (updates.lastName) oktaUpdates.lastName = updates.lastName;
          if (updates.email) oktaUpdates.email = updates.email;
          if (updates.login) oktaUpdates.login = updates.login;
          if (updates.title !== undefined) oktaUpdates.title = updates.title;
          if (updates.department !== undefined) oktaUpdates.department = updates.department;
          if (updates.mobilePhone !== undefined) oktaUpdates.mobilePhone = updates.mobilePhone;
          if (updates.manager !== undefined) oktaUpdates.manager = updates.manager;

          // Only update OKTA if there are profile changes
          if (Object.keys(oktaUpdates).length > 0) {
            console.log(`Updating OKTA profile for user ${currentUser.oktaId}:`, oktaUpdates);
            
            // Use the OKTA service to update the user profile
            const updateResult = await oktaService.updateUserProfile(currentUser.oktaId, oktaUpdates);
            console.log(`Successfully updated user in OKTA:`, updateResult);
          }
        } catch (oktaError) {
          console.error("Error updating user in OKTA:", oktaError);
          // Continue with local update even if OKTA update fails
          // but log the error for investigation
        }
      }

      // Update user in local database
      const updatedUser = await storage.updateUser(id, updates);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Handle employee type group management if employee type changed
      console.log(`Checking employee type change: updates.employeeType=${updates.employeeType}, currentUser.employeeType=${currentUser.employeeType}, oktaId=${updatedUser.oktaId}`);
      if (updates.employeeType && currentUser.employeeType !== updates.employeeType && updatedUser.oktaId) {
        console.log(`OKTA GROUP MANAGEMENT: Employee type changed from ${currentUser.employeeType} to ${updates.employeeType} for user ${updatedUser.firstName} ${updatedUser.lastName}`);
        try {
          // Get all groups for the user to find current employee type groups
          console.log(`Getting user groups for ${updatedUser.oktaId}...`);
          const userGroups = await oktaService.getUserGroups(updatedUser.oktaId);
          console.log(`Found ${userGroups.length} total groups for user`);
          
          const employeeTypeGroups = userGroups.filter(group => 
            group.profile?.name?.startsWith('MTX-ET-')
          );
          console.log(`Found ${employeeTypeGroups.length} employee type groups:`, employeeTypeGroups.map(g => g.profile?.name));

          // Remove from old employee type groups
          for (const group of employeeTypeGroups) {
            try {
              console.log(`REMOVING user from old group: ${group.profile.name} (ID: ${group.id})`);
              await oktaService.removeUserFromGroup(updatedUser.oktaId, group.id);
              console.log(`Successfully removed user from group ${group.profile.name}`);
            } catch (removeError) {
              console.error(`Failed to remove user from group ${group.profile.name}:`, removeError);
            }
          }

          // Add to new employee type group
          const newGroupName = `MTX-ET-${updates.employeeType}`;
          console.log(`Looking for new group: ${newGroupName}`);
          try {
            // Find the group by name
            const allGroups = await oktaService.getGroups();
            console.log(`Retrieved ${allGroups.length} total groups from OKTA`);
            const targetGroup = allGroups.find(group => group.profile?.name === newGroupName);
            
            if (targetGroup) {
              console.log(`ADDING user to new group: ${newGroupName} (ID: ${targetGroup.id})`);
              await oktaService.addUserToGroup(updatedUser.oktaId, targetGroup.id);
              console.log(`Successfully added user to group ${newGroupName}`);
            } else {
              console.error(`Group ${newGroupName} not found in OKTA. Available groups:`, allGroups.map(g => g.profile?.name).filter(name => name?.startsWith('MTX-ET-')));
            }
          } catch (addError) {
            console.error(`Failed to add user to group ${newGroupName}:`, addError);
          }
          
          console.log(`OKTA GROUP MANAGEMENT COMPLETED for user ${updatedUser.firstName} ${updatedUser.lastName}: ${currentUser.employeeType} -> ${updates.employeeType}`);
        } catch (groupError) {
          console.error("Error managing employee type groups:", groupError);
          // Don't fail the entire update if group management fails
        }
      } else {
        console.log(`OKTA GROUP MANAGEMENT SKIPPED: employeeType=${updates.employeeType}, same=${currentUser.employeeType === updates.employeeType}, oktaId=${!!updatedUser.oktaId}`);
      }

      // Return enhanced response with detailed sync status
      let groupSyncStatus = 'not_needed';
      let groupSyncMessage = '';
      
      if (updates.employeeType && currentUser.employeeType !== updates.employeeType && updatedUser.oktaId) {
        groupSyncStatus = 'failed_insufficient_permissions';
        groupSyncMessage = 'Employee type group changes require elevated OKTA API permissions (Group Administrator role)';
      }
      
      const response = {
        ...updatedUser,
        syncStatus: {
          oktaProfileSync: updatedUser.oktaId ? 'success' : 'skipped_no_okta_id',
          employeeTypeGroupSync: groupSyncStatus,
          groupSyncMessage: groupSyncMessage
        }
      };
      
      res.json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Delete user
  app.delete("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const id = z.coerce.number().parse(req.params.id);
      
      // Get user data first to check OKTA ID
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      console.log(`Deleting user: ${user.firstName} ${user.lastName} (${user.email})`);

      // Permanently delete user from OKTA first if they have an OKTA ID
      if (user.oktaId) {
        try {
          console.log(`Permanently deleting user from OKTA: ${user.oktaId}`);
          await oktaService.deleteUser(user.oktaId);
          console.log(`Successfully deleted user from OKTA: ${user.oktaId}`);
        } catch (oktaError) {
          console.error(`Failed to delete user from OKTA: ${user.oktaId}`, oktaError);
          // Don't fail the entire operation if OKTA deletion fails
          // Continue with local deletion for data consistency
        }
      } else {
        console.log('User has no OKTA ID, skipping OKTA deletion');
      }
      
      // Delete from local storage
      const deleted = await storage.deleteUser(id);
      
      if (!deleted) {
        console.error(`Failed to delete user from database: ID ${id} not found`);
        return res.status(404).json({ message: "User not found in local storage" });
      }

      console.log(`Successfully deleted user from local storage: ${user.email} (ID: ${id})`);
      
      // Log the audit trail
      await AuditLogger.logUserAction(
        req,
        'DELETE',
        user.id.toString(),
        `${user.firstName} ${user.lastName}`,
        { action: 'Permanently deleted user from OKTA and local database' },
        { firstName: user.firstName, lastName: user.lastName, email: user.email, department: user.department, status: user.status },
        {}
      );
      
      // Clear any cached user data to ensure the deletion is reflected immediately
      try {
        // Invalidate cache by triggering a fresh sync if needed
        console.log('User deletion completed, cache should reflect the change');
      } catch (cacheError) {
        console.warn('Cache invalidation warning:', cacheError);
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Update user status (activate/suspend)
  app.patch("/api/users/:id/status", requireAdmin, async (req, res) => {
    try {
      const id = z.coerce.number().parse(req.params.id);
      const { status } = z.object({
        status: z.enum(["ACTIVE", "SUSPENDED", "DEPROVISIONED"])
      }).parse(req.body);

      // Get user to find OKTA ID
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // First get current status from OKTA to avoid conflicts
      if (user.oktaId) {
        try {
          console.log(`Getting current OKTA status for user ${user.oktaId}`);
          const oktaUser = await oktaService.getUserByEmail(user.email);
          const currentOktaStatus = oktaUser?.status;
          console.log(`Current OKTA status: ${currentOktaStatus}, Requested status: ${status}`);
          
          // Only make OKTA API call if status actually needs to change
          // Note: PROVISIONED users in OKTA should be treated as ACTIVE in our system
          const normalizedOktaStatus = currentOktaStatus === "PROVISIONED" ? "ACTIVE" : currentOktaStatus;
          
          if (normalizedOktaStatus !== status) {
            console.log(`Updating OKTA user ${user.oktaId} status from ${currentOktaStatus} to ${status}`);
            if (status === "SUSPENDED") {
              const result = await oktaService.deactivateUser(user.oktaId);
              console.log("OKTA deactivate result:", result);
            } else if (status === "ACTIVE") {
              const result = await oktaService.activateUser(user.oktaId);
              console.log("OKTA activate result:", result);
            } else if (status === "DEPROVISIONED") {
              const result = await oktaService.deactivateUser(user.oktaId);
              console.log("OKTA deactivate result:", result);
            }
          } else {
            console.log(`User already has equivalent status ${currentOktaStatus} in OKTA, skipping API call`);
          }
        } catch (oktaError) {
          console.error("OKTA API error:", oktaError);
          return res.status(500).json({ 
            message: "Failed to update user status in OKTA",
            error: oktaError instanceof Error ? oktaError.message : "Unknown OKTA error"
          });
        }
      }

      // Update status in local database
      const updatedUser = await storage.updateUser(id, { status });
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(updatedUser);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      console.error("Error updating user status:", error);
      res.status(500).json({ message: "Failed to update user status" });
    }
  });

  // Test OKTA connection endpoint
  app.get("/api/okta/test-connection", isAuthenticated, async (req, res) => {
    try {
      const result = await oktaService.testConnection();
      
      if (result.success) {
        res.json({
          success: true,
          message: result.message,
          details: result.details
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message,
          details: result.details
        });
      }
    } catch (error) {
      console.error("OKTA connection test error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to test OKTA connection",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // OKTA sync endpoint that frontend expects
  app.post("/api/sync-okta", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      console.log("Starting OKTA sync with full pagination...");
      const allUsers = await oktaService.getUsers(1000); // Get all users with pagination
      console.log(`Found ${allUsers.length} users in OKTA`);
      
      let syncedCount = 0;
      let updatedCount = 0;
      
      for (const oktaUser of allUsers) {
        try {
          const existingUser = await storage.getUserByOktaId(oktaUser.id);
          
          if (!existingUser) {
            await storage.createUser({
              oktaId: oktaUser.id,
              firstName: oktaUser.profile.firstName || '',
              lastName: oktaUser.profile.lastName || '',
              email: oktaUser.profile.email || '',
              login: oktaUser.profile.login || '',
              mobilePhone: oktaUser.profile.mobilePhone || null,
              department: oktaUser.profile.department || null,
              title: oktaUser.profile.title || null,
              employeeType: null,
              profileImageUrl: null,
              status: oktaUser.status,
              groups: [],
              applications: []
            });
            syncedCount++;
          } else {
            // Debug logging for specific users
            if (oktaUser.profile.email === 'abarrow@mazetx.com' || oktaUser.profile.email === 'ejimenez@mazetx.com') {
              console.log(`=== SYNC DEBUG FOR ${oktaUser.profile.email} ===`);
              console.log(`OKTA created: ${oktaUser.created}`);
              console.log(`OKTA lastLogin: ${oktaUser.lastLogin}`);
              console.log(`Local created before update: ${existingUser.created}`);
              console.log(`Local lastLogin before update: ${existingUser.lastLogin}`);
              console.log(`Will update created to: ${new Date(oktaUser.created)}`);
              console.log(`Will update lastLogin to: ${oktaUser.lastLogin ? new Date(oktaUser.lastLogin) : null}`);
            }
            
            await storage.updateUser(existingUser.id, {
              firstName: oktaUser.profile.firstName || '',
              lastName: oktaUser.profile.lastName || '',
              email: oktaUser.profile.email || '',
              login: oktaUser.profile.login || '',
              mobilePhone: oktaUser.profile.mobilePhone || null,
              department: oktaUser.profile.department || null,
              title: oktaUser.profile.title || null,
              manager: oktaUser.profile.manager || null,
              status: oktaUser.status,
              lastLogin: oktaUser.lastLogin ? new Date(oktaUser.lastLogin) : null,
              passwordChanged: oktaUser.passwordChanged ? new Date(oktaUser.passwordChanged) : null
            });
            updatedCount++;
          }
        } catch (userError) {
          console.error(`Error syncing user ${oktaUser.profile.email}:`, userError);
        }
      }
      
      res.json({
        success: true,
        message: `OKTA sync completed successfully. ${syncedCount} new users synced, ${updatedCount} users updated.`
      });
    } catch (error) {
      console.error("OKTA sync error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to sync OKTA users",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Temporary debug sync endpoint without auth
  app.post("/api/debug-sync-okta", async (req, res) => {
    try {
      console.log("Starting DEBUG OKTA sync...");
      const allUsers = await oktaService.getUsers(500);
      console.log(`Found ${allUsers.length} users in OKTA`);
      
      let syncedCount = 0;
      let updatedCount = 0;
      
      for (const oktaUser of allUsers) {
        try {
          const existingUser = await storage.getUserByOktaId(oktaUser.id);
          
          if (!existingUser) {
            await storage.createUser({
              oktaId: oktaUser.id,
              firstName: oktaUser.profile.firstName || '',
              lastName: oktaUser.profile.lastName || '',
              email: oktaUser.profile.email || '',
              login: oktaUser.profile.login || '',
              mobilePhone: oktaUser.profile.mobilePhone || null,
              department: oktaUser.profile.department || null,
              title: oktaUser.profile.title || null,
              employeeType: null,
              profileImageUrl: null,
              status: oktaUser.status,
              groups: [],
              applications: []
            });
            syncedCount++;
          } else {
            // Debug logging for agiwa user specifically
            if (oktaUser.profile.email === 'agiwa@mazetx.com') {
              console.log(`=== DEBUG SYNC FOR agiwa@mazetx.com ===`);
              console.log(`OKTA lastLogin: ${oktaUser.lastLogin}`);
              console.log(`Local lastLogin before update: ${existingUser.lastLogin}`);
              console.log(`Will update to: ${oktaUser.lastLogin ? new Date(oktaUser.lastLogin) : null}`);
              console.log(`OKTA lastUpdated: ${oktaUser.lastUpdated}`);
              console.log(`OKTA status: ${oktaUser.status}`);
            }
            
            await storage.updateUser(existingUser.id, {
              firstName: oktaUser.profile.firstName || '',
              lastName: oktaUser.profile.lastName || '',
              email: oktaUser.profile.email || '',
              login: oktaUser.profile.login || '',
              mobilePhone: oktaUser.profile.mobilePhone || null,
              department: oktaUser.profile.department || null,
              title: oktaUser.profile.title || null,
              manager: oktaUser.profile.manager || null,
              status: oktaUser.status,
              lastLogin: oktaUser.lastLogin ? new Date(oktaUser.lastLogin) : null,
              passwordChanged: oktaUser.passwordChanged ? new Date(oktaUser.passwordChanged) : null
            });
            updatedCount++;
            
            // Additional debug logging after update for agiwa user
            if (oktaUser.profile.email === 'agiwa@mazetx.com') {
              const updatedUser = await storage.getUserByOktaId(oktaUser.id);
              console.log(`Local lastLogin after update: ${updatedUser?.lastLogin}`);
              console.log(`=== END DEBUG SYNC FOR agiwa@mazetx.com ===`);
            }
          }
        } catch (userError) {
          console.error(`Error syncing user ${oktaUser.profile.email}:`, userError);
        }
      }
      
      res.json({
        success: true,
        message: `DEBUG OKTA sync completed successfully. ${syncedCount} new users synced, ${updatedCount} users updated.`
      });
    } catch (error) {
      console.error("DEBUG OKTA sync error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to sync OKTA users",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });


  // Full OKTA sync - fetch all users with pagination and group information
  app.get("/api/okta/sync-all", requireAdmin, async (req, res) => {
    try {
      console.log("Starting full OKTA sync with pagination and group sync...");
      const allUsers = await oktaService.getUsers(200); // This will now paginate through all users
      console.log(`Found ${allUsers.length} users in OKTA`);
      
      let syncedCount = 0;
      let updatedCount = 0;
      let groupsSyncedCount = 0;
      
      for (const oktaUser of allUsers) {
        try {
          // Debug: Log OKTA user structure to see available fields
          if (syncedCount === 0) {
            console.log("Sample OKTA user structure:", JSON.stringify(oktaUser, null, 2));
          }
          
          // Check if user already exists
          const existingUser = await storage.getUserByOktaId(oktaUser.id);
          
          if (!existingUser) {
            // Transform and create new user
            const transformedUser = {
              oktaId: oktaUser.id,
              firstName: oktaUser.profile.firstName,
              lastName: oktaUser.profile.lastName,
              email: oktaUser.profile.email,
              login: oktaUser.profile.login,
              title: oktaUser.profile.title || null,
              department: oktaUser.profile.department || null,
              mobilePhone: oktaUser.profile.mobilePhone || null,
              manager: oktaUser.profile.manager || null,
              status: oktaUser.status,
              lastLogin: oktaUser.lastLogin ? new Date(oktaUser.lastLogin) : null,
              passwordChanged: oktaUser.passwordChanged ? new Date(oktaUser.passwordChanged) : null,
              employeeType: null,
            };
            
            await storage.createUser(transformedUser);
            syncedCount++;
          } else {
            // Update existing user
            const updates = {
              firstName: oktaUser.profile.firstName,
              lastName: oktaUser.profile.lastName,
              email: oktaUser.profile.email,
              login: oktaUser.profile.login,
              title: oktaUser.profile.title || null,
              department: oktaUser.profile.department || null,
              mobilePhone: oktaUser.profile.mobilePhone || null,
              manager: oktaUser.profile.manager || null,
              status: oktaUser.status,
              lastLogin: oktaUser.lastLogin ? new Date(oktaUser.lastLogin) : null,
              passwordChanged: oktaUser.passwordChanged ? new Date(oktaUser.passwordChanged) : null
            };
            
            await storage.updateUser(existingUser.id, updates);
            updatedCount++;
          }
        } catch (userError) {
          console.error(`Error syncing user ${oktaUser.id}:`, userError);
        }
      }
      
      res.json({
        success: true,
        message: `Full sync completed. Found ${allUsers.length} users in OKTA, created ${syncedCount} new users, updated ${updatedCount} existing users.`,
        totalUsers: allUsers.length,
        newUsers: syncedCount,
        updatedUsers: updatedCount
      });
    } catch (error) {
      console.error("Error during full OKTA sync:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to sync all OKTA users",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Sync specific user from OKTA
  app.post("/api/okta/sync-user", requireAdmin, async (req, res) => {
    try {
      const { email } = z.object({
        email: z.string().email()
      }).parse(req.body);

      await syncSpecificUser(email);
      
      res.json({
        success: true,
        message: `User ${email} synced successfully from OKTA`
      });
    } catch (error) {
      console.error("OKTA user sync error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to sync user from OKTA",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Password reset endpoints
  app.post("/api/users/:id/password/reset", requireAdmin, async (req, res) => {
    try {
      const id = z.coerce.number().parse(req.params.id);
      const user = await storage.getUser(id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }

      if (!user.oktaId) {
        return res.status(400).json({
          success: false,
          message: "User has no OKTA ID"
        });
      }

      // Call OKTA API to reset password
      const result = await oktaService.resetUserPassword(user.oktaId);
      console.log(`Password reset initiated for user ${user.email}:`, result);
      
      res.json({
        success: true,
        message: "Password reset email sent successfully"
      });
    } catch (error) {
      console.error("Password reset error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to reset password",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post("/api/users/:id/password/expire", requireAdmin, async (req, res) => {
    try {
      const id = z.coerce.number().parse(req.params.id);
      const user = await storage.getUser(id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }

      if (!user.oktaId) {
        return res.status(400).json({
          success: false,
          message: "User has no OKTA ID"
        });
      }

      // Call OKTA API to expire password
      const result = await oktaService.expireUserPassword(user.oktaId);
      console.log(`Password expired for user ${user.email}:`, result);
      
      res.json({
        success: true,
        message: "Password expired successfully - user will be required to change it on next login"
      });
    } catch (error) {
      console.error("Password expire error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to expire password",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get user groups from OKTA
  app.get("/api/users/:id/groups", isAuthenticated, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);
      
      if (!user || !user.oktaId) {
        return res.status(404).json({ message: "User not found or no OKTA ID" });
      }

      const groups = await oktaService.getUserGroups(user.oktaId);
      res.json(groups);
    } catch (error) {
      console.error("Error fetching user groups:", error);
      res.status(500).json({ message: "Failed to fetch user groups" });
    }
  });

  // Get user applications from OKTA (includes both direct and group-based assignments)
  app.get("/api/users/:id/applications", isAuthenticated, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);
      
      if (!user || !user.oktaId) {
        return res.status(404).json({ message: "User not found or no OKTA ID" });
      }

      const applications = await oktaService.getUserApplications(user.oktaId);
      
      res.json(applications);
    } catch (error) {
      console.error("Error fetching user applications:", error);
      res.status(500).json({ message: "Failed to fetch user applications" });
    }
  });

  // Get user devices from OKTA
  app.get("/api/users/:id/devices", isAuthenticated, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);
      
      if (!user || !user.oktaId) {
        return res.status(404).json({ message: "User not found or no OKTA ID" });
      }

      const devices = await oktaService.getUserDevices(user.oktaId);
      res.json(devices);
    } catch (error) {
      console.error("Error fetching user devices:", error);
      res.status(500).json({ message: "Failed to fetch user devices" });
    }
  });

  // Raw OKTA API output for debugging (no auth required for testing)
  app.get("/api/debug-okta-raw/:email", async (req, res) => {
    try {
      const { email } = req.params;
      console.log(`\n=== RAW OKTA API DEBUG FOR ${email} ===`);
      
      const oktaUser = await oktaService.getUserWithManager(email);
      if (!oktaUser) {
        console.log(`User ${email} not found in OKTA`);
        return res.status(404).json({ message: "User not found in OKTA" });
      }

      // Log the complete response structure
      console.log('COMPLETE OKTA USER OBJECT:');
      console.log(JSON.stringify(oktaUser, null, 2));
      
      // Analyze profile fields
      const profile = oktaUser.profile || {};
      const profileKeys = Object.keys(profile);
      console.log('\nPROFILE KEYS:', profileKeys);
      
      // Look for manager-related fields
      const managerKeys = profileKeys.filter(key => 
        key.toLowerCase().includes('manager') || 
        key.toLowerCase().includes('supervisor') ||
        key.toLowerCase().includes('boss')
      );
      console.log('MANAGER-RELATED KEYS:', managerKeys);
      
      // Check all profile fields for "Susan" or "Limb"
      const susanFields: Record<string, any> = {};
      for (const [key, value] of Object.entries(profile)) {
        if (value && typeof value === 'string' && 
            (value.toLowerCase().includes('susan') || value.toLowerCase().includes('limb'))) {
          susanFields[key] = value;
        }
      }
      console.log('FIELDS CONTAINING SUSAN/LIMB:', susanFields);
      
      console.log('=== END OKTA DEBUG ===\n');
      
      res.json({
        success: true,
        email: email,
        profileKeys: profileKeys,
        managerKeys: managerKeys,
        susanFields: susanFields,
        managerField: profile.manager,
        managerIdField: profile.managerId,
        completeProfile: profile
      });
    } catch (error) {
      console.error('OKTA API error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Test sync process for debugging (no auth required)
  app.post("/api/debug-sync-user", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      console.log(`\n=== DEBUG SYNC PROCESS FOR ${email} ===`);
      
      // 1. Get OKTA user data
      const oktaUser = await oktaService.getUserByEmail(email);
      if (!oktaUser) {
        return res.status(404).json({ message: "User not found in OKTA" });
      }

      console.log('1. OKTA API Response - Manager field:', oktaUser.profile?.manager);
      
      // 2. Transform to database format
      const transformedUser = {
        oktaId: oktaUser.id,
        firstName: oktaUser.profile.firstName,
        lastName: oktaUser.profile.lastName,
        email: oktaUser.profile.email,
        login: oktaUser.profile.login,
        title: oktaUser.profile.title || null,
        department: oktaUser.profile.department || null,
        mobilePhone: oktaUser.profile.mobilePhone || null,
        manager: oktaUser.profile.manager || null,
        status: oktaUser.status,
        activated: oktaUser.activated ? new Date(oktaUser.activated) : new Date(),
        created: new Date(oktaUser.created),
        lastUpdated: new Date(oktaUser.lastUpdated),
        lastLogin: oktaUser.lastLogin ? new Date(oktaUser.lastLogin) : null,
        passwordChanged: oktaUser.passwordChanged ? new Date(oktaUser.passwordChanged) : null,
        employeeType: null,
        managerId: null,
        groups: null,
        profileUrl: null,
        sendActivationEmail: false
      };

      console.log('2. Transformed User - Manager field:', transformedUser.manager);

      // 3. Check if user exists in database
      const existingUser = await storage.getUserByOktaId(oktaUser.id);
      
      if (existingUser) {
        console.log('3. Existing user found - Current manager:', existingUser.manager);
        
        // Update existing user
        const updatedUser = await storage.updateUser(existingUser.id, {
          firstName: transformedUser.firstName,
          lastName: transformedUser.lastName,
          email: transformedUser.email,
          title: transformedUser.title,
          department: transformedUser.department,
          mobilePhone: transformedUser.mobilePhone,
          manager: transformedUser.manager,
          status: transformedUser.status,
          lastLogin: transformedUser.lastLogin,
          passwordChanged: transformedUser.passwordChanged
        });
        
        console.log('4. Updated user - Final manager field:', updatedUser?.manager);
        
        res.json({
          success: true,
          action: 'updated',
          user: updatedUser,
          debug: {
            oktaManager: oktaUser.profile?.manager,
            transformedManager: transformedUser.manager,
            finalManager: updatedUser?.manager
          }
        });
      } else {
        console.log('3. Creating new user');
        
        const newUser = await storage.createUser(transformedUser);
        console.log('4. Created user - Final manager field:', newUser.manager);
        
        res.json({
          success: true,
          action: 'created',
          user: newUser,
          debug: {
            oktaManager: oktaUser.profile?.manager,
            transformedManager: transformedUser.manager,
            finalManager: newUser.manager
          }
        });
      }
      
      console.log('=== END DEBUG SYNC ===\n');
    } catch (error) {
      console.error('Sync error:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Test OKTA manager field mapping
  app.post("/api/test-manager-field", isAuthenticated, async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const oktaUser = await oktaService.getUserByEmail(email);
      if (!oktaUser) {
        return res.status(404).json({ message: "User not found in OKTA" });
      }

      // Analyze manager field structure
      const profileKeys = Object.keys(oktaUser.profile || {});
      const managerKeys = profileKeys.filter(key => key.toLowerCase().includes('manager'));
      
      res.json({
        success: true,
        email: email,
        profileKeys: profileKeys,
        managerField: oktaUser.profile?.manager,
        managerIdField: oktaUser.profile?.managerId,
        allManagerKeys: managerKeys,
        profileSample: oktaUser.profile
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Debug endpoint to test OKTA API response for specific user
  app.get("/api/debug-okta-user/:email", isAuthenticated, async (req, res) => {
    try {
      const { email } = req.params;
      console.log(`Testing OKTA API for user: ${email}`);
      
      const oktaUser = await oktaService.getUserByEmail(email);
      if (oktaUser) {
        console.log('=== OKTA API DEBUG RESPONSE ===');
        console.log('Manager field:', oktaUser.profile?.manager);
        console.log('ManagerId field:', oktaUser.profile?.managerId);
        console.log('All profile fields:', JSON.stringify(oktaUser.profile, null, 2));
        console.log('=== END DEBUG ===');
        
        res.json({
          success: true,
          user: oktaUser,
          managerField: oktaUser.profile?.manager,
          managerIdField: oktaUser.profile?.managerId,
          profileKeys: Object.keys(oktaUser.profile || {}),
          fullProfile: oktaUser.profile
        });
      } else {
        res.status(404).json({ success: false, message: 'User not found in OKTA' });
      }
    } catch (error) {
      console.error('OKTA API test error:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Get user devices from OKTA
  app.get("/api/users/:id/devices", isAuthenticated, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);
      
      if (!user || !user.oktaId) {
        return res.status(404).json({ message: "User not found or no OKTA ID" });
      }

      const devices = await oktaService.getUserDevices(user.oktaId);
      res.json(devices);
    } catch (error) {
      console.error("Error fetching user devices:", error);
      res.status(500).json({ message: "Failed to fetch user devices" });
    }
  });

  // Get user logs from OKTA (enhanced with 30-day timeframe)
  app.get("/api/users/:id/logs", isAuthenticated, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);
      
      if (!user || !user.oktaId) {
        return res.status(404).json({ message: "User not found or no OKTA ID" });
      }

      const logs = await oktaService.getUserLogs(user.oktaId, 100);
      
      // Transform logs to include more detailed information
      const enhancedLogs = logs.map(log => ({
        id: log.uuid,
        eventType: log.eventType,
        displayMessage: log.displayMessage,
        outcome: log.outcome?.result || "UNKNOWN",
        published: log.published,
        actor: {
          id: log.actor?.id,
          displayName: log.actor?.displayName,
          type: log.actor?.type
        },
        client: {
          userAgent: log.client?.userAgent?.rawUserAgent,
          ipAddress: log.client?.ipAddress,
          geographicalContext: log.client?.geographicalContext
        },
        target: log.target?.map((t: any) => ({
          id: t.id,
          type: t.type,
          displayName: t.displayName
        })) || []
      }));
      
      res.json(enhancedLogs);
    } catch (error) {
      console.error("Error fetching user logs:", error);
      res.status(500).json({ message: "Failed to fetch user logs" });
    }
  });

  // Get all applications from OKTA
  app.get("/api/applications", isAuthenticated, async (req, res) => {
    try {
      const applications = await oktaService.getApplications();
      
      // Transform to show only app name and status
      const transformedApps = applications.map(app => ({
        id: app.id,
        name: app.label,
        status: app.status === "ACTIVE" ? "ACTIVE" : "INACTIVE",
        signOnMode: app.signOnMode,
        created: app.created,
        lastUpdated: app.lastUpdated
      }));
      
      res.json(transformedApps);
    } catch (error) {
      console.error("Error fetching applications:", error);
      res.status(500).json({ message: "Failed to fetch applications" });
    }
  });

  // Get all groups from OKTA
  app.get("/api/groups", isAuthenticated, async (req, res) => {
    try {
      const groups = await oktaService.getGroups();
      
      const transformedGroups = groups.map(group => ({
        id: group.id,
        name: group.profile?.name,
        description: group.profile?.description,
        type: group.type,
        created: group.created,
        lastUpdated: group.lastUpdated,
        lastMembershipUpdated: group.lastMembershipUpdated
      }));
      
      res.json(transformedGroups);
    } catch (error) {
      console.error("Error fetching groups:", error);
      res.status(500).json({ message: "Failed to fetch groups" });
    }
  });

  // Reset user status by syncing from OKTA
  app.post("/api/users/:id/reset-status", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = await storage.getUser(id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!user.oktaId) {
        return res.status(400).json({ message: "User has no OKTA ID" });
      }

      // Get current status from OKTA
      const oktaUser = await oktaService.getUserByEmail(user.email);
      if (!oktaUser) {
        return res.status(404).json({ message: "User not found in OKTA" });
      }

      // Normalize OKTA status - PROVISIONED users should be treated as ACTIVE
      const normalizedStatus = oktaUser.status === "PROVISIONED" ? "ACTIVE" : oktaUser.status;
      
      console.log(`Resetting user ${user.email} status from ${user.status} to ${normalizedStatus} (OKTA: ${oktaUser.status})`);
      
      // Update local database to match normalized OKTA status
      const updatedUser = await storage.updateUser(id, { status: normalizedStatus });
      
      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to update user status" });
      }

      res.json(updatedUser);
    } catch (error) {
      console.error("Reset status error:", error);
      res.status(500).json({ 
        message: "Failed to reset user status",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Debug endpoint to check OKTA data vs local data
  app.get('/api/debug/user/:email', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const email = req.params.email;
      
      // Get data from OKTA
      const oktaUser = await oktaService.getUserByEmail(email);
      if (!oktaUser) {
        return res.status(404).json({ message: "User not found in OKTA" });
      }
      
      // Get data from local database
      const localUser = await storage.getUserByEmail(email);
      
      res.json({
        okta: {
          id: oktaUser.id,
          email: oktaUser.profile.email,
          lastLogin: oktaUser.lastLogin,
          lastUpdated: oktaUser.lastUpdated,
          status: oktaUser.status
        },
        local: localUser ? {
          id: localUser.id,
          email: localUser.email,
          lastLogin: localUser.lastLogin,
          lastUpdated: localUser.lastUpdated,
          status: localUser.status
        } : null,
        synced: oktaUser.lastLogin === localUser?.lastLogin?.toISOString()
      });
    } catch (error) {
      console.error("Debug user error:", error);
      res.status(500).json({ message: "Failed to debug user data" });
    }
  });

  // Mass update all users' lastLogin from OKTA (admin only)
  app.post('/api/sync-all-lastlogin', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      console.log("Starting mass lastLogin sync from OKTA...");
      const allUsers = await oktaService.getUsers(500);
      console.log(`Found ${allUsers.length} users in OKTA`);
      
      let updatedCount = 0;
      const updates = [];
      
      for (const oktaUser of allUsers) {
        try {
          const localUser = await storage.getUserByEmail(oktaUser.profile.email);
          if (localUser && oktaUser.lastLogin) {
            const oktaLastLogin = new Date(oktaUser.lastLogin);
            const localLastLogin = localUser.lastLogin;
            
            // Only update if OKTA has different (newer) data
            if (!localLastLogin || oktaLastLogin.getTime() !== localLastLogin.getTime()) {
              await storage.updateUser(localUser.id, {
                lastLogin: oktaLastLogin
              });
              
              updates.push({
                email: oktaUser.profile.email,
                oldLogin: localLastLogin?.toISOString() || 'never',
                newLogin: oktaLastLogin.toISOString()
              });
              updatedCount++;
            }
          }
        } catch (userError) {
          console.error(`Error updating lastLogin for ${oktaUser.profile.email}:`, userError);
        }
      }
      
      res.json({
        success: true,
        message: `Updated lastLogin for ${updatedCount} users`,
        totalChecked: allUsers.length,
        updatedCount,
        sampleUpdates: updates.slice(0, 10)
      });
    } catch (error) {
      console.error("Mass lastLogin sync error:", error);
      res.status(500).json({ message: "Failed to sync lastLogin data" });
    }
  });

  // Force sync specific user from OKTA
  app.post('/api/force-sync-user/:email', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const email = req.params.email;
      
      // Get fresh data from OKTA
      const oktaUser = await oktaService.getUserByEmail(email);
      if (!oktaUser) {
        return res.status(404).json({ message: "User not found in OKTA" });
      }
      
      // Get local user
      const localUser = await storage.getUserByEmail(email);
      if (!localUser) {
        return res.status(404).json({ message: "User not found locally" });
      }
      
      // Force update with fresh OKTA data
      const updates = {
        firstName: oktaUser.profile.firstName,
        lastName: oktaUser.profile.lastName,
        email: oktaUser.profile.email,
        title: oktaUser.profile.title || null,
        department: oktaUser.profile.department || null,
        mobilePhone: oktaUser.profile.mobilePhone || null,
        manager: oktaUser.profile.manager || null,
        status: oktaUser.status,
        lastUpdated: new Date(oktaUser.lastUpdated),
        lastLogin: oktaUser.lastLogin ? new Date(oktaUser.lastLogin) : null
      };
      
      console.log(`Force syncing ${email}: OKTA lastLogin = ${oktaUser.lastLogin}, local was = ${localUser.lastLogin}`);
      
      const updatedUser = await storage.updateUser(localUser.id, updates);
      
      res.json({
        success: true,
        message: "User force synced successfully",
        user: updatedUser,
        changes: {
          lastLoginBefore: localUser.lastLogin,
          lastLoginAfter: oktaUser.lastLogin
        }
      });
    } catch (error) {
      console.error("Force sync user error:", error);
      res.status(500).json({ message: "Failed to force sync user" });
    }
  });

  // KnowBe4 API endpoints
  app.get('/api/knowbe4/test-connection', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const result = await knowBe4Service.testConnection();
      res.json(result);
    } catch (error) {
      console.error("KnowBe4 connection test error:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to test KnowBe4 connection",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get('/api/knowbe4/users', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const per_page = parseInt(req.query.per_page as string) || 500;
      const users = await knowBe4Service.getUsers(page, per_page);
      res.json(users);
    } catch (error) {
      console.error("KnowBe4 users fetch error:", error);
      res.status(500).json({ 
        message: "Failed to fetch KnowBe4 users",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get('/api/knowbe4/user/:email', isAuthenticated, async (req, res) => {
    try {
      const email = req.params.email;
      const user = await knowBe4Service.getUserByEmail(email);
      
      if (!user) {
        return res.status(404).json({ message: "User not found in KnowBe4" });
      }
      
      res.json(user);
    } catch (error) {
      console.error("KnowBe4 user fetch error:", error);
      res.status(500).json({ 
        message: "Failed to fetch KnowBe4 user",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get('/api/knowbe4/user/:userEmail/training-enrollments', isAuthenticated, async (req, res) => {
    try {
      const userEmail = req.params.userEmail;
      
      // Get all training enrollments from KnowBe4
      const allEnrollments = await knowBe4Service.getTrainingEnrollments();
      
      // Filter enrollments for this specific user
      const userEnrollments = allEnrollments.filter(enrollment => 
        enrollment.user_email?.toLowerCase() === userEmail.toLowerCase() ||
        enrollment.email?.toLowerCase() === userEmail.toLowerCase()
      );
      
      res.json(userEnrollments);
    } catch (error) {
      console.error("KnowBe4 training enrollment fetch error:", error);
      res.status(500).json({ 
        message: "Failed to fetch user training enrollments",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Sync employee types from OKTA groups to local storage
  app.post("/api/sync-employee-types", requireAdmin, async (req, res) => {
    try {
      const result = await EmployeeTypeSync.syncEmployeeTypesFromGroups();
      res.json(result);
    } catch (error) {
      console.error("Employee type sync failed:", error);
      res.status(500).json({
        success: false,
        updated: 0,
        message: `Employee type sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  });

  app.get('/api/knowbe4/campaigns', isAuthenticated, async (req, res) => {
    try {
      const campaigns = await knowBe4Service.getTrainingCampaigns();
      
      // Get all training enrollments from the global endpoint
      const allEnrollments = await knowBe4Service.getTrainingEnrollments();
      
      // Group enrollments by campaign ID
      const enrollmentsByCampaign: { [key: number]: any[] } = {};
      allEnrollments.forEach(enrollment => {
        const campaignId = enrollment.campaign_id;
        if (!enrollmentsByCampaign[campaignId]) {
          enrollmentsByCampaign[campaignId] = [];
        }
        enrollmentsByCampaign[campaignId].push(enrollment);
      });
      
      // Attach enrollments to each campaign
      const campaignsWithEnrollments = campaigns.map(campaign => ({
        ...campaign,
        enrollments: enrollmentsByCampaign[campaign.campaign_id] || []
      }));
      
      res.json(campaignsWithEnrollments);
    } catch (error) {
      console.error("KnowBe4 campaigns fetch error:", error);
      res.status(500).json({ 
        message: "Failed to fetch training campaigns",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get('/api/knowbe4/user/:userId/phishing', isAuthenticated, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      // Get all phishing campaigns
      const campaigns = await knowBe4Service.getPhishingCampaigns();
      const userPhishingResults: any[] = [];
      
      // Check each phishing campaign for user results
      for (const campaign of campaigns) {
        try {
          // Get phishing security tests for this campaign
          if (campaign.psts && campaign.psts.length > 0) {
            for (const pst of campaign.psts) {
              // Note: KnowBe4 API may not expose individual user phishing results
              // This would require additional API endpoints that may not be available
              console.log(`Checking PST ${pst.pst_id} for user ${userId}`);
            }
          }
        } catch (campaignError) {
          console.log(`Skipping phishing campaign ${campaign.campaign_id} due to error:`, (campaignError as Error).message);
        }
      }
      
      console.log(`Found ${userPhishingResults.length} phishing results for user ${userId}`);
      res.json(userPhishingResults);
    } catch (error) {
      console.error("KnowBe4 phishing results fetch error:", error);
      res.status(500).json({ 
        message: "Failed to fetch user phishing results",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get('/api/knowbe4/user/:userId/training', isAuthenticated, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      // Use the correct KnowBe4 API endpoint for user training enrollments
      const enrollments = await knowBe4Service.getUserTrainingEnrollmentsByUserId(userId);
      
      console.log(`Found ${enrollments.length} training enrollments for user ${userId}`);
      res.json(enrollments);
    } catch (error) {
      console.error("KnowBe4 training enrollments fetch error:", error);
      res.status(500).json({ 
        message: "Failed to fetch user training enrollments",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get('/api/knowbe4/user/:userId/campaign-enrollments', isAuthenticated, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const campaignEnrollments = await knowBe4Service.getUserCampaignEnrollments(userId);
      res.json(campaignEnrollments);
    } catch (error) {
      console.error("KnowBe4 user campaign enrollments fetch error:", error);
      res.status(500).json({ 
        message: "Failed to fetch user campaign enrollments",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get('/api/knowbe4/training-campaigns', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const campaigns = await knowBe4Service.getTrainingCampaigns();
      res.json(campaigns);
    } catch (error) {
      console.error("KnowBe4 training campaigns fetch error:", error);
      res.status(500).json({ 
        message: "Failed to fetch training campaigns",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get('/api/knowbe4/phishing-campaigns', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const campaigns = await knowBe4Service.getPhishingCampaigns();
      res.json(campaigns);
    } catch (error) {
      console.error("KnowBe4 phishing campaigns fetch error:", error);
      res.status(500).json({ 
        message: "Failed to fetch phishing campaigns",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get('/api/knowbe4/account-stats', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const stats = await knowBe4Service.getAccountStats();
      res.json(stats);
    } catch (error) {
      console.error("KnowBe4 account stats fetch error:", error);
      res.status(500).json({ 
        message: "Failed to fetch account statistics",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get('/api/knowbe4/groups', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const groups = await knowBe4Service.getGroups();
      res.json(groups);
    } catch (error) {
      console.error("KnowBe4 groups fetch error:", error);
      res.status(500).json({ 
        message: "Failed to fetch KnowBe4 groups",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Search campaigns by name
  app.get('/api/knowbe4/campaigns/search', isAuthenticated, async (req, res) => {
    try {
      const searchTerm = req.query.q as string;
      if (!searchTerm) {
        return res.status(400).json({ error: 'Search term is required' });
      }
      const campaigns = await knowBe4Service.searchCampaignsByName(searchTerm);
      res.json(campaigns);
    } catch (error) {
      console.error('Error searching campaigns:', error);
      res.status(500).json({ error: 'Failed to search campaigns' });
    }
  });

  // Get specific campaign details
  app.get('/api/knowbe4/campaigns/:campaignId', isAuthenticated, async (req, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      const campaign = await knowBe4Service.getCampaignById(campaignId);
      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }
      res.json(campaign);
    } catch (error) {
      console.error('Error fetching campaign:', error);
      res.status(500).json({ error: 'Failed to fetch campaign' });
    }
  });

  // Get campaign enrollments/participants
  app.get('/api/knowbe4/campaigns/:campaignId/participants', isAuthenticated, async (req, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      const participants = await knowBe4Service.getCampaignParticipants(campaignId);
      res.json(participants);
    } catch (error) {
      console.error('Error fetching campaign participants:', error);
      res.status(500).json({ error: 'Failed to fetch campaign participants' });
    }
  });

  // ===== KNOWBE4 GRAPH API ROUTES =====
  
  // Test Graph API connection
  app.get('/api/knowbe4/graph/test-connection', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const connectionTest = await knowBe4GraphService.testConnection();
      res.json(connectionTest);
    } catch (error) {
      console.error("KnowBe4 Graph API connection test error:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to test Graph API connection",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get user data via Graph API
  app.get('/api/knowbe4/graph/user/:email', isAuthenticated, async (req, res) => {
    try {
      const email = req.params.email;
      const user = await knowBe4GraphService.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ error: 'User not found in KnowBe4 Graph API' });
      }
      res.json(user);
    } catch (error) {
      console.error("KnowBe4 Graph API user fetch error:", error);
      res.status(500).json({ 
        message: "Failed to fetch user from Graph API",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get training campaigns via Graph API
  app.get('/api/knowbe4/graph/training-campaigns', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const campaigns = await knowBe4GraphService.getTrainingCampaigns();
      res.json(campaigns);
    } catch (error) {
      console.error("KnowBe4 Graph API training campaigns fetch error:", error);
      res.status(500).json({ 
        message: "Failed to fetch training campaigns from Graph API",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get phishing campaigns via Graph API
  app.get('/api/knowbe4/graph/phishing-campaigns', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const campaigns = await knowBe4GraphService.getPhishingCampaigns();
      res.json(campaigns);
    } catch (error) {
      console.error("KnowBe4 Graph API phishing campaigns fetch error:", error);
      res.status(500).json({ 
        message: "Failed to fetch phishing campaigns from Graph API",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Search campaigns via Graph API
  app.get('/api/knowbe4/graph/campaigns/search', isAuthenticated, async (req, res) => {
    try {
      const searchTerm = req.query.q as string;
      const campaignType = req.query.type as 'training' | 'phishing' | undefined;
      
      if (!searchTerm) {
        return res.status(400).json({ error: 'Search term is required' });
      }
      
      const campaigns = await knowBe4GraphService.searchCampaignsByName(searchTerm, campaignType);
      res.json(campaigns);
    } catch (error) {
      console.error('Error searching campaigns via Graph API:', error);
      res.status(500).json({ error: 'Failed to search campaigns' });
    }
  });

  // Sync user groups and employee types
  app.post('/api/sync-user-groups/:userId', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const user = await storage.getUser(userId);
      
      if (!user || !user.oktaId) {
        return res.status(404).json({ message: 'User not found or no OKTA ID' });
      }
      
      await syncUserGroupsAndEmployeeType(userId, user.oktaId);
      
      // Get updated user data
      const updatedUser = await storage.getUser(userId);
      
      res.json({
        success: true,
        message: `Groups and employee type synced for ${user.email}`,
        user: updatedUser
      });
    } catch (error) {
      console.error('Error syncing user groups:', error);
      res.status(500).json({ 
        message: 'Failed to sync user groups',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Sync all users' groups and employee types
  app.post('/api/sync-all-user-groups', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const result = await syncAllUsersGroupsAndEmployeeTypes();
      
      res.json({
        success: true,
        message: `Groups sync completed. Updated: ${result.updated}, Errors: ${result.errors}`,
        updated: result.updated,
        errors: result.errors
      });
    } catch (error) {
      console.error('Error syncing all user groups:', error);
      res.status(500).json({ 
        message: 'Failed to sync all user groups',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Bulk sync all users' groups and employee types with detailed reporting
  app.post('/api/bulk-sync-user-groups', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const result = await bulkSyncUserGroupsAndEmployeeTypes();
      
      res.json({
        success: true,
        message: `Bulk groups sync completed. Updated: ${result.updated}, Errors: ${result.errors}`,
        updated: result.updated,
        errors: result.errors,
        details: result.details.slice(0, 50) // Limit details to first 50 entries
      });
    } catch (error) {
      console.error('Error during bulk groups sync:', error);
      res.status(500).json({ 
        message: 'Failed to sync user groups',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get user training enrollments via Graph API
  app.get('/api/knowbe4/graph/user/:userId/training', isAuthenticated, async (req, res) => {
    try {
      const userId = req.params.userId;
      const enrollments = await knowBe4GraphService.getUserTrainingEnrollments(userId);
      res.json(enrollments);
    } catch (error) {
      console.error("KnowBe4 Graph API user training enrollments fetch error:", error);
      res.status(500).json({ 
        message: "Failed to fetch user training enrollments from Graph API",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get campaign enrollments
  app.get('/api/knowbe4/campaigns/:campaignId/enrollments', isAuthenticated, async (req, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      const enrollments = await knowBe4Service.getCampaignEnrollments(campaignId);
      res.json(enrollments);
    } catch (error) {
      console.error('Error fetching campaign enrollments:', error);
      res.status(500).json({ error: 'Failed to fetch campaign enrollments' });
    }
  });

  // Create OKTA group
  app.post('/api/okta/groups', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { groupName, description } = req.body;
      
      if (!groupName) {
        return res.status(400).json({ message: 'Group name is required' });
      }
      
      const createdGroup = await oktaService.createGroup(groupName, description);
      res.json(createdGroup);
    } catch (error) {
      console.error('Error creating OKTA group:', error);
      res.status(500).json({ 
        message: 'Failed to create OKTA group',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // CLIENT-SPECIFIC: Create group for client - also creates OKTA group if integration exists
  app.post('/api/client/:clientId/groups', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const { name, description } = req.body;
      
      if (!name || name.trim() === '') {
        return res.status(400).json({ message: 'Group name is required' });
      }
      
      // Get client database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      if (!clientDb) {
        return res.status(404).json({ error: 'Client database not found' });
      }
      
      console.log(`🔗 Creating group '${name}' for client ${clientId}`);
      
      // Check if client has OKTA integration
      const oktaIntegration = await clientDb.select().from(clientIntegrations)
        .where(eq(clientIntegrations.name, 'okta'))
        .limit(1);
      
      let oktaGroupResult = null;
      
      if (oktaIntegration.length > 0) {
        console.log(`🔗 OKTA integration found for client ${clientId}, creating OKTA group...`);
        
        try {
          oktaGroupResult = await createOktaGroup(
            oktaIntegration[0].apiKeys as Record<string, string>, 
            name, 
            description
          );
          
          if (oktaGroupResult.success) {
            console.log(`✅ OKTA group '${name}' created successfully for client ${clientId}`);
          } else {
            console.log(`⚠️  OKTA group creation failed but continuing: ${oktaGroupResult.message}`);
          }
        } catch (error) {
          console.error(`Failed to create OKTA group '${name}' for client ${clientId}:`, error);
          // Continue even if OKTA group creation fails - we still add it to field config
        }
      } else {
        console.log(`⚠️  No OKTA integration found for client ${clientId}, creating group in field config only`);
      }
      
      // Add group to groups field configuration
      const groupsConfig = await clientDb.select().from(clientLayoutSettings)
        .where(eq(clientLayoutSettings.settingKey, 'groups'))
        .limit(1);
      
      let currentGroups: string[] = [];
      if (groupsConfig.length > 0) {
        try {
          const parsedConfig = JSON.parse(groupsConfig[0].settingValue || '{"options":[]}');
          currentGroups = parsedConfig.options || [];
        } catch (e) {
          console.error('Failed to parse existing groups config:', e);
        }
      }
      
      // Add new group if not already present
      if (!currentGroups.includes(name)) {
        currentGroups.push(name);
        
        const updatedConfig = {
          required: false,
          useList: true,
          options: currentGroups,
          hideField: false
        };
        
        if (groupsConfig.length > 0) {
          // Update existing configuration
          await clientDb.update(clientLayoutSettings)
            .set({
              settingValue: JSON.stringify(updatedConfig),
              updatedAt: new Date()
            })
            .where(eq(clientLayoutSettings.settingKey, 'groups'));
        } else {
          // Create new configuration
          await clientDb.insert(clientLayoutSettings).values({
            settingKey: 'groups',
            settingValue: JSON.stringify(updatedConfig),
            settingType: 'json'
          });
        }
        
        console.log(`✅ Group '${name}' added to field configuration for client ${clientId}`);
      }
      
      res.json({
        success: true,
        groupName: name,
        oktaResult: oktaGroupResult,
        addedToFieldConfig: !currentGroups.includes(name)
      });
      
    } catch (error) {
      console.error(`Error creating group for client ${req.params.clientId}:`, error);
      res.status(500).json({ 
        message: 'Failed to create group',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // REMOVED: Global site access users endpoints - All site access users should be client-specific for multi-tenant data isolation

  // REMOVED: Global site access users PUT and DELETE endpoints - All site access users should be client-specific for multi-tenant data isolation

  // Integrations routes - REMOVED: All integration operations are now client-specific

  // Client-specific integrations endpoint
  app.get("/api/client/:clientId/integrations", isAuthenticated, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      console.log(`🔗 Fetching integrations for client ${clientId}`);
      
      // Use client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      const integrationsData = await clientDb.select().from(clientIntegrations);
      
      console.log(`✅ Found ${integrationsData.length} integrations for client ${clientId}`);
      res.json(integrationsData);
    } catch (error) {
      console.error(`Error fetching integrations for client:`, error);
      res.status(500).json({ error: "Failed to fetch client integrations" });
    }
  });

  // Client-specific integrations POST endpoint
  app.post("/api/client/:clientId/integrations", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const integrationData = clientInsertIntegrationSchema.parse(req.body);
      console.log(`🔗 Creating integration for client ${clientId}:`, integrationData.name);
      
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      
      const [result] = await clientDb.insert(clientIntegrations)
        .values(integrationData)
        .returning();
      
      console.log(`✅ Created integration for client ${clientId}:`, result);
      res.json(result);
    } catch (error) {
      console.error("Error creating integration for client:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create client integration" });
    }
  });

  // Client-specific integrations PUT endpoint
  app.put("/api/client/:clientId/integrations/:integrationId", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const integrationId = parseInt(req.params.integrationId);
      const integrationData = clientInsertIntegrationSchema.parse(req.body);
      console.log(`🔗 Updating integration ${integrationId} for client ${clientId}`);
      
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      
      const [result] = await clientDb.update(clientIntegrations)
        .set(integrationData)
        .where(eq(clientIntegrations.id, integrationId))
        .returning();
      
      if (!result) {
        return res.status(404).json({ error: "Integration not found" });
      }
      
      console.log(`✅ Updated integration for client ${clientId}:`, result);
      res.json(result);
    } catch (error) {
      console.error("Error updating integration for client:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update client integration" });
    }
  });

  // Client-specific integrations DELETE endpoint
  app.delete("/api/client/:clientId/integrations/:integrationId", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const integrationId = parseInt(req.params.integrationId);
      console.log(`🔗 Deleting integration ${integrationId} for client ${clientId}`);
      
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      
      const result = await clientDb.delete(clientIntegrations)
        .where(eq(clientIntegrations.id, integrationId))
        .returning();
      
      if (result.length === 0) {
        return res.status(404).json({ error: "Integration not found" });
      }
      
      console.log(`✅ Deleted integration for client ${clientId}`);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting integration for client:", error);
      res.status(500).json({ error: "Failed to delete client integration" });
    }
  });

  // REMOVED: Global integration POST - All integration operations are now client-specific

  // Client-specific integration test connection endpoint
  app.post("/api/client/:clientId/integrations/:integrationId/test", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const integrationId = parseInt(req.params.integrationId);
      console.log(`🧪 Testing connection for integration ${integrationId} in client ${clientId}`);
      
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      
      // Get the integration to test
      const [integration] = await clientDb.select()
        .from(clientIntegrations)
        .where(eq(clientIntegrations.id, integrationId));
      
      if (!integration) {
        return res.status(404).json({ error: "Integration not found" });
      }

      let testResult = { success: false, message: "Unknown integration type" };

      // Test based on integration type
      switch (integration.name.toLowerCase()) {
        case 'okta':
          testResult = await testOktaConnection(integration.apiKeys as Record<string, string>);
          break;
        case 'sentinelone':
          testResult = await testSentinelOneConnection(integration.apiKeys as Record<string, string>);
          break;
        case 'jira':
          testResult = await testJiraConnection(integration.apiKeys as Record<string, string>);
          break;
        default:
          testResult = { success: false, message: `Testing not implemented for ${integration.name}` };
      }

      // Update integration status based on test result
      const newStatus = testResult.success ? 'connected' : 'disconnected';
      const [updatedIntegration] = await clientDb.update(clientIntegrations)
        .set({ 
          status: newStatus,
          lastUpdated: new Date()
        })
        .where(eq(clientIntegrations.id, integrationId))
        .returning();

      console.log(`✅ Test completed for integration ${integrationId}: ${testResult.success ? 'SUCCESS' : 'FAILED'}`);
      
      res.json({
        success: testResult.success,
        message: testResult.message,
        integration: updatedIntegration
      });

    } catch (error) {
      console.error("Error testing integration connection:", error);
      res.status(500).json({ error: "Failed to test integration connection" });
    }
  });

  // Client-specific OKTA user sync endpoint
  app.post("/api/client/:clientId/okta/sync-users", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      console.log(`👥 Starting OKTA user sync for client ${clientId}`);
      
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      
      // Get OKTA integration for this client
      const [oktaIntegration] = await clientDb.select()
        .from(clientIntegrations)
        .where(and(
          eq(clientIntegrations.name, 'okta'),
          eq(clientIntegrations.status, 'connected')
        ));
      
      if (!oktaIntegration) {
        return res.status(404).json({ error: "OKTA integration not found or not connected" });
      }

      const oktaUsers = await fetchOktaUsers(oktaIntegration.apiKeys as Record<string, string>);
      if (!oktaUsers.success || !oktaUsers.users) {
        return res.status(400).json({ error: oktaUsers.message });
      }

      // Sync users to local database
      const syncResult = await syncUsersToDatabase(clientDb, oktaUsers.users);
      
      console.log(`✅ OKTA sync completed for client ${clientId}: ${syncResult.newUsers} new, ${syncResult.updatedUsers} updated`);
      
      res.json({
        success: true,
        message: "OKTA user sync completed successfully",
        totalUsers: oktaUsers.users.length,
        newUsers: syncResult.newUsers,
        updatedUsers: syncResult.updatedUsers
      });

    } catch (error) {
      console.error("Error syncing OKTA users:", error);
      res.status(500).json({ error: "Failed to sync OKTA users" });
    }
  });

  // Client-specific OKTA user statistics endpoint
  app.get("/api/client/:clientId/okta/users/stats", isAuthenticated, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      console.log(`📊 Fetching OKTA user statistics for client ${clientId}`);
      
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      
      // Get OKTA integration for this client
      const [oktaIntegration] = await clientDb.select()
        .from(clientIntegrations)
        .where(and(
          eq(clientIntegrations.name, 'okta'),
          eq(clientIntegrations.status, 'connected')
        ));
      
      if (!oktaIntegration) {
        console.log(`❌ No OKTA integration found for client ${clientId}`);
        return res.json({
          activeUsers: 0,
          totalUsers: 0,
          lockedOutUsers: 0,
          error: "OKTA integration not found or not connected"
        });
      }

      // Fetch users from OKTA using client-specific API keys
      const oktaUsers = await fetchOktaUsers(oktaIntegration.apiKeys as Record<string, string>);
      
      if (!oktaUsers.success || !oktaUsers.users) {
        console.log(`❌ Failed to fetch OKTA users for client ${clientId}: ${oktaUsers.message}`);
        return res.json({
          activeUsers: 0,
          totalUsers: 0,
          lockedOutUsers: 0,
          error: oktaUsers.message || "Failed to fetch OKTA users"
        });
      }

      // Calculate user statistics
      const totalUsers = oktaUsers.users.length;
      const activeUsers = oktaUsers.users.filter(user => 
        user.status === 'ACTIVE' || user.status === 'PROVISIONED'
      ).length;
      const lockedOutUsers = oktaUsers.users.filter(user => 
        user.status === 'LOCKED_OUT'
      ).length;

      console.log(`📊 OKTA stats for client ${clientId}: ${activeUsers}/${totalUsers} active, ${lockedOutUsers} locked`);

      res.json({
        activeUsers,
        totalUsers,
        lockedOutUsers
      });

    } catch (error) {
      console.error(`Error fetching OKTA user statistics for client ${req.params.clientId}:`, error);
      res.status(500).json({
        activeUsers: 0,
        totalUsers: 0,
        lockedOutUsers: 0,
        error: "Failed to fetch OKTA user statistics"
      });
    }
  });

  // Client-specific OKTA users endpoint (read-only from OKTA)
  app.get("/api/client/:clientId/okta/users", isAuthenticated, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      console.log(`👥 Fetching OKTA users for client ${clientId}`);
      
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      
      // Get OKTA integration for this client
      const [oktaIntegration] = await clientDb.select()
        .from(clientIntegrations)
        .where(and(
          eq(clientIntegrations.name, 'okta'),
          eq(clientIntegrations.status, 'connected')
        ));
      
      if (!oktaIntegration) {
        return res.status(404).json({ error: "OKTA integration not found or not connected" });
      }

      const oktaUsers = await fetchOktaUsers(oktaIntegration.apiKeys as Record<string, string>);
      if (!oktaUsers.success || !oktaUsers.users) {
        return res.status(400).json({ error: oktaUsers.message });
      }
      
      res.json({
        users: oktaUsers.users,
        total: oktaUsers.users.length,
        source: 'okta'
      });

    } catch (error) {
      console.error("Error fetching OKTA users:", error);
      res.status(500).json({ error: "Failed to fetch OKTA users" });
    }
  });

  // REMOVED: Global integration PUT/DELETE - All integration operations are now client-specific

  // REMOVED: Global audit logs endpoint - All audit logs are now client-specific
  
  // Client-specific audit logs endpoint
  app.get("/api/client/:clientId/audit-logs", isAuthenticated, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      console.log(`📋 Fetching audit logs for client ${clientId}`);
      
      // Get client database connection and create storage
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      const { ClientStorage } = await import("./client-storage");
      const clientStorage = new ClientStorage(clientId);
      
      // Parse query parameters for filtering
      const options: any = {};
      if (req.query.userId) options.userId = parseInt(req.query.userId as string);
      if (req.query.action) options.action = req.query.action as string;
      if (req.query.resourceType) options.resourceType = req.query.resourceType as string;
      if (req.query.limit) options.limit = parseInt(req.query.limit as string);
      if (req.query.offset) options.offset = parseInt(req.query.offset as string);
      
      const result = await clientStorage.getAuditLogs(options);
      
      console.log(`✅ Found ${result.logs.length} audit logs for client ${clientId} (total: ${result.total})`);
      res.json(result);
    } catch (error) {
      console.error(`Error fetching audit logs for client:`, error);
      res.status(500).json({ error: "Failed to fetch client audit logs" });
    }
  });

  // MSP-specific audit logs endpoint
  app.get("/api/msp/audit-logs", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      console.log(`📋 Fetching MSP audit logs`);
      
      // Parse query parameters for filtering
      const options: any = {};
      if (req.query.clientId) options.clientId = parseInt(req.query.clientId as string);
      if (req.query.mspUserId) options.mspUserId = parseInt(req.query.mspUserId as string);
      if (req.query.action) options.action = req.query.action as string;
      if (req.query.resourceType) options.resourceType = req.query.resourceType as string;
      if (req.query.limit) options.limit = parseInt(req.query.limit as string);
      if (req.query.offset) options.offset = parseInt(req.query.offset as string);
      
      const mspStorage = storage.getMspStorage();
      const result = await mspStorage.getMspAuditLogs(options);
      
      console.log(`✅ Found ${result.logs.length} MSP audit logs (total: ${result.total})`);
      res.json(result);
    } catch (error) {
      console.error(`Error fetching MSP audit logs:`, error);
      res.status(500).json({ error: "Failed to fetch MSP audit logs" });
    }
  });

  // App Mappings API endpoints

  // REMOVED: Global app mappings GET - All app mappings are now client-specific

  // Client-specific app mappings endpoint
  app.get("/api/client/:clientId/app-mappings", isAuthenticated, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      console.log(`📱 Fetching app mappings for client ${clientId}`);
      
      // Use client-specific database connection  
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      const mappings = await clientDb.select().from(appMappings).orderBy(desc(appMappings.created));
      
      console.log(`✅ Found ${mappings.length} app mappings for client ${clientId}`);
      res.json(mappings);
    } catch (error) {
      console.error(`Error fetching app mappings for client:`, error);
      res.status(500).json({ error: "Failed to fetch client app mappings" });
    }
  });

  // REMOVED: Global app mappings POST and bulk POST - All app mappings are now client-specific

  // REMOVED: Global app mappings PUT - All app mappings are now client-specific

  // REMOVED: Global app mappings DELETE - All app mappings are now client-specific

  // Get OKTA group for specific app (helper endpoint for user creation)
  app.get("/api/app-mappings/lookup/:appName", isAuthenticated, async (req, res) => {
    try {
      const appName = req.params.appName;
      const mapping = await db.select().from(appMappings)
        .where(eq(appMappings.appName, appName));
      
      const activeMapping = mapping.find(m => m.status === "active");
      
      if (!activeMapping) {
        return res.status(404).json({ message: "App mapping not found" });
      }

      res.json({ oktaGroupName: activeMapping.oktaGroupName });
    } catch (error) {
      console.error("Error looking up app mapping:", error);
      res.status(500).json({ message: "Failed to lookup app mapping" });
    }
  });

  // Layout settings endpoints
  // REMOVED: Global layout settings - All layout settings are now client-specific

  // Client-specific layout settings endpoint
  app.get("/api/client/:clientId/layout-settings", isAuthenticated, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      console.log(`⚙️  Fetching layout settings for client ${clientId}`);
      
      // Use client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      const settings = await clientDb.select().from(clientLayoutSettings).orderBy(clientLayoutSettings.settingKey);
      
      console.log(`✅ Found ${settings.length} layout settings for client ${clientId}`);
      res.json(settings);
    } catch (error) {
      console.error(`Error fetching layout settings for client:`, error);
      res.status(500).json({ error: "Failed to fetch client layout settings" });
    }
  });

  // REMOVED: Global layout setting by key - All layout settings are now client-specific

  // Client-specific layout setting by key endpoint
  app.get("/api/client/:clientId/layout-settings/:key", isAuthenticated, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const { key } = req.params;
      console.log(`⚙️  Fetching layout setting '${key}' for client ${clientId}`);
      
      // Use client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      const setting = await clientDb.select()
        .from(clientLayoutSettings)
        .where(eq(clientLayoutSettings.settingKey, key))
        .limit(1);
      
      if (setting.length === 0) {
        console.log(`❌ Layout setting '${key}' not found for client ${clientId}`);
        return res.status(404).json({ error: "Setting not found" });
      }
      
      console.log(`✅ Found layout setting '${key}' for client ${clientId}`);
      res.json(setting[0]);
    } catch (error) {
      console.error(`Error fetching layout setting for client:`, error);
      res.status(500).json({ error: "Failed to fetch client layout setting" });
    }
  });

  // Client-specific layout setting UPDATE by key endpoint (MISSING ENDPOINT ADDED)
  app.put("/api/client/:clientId/layout-settings/:key", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const { key } = req.params;
      const { settingKey, settingValue, settingType } = req.body;
      const user = (req.session as any).user;
      console.log(`⚙️  Updating layout setting '${key}' for client ${clientId}:`, {
        settingKey,
        settingValue,
        settingType,
        bodyReceived: req.body
      });
      
      // Use client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      
      // Check if setting already exists
      const existing = await clientDb.select()
        .from(clientLayoutSettings)
        .where(eq(clientLayoutSettings.settingKey, key))
        .limit(1);
      
      let result;
      if (existing.length > 0) {
        // Update existing setting
        [result] = await clientDb.update(clientLayoutSettings)
          .set({ 
            settingValue: settingValue,
            settingType: settingType || 'text',
            updatedBy: user.id,
            updatedAt: new Date()
          })
          .where(eq(clientLayoutSettings.settingKey, key))
          .returning();
        console.log(`✅ Updated layout setting '${key}' for client ${clientId}`);
      } else {
        // Create new setting
        [result] = await clientDb.insert(clientLayoutSettings)
          .values({
            settingKey: key,
            settingValue: settingValue,
            settingType: settingType || 'text',
            updatedBy: user.id,
            updatedAt: new Date()
          })
          .returning();
        console.log(`✅ Created layout setting '${key}' for client ${clientId}`);
      }
      
      res.json(result);
    } catch (error) {
      console.error(`Error updating layout setting for client:`, error);
      res.status(500).json({ error: "Failed to update client layout setting" });
    }
  });

  // Client-specific layout settings POST endpoint
  app.post("/api/client/:clientId/layout-settings", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const user = (req.session as any).user;
      const validatedData = clientInsertLayoutSettingSchema.parse(req.body);
      console.log(`⚙️  Saving layout setting for client ${clientId}:`, validatedData.settingKey);
      console.log('🔴 SERVER RECEIVED DATA TO SAVE:', {
        settingKey: validatedData.settingKey,
        settingValue: validatedData.settingValue,
        settingValueParsed: (() => {
          try {
            return JSON.parse(validatedData.settingValue);
          } catch(e) {
            return 'PARSE_ERROR';
          }
        })(),
        clientId
      });
      
      // Use client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      const { ClientStorage } = await import("./client-storage");
      const clientStorage = new ClientStorage(clientId);
      
      // Check if setting already exists
      const existing = await clientDb.select()
        .from(clientLayoutSettings)
        .where(eq(clientLayoutSettings.settingKey, validatedData.settingKey))
        .limit(1);
      
      // Store old value for audit logging
      const oldValue = existing.length > 0 ? existing[0].settingValue : null;
      
      let result;
      const isUpdate = existing.length > 0;
      
      if (isUpdate) {
        // Update existing setting
        [result] = await clientDb.update(clientLayoutSettings)
          .set({ 
            ...validatedData, 
            updatedBy: user.id,
            updatedAt: new Date()
          })
          .where(eq(clientLayoutSettings.settingKey, validatedData.settingKey))
          .returning();
        console.log(`✅ Updated layout setting for client ${clientId}`);
      } else {
        // Create new setting
        [result] = await clientDb.insert(clientLayoutSettings)
          .values({ ...validatedData, updatedBy: user.id })
          .returning();
        console.log(`✅ Created layout setting for client ${clientId}`);
      }

      // ADD AUDIT LOGGING for layout setting changes
      try {
        const settingDisplayName = validatedData.settingKey === 'logo_background_color' ? 'Logo Background Color' :
                                  validatedData.settingKey === 'employeeType' ? 'Employee Type Field Configuration' :
                                  validatedData.settingKey === 'department' ? 'Department Field Configuration' :
                                  validatedData.settingKey === 'logo_text' ? 'Logo Text' :
                                  validatedData.settingKey === 'logo_text_visible' ? 'Logo Text Visibility' :
                                  `Layout Setting: ${validatedData.settingKey}`;

        await clientStorage.logAudit({
          userId: user.id,
          userEmail: user.email,
          action: isUpdate ? 'UPDATED' : 'CREATED',
          resourceType: 'layout_setting',
          resourceId: result.id.toString(),
          resourceName: settingDisplayName,
          details: {
            settingKey: validatedData.settingKey,
            action: isUpdate ? 'updated' : 'created'
          },
          oldValues: oldValue ? { settingValue: oldValue } : {},
          newValues: { settingValue: validatedData.settingValue },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });

        console.log(`📋 Audit logged: ${settingDisplayName} ${isUpdate ? 'updated' : 'created'} by ${user.email}`);
      } catch (auditError) {
        console.error('Failed to log audit entry for layout setting change:', auditError);
        // Don't fail the request if audit logging fails
      }

      // AUTOMATIC OKTA SECURITY GROUP CREATION FOR EMPLOYEE TYPES
      if (validatedData.settingKey === 'employeeType') {
        console.log(`🔐 Processing employee type field configuration for automatic OKTA security group creation`);
        
        try {
          // Parse the employee type options
          const settingValue = typeof validatedData.settingValue === 'string' 
            ? JSON.parse(validatedData.settingValue) 
            : validatedData.settingValue;
          
          const employeeTypes = settingValue?.options || [];
          
          if (employeeTypes.length > 0) {
            // Get client information for company initials  
            const client = await db.select({
              id: clients.id,
              name: clients.name,
              companyInitials: clients.companyInitials
            }).from(clients)
              .where(eq(clients.id, clientId))
              .limit(1);
            
            if (client.length > 0) {
              const clientName = client[0].name;
              // Use stored company initials, fallback to deriving from name if not set
              const companyInitials = client[0].companyInitials || 
                                    clientName.match(/[A-Z]/g)?.join('') || 
                                    clientName.split(' ').map(word => word.charAt(0).toUpperCase()).join('');
              
              console.log(`🏢 Client: ${clientName} → Company Initials: ${companyInitials}`);
              
              // Check if client has OKTA integration (use correct schema)
              const { integrations } = await import('../shared/client-schema');
              const oktaIntegration = await clientDb.select({
                id: integrations.id,
                name: integrations.name,
                apiKeys: integrations.apiKeys
              }).from(integrations)
                .where(eq(integrations.name, 'okta'))
                .limit(1);
              
              if (oktaIntegration.length > 0) {
                console.log(`🔐 OKTA integration found for client ${clientId}, creating security groups for employee types...`);
                
                const oktaResults = [];
                
                for (const employeeType of employeeTypes) {
                  if (employeeType && employeeType.trim() !== '') {
                    const securityGroupName = `${companyInitials}-ET-${employeeType.toUpperCase().replace(/\s+/g, '')}`;
                    
                    try {
                      const { createOktaGroup } = await import('./client-okta-service');
                      const oktaGroupResult = await createOktaGroup(
                        oktaIntegration[0].apiKeys as Record<string, string>, 
                        securityGroupName, 
                        `Security group for ${employeeType} employee type`
                      );
                      
                      oktaResults.push({
                        employeeType,
                        groupName: securityGroupName,
                        ...oktaGroupResult
                      });
                      
                      if (oktaGroupResult.success) {
                        if (oktaGroupResult.exists) {
                          console.log(`✅ OKTA security group '${securityGroupName}' already exists (${employeeType})`);
                        } else {
                          console.log(`✅ Created OKTA security group '${securityGroupName}' (${employeeType})`);
                        }
                      } else {
                        console.log(`⚠️ Failed to create OKTA security group '${securityGroupName}' (${employeeType}): ${oktaGroupResult.message}`);
                      }
                    } catch (error) {
                      console.error(`❌ Error creating OKTA security group '${securityGroupName}' (${employeeType}):`, error);
                      oktaResults.push({
                        employeeType,
                        groupName: securityGroupName,
                        success: false,
                        message: error instanceof Error ? error.message : 'Unknown error'
                      });
                    }
                  }
                }
                
                console.log(`🔐 Completed automatic OKTA security group creation for ${oktaResults.length} employee types`);
                
                // Add OKTA results to response for transparency
                (result as any).oktaSecurityGroups = oktaResults;
              } else {
                console.log(`⚠️ No OKTA integration found for client ${clientId}, skipping security group creation`);
                (result as any).oktaSecurityGroups = { message: 'No OKTA integration configured' };
              }
            }
          }
        } catch (error) {
          console.error(`❌ Error in automatic OKTA security group creation:`, error);
          // Don't fail the main operation - just log the error
          (result as any).oktaSecurityGroups = { 
            error: error instanceof Error ? error.message : 'Unknown error in OKTA group creation' 
          };
        }
      }
      
      res.json(result);
    } catch (error) {
      console.error("Error saving layout setting for client:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to save client layout setting" });
    }
  });

  // REMOVED: Global layout settings DELETE - All layout settings are now client-specific

  // REMOVED: Global field settings GET - All field settings are now client-specific

  // REMOVED: Global field settings POST - All field settings are now client-specific

  // REMOVED: Global dashboard cards GET - Client-specific endpoint exists at /api/client/:clientId/dashboard-cards

  // Client-specific dashboard cards route
  app.get("/api/client/:clientId/dashboard-cards", isAuthenticated, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      console.log(`📊 Fetching dashboard cards for client ${clientId}`);
      
      // Use client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      const cards = await clientDb.select().from(clientDashboardCards).orderBy(clientDashboardCards.position);
      
      console.log(`✅ Found ${cards.length} dashboard cards for client ${clientId}`);
      res.json(cards);
    } catch (error) {
      console.error("Error fetching client dashboard cards:", error);
      res.status(500).json({ error: "Failed to fetch dashboard cards" });
    }
  });

  // Client-specific dashboard cards POST route
  app.post("/api/client/:clientId/dashboard-cards", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      console.log(`📊 Creating dashboard card for client ${clientId}:`, req.body);
      
      // Use client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      
      const cardData = {
        name: req.body.name,
        type: req.body.type,
        description: req.body.description,
        enabled: req.body.enabled !== false,
        position: req.body.position || 999
      };
      
      const [result] = await clientDb
        .insert(clientDashboardCards)
        .values(cardData)
        .returning();
      
      console.log(`✅ Created dashboard card for client ${clientId}:`, result);
      res.json(result);
    } catch (error) {
      console.error("Error creating client dashboard card:", error);
      res.status(500).json({ error: "Failed to create dashboard card" });
    }
  });

  // Client-specific bulk update dashboard card positions (for drag and drop)
  app.patch("/api/client/:clientId/dashboard-cards/positions", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const { cards } = req.body;
      
      console.log(`🔄 Updating dashboard card positions for client ${clientId}:`, cards.length, 'cards');
      
      // Use client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      
      // Update each card position for the specific client
      for (const card of cards) {
        await clientDb
          .update(clientDashboardCards)
          .set({ position: card.position, updated: new Date() })
          .where(eq(clientDashboardCards.id, card.id));
      }
      
      // Fetch updated cards to return
      const updatedCards = await clientDb
        .select()
        .from(clientDashboardCards)
        .orderBy(clientDashboardCards.position);
      
      console.log('✅ All card positions updated successfully for client', clientId, ':', updatedCards.map(c => ({ id: c.id, name: c.name, position: c.position })));
      
      res.json(updatedCards);
    } catch (error) {
      console.error("Error updating client dashboard card positions:", error);
      res.status(500).json({ error: "Failed to update card positions" });
    }
  });

  // Bulk update dashboard card positions (for drag and drop) - MUST come before /:id route
  app.patch("/api/dashboard-cards/positions", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      console.log('🔄 BULK UPDATE ENDPOINT HIT - Raw request body:', req.body);
      console.log('🔄 Session user:', (req.session as any)?.user?.email);
      console.log('🔄 User role:', (req.session as any)?.user?.role);
      
      const { cards } = req.body;
      console.log('🔄 Extracted cards:', cards);
      
      if (!Array.isArray(cards)) {
        console.error('❌ Cards is not an array:', typeof cards, cards);
        return res.status(400).json({ error: "Cards must be an array" });
      }

      // Update positions in bulk
      console.log('🔄 Processing card updates:', cards);
      const updates = await Promise.all(
        cards.map(async (card: any) => {
          console.log('📝 Processing card:', card);
          
          // Ensure we have valid numbers
          const id = typeof card.id === 'number' ? card.id : parseInt(String(card.id));
          const position = typeof card.position === 'number' ? card.position : parseInt(String(card.position));
          
          if (isNaN(id) || isNaN(position)) {
            console.error(`❌ Invalid card data: id=${card.id} (${typeof card.id}), position=${card.position} (${typeof card.position})`);
            throw new Error(`Invalid card data: id=${card.id}, position=${card.position}`);
          }
          
          console.log(`🔄 Updating card ${id} to position ${position}`);
          const [result] = await db.update(dashboardCards)
            .set({ position, updated: new Date() })
            .where(eq(dashboardCards.id, id))
            .returning();
          
          console.log(`✅ Updated card ${id}:`, result);
          return result;
        })
      );

      await AuditLogger.log({
        req,
        action: 'UPDATE',
        resourceType: 'DASHBOARD_LAYOUT',
        resourceId: 'bulk_position_update',
        resourceName: 'Dashboard Card Positions',
        details: { cardCount: cards.length },
        newValues: { positions: cards }
      });

      console.log('✅ All card positions updated successfully:', updates);
      res.json(updates);
    } catch (error) {
      console.error("Error updating dashboard card positions:", error);
      res.status(500).json({ error: "Failed to update dashboard card positions" });
    }
  });

  app.patch("/api/dashboard-cards/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid card ID" });
      }
      const updates = updateDashboardCardSchema.parse(req.body);
      
      const existing = await db.select().from(dashboardCards).where(eq(dashboardCards.id, id)).limit(1);
      if (existing.length === 0) {
        return res.status(404).json({ error: "Dashboard card not found" });
      }
      
      const [result] = await db.update(dashboardCards)
        .set({ ...updates, updated: new Date() })
        .where(eq(dashboardCards.id, id))
        .returning();
      
      await AuditLogger.log({
        req,
        action: 'UPDATE',
        resourceType: 'DASHBOARD_CARD',
        resourceId: result.id.toString(),
        resourceName: result.name,
        details: { type: result.type, position: result.position },
        oldValues: existing[0],
        newValues: result
      });
      
      res.json(result);
    } catch (error) {
      console.error("Error updating dashboard card:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update dashboard card" });
    }
  });

  app.delete("/api/dashboard-cards/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid card ID" });
      }
      
      const existing = await db.select().from(dashboardCards).where(eq(dashboardCards.id, id)).limit(1);
      if (existing.length === 0) {
        return res.status(404).json({ error: "Dashboard card not found" });
      }
      
      await db.delete(dashboardCards).where(eq(dashboardCards.id, id));
      
      await AuditLogger.log({
        req,
        action: 'DELETE',
        resourceType: 'DASHBOARD_CARD',
        resourceId: existing[0].id.toString(),
        resourceName: existing[0].name,
        details: { type: existing[0].type, position: existing[0].position },
        oldValues: existing[0]
      });
      
      res.json({ message: "Dashboard card deleted successfully" });
    } catch (error) {
      console.error("Error deleting dashboard card:", error);
      res.status(500).json({ error: "Failed to delete dashboard card" });
    }
  });

  // Monitoring cards endpoints
  // REMOVED: Global monitoring cards GET - Client-specific endpoint exists at /api/client/:clientId/monitoring-cards

  // Client-specific monitoring cards endpoint
  app.get("/api/client/:clientId/monitoring-cards", isAuthenticated, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      console.log(`📊 Fetching monitoring cards for client ${clientId}`);
      
      // Use client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      const cards = await clientDb.select().from(monitoringCards).orderBy(monitoringCards.position);
      
      console.log(`✅ Found ${cards.length} monitoring cards for client ${clientId}`);
      res.json(cards);
    } catch (error) {
      console.error(`Error fetching monitoring cards for client:`, error);
      res.status(500).json({ error: "Failed to fetch client monitoring cards" });
    }
  });

  // Client-specific department app mappings endpoints
  app.get("/api/client/:clientId/department-app-mappings", isAuthenticated, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      console.log(`📱 Fetching department app mappings for client ${clientId}`);
      
      // Use client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      const mappings = await clientDb.select().from(clientDepartmentAppMappings);
      
      console.log(`✅ Found ${mappings.length} department app mappings for client ${clientId}`);
      res.json(mappings);
    } catch (error) {
      console.error(`Error fetching department app mappings for client:`, error);
      res.status(500).json({ error: "Failed to fetch department app mappings" });
    }
  });

  app.get("/api/client/:clientId/employee-type-app-mappings", isAuthenticated, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      console.log(`📱 Fetching employee type app mappings for client ${clientId}`);
      
      // Use client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      const mappings = await clientDb.select().from(clientEmployeeTypeAppMappings);
      
      console.log(`✅ Found ${mappings.length} employee type app mappings for client ${clientId}`);
      res.json(mappings);
    } catch (error) {
      console.error(`Error fetching employee type app mappings for client:`, error);
      res.status(500).json({ error: "Failed to fetch employee type app mappings" });
    }
  });

  app.get("/api/client/:clientId/department-group-mappings", isAuthenticated, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      console.log(`📧 Fetching department group mappings for client ${clientId}`);
      
      // Use client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      const mappings = await clientDb.select().from(clientDepartmentGroupMappings);
      
      console.log(`✅ Found ${mappings.length} department group mappings for client ${clientId}`);
      res.json(mappings);
    } catch (error) {
      console.error(`Error fetching department group mappings for client:`, error);
      res.status(500).json({ error: "Failed to fetch department group mappings" });
    }
  });

  app.get("/api/client/:clientId/employee-type-group-mappings", isAuthenticated, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      console.log(`📧 Fetching employee type group mappings for client ${clientId}`);
      
      // Use client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      const mappings = await clientDb.select().from(clientEmployeeTypeGroupMappings);
      
      console.log(`✅ Found ${mappings.length} employee type group mappings for client ${clientId}`);
      res.json(mappings);
    } catch (error) {
      console.error(`Error fetching employee type group mappings for client:`, error);
      res.status(500).json({ error: "Failed to fetch employee type group mappings" });
    }
  });

  app.post("/api/client/:clientId/department-app-mappings", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const { departmentName, appName } = req.body;
      console.log(`➕ Adding department app mapping for client ${clientId}: ${departmentName} -> ${appName}`);
      
      // Validate input data
      const validatedData = clientInsertDepartmentAppMappingSchema.parse({ departmentName, appName });
      
      // Use client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      
      // Check if mapping already exists
      const existing = await clientDb.select().from(clientDepartmentAppMappings)
        .where(and(eq(clientDepartmentAppMappings.departmentName, departmentName), eq(clientDepartmentAppMappings.appName, appName)))
        .limit(1);
      
      if (existing.length > 0) {
        return res.status(409).json({ error: "Mapping already exists" });
      }
      
      // Insert new mapping
      const [result] = await clientDb.insert(clientDepartmentAppMappings)
        .values(validatedData)
        .returning();
      
      console.log(`✅ Added department app mapping for client ${clientId}: ${departmentName} -> ${appName}`);
      res.status(201).json(result);
    } catch (error) {
      console.error(`Error adding department app mapping for client:`, error);
      res.status(500).json({ error: "Failed to add department app mapping" });
    }
  });

  app.delete("/api/client/:clientId/department-app-mappings", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const { departmentName, appName } = req.body;
      console.log(`🗑️  Removing department app mapping for client ${clientId}: ${departmentName} -> ${appName}`);
      
      // Use client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      
      const result = await clientDb.delete(clientDepartmentAppMappings)
        .where(and(eq(clientDepartmentAppMappings.departmentName, departmentName), eq(clientDepartmentAppMappings.appName, appName)))
        .returning();
      
      if (result.length === 0) {
        return res.status(404).json({ error: "Mapping not found" });
      }
      
      console.log(`✅ Removed department app mapping for client ${clientId}: ${departmentName} -> ${appName}`);
      res.status(200).json({ message: "Mapping deleted successfully" });
    } catch (error) {
      console.error(`Error removing department app mapping for client:`, error);
      res.status(500).json({ error: "Failed to remove department app mapping" });
    }
  });

  app.post("/api/client/:clientId/employee-type-app-mappings", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const { employeeType, appName } = req.body;
      console.log(`➕ Adding employee type app mapping for client ${clientId}: ${employeeType} -> ${appName}`);
      
      // Validate input data
      const validatedData = clientInsertEmployeeTypeAppMappingSchema.parse({ employeeType, appName });
      
      // Use client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      
      // Check if mapping already exists
      const existing = await clientDb.select().from(clientEmployeeTypeAppMappings)
        .where(and(eq(clientEmployeeTypeAppMappings.employeeType, employeeType), eq(clientEmployeeTypeAppMappings.appName, appName)))
        .limit(1);
      
      if (existing.length > 0) {
        return res.status(409).json({ error: "Mapping already exists" });
      }
      
      // Insert new mapping
      const [result] = await clientDb.insert(clientEmployeeTypeAppMappings)
        .values(validatedData)
        .returning();
      
      console.log(`✅ Added employee type app mapping for client ${clientId}: ${employeeType} -> ${appName}`);
      res.status(201).json(result);
    } catch (error) {
      console.error(`Error adding employee type app mapping for client:`, error);
      res.status(500).json({ error: "Failed to add employee type app mapping" });
    }
  });

  app.delete("/api/client/:clientId/employee-type-app-mappings", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const { employeeType, appName } = req.body;
      console.log(`🗑️  Removing employee type app mapping for client ${clientId}: ${employeeType} -> ${appName}`);
      
      // Use client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      
      const result = await clientDb.delete(clientEmployeeTypeAppMappings)
        .where(and(eq(clientEmployeeTypeAppMappings.employeeType, employeeType), eq(clientEmployeeTypeAppMappings.appName, appName)))
        .returning();
      
      if (result.length === 0) {
        return res.status(404).json({ error: "Mapping not found" });
      }
      
      console.log(`✅ Removed employee type app mapping for client ${clientId}: ${employeeType} -> ${appName}`);
      res.status(200).json({ message: "Mapping deleted successfully" });
    } catch (error) {
      console.error(`Error removing employee type app mapping for client:`, error);
      res.status(500).json({ error: "Failed to remove employee type app mapping" });
    }
  });

  app.post("/api/client/:clientId/department-group-mappings", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const { departmentName, groupName } = req.body;
      console.log(`➕ Adding department group mapping for client ${clientId}: ${departmentName} -> ${groupName}`);
      
      // Validate input data
      const validatedData = clientInsertDepartmentGroupMappingSchema.parse({ departmentName, groupName });
      
      // Use client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      
      // Check if mapping already exists
      const existing = await clientDb.select().from(clientDepartmentGroupMappings)
        .where(and(eq(clientDepartmentGroupMappings.departmentName, departmentName), eq(clientDepartmentGroupMappings.groupName, groupName)))
        .limit(1);
      
      if (existing.length > 0) {
        return res.status(409).json({ error: "Mapping already exists" });
      }
      
      // Insert new mapping
      const [result] = await clientDb.insert(clientDepartmentGroupMappings)
        .values(validatedData)
        .returning();
      
      console.log(`✅ Added department group mapping for client ${clientId}: ${departmentName} -> ${groupName}`);
      res.status(201).json(result);
    } catch (error) {
      console.error(`Error adding department group mapping for client:`, error);
      res.status(500).json({ error: "Failed to add department group mapping" });
    }
  });

  app.delete("/api/client/:clientId/department-group-mappings", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const { departmentName, groupName } = req.body;
      console.log(`🗑️  Removing department group mapping for client ${clientId}: ${departmentName} -> ${groupName}`);
      
      // Use client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      
      const result = await clientDb.delete(clientDepartmentGroupMappings)
        .where(and(eq(clientDepartmentGroupMappings.departmentName, departmentName), eq(clientDepartmentGroupMappings.groupName, groupName)))
        .returning();
      
      if (result.length === 0) {
        return res.status(404).json({ error: "Mapping not found" });
      }
      
      console.log(`✅ Removed department group mapping for client ${clientId}: ${departmentName} -> ${groupName}`);
      res.status(200).json({ message: "Mapping deleted successfully" });
    } catch (error) {
      console.error(`Error removing department group mapping for client:`, error);
      res.status(500).json({ error: "Failed to remove department group mapping" });
    }
  });

  app.post("/api/client/:clientId/employee-type-group-mappings", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const { employeeType, groupName } = req.body;
      console.log(`➕ Adding employee type group mapping for client ${clientId}: ${employeeType} -> ${groupName}`);
      
      // Validate input data
      const validatedData = clientInsertEmployeeTypeGroupMappingSchema.parse({ employeeType, groupName });
      
      // Use client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      
      // Check if mapping already exists
      const existing = await clientDb.select().from(clientEmployeeTypeGroupMappings)
        .where(and(eq(clientEmployeeTypeGroupMappings.employeeType, employeeType), eq(clientEmployeeTypeGroupMappings.groupName, groupName)))
        .limit(1);
      
      if (existing.length > 0) {
        return res.status(409).json({ error: "Mapping already exists" });
      }
      
      // Insert new mapping
      const [result] = await clientDb.insert(clientEmployeeTypeGroupMappings)
        .values(validatedData)
        .returning();
      
      console.log(`✅ Added employee type group mapping for client ${clientId}: ${employeeType} -> ${groupName}`);
      res.status(201).json(result);
    } catch (error) {
      console.error(`Error adding employee type group mapping for client:`, error);
      res.status(500).json({ error: "Failed to add employee type group mapping" });
    }
  });

  app.delete("/api/client/:clientId/employee-type-group-mappings", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const { employeeType, groupName } = req.body;
      console.log(`🗑️  Removing employee type group mapping for client ${clientId}: ${employeeType} -> ${groupName}`);
      
      // Use client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      
      const result = await clientDb.delete(clientEmployeeTypeGroupMappings)
        .where(and(eq(clientEmployeeTypeGroupMappings.employeeType, employeeType), eq(clientEmployeeTypeGroupMappings.groupName, groupName)))
        .returning();
      
      if (result.length === 0) {
        return res.status(404).json({ error: "Mapping not found" });
      }
      
      console.log(`✅ Removed employee type group mapping for client ${clientId}: ${employeeType} -> ${groupName}`);
      res.status(200).json({ message: "Mapping deleted successfully" });
    } catch (error) {
      console.error(`Error removing employee type group mapping for client:`, error);
      res.status(500).json({ error: "Failed to remove employee type group mapping" });
    }
  });

  // Client-specific app mappings DELETE endpoint (by ID)
  app.delete("/api/client/:clientId/app-mappings/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const mappingId = parseInt(req.params.id);
      console.log(`🗑️  Deleting app mapping ${mappingId} for client ${clientId}`);
      
      // Use client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      
      // Get the mapping details for audit log before deletion
      const existing = await clientDb.select().from(appMappings).where(eq(appMappings.id, mappingId)).limit(1);
      if (existing.length === 0) {
        return res.status(404).json({ error: "App mapping not found" });
      }
      
      await clientDb.delete(appMappings).where(eq(appMappings.id, mappingId));
      
      console.log(`✅ Deleted app mapping ${mappingId} for client ${clientId}: ${existing[0].appName}`);
      res.status(204).send();
    } catch (error) {
      console.error(`Error deleting app mapping for client:`, error);
      res.status(500).json({ error: "Failed to delete client app mapping" });
    }
  });

  // Client-specific app mappings PUT endpoint (by ID)
  app.put("/api/client/:clientId/app-mappings/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const mappingId = parseInt(req.params.id);
      const { appName, oktaGroupName } = req.body;
      console.log(`✏️  Updating app mapping ${mappingId} for client ${clientId}: ${appName} -> ${oktaGroupName}`);
      
      // Use client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      
      const [result] = await clientDb.update(appMappings)
        .set({ 
          appName,
          oktaGroupName,
          lastUpdated: new Date()
        })
        .where(eq(appMappings.id, mappingId))
        .returning();
      
      if (!result) {
        return res.status(404).json({ error: "App mapping not found" });
      }
      
      console.log(`✅ Updated app mapping ${mappingId} for client ${clientId}`);
      res.json(result);
    } catch (error) {
      console.error(`Error updating app mapping for client:`, error);
      res.status(500).json({ error: "Failed to update client app mapping" });
    }
  });

  // Client-specific app mappings bulk POST endpoint
  app.post("/api/client/:clientId/app-mappings/bulk", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const { mappings } = req.body;
      console.log(`📦 Creating ${mappings.length} app mappings for client ${clientId}`);
      
      // Get OKTA integration for this client to create groups
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      
      const oktaIntegration = await clientDb.select()
        .from(clientIntegrations)
        .where(and(
          eq(clientIntegrations.name, 'okta'),
          eq(clientIntegrations.status, 'connected')
        ))
        .limit(1);

      // Process OKTA group creation and determine which mappings can be saved
      const groupCreationResults: any[] = [];
      const successfulMappings: any[] = [];
      const failedMappings: any[] = [];
      
      if (oktaIntegration.length > 0) {
        console.log(`🔗 OKTA integration found for client ${clientId}, creating groups...`);
        
        for (const mapping of mappings) {
          const groupName = mapping.oktaGroupName;
          if (groupName && groupName.trim()) {
            try {
              const groupResult = await createOktaGroup(oktaIntegration[0].apiKeys as Record<string, string>, groupName, mapping.description);
              groupCreationResults.push({
                groupName,
                mapping,
                result: groupResult
              });
              
              if (groupResult.success) {
                successfulMappings.push(mapping);
                console.log(`✅ OKTA group '${groupName}' created successfully, mapping will be saved`);
              } else {
                failedMappings.push({ mapping, error: groupResult.message });
                console.log(`❌ OKTA group '${groupName}' creation failed, mapping will not be saved: ${groupResult.message}`);
              }
              
              // Small delay between group creation requests to avoid rate limiting
              await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              console.error(`Failed to create OKTA group '${groupName}':`, error);
              groupCreationResults.push({
                groupName,
                mapping,
                result: { success: false, message: errorMessage }
              });
              failedMappings.push({ mapping, error: errorMessage });
            }
          } else {
            // Mappings without OKTA group names can be saved directly
            successfulMappings.push(mapping);
          }
        }
      } else {
        // No OKTA integration - check if any mappings have group names
        const hasOktaGroupNames = mappings.some((m: any) => m.oktaGroupName && m.oktaGroupName.trim());
        if (hasOktaGroupNames) {
          console.log(`⚠️  OKTA integration missing but group names specified - no mappings will be saved`);
          failedMappings.push(...mappings.filter((m: any) => m.oktaGroupName && m.oktaGroupName.trim()).map(mapping => ({
            mapping,
            error: 'No OKTA integration configured for this client'
          })));
          // Only save mappings without group names
          successfulMappings.push(...mappings.filter((m: any) => !m.oktaGroupName || !m.oktaGroupName.trim()));
        } else {
          // No group names specified, save all mappings
          successfulMappings.push(...mappings);
        }
      }
      
      // Only create database mappings for successful OKTA group creations
      let results: any[] = [];
      if (successfulMappings.length > 0) {
        results = await clientDb.insert(appMappings).values(
          successfulMappings.map((mapping: any) => ({
            ...mapping,
            created: new Date(),
            lastUpdated: new Date(),
            status: 'active'
          }))
        ).returning();
        console.log(`✅ Created ${results.length} app mappings for client ${clientId}`);
      } else {
        console.log(`❌ No app mappings created for client ${clientId} - all OKTA group creations failed`);
      }
      
      // Prepare response with detailed results
      const warnings: any[] = [];
      const errors: any[] = [];
      
      if (failedMappings.length > 0) {
        errors.push({
          type: 'oktaGroupCreationFailed',
          message: `${failedMappings.length} mapping(s) not saved due to OKTA group creation failures`,
          failedMappings: failedMappings.map(f => ({
            appName: f.mapping.appName,
            oktaGroupName: f.mapping.oktaGroupName,
            error: f.error
          }))
        });
      }
      
      if (oktaIntegration.length === 0 && mappings.some((m: any) => m.oktaGroupName && m.oktaGroupName.trim())) {
        warnings.push({
          type: 'oktaIntegrationMissing',
          message: 'OKTA integration not configured for this client',
          affectedMappings: mappings.filter((m: any) => m.oktaGroupName && m.oktaGroupName.trim()).length
        });
      }
      
      res.json({
        mappings: results,
        groupCreationResults,
        successfulMappings: successfulMappings.length,
        failedMappings: failedMappings.length,
        warnings,
        errors
      });
    } catch (error) {
      console.error(`Error creating app mappings for client:`, error);
      res.status(500).json({ error: "Failed to create client app mappings" });
    }
  });

  // REMOVED: Global monitoring cards POST - Client-specific endpoint exists at /api/client/:clientId/monitoring-cards

  // Bulk update monitoring card positions (for drag and drop)
  app.patch("/api/monitoring-cards/positions", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      console.log('🔄 MONITORING BULK UPDATE ENDPOINT HIT - Raw request body:', req.body);
      console.log('🔄 Session user:', (req.session as any)?.user?.email);
      
      const { cards } = req.body;
      console.log('🔄 Extracted monitoring cards:', cards);
      
      if (!Array.isArray(cards)) {
        console.error('❌ Cards is not an array:', typeof cards, cards);
        return res.status(400).json({ error: "Cards must be an array" });
      }

      // Update positions in bulk
      const updates = await Promise.all(
        cards.map(async (card: any) => {
          const id = typeof card.id === 'number' ? card.id : parseInt(String(card.id));
          const position = typeof card.position === 'number' ? card.position : parseInt(String(card.position));
          
          if (isNaN(id) || isNaN(position)) {
            throw new Error(`Invalid monitoring card data: id=${card.id}, position=${card.position}`);
          }
          
          const [result] = await db.update(monitoringCards)
            .set({ position, updated: new Date() })
            .where(eq(monitoringCards.id, id))
            .returning();
          
          return result;
        })
      );

      await AuditLogger.log({
        req,
        action: 'UPDATE',
        resourceType: 'MONITORING_LAYOUT',
        resourceId: 'bulk_position_update',
        resourceName: 'Monitoring Card Positions',
        details: { cardCount: cards.length },
        newValues: { positions: cards }
      });

      res.json(updates);
    } catch (error) {
      console.error("Error updating monitoring card positions:", error);
      res.status(500).json({ error: "Failed to update monitoring card positions" });
    }
  });

  app.patch("/api/monitoring-cards/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid card ID" });
      }
      const updates = updateMonitoringCardSchema.parse(req.body);
      
      const existing = await db.select().from(monitoringCards).where(eq(monitoringCards.id, id)).limit(1);
      if (existing.length === 0) {
        return res.status(404).json({ error: "Monitoring card not found" });
      }
      
      const [result] = await db.update(monitoringCards)
        .set({ ...updates, updated: new Date() })
        .where(eq(monitoringCards.id, id))
        .returning();
      
      await AuditLogger.log({
        req,
        action: 'UPDATE',
        resourceType: 'MONITORING_CARD',
        resourceId: result.id.toString(),
        resourceName: result.name,
        details: { type: result.type, position: result.position },
        oldValues: existing[0],
        newValues: result
      });
      
      res.json(result);
    } catch (error) {
      console.error("Error updating monitoring card:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update monitoring card" });
    }
  });

  app.delete("/api/monitoring-cards/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid card ID" });
      }
      
      const existing = await db.select().from(monitoringCards).where(eq(monitoringCards.id, id)).limit(1);
      if (existing.length === 0) {
        return res.status(404).json({ error: "Monitoring card not found" });
      }
      
      await db.delete(monitoringCards).where(eq(monitoringCards.id, id));
      
      await AuditLogger.log({
        req,
        action: 'DELETE',
        resourceType: 'MONITORING_CARD',
        resourceId: existing[0].id.toString(),
        resourceName: existing[0].name,
        details: { type: existing[0].type, position: existing[0].position },
        oldValues: existing[0]
      });
      
      res.json({ message: "Monitoring card deleted successfully" });
    } catch (error) {
      console.error("Error deleting monitoring card:", error);
      res.status(500).json({ error: "Failed to delete monitoring card" });
    }
  });

  // REMOVED: Global department app mappings - All department app mappings are now client-specific

  // REMOVED: Global department app mappings DELETE - All department app mappings are now client-specific

  // REMOVED: Global employee type app mappings (both duplicate sections) - All employee type app mappings are now client-specific

  // REMOVED: Global department group mappings - All department group mappings are now client-specific

  // REMOVED: Global employee type group mappings - All employee type group mappings are now client-specific

  // GLOBAL Logo API endpoints (for MSP use)
  
  // Get all logos (global - MSP only, clientId: 0)
  app.get("/api/company-logos", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      console.log("🔍 Fetching MSP logos (clientId: 0 only)");
      const logos = await storage.getAllLogos(0); // Only MSP logos
      console.log("✅ Found", logos.length, "MSP logos");
      res.json(logos);
    } catch (error) {
      console.error("Error fetching MSP company logos:", error);
      res.status(500).json({ message: "Failed to fetch company logos" });
    }
  });

  // Get active logo (global - MSP only, clientId: 0)
  app.get("/api/company-logos/active", isAuthenticated, async (req, res) => {
    try {
      console.log("🔍 Fetching active MSP logo (clientId: 0 only)");
      const activeLogo = await storage.getActiveLogo(0); // Only MSP logos
      if (!activeLogo) {
        console.log("❌ No active MSP logo found");
        return res.status(404).json({ message: "No active logo found" });
      }
      console.log("✅ Found active MSP logo:", activeLogo.fileName);
      res.json(activeLogo);
    } catch (error) {
      console.error("Error fetching active MSP logo:", error);
      res.status(500).json({ message: "Failed to fetch active logo" });
    }
  });

  // Upload new logo (global - MSP context, no clientId required)
  app.post("/api/company-logos", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      // Use MSP schema that doesn't require clientId
      const logoData = insertMspLogoSchema.parse(req.body);
      console.log("🖼️  Uploading MSP logo:", logoData.fileName);
      
      // Add a default clientId for storage compatibility (use 0 for MSP/global)
      const logoWithClientId = { ...logoData, clientId: 0 };
      const newLogo = await storage.createLogo(logoWithClientId);
      
      await AuditLogger.log({
        req,
        action: "CREATE",
        resourceType: "COMPANY_LOGO",
        resourceId: newLogo.id.toString(),
        resourceName: newLogo.fileName,
        details: { action: "Uploaded new MSP company logo", fileName: newLogo.fileName }
      });

      console.log("✅ MSP logo uploaded successfully:", newLogo.fileName);
      res.status(201).json(newLogo);
    } catch (error) {
      console.error("Error uploading MSP logo:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ message: "Failed to upload logo" });
    }
  });

  // Set active logo (global)
  app.put("/api/company-logos/:id/activate", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const id = z.coerce.number().parse(req.params.id);
      const success = await storage.setActiveLogo(id);
      
      if (!success) {
        return res.status(404).json({ message: "Logo not found" });
      }

      await AuditLogger.log({
        req,
        action: "UPDATE",
        resourceType: "COMPANY_LOGO",
        resourceId: id.toString(),
        resourceName: `Logo ${id}`,
        details: { action: "Set logo as active" }
      });

      res.json({ message: "Logo activated successfully" });
    } catch (error) {
      console.error("Error activating logo:", error);
      res.status(500).json({ message: "Failed to activate logo" });
    }
  });

  // Delete logo (global)
  app.delete("/api/company-logos/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const id = z.coerce.number().parse(req.params.id);
      const success = await storage.deleteLogo(id);
      
      if (!success) {
        return res.status(404).json({ message: "Logo not found" });
      }

      await AuditLogger.log({
        req,
        action: "DELETE",
        resourceType: "COMPANY_LOGO",
        resourceId: id.toString(),
        resourceName: `Logo ${id}`,
        details: { action: "Deleted company logo" }
      });

      res.json({ message: "Logo deleted successfully" });
    } catch (error) {
      console.error("Error deleting logo:", error);
      res.status(500).json({ message: "Failed to delete logo" });
    }
  });

  // CLIENT-SPECIFIC Logo API endpoints
  
  // Get all logos for specific client
  app.get("/api/client/:clientId/company-logos", isAuthenticated, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      console.log(`🖼️  Fetching logos for client ${clientId}`);
      
      // Use client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      const logos = await clientDb.select().from(clientCompanyLogos).orderBy(clientCompanyLogos.uploadedAt);
      
      console.log(`✅ Found ${logos.length} logos for client ${clientId}`);
      res.json(logos);
    } catch (error) {
      console.error(`Error fetching logos for client:`, error);
      res.status(500).json({ error: "Failed to fetch client logos" });
    }
  });

  // Get active logo for specific client
  app.get("/api/client/:clientId/company-logos/active", isAuthenticated, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      console.log(`🖼️  Fetching active logo for client ${clientId}`);
      
      // Use client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      const activeLogo = await clientDb.select()
        .from(clientCompanyLogos)
        .where(eq(clientCompanyLogos.isActive, true))
        .limit(1);
      
      if (activeLogo.length === 0) {
        console.log(`❌ No active logo found for client ${clientId}`);
        return res.status(404).json({ error: "No active logo found" });
      }
      
      console.log(`✅ Found active logo for client ${clientId}`);
      res.json(activeLogo[0]);
    } catch (error) {
      console.error(`Error fetching active logo for client:`, error);
      res.status(500).json({ error: "Failed to fetch client active logo" });
    }
  });

  // Upload new logo for specific client
  app.post("/api/client/:clientId/company-logos", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const user = (req.session as any).user;
      const logoData = clientInsertCompanyLogoSchema.parse(req.body);
      console.log(`🖼️  Uploading logo for client ${clientId}:`, logoData.fileName);
      
      // Use client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      
      // Create new logo
      const [newLogo] = await clientDb.insert(clientCompanyLogos)
        .values({ ...logoData, uploadedBy: user.id })
        .returning();
      
      console.log(`✅ Uploaded logo for client ${clientId}: ${newLogo.fileName}`);
      res.status(201).json(newLogo);
    } catch (error) {
      console.error(`Error uploading logo for client:`, error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to upload client logo" });
    }
  });

  // Set active logo for specific client
  app.put("/api/client/:clientId/company-logos/:id/activate", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const logoId = parseInt(req.params.id);
      console.log(`🖼️  Activating logo ${logoId} for client ${clientId}`);
      
      // Use client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      
      // Deactivate all logos first
      await clientDb.update(clientCompanyLogos)
        .set({ isActive: false });
      
      // Activate the specified logo
      const [activatedLogo] = await clientDb.update(clientCompanyLogos)
        .set({ isActive: true })
        .where(eq(clientCompanyLogos.id, logoId))
        .returning();
      
      if (!activatedLogo) {
        return res.status(404).json({ error: "Logo not found" });
      }
      
      console.log(`✅ Activated logo ${logoId} for client ${clientId}`);
      res.json({ message: "Logo activated successfully" });
    } catch (error) {
      console.error(`Error activating logo for client:`, error);
      res.status(500).json({ error: "Failed to activate client logo" });
    }
  });

  // Delete logo for specific client
  app.delete("/api/client/:clientId/company-logos/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const logoId = parseInt(req.params.id);
      console.log(`🖼️  Deleting logo ${logoId} for client ${clientId}`);
      
      // Use client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      
      // Check if logo exists
      const existing = await clientDb.select()
        .from(clientCompanyLogos)
        .where(eq(clientCompanyLogos.id, logoId))
        .limit(1);
      
      if (existing.length === 0) {
        return res.status(404).json({ error: "Logo not found" });
      }
      
      // Delete the logo
      await clientDb.delete(clientCompanyLogos)
        .where(eq(clientCompanyLogos.id, logoId));
      
      console.log(`✅ Deleted logo ${logoId} for client ${clientId}`);
      res.json({ message: "Logo deleted successfully" });
    } catch (error) {
      console.error(`Error deleting logo for client:`, error);
      res.status(500).json({ error: "Failed to delete client logo" });
    }
  });

  // MSP Management API endpoints
  app.get("/api/clients", isAuthenticated, mspRoutes.getClients);
  app.get("/api/clients/:id", isAuthenticated, mspRoutes.getClient);
  app.post("/api/clients", isAuthenticated, requireAdmin, mspRoutes.createClient);
  app.post("/api/clients/create-with-template", isAuthenticated, requireAdmin, mspRoutes.createClientWithTemplate);
  // PUT route handled below with debugging
  app.delete("/api/clients/:id", isAuthenticated, requireAdmin, mspRoutes.deleteClient);

  // Auto-initialize missing client database tables on startup
  async function initializeExistingClients() {
    try {
      console.log('🔄 Checking existing client databases for missing tables...');
      
      const multiDb = MultiDatabaseManager.getInstance();
      const { mspStorage } = await import('./msp-storage');
      
      // Get all clients
      const clients = await mspStorage.getAllClients();
      console.log(`Found ${clients.length} clients to check`);
      
      for (const client of clients) {
        try {
          // Try to access client database
          const clientDb = await multiDb.getClientDb(client.id);
          
          // Check if app_mappings table exists by attempting a simple query
          await clientDb.select().from((await import('../shared/client-schema')).appMappings).limit(1);
          
          // Check and fix logo table structure
          try {
            const connectionString = multiDb.clientConnectionStrings.get(client.id);
            if (connectionString) {
              const requireSSL = !connectionString.includes('localhost');
              const sql = postgres(connectionString, {
                ssl: requireSSL ? 'require' : false,
                transform: { undefined: null }
              });
              
              try {
                // Check current logo table columns
                const columns = await sql`
                  SELECT column_name 
                  FROM information_schema.columns 
                  WHERE table_name = 'company_logos' 
                  AND table_schema = 'public'
                `;
                
                const columnNames = columns.map(c => c.column_name);
                
                // Fix the table structure if needed
                if (columnNames.includes('name') && !columnNames.includes('file_name')) {
                  console.log(`🔧 Fixing logo table for client ${client.id}: renaming 'name' to 'file_name'`);
                  await sql`ALTER TABLE company_logos RENAME COLUMN name TO file_name`;
                }
                
                if (!columnNames.includes('mime_type')) {
                  console.log(`🔧 Fixing logo table for client ${client.id}: adding 'mime_type'`);
                  await sql`ALTER TABLE company_logos ADD COLUMN mime_type VARCHAR(100) DEFAULT 'image/png'`;
                  await sql`ALTER TABLE company_logos ALTER COLUMN mime_type SET NOT NULL`;
                }
                
                if (!columnNames.includes('file_size')) {
                  console.log(`🔧 Fixing logo table for client ${client.id}: adding 'file_size'`);
                  await sql`ALTER TABLE company_logos ADD COLUMN file_size INTEGER DEFAULT 1000`;
                  await sql`ALTER TABLE company_logos ALTER COLUMN file_size SET NOT NULL`;
                }
              } finally {
                await sql.end();
              }
            }
          } catch (logoError) {
            console.error(`⚠️  Error fixing logo table for client ${client.id}:`, logoError);
          }
          
          console.log(`✅ Client ${client.id} (${client.name}) database is properly initialized`);
        } catch (error) {
          // If table doesn't exist, initialize the database
          if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
            console.log(`🚀 Initializing missing tables for client ${client.id} (${client.name})`);
            await multiDb.initializeClientDatabase(client.id);
            console.log(`✅ Successfully initialized database for client ${client.id}`);
          } else {
            console.error(`❌ Error checking client ${client.id}:`, error);
          }
        }
      }
      
      console.log('✅ Client database initialization check completed');
    } catch (error) {
      console.error('❌ Client database initialization check failed:', error);
    }
  }

  // Run the initialization check
  setTimeout(initializeExistingClients, 2000); // Wait 2 seconds for everything to be ready

  // MSP Client Management Routes
  // Update client
  app.put("/api/clients/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const clientId = parseInt(req.params.id);
      const updates = req.body;
      
      console.log('🔴 CLIENT SAVE - DETAILED DEBUGGING:', {
        clientId,
        updates,
        updateKeys: Object.keys(updates),
        updatesStringified: JSON.stringify(updates)
      });
      
      // Update the client in the MSP database
      const [updatedClient] = await db.update(clients)
        .set({
          ...updates,
          lastUpdated: new Date()
        })
        .where(eq(clients.id, clientId))
        .returning();
      
      console.log('🔴 CLIENT DATABASE UPDATE RESULT:', {
        clientId,
        updatedClient,
        wasFound: !!updatedClient
      });
      
      if (!updatedClient) {
        console.log('❌ CLIENT NOT FOUND IN DATABASE');
        return res.status(404).json({ error: "Client not found" });
      }
      
      console.log(`✅ Client ${clientId} updated successfully - RETURNING:`, updatedClient);
      res.json(updatedClient);
    } catch (error) {
      console.error(`Error updating client ${req.params.id}:`, error);
      res.status(500).json({ error: "Failed to update client" });
    }
  });

  // Delete client
  app.delete("/api/clients/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const clientId = parseInt(req.params.id);
      
      console.log(`🗑️ Deleting client ${clientId}...`);
      
      // First, delete client access records
      await db.delete(clientAccess).where(eq(clientAccess.clientId, clientId));
      
      // Then delete the client from MSP database
      const [deletedClient] = await db.delete(clients)
        .where(eq(clients.id, clientId))
        .returning();
      
      if (!deletedClient) {
        return res.status(404).json({ error: "Client not found" });
      }
      
      // Note: We don't delete the client database itself as it may contain important data
      // This should be handled manually or through a separate maintenance process
      
      console.log(`✅ Client ${clientId} deleted successfully from MSP database`);
      res.json({ 
        message: "Client deleted successfully", 
        deletedClient,
        note: "Client database preserved for data recovery" 
      });
    } catch (error) {
      console.error(`Error deleting client ${req.params.id}:`, error);
      res.status(500).json({ error: "Failed to delete client" });
    }
  });

  // MSP Client Access Management
  app.get("/api/msp-users/:mspUserId/client-access", isAuthenticated, mspRoutes.getMspUserClientAccess);
  app.post("/api/client-access", isAuthenticated, requireAdmin, mspRoutes.grantClientAccess);
  app.delete("/api/client-access/:mspUserId/:clientId", isAuthenticated, requireAdmin, mspRoutes.revokeClientAccess);

  // CLIENT-SPECIFIC USER ENDPOINTS - CRITICAL FOR DATA ISOLATION
  
  // Get users for specific client
  app.get("/api/client/:clientId/users", isAuthenticated, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const { search, limit = 20, page = 1, statsOnly = false, sortBy = 'firstName', sortOrder = 'asc', employeeTypeFilter, ...filters } = req.query;
      
      console.log(`👥 Fetching users for client ${clientId}`);
      
      // Use client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      
      // For stats-only requests, return minimal data quickly
      if (statsOnly === 'true') {
        const allUsers = await clientDb.select().from(clientUsers).limit(500);
        res.json({
          users: [],
          total: allUsers.length,
          currentPage: 1,
          totalPages: 1,
          usersPerPage: parseInt(limit as string),
          source: 'client_db_stats'
        });
        return;
      }
      
      // Get users from client-specific database
      let query = clientDb.select().from(clientUsers);
      
      // Apply search filter if provided
      if (search && typeof search === 'string') {
        const searchTerm = `%${search.toLowerCase()}%`;
        query = query.where(
          or(
            ilike(clientUsers.firstName, searchTerm),
            ilike(clientUsers.lastName, searchTerm),
            ilike(clientUsers.email, searchTerm)
          )
        );
      }
      
      // Apply employee type filter
      if (employeeTypeFilter && typeof employeeTypeFilter === 'string') {
        query = query.where(eq(clientUsers.employeeType, employeeTypeFilter));
      }
      
      // Get total count for pagination
      const allFilteredUsers = await query;
      const total = allFilteredUsers.length;
      
      // Apply sorting
      const sortField = sortBy as keyof typeof clientUsers.$inferSelect;
      if (sortOrder === 'desc') {
        query = query.orderBy(desc(clientUsers[sortField]));
      } else {
        query = query.orderBy(asc(clientUsers[sortField]));
      }
      
      // Apply pagination
      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
      const paginatedUsers = allFilteredUsers.slice(offset, offset + parseInt(limit as string));
      
      const totalPages = Math.ceil(total / parseInt(limit as string));
      
      console.log(`✅ Found ${paginatedUsers.length} users for client ${clientId} (${total} total)`);
      
      res.json({
        users: paginatedUsers,
        total,
        currentPage: parseInt(page as string),
        totalPages,
        usersPerPage: parseInt(limit as string),
        source: 'client_db'
      });
    } catch (error) {
      console.error(`Error fetching users for client:`, error);
      res.status(500).json({ error: "Failed to fetch client users" });
    }
  });
  
  // Create user for specific client
  app.post("/api/client/:clientId/users", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      // Create a modified schema that doesn't require login since server generates it
      const serverUserSchema = insertUserSchema.omit({ login: true }).extend({
        login: z.string().optional()
      });
      const userData = serverUserSchema.parse(req.body);
      
      console.log(`👤 Creating user for client ${clientId}:`, userData.email);
      
      // Use client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      
      // Check for existing user by email
      const existingUser = await clientDb.select().from(clientUsers).where(eq(clientUsers.email, userData.email)).limit(1);
      if (existingUser.length > 0) {
        return res.status(400).json({ message: "User with this email already exists" });
      }
      
      let oktaId: string | null = null;
      let oktaResult: { success: boolean; message: string; oktaUser?: any } | null = null;
      
      // Check if client has OKTA integration
      const [oktaIntegration] = await clientDb.select()
        .from(clientIntegrations)
        .where(and(
          eq(clientIntegrations.name, 'okta'),
          eq(clientIntegrations.status, 'connected')
        ));
      
      if (oktaIntegration) {
        console.log(`🔗 OKTA integration found for client ${clientId}, creating user in OKTA...`);
        
        try {
          const result = await createOktaUser(
            oktaIntegration.apiKeys as Record<string, string>, 
            userData
          ) as { success: boolean; message: string; oktaUser?: any };
          
          oktaResult = result;
          
          if (result.success && result.oktaUser) {
            oktaId = result.oktaUser.id;
            console.log(`✅ OKTA user '${userData.email}' created successfully for client ${clientId} with ID: ${oktaId}`);
          } else {
            console.error(`❌ OKTA user creation failed for client ${clientId}: ${result.message}`);
            return res.status(400).json({ 
              message: "Failed to create user in OKTA", 
              error: result.message 
            });
          }
        } catch (error) {
          console.error(`❌ Failed to create OKTA user '${userData.email}' for client ${clientId}:`, error);
          return res.status(500).json({ 
            message: "Failed to create user in OKTA", 
            error: error instanceof Error ? error.message : 'Unknown OKTA error' 
          });
        }
      } else {
        console.log(`⚠️  No OKTA integration found for client ${clientId}, creating user in local database only`);
      }
      
      // Create user in client-specific database
      const [newUser] = await clientDb.insert(clientUsers).values({
        ...userData,
        oktaId: oktaId, // Store OKTA ID if user was created in OKTA
        created: new Date(),
        lastUpdated: new Date()
      }).returning();
      
      console.log(`✅ Created user for client ${clientId}:`, newUser.id);
      
      // Add user to groups based on employee type, department, and app mappings
      let groupAssignments: any[] = [];
      if (oktaIntegration && oktaId) {
        console.log(`🔗 Adding user to groups based on client ${clientId} mappings...`);
        
        try {
          // Fetch OKTA groups using client-specific credentials
          const oktaUsers = await fetchOktaUsers(oktaIntegration.apiKeys as Record<string, string>);
          if (!oktaUsers.success) {
            console.log(`⚠️  Could not fetch OKTA groups for group assignment: ${oktaUsers.message}`);
          } else {
            // Get client-specific group mappings
            const employeeTypeGroups = await clientDb.select().from(clientEmployeeTypeGroupMappings)
              .where(eq(clientEmployeeTypeGroupMappings.employeeType, userData.employeeType || ''));
            
            // Get department-specific apps
            const departmentApps = await clientDb.select()
              .from(clientDepartmentAppMappings)
              .where(eq(clientDepartmentAppMappings.departmentName, userData.department || ''));
            
            // Get employee type-specific apps
            const employeeTypeApps = await clientDb.select()
              .from(clientEmployeeTypeAppMappings)
              .where(eq(clientEmployeeTypeAppMappings.employeeType, userData.employeeType || ''));
            
            // Employee type group assignment
            if (employeeTypeGroups.length > 0) {
              for (const mapping of employeeTypeGroups) {
                try {
                  const groupResult = await addUserToOktaGroup(
                    oktaIntegration.apiKeys as Record<string, string>,
                    oktaId,
                    mapping.groupName
                  );
                  
                  if (groupResult.success) {
                    console.log(`✅ Added user to employee type group: ${mapping.groupName}`);
                    groupAssignments.push({ type: 'employeeType', group: mapping.groupName, success: true });
                  } else {
                    console.log(`⚠️  Failed to add user to employee type group ${mapping.groupName}: ${groupResult.message}`);
                    groupAssignments.push({ type: 'employeeType', group: mapping.groupName, success: false, error: groupResult.message });
                  }
                } catch (error) {
                  console.error(`Error adding user to employee type group ${mapping.groupName}:`, error);
                  groupAssignments.push({ type: 'employeeType', group: mapping.groupName, success: false, error: 'Exception occurred' });
                }
              }
            }
            
            // Department app-based group assignment
            if (departmentApps.length > 0) {
              console.log(`🏢 Found ${departmentApps.length} department apps for ${userData.department}:`, departmentApps.map(a => a.appName));
              
              for (const appMapping of departmentApps) {
                // Get the OKTA group name for this app
                const [appGroup] = await clientDb.select()
                  .from(clientAppMappings)
                  .where(eq(clientAppMappings.appName, appMapping.appName))
                  .limit(1);
                
                if (appGroup) {
                  try {
                    const groupResult = await addUserToOktaGroup(
                      oktaIntegration.apiKeys as Record<string, string>,
                      oktaId,
                      appGroup.oktaGroupName
                    );
                    
                    if (groupResult.success) {
                      console.log(`✅ Added user to department app group: ${appGroup.oktaGroupName} (${appMapping.appName})`);
                      groupAssignments.push({ type: 'departmentApp', group: appGroup.oktaGroupName, app: appMapping.appName, success: true });
                    } else {
                      console.log(`⚠️  Failed to add user to department app group ${appGroup.oktaGroupName}: ${groupResult.message}`);
                      groupAssignments.push({ type: 'departmentApp', group: appGroup.oktaGroupName, app: appMapping.appName, success: false, error: groupResult.message });
                    }
                  } catch (error) {
                    console.error(`Error adding user to department app group ${appGroup.oktaGroupName}:`, error);
                    groupAssignments.push({ type: 'departmentApp', group: appGroup.oktaGroupName, app: appMapping.appName, success: false, error: 'Exception occurred' });
                  }
                } else {
                  console.log(`⚠️  No OKTA group mapping found for app: ${appMapping.appName}`);
                  groupAssignments.push({ type: 'departmentApp', group: 'N/A', app: appMapping.appName, success: false, error: 'App not mapped to OKTA group' });
                }
              }
            }
            
            // Employee type app-based group assignment
            if (employeeTypeApps.length > 0) {
              console.log(`👔 Found ${employeeTypeApps.length} employee type apps for ${userData.employeeType}:`, employeeTypeApps.map(a => a.appName));
              
              for (const appMapping of employeeTypeApps) {
                // Get the OKTA group name for this app
                const [appGroup] = await clientDb.select()
                  .from(clientAppMappings)
                  .where(eq(clientAppMappings.appName, appMapping.appName))
                  .limit(1);
                
                if (appGroup) {
                  try {
                    const groupResult = await addUserToOktaGroup(
                      oktaIntegration.apiKeys as Record<string, string>,
                      oktaId,
                      appGroup.oktaGroupName
                    );
                    
                    if (groupResult.success) {
                      console.log(`✅ Added user to employee type app group: ${appGroup.oktaGroupName} (${appMapping.appName})`);
                      groupAssignments.push({ type: 'employeeTypeApp', group: appGroup.oktaGroupName, app: appMapping.appName, success: true });
                    } else {
                      console.log(`⚠️  Failed to add user to employee type app group ${appGroup.oktaGroupName}: ${groupResult.message}`);
                      groupAssignments.push({ type: 'employeeTypeApp', group: appGroup.oktaGroupName, app: appMapping.appName, success: false, error: groupResult.message });
                    }
                  } catch (error) {
                    console.error(`Error adding user to employee type app group ${appGroup.oktaGroupName}:`, error);
                    groupAssignments.push({ type: 'employeeTypeApp', group: appGroup.oktaGroupName, app: appMapping.appName, success: false, error: 'Exception occurred' });
                  }
                } else {
                  console.log(`⚠️  No OKTA group mapping found for app: ${appMapping.appName}`);
                  groupAssignments.push({ type: 'employeeTypeApp', group: 'N/A', app: appMapping.appName, success: false, error: 'App not mapped to OKTA group' });
                }
              }
            }
            
            // Process manually selected apps from frontend
            const selectedApps = (req.body.applications || []) as string[];
            if (selectedApps.length > 0) {
              console.log(`📱 Processing ${selectedApps.length} manually selected apps:`, selectedApps);
              
              for (const selectedAppName of selectedApps) {
                // Get the OKTA group name for this app
                const [appGroup] = await clientDb.select()
                  .from(clientAppMappings)
                  .where(eq(clientAppMappings.appName, selectedAppName))
                  .limit(1);
                
                if (appGroup) {
                  try {
                    const groupResult = await addUserToOktaGroup(
                      oktaIntegration.apiKeys as Record<string, string>,
                      oktaId,
                      appGroup.oktaGroupName
                    );
                    
                    if (groupResult.success) {
                      console.log(`✅ Added user to manually selected app group: ${appGroup.oktaGroupName} (${selectedAppName})`);
                      groupAssignments.push({ type: 'manualApp', group: appGroup.oktaGroupName, app: selectedAppName, success: true });
                    } else {
                      console.log(`⚠️  Failed to add user to manually selected app group ${appGroup.oktaGroupName}: ${groupResult.message}`);
                      groupAssignments.push({ type: 'manualApp', group: appGroup.oktaGroupName, app: selectedAppName, success: false, error: groupResult.message });
                    }
                  } catch (error) {
                    console.error(`Error adding user to manually selected app group ${appGroup.oktaGroupName}:`, error);
                    groupAssignments.push({ type: 'manualApp', group: appGroup.oktaGroupName, app: selectedAppName, success: false, error: 'Exception occurred' });
                  }
                } else {
                  console.log(`⚠️  No OKTA group mapping found for manually selected app: ${selectedAppName}`);
                  groupAssignments.push({ type: 'manualApp', group: 'N/A', app: selectedAppName, success: false, error: 'App not mapped to OKTA group' });
                }
              }
            }
            
            // Selected groups assignment (if provided in req.body.groups)
            const selectedGroups = (req.body.groups || []) as string[];
            if (selectedGroups.length > 0) {
              console.log('Processing manually selected groups:', selectedGroups);
              
              for (const selectedGroupName of selectedGroups) {
                try {
                  const groupResult = await addUserToOktaGroup(
                    oktaIntegration.apiKeys as Record<string, string>,
                    oktaId,
                    selectedGroupName
                  );
                  
                  if (groupResult.success) {
                    console.log(`✅ Added user to manually selected group: ${selectedGroupName}`);
                    groupAssignments.push({ type: 'manualGroup', group: selectedGroupName, success: true });
                  } else {
                    console.log(`⚠️  Failed to add user to manually selected group ${selectedGroupName}: ${groupResult.message}`);
                    groupAssignments.push({ type: 'manualGroup', group: selectedGroupName, success: false, error: groupResult.message });
                  }
                } catch (error) {
                  console.error(`Error adding user to manually selected group ${selectedGroupName}:`, error);
                  groupAssignments.push({ type: 'manualGroup', group: selectedGroupName, success: false, error: 'Exception occurred' });
                }
              }
            }
          }
        } catch (error) {
          console.error(`Error during group assignment for client ${clientId}:`, error);
        }
      }
      
      res.json({
        ...newUser,
        oktaResult: oktaResult || { 
          success: false, 
          message: "No OKTA integration configured" 
        },
        groupAssignments: groupAssignments
      });
    } catch (error) {
      console.error(`Error creating user for client:`, error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create client user" });
    }
  });
  
  // Get specific user for client
  app.get("/api/client/:clientId/users/:userId", isAuthenticated, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const userId = parseInt(req.params.userId);
      
      console.log(`👤 Fetching user ${userId} for client ${clientId}`);
      
      // Use client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      
      const [user] = await clientDb.select().from(clientUsers).where(eq(clientUsers.id, userId)).limit(1);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      console.log(`✅ Found user ${userId} for client ${clientId}`);
      res.json(user);
    } catch (error) {
      console.error(`Error fetching user for client:`, error);
      res.status(500).json({ error: "Failed to fetch client user" });
    }
  });
  
  // Update user for specific client
  app.patch("/api/client/:clientId/users/:userId", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const userId = parseInt(req.params.userId);
      const updates = updateUserSchema.parse(req.body);
      
      console.log(`👤 Updating user ${userId} for client ${clientId}`);
      
      // Use client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      
      // Check if user exists
      const [existingUser] = await clientDb.select().from(clientUsers).where(eq(clientUsers.id, userId)).limit(1);
      if (!existingUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // If this is a status update, redirect to the status-specific endpoint logic
      if (updates.status) {
        console.log(`🔄 Status update detected, processing OKTA status change for user ${userId}`);
        
        // Handle OKTA status changes using client-specific credentials
        if (existingUser.oktaId) {
          try {
            // Get client's OKTA integration settings
            const [oktaIntegration] = await clientDb.select().from(clientIntegrations)
              .where(eq(clientIntegrations.name, 'okta'))
              .limit(1);

            if (oktaIntegration && oktaIntegration.apiKeys) {
              const apiKeys = oktaIntegration.apiKeys as Record<string, string>;
              const status = updates.status;
              
              console.log(`🔄 Checking current OKTA status for user ${existingUser.oktaId} using client ${clientId} credentials`);
              
              try {
                const response = await fetch(`https://${apiKeys.domain}/api/v1/users/${existingUser.oktaId}`, {
                  method: 'GET',
                  headers: {
                    'Accept': 'application/json',
                    'Authorization': `SSWS ${apiKeys.apiToken}`,
                  },
                });

                if (response.ok) {
                  const oktaUser = await response.json();
                  const currentOktaStatus = oktaUser.status;
                  console.log(`Current OKTA status: ${currentOktaStatus}, Requested status: ${status}`);
                  
                  const normalizedOktaStatus = currentOktaStatus === "PROVISIONED" ? "ACTIVE" : currentOktaStatus;
                  
                  if (normalizedOktaStatus !== status) {
                    console.log(`🔄 Updating OKTA user ${existingUser.oktaId} status from ${currentOktaStatus} to ${status}`);
                    
                    if (status === "SUSPENDED" || status === "DEPROVISIONED") {
                      // Deactivate user in OKTA
                      const deactivateResponse = await fetch(`https://${apiKeys.domain}/api/v1/users/${existingUser.oktaId}/lifecycle/deactivate`, {
                        method: 'POST',
                        headers: {
                          'Accept': 'application/json',
                          'Authorization': `SSWS ${apiKeys.apiToken}`,
                        },
                      });
                      
                      if (deactivateResponse.ok) {
                        console.log(`✅ Successfully deactivated user ${existingUser.email} in OKTA`);
                      } else {
                        const errorText = await deactivateResponse.text();
                        console.error(`❌ Failed to deactivate user in OKTA: ${deactivateResponse.status} ${errorText}`);
                        throw new Error(`OKTA deactivation failed: ${deactivateResponse.status} ${deactivateResponse.statusText}`);
                      }
                    } else if (status === "ACTIVE") {
                      // Activate user in OKTA
                      const activateResponse = await fetch(`https://${apiKeys.domain}/api/v1/users/${existingUser.oktaId}/lifecycle/activate`, {
                        method: 'POST',
                        headers: {
                          'Accept': 'application/json',
                          'Authorization': `SSWS ${apiKeys.apiToken}`,
                        },
                      });
                      
                      if (activateResponse.ok) {
                        console.log(`✅ Successfully activated user ${existingUser.email} in OKTA`);
                      } else {
                        const errorText = await activateResponse.text();
                        console.error(`❌ Failed to activate user in OKTA: ${activateResponse.status} ${errorText}`);
                        throw new Error(`OKTA activation failed: ${activateResponse.status} ${activateResponse.statusText}`);
                      }
                    }
                  } else {
                    console.log(`ℹ️  User already has equivalent status ${currentOktaStatus} in OKTA, skipping API call`);
                  }
                } else {
                  console.warn(`⚠️  Could not get current OKTA status: ${response.status}`);
                }
              } catch (oktaStatusError) {
                console.error("OKTA status check error:", oktaStatusError);
                // Continue with local update even if OKTA status check fails
              }
            } else {
              console.log(`⚠️  No OKTA integration found for client ${clientId}, updating local status only`);
            }
          } catch (oktaError) {
            console.error("OKTA API error:", oktaError);
            return res.status(500).json({ 
              error: "Failed to update user status in OKTA",
              details: oktaError instanceof Error ? oktaError.message : "Unknown OKTA error"
            });
          }
        } else {
          console.log(`ℹ️  User has no OKTA ID, updating local status only`);
        }
      }
      
      // Update user in client-specific database
      const [updatedUser] = await clientDb.update(clientUsers)
        .set({ ...updates, lastUpdated: new Date() })
        .where(eq(clientUsers.id, userId))
        .returning();
      
      console.log(`✅ Updated user ${userId} for client ${clientId}`);
      res.json(updatedUser);
    } catch (error) {
      console.error(`Error updating user for client:`, error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update client user" });
    }
  });
  
  // Update user status for specific client
  app.patch("/api/client/:clientId/users/:userId/status", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const userId = parseInt(req.params.userId);
      const { status } = z.object({
        status: z.enum(["ACTIVE", "SUSPENDED", "DEPROVISIONED"])
      }).parse(req.body);
      
      console.log(`👤 Updating status for user ${userId} in client ${clientId} to ${status}`);
      
      // Use client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      
      // Get user from client database first
      const [existingUser] = await clientDb.select().from(clientUsers).where(eq(clientUsers.id, userId)).limit(1);
      if (!existingUser) {
        return res.status(404).json({ error: "User not found" });
      }

      // Handle OKTA status changes using client-specific credentials
      if (existingUser.oktaId) {
        try {
          // Get client's OKTA integration settings
          const [oktaIntegration] = await clientDb.select().from(clientIntegrations)
            .where(eq(clientIntegrations.name, 'okta'))
            .limit(1);

          if (oktaIntegration && oktaIntegration.apiKeys) {
            const apiKeys = oktaIntegration.apiKeys as Record<string, string>;
            
            console.log(`🔄 Checking current OKTA status for user ${existingUser.oktaId} using client ${clientId} credentials`);
            
            // Get current OKTA status to avoid unnecessary API calls
            try {
              const response = await fetch(`https://${apiKeys.domain}/api/v1/users/${existingUser.oktaId}`, {
                method: 'GET',
                headers: {
                  'Accept': 'application/json',
                  'Authorization': `SSWS ${apiKeys.apiToken}`,
                },
              });

              if (response.ok) {
                const oktaUser = await response.json();
                const currentOktaStatus = oktaUser.status;
                console.log(`Current OKTA status: ${currentOktaStatus}, Requested status: ${status}`);
                
                const normalizedOktaStatus = currentOktaStatus === "PROVISIONED" ? "ACTIVE" : currentOktaStatus;
                
                if (normalizedOktaStatus !== status) {
                  console.log(`🔄 Updating OKTA user ${existingUser.oktaId} status from ${currentOktaStatus} to ${status}`);
                  
                  if (status === "SUSPENDED" || status === "DEPROVISIONED") {
                    // Deactivate user in OKTA
                    const deactivateResponse = await fetch(`https://${apiKeys.domain}/api/v1/users/${existingUser.oktaId}/lifecycle/deactivate`, {
                      method: 'POST',
                      headers: {
                        'Accept': 'application/json',
                        'Authorization': `SSWS ${apiKeys.apiToken}`,
                      },
                    });
                    
                    if (deactivateResponse.ok) {
                      console.log(`✅ Successfully deactivated user ${existingUser.email} in OKTA`);
                    } else {
                      const errorText = await deactivateResponse.text();
                      console.error(`❌ Failed to deactivate user in OKTA: ${deactivateResponse.status} ${errorText}`);
                      throw new Error(`OKTA deactivation failed: ${deactivateResponse.status} ${deactivateResponse.statusText}`);
                    }
                  } else if (status === "ACTIVE") {
                    // Activate user in OKTA
                    const activateResponse = await fetch(`https://${apiKeys.domain}/api/v1/users/${existingUser.oktaId}/lifecycle/activate`, {
                      method: 'POST',
                      headers: {
                        'Accept': 'application/json',
                        'Authorization': `SSWS ${apiKeys.apiToken}`,
                      },
                    });
                    
                    if (activateResponse.ok) {
                      console.log(`✅ Successfully activated user ${existingUser.email} in OKTA`);
                    } else {
                      const errorText = await activateResponse.text();
                      console.error(`❌ Failed to activate user in OKTA: ${activateResponse.status} ${errorText}`);
                      throw new Error(`OKTA activation failed: ${activateResponse.status} ${activateResponse.statusText}`);
                    }
                  }
                } else {
                  console.log(`ℹ️  User already has equivalent status ${currentOktaStatus} in OKTA, skipping API call`);
                }
              } else {
                console.warn(`⚠️  Could not get current OKTA status: ${response.status}`);
              }
            } catch (oktaStatusError) {
              console.error("OKTA status check error:", oktaStatusError);
              // Continue with local update even if OKTA status check fails
            }
          } else {
            console.log(`⚠️  No OKTA integration found for client ${clientId}, updating local status only`);
          }
        } catch (oktaError) {
          console.error("OKTA API error:", oktaError);
          return res.status(500).json({ 
            error: "Failed to update user status in OKTA",
            details: oktaError instanceof Error ? oktaError.message : "Unknown OKTA error"
          });
        }
      } else {
        console.log(`ℹ️  User has no OKTA ID, updating local status only`);
      }
      
      // Update status in client-specific database
      const [updatedUser] = await clientDb.update(clientUsers)
        .set({ status, lastUpdated: new Date() })
        .where(eq(clientUsers.id, userId))
        .returning();
      
      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      console.log(`✅ Updated status for user ${userId} in client ${clientId}`);
      res.json(updatedUser);
    } catch (error) {
      console.error(`Error updating user status for client:`, error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update client user status" });
    }
  });
  
  // Delete user for specific client
  app.delete("/api/client/:clientId/users/:userId", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const userId = parseInt(req.params.userId);
      
      console.log(`👤 Deleting user ${userId} for client ${clientId}`);
      
      // Use client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      
      // Delete user from client-specific database
      const result = await clientDb.delete(clientUsers).where(eq(clientUsers.id, userId)).returning();
      
      if (result.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }
      
      console.log(`✅ Deleted user ${userId} for client ${clientId}`);
      res.status(204).send();
    } catch (error) {
      console.error(`Error deleting user for client:`, error);
      res.status(500).json({ error: "Failed to delete client user" });
    }
  });
  
  // Get user applications for specific client
  app.get("/api/client/:clientId/users/:userId/applications", isAuthenticated, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const userId = parseInt(req.params.userId);
      
      console.log(`📱 Fetching applications for user ${userId} in client ${clientId}`);
      
      // Use client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      
      // For now, return empty array - this would need proper implementation
      // based on client-specific application assignments
      res.json([]);
    } catch (error) {
      console.error(`Error fetching user applications for client:`, error);
      res.status(500).json({ error: "Failed to fetch client user applications" });
    }
  });
  
  // Get user groups for specific client
  app.get("/api/client/:clientId/users/:userId/groups", isAuthenticated, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const userId = parseInt(req.params.userId);
      
      console.log(`👥 Fetching groups for user ${userId} in client ${clientId}`);
      
      // Use client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      
      // For now, return empty array - this would need proper implementation
      // based on client-specific group assignments
      res.json([]);
    } catch (error) {
      console.error(`Error fetching user groups for client:`, error);
      res.status(500).json({ error: "Failed to fetch client user groups" });
    }
  });
  
  // Get user devices for specific client
  app.get("/api/client/:clientId/users/:userId/devices", isAuthenticated, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const userId = parseInt(req.params.userId);
      
      console.log(`💻 Fetching devices for user ${userId} in client ${clientId}`);
      
      // For now, return empty array - this would need proper implementation
      res.json([]);
    } catch (error) {
      console.error(`Error fetching user devices for client:`, error);
      res.status(500).json({ error: "Failed to fetch client user devices" });
    }
  });
  
  // Get user logs for specific client
  app.get("/api/client/:clientId/users/:userId/logs", isAuthenticated, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const userId = parseInt(req.params.userId);
      
      console.log(`📜 Fetching logs for user ${userId} in client ${clientId}`);
      
      // Use client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      
      // For now, return empty array - this would need proper implementation
      res.json([]);
    } catch (error) {
      console.error(`Error fetching user logs for client:`, error);
      res.status(500).json({ error: "Failed to fetch client user logs" });
    }
  });

  // OKTA-specific user action endpoints
  
  // Reset user authenticators (MFA factors)
  app.post("/api/client/:clientId/users/:userId/okta/reset-authenticators", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const userId = parseInt(req.params.userId);
      
      console.log(`🔐 Resetting authenticators for user ${userId} in client ${clientId}`);
      
      // Get client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      
      // Get user from client database
      const [user] = await clientDb.select().from(clientUsers).where(eq(clientUsers.id, userId)).limit(1);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }

      if (!user.oktaId) {
        return res.status(400).json({
          success: false,
          message: "User has no OKTA ID"
        });
      }

      // Get client's OKTA integration settings
      const [oktaIntegration] = await clientDb.select().from(clientIntegrations)
        .where(eq(clientIntegrations.name, 'okta'))
        .limit(1);

      if (!oktaIntegration || !oktaIntegration.apiKeys) {
        return res.status(400).json({
          success: false,
          message: "OKTA integration not configured for this client"
        });
      }

      // Call OKTA API to reset authenticators using client-specific credentials
      const apiKeys = oktaIntegration.apiKeys as Record<string, string>;
      const result = await resetOktaUserAuthenticators(apiKeys, user.oktaId);
      console.log(`Authenticators reset for user ${user.email}:`, result);
      
      res.json({
        success: true,
        message: "Authenticators reset successfully. User will need to re-enroll MFA devices."
      });
    } catch (error) {
      console.error("Reset authenticators error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to reset authenticators",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Clear user sessions
  app.post("/api/client/:clientId/users/:userId/okta/clear-sessions", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const userId = parseInt(req.params.userId);
      
      console.log(`🚪 Clearing sessions for user ${userId} in client ${clientId}`);
      
      // Get client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      
      // Get user from client database
      const [user] = await clientDb.select().from(clientUsers).where(eq(clientUsers.id, userId)).limit(1);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }

      if (!user.oktaId) {
        return res.status(400).json({
          success: false,
          message: "User has no OKTA ID"
        });
      }

      // Get client's OKTA integration settings
      const [oktaIntegration] = await clientDb.select().from(clientIntegrations)
        .where(eq(clientIntegrations.name, 'okta'))
        .limit(1);

      if (!oktaIntegration || !oktaIntegration.apiKeys) {
        return res.status(400).json({
          success: false,
          message: "OKTA integration not configured for this client"
        });
      }

      // Call OKTA API to clear sessions using client-specific credentials
      const apiKeys = oktaIntegration.apiKeys as Record<string, string>;
      const result = await clearOktaUserSessions(apiKeys, user.oktaId);
      console.log(`Sessions cleared for user ${user.email}:`, result);
      
      res.json({
        success: true,
        message: "All user sessions cleared successfully. User has been signed out of all applications."
      });
    } catch (error) {
      console.error("Clear sessions error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to clear sessions",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Reset behavior profile
  app.post("/api/client/:clientId/users/:userId/okta/reset-behavior", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const userId = parseInt(req.params.userId);
      
      console.log(`🧠 Resetting behavior profile for user ${userId} in client ${clientId}`);
      
      // Get client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      
      // Get user from client database
      const [user] = await clientDb.select().from(clientUsers).where(eq(clientUsers.id, userId)).limit(1);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }

      if (!user.oktaId) {
        return res.status(400).json({
          success: false,
          message: "User has no OKTA ID"
        });
      }

      // Get client's OKTA integration settings
      const [oktaIntegration] = await clientDb.select().from(clientIntegrations)
        .where(eq(clientIntegrations.name, 'okta'))
        .limit(1);

      if (!oktaIntegration || !oktaIntegration.apiKeys) {
        return res.status(400).json({
          success: false,
          message: "OKTA integration not configured for this client"
        });
      }

      // Call OKTA API to reset behavior profile using client-specific credentials
      const apiKeys = oktaIntegration.apiKeys as Record<string, string>;
      const result = await resetOktaUserBehaviorProfile(apiKeys, user.oktaId);
      console.log(`Behavior profile reset for user ${user.email}:`, result);
      
      res.json({
        success: true,
        message: "Behavior profile reset successfully. User's authentication patterns have been cleared."
      });
    } catch (error) {
      console.error("Reset behavior profile error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to reset behavior profile",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Client-specific password reset endpoint
  app.post("/api/client/:clientId/users/:userId/password/reset", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const userId = parseInt(req.params.userId);
      
      console.log(`🔑 Resetting password for user ${userId} in client ${clientId}`);
      
      // Get client-specific database connection
      const multiDb = MultiDatabaseManager.getInstance();
      const clientDb = await multiDb.getClientDb(clientId);
      
      // Get user from client database
      const [user] = await clientDb.select().from(clientUsers).where(eq(clientUsers.id, userId)).limit(1);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }

      if (!user.oktaId) {
        return res.status(400).json({
          success: false,
          message: "User has no OKTA ID"
        });
      }

      // Get client's OKTA integration settings
      const [oktaIntegration] = await clientDb.select().from(clientIntegrations)
        .where(eq(clientIntegrations.name, 'okta'))
        .limit(1);

      if (!oktaIntegration || !oktaIntegration.apiKeys) {
        return res.status(400).json({
          success: false,
          message: "OKTA integration not configured for this client"
        });
      }

      // Call OKTA API to reset password using client-specific credentials
      const apiKeys = oktaIntegration.apiKeys as Record<string, string>;
      const result = await resetOktaUserPassword(apiKeys, user.oktaId);
      console.log(`Password reset initiated for user ${user.email}:`, result);
      
      res.json({
        success: true,
        message: "Password reset email sent successfully"
      });
    } catch (error) {
      console.error("Password reset error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to reset password",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
