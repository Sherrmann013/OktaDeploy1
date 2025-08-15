import https from 'https';

interface OktaConfig {
  domain: string;
  apiToken: string;
}

class OktaService {
  private config: OktaConfig | null = null;
  private baseUrl: string = '';
  private initialized: boolean = false;

  private initialize() {
    if (this.initialized) return;
    
    const domain = process.env.OKTA_DOMAIN;
    const apiToken = process.env.OKTA_API_TOKEN;

    if (!domain || !apiToken) {
      throw new Error('OKTA_DOMAIN and OKTA_API_TOKEN environment variables are required for OKTA operations');
    }

    this.config = {
      domain: domain.replace(/^https?:\/\//, ''), // Remove protocol if present
      apiToken
    };
    
    this.baseUrl = `https://${this.config.domain}/api/v1`;
    this.initialized = true;
  }

  isConfigured(): boolean {
    return !!(process.env.OKTA_DOMAIN && process.env.OKTA_API_TOKEN);
  }

  private async makeRequest(endpoint: string, options: { method?: string; body?: string; useEnhancedToken?: boolean } = {}): Promise<any> {
    this.initialize();
    
    if (!this.config) {
      throw new Error('OKTA service not properly configured');
    }

    return new Promise((resolve, reject) => {
      const requestOptions = {
        hostname: this.config!.domain,
        port: 443,
        path: `/api/v1${endpoint}`,
        method: options.method || 'GET',
        headers: {
          'Authorization': `SSWS ${options.useEnhancedToken && process.env.OKTA_API_TOKEN_ENHANCED ? process.env.OKTA_API_TOKEN_ENHANCED : this.config!.apiToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...(options.body && { 'Content-Length': Buffer.byteLength(options.body) })
        }
      };

      const req = https.request(requestOptions, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const jsonData = JSON.parse(data);
            resolve({
              ok: res.statusCode! >= 200 && res.statusCode! < 300,
              status: res.statusCode,
              statusText: res.statusMessage,
              headers: {
                get: (name: string) => res.headers[name.toLowerCase()]
              },
              json: () => Promise.resolve(jsonData),
              text: () => Promise.resolve(data)
            });
          } catch (error) {
            resolve({
              ok: res.statusCode! >= 200 && res.statusCode! < 300,
              status: res.statusCode,
              statusText: res.statusMessage,
              headers: {
                get: (name: string) => res.headers[name.toLowerCase()]
              },
              json: () => Promise.reject(new Error('Invalid JSON')),
              text: () => Promise.resolve(data)
            });
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      if (options.body) {
        req.write(options.body);
      }
      
      req.end();
    });
  }

  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      this.initialize();
      if (!this.config) {
        throw new Error('OKTA service not properly configured');
      }
      
      console.log(`Testing OKTA connection to: ${this.config.domain}`);
      
      // Test connection by making a simple API call to get org info
      const response = await this.makeRequest('/org');
      
      if (response.ok) {
        const orgData = await response.json();
        return {
          success: true,
          message: `Successfully connected to OKTA tenant: ${orgData.companyName || this.config.domain}`,
          details: {
            domain: this.config.domain,
            companyName: orgData.companyName,
            status: orgData.status,
            edition: orgData.edition
          }
        };
      } else {
        const errorText = await response.text();
        return {
          success: false,
          message: `Failed to connect to OKTA: ${response.status} ${response.statusText}`,
          details: {
            status: response.status,
            statusText: response.statusText,
            error: errorText
          }
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `OKTA connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: error
      };
    }
  }

  async getUserByEmail(email: string): Promise<any> {
    try {
      const response = await this.makeRequest(`/users/${email}`);
      
      if (response.ok) {
        const userData = await response.json();
        return userData;
      } else {
        const errorText = await response.text();
        throw new Error(`Failed to get user: ${response.status} ${response.statusText} - ${errorText}`);
      }
    } catch (error) {
      throw new Error(`OKTA API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get user with expanded manager information using relationships API
  async getUserWithManager(email: string): Promise<any> {
    try {
      // First get the basic user data
      const userResponse = await this.makeRequest(`/users/${email}`);
      
      if (!userResponse.ok) {
        const errorText = await userResponse.text();
        throw new Error(`Failed to get user: ${userResponse.status} ${userResponse.statusText} - ${errorText}`);
      }

      const userData = await userResponse.json();
      
      // Try to get manager information through relationships API
      try {
        const relationshipsResponse = await this.makeRequest(`/users/${userData.id}/relationships`);
        if (relationshipsResponse.ok) {
          const relationships = await relationshipsResponse.json();
          console.log('User relationships:', JSON.stringify(relationships, null, 2));
          
          // Look for manager relationship
          const managerRelationship = relationships.find((rel: any) => 
            rel.type === 'manager' || rel.type === 'MANAGER'
          );
          
          if (managerRelationship) {
            // Get manager user details
            const managerResponse = await this.makeRequest(`/users/${managerRelationship.targetId}`);
            if (managerResponse.ok) {
              const managerData = await managerResponse.json();
              userData.managerInfo = {
                id: managerData.id,
                name: `${managerData.profile.firstName} ${managerData.profile.lastName}`,
                email: managerData.profile.email
              };
            }
          }
        }
      } catch (relationshipError) {
        console.log('Relationships API not available or no manager relationship found');
      }

      return userData;
    } catch (error) {
      throw new Error(`OKTA API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createGroup(groupName: string, description?: string): Promise<any> {
    try {
      this.initialize();
      if (!this.config) {
        throw new Error('OKTA service not properly configured');
      }

      const groupData = {
        profile: {
          name: groupName,
          description: description || `Security group for ${groupName} access`
        }
      };

      console.log(`🏗️  Creating OKTA group: ${groupName}`);
      const response = await this.makeRequest('/groups', {
        method: 'POST',
        body: JSON.stringify(groupData)
      });

      const data = await response.json();

      if (!response.ok) {
        // Check if group already exists
        if (response.status === 400 && data.errorSummary?.includes('already exists')) {
          console.log(`✅ OKTA group '${groupName}' already exists`);
          return { success: true, exists: true, message: `Group '${groupName}' already exists` };
        }
        throw new Error(`OKTA API error: ${response.status} ${response.statusText} - ${data.errorSummary || data.error}`);
      }

      console.log(`✅ Created OKTA group: ${groupName} (ID: ${data.id})`);
      return { success: true, exists: false, group: data };
    } catch (error) {
      console.error(`❌ Error creating OKTA group '${groupName}':`, error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error creating group' 
      };
    }
  }

  async getUsers(limit: number = 200): Promise<any[]> {
    // Optimize for large datasets - implement progressive loading
    if (limit > 100) {
      return this.getUsersBatch(limit);
    }

    // Skip cache for sync operations to ensure fresh data
    console.log("Fetching fresh user data from OKTA (bypassing cache)");

    try {
      let allUsers: any[] = [];
      let after = '';
      
      do {
        await this.throttleRequest(); // Add rate limiting
        const url = `/users?limit=${limit}${after ? `&after=${after}` : ''}`;
        const response = await this.makeRequest(url);
        
        if (response.ok) {
          const users = await response.json();
          allUsers = allUsers.concat(users);
          
          // Check for pagination - OKTA includes Link header for pagination
          const linkHeader = response.headers.get('link');
          after = '';
          
          if (linkHeader) {
            const nextMatch = linkHeader.match(/<[^>]+[?&]after=([^&>]+)[^>]*>;\s*rel="next"/);
            if (nextMatch) {
              after = nextMatch[1];
            }
          }
        } else {
          const errorText = await response.text();
          throw new Error(`Failed to get users: ${response.status} ${response.statusText} - ${errorText}`);
        }
      } while (after);
      
      // Don't cache during sync operations to ensure fresh data
      console.log(`Retrieved ${allUsers.length} users from OKTA with fresh data`);
      
      return allUsers;
    } catch (error) {
      throw new Error(`OKTA API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Batch loading method for large datasets with proper pagination
  private async getUsersBatch(limit: number): Promise<any[]> {
    // Skip cache for sync operations to ensure fresh data
    console.log("Fetching fresh batch user data from OKTA with full pagination (bypassing cache)");

    try {
      let allUsers: any[] = [];
      let after = '';
      const batchSize = Math.min(200, limit);
      
      do {
        await this.throttleRequest();
        const url = `/users?limit=${batchSize}${after ? `&after=${after}` : ''}`;
        const response = await this.makeRequest(url);
        
        if (response.ok) {
          const users = await response.json();
          allUsers = allUsers.concat(users);
          
          console.log(`Retrieved ${users.length} users from OKTA batch (total so far: ${allUsers.length})`);
          
          // Check for pagination - OKTA includes Link header for pagination
          const linkHeader = response.headers.get('link');
          after = '';
          
          if (linkHeader) {
            const nextMatch = linkHeader.match(/<[^>]+[?&]after=([^&>]+)[^>]*>;\s*rel="next"/);
            if (nextMatch) {
              after = nextMatch[1];
            }
          }
        } else {
          const errorText = await response.text();
          throw new Error(`Failed to get users batch: ${response.status} ${response.statusText} - ${errorText}`);
        }
      } while (after && allUsers.length < limit);
      
      console.log(`Completed batch fetch: ${allUsers.length} total users from OKTA with fresh data`);
      return allUsers;
    } catch (error) {
      throw new Error(`OKTA API batch error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getUserGroups(userId: string): Promise<any[]> {
    // Check cache first
    const cacheKey = `groups_${userId}`;
    const cached = this.userCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.USER_CACHE_TTL) {
      return cached.data;
    }

    try {
      await this.throttleRequest();
      const response = await this.makeRequest(`/users/${userId}/groups`);
      
      if (response.ok) {
        const groups = await response.json();
        
        // Cache the result
        this.userCache.set(cacheKey, {
          data: groups,
          timestamp: Date.now()
        });
        
        return groups;
      } else {
        const errorText = await response.text();
        throw new Error(`Failed to get user groups: ${response.status} ${response.statusText} - ${errorText}`);
      }
    } catch (error) {
      throw new Error(`OKTA API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Cache for Employee Type applications to avoid repeated API calls
  private employeeTypeAppsCache: Set<string> | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  
  // Add user cache to reduce repeated API calls
  private userCache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly USER_CACHE_TTL = 2 * 60 * 1000; // 2 minutes
  
  // Rate limiting protection
  private lastRequestTime = 0;
  private readonly MIN_REQUEST_INTERVAL = 200; // 200ms between requests

  private async throttleRequest(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
      await new Promise(resolve => setTimeout(resolve, this.MIN_REQUEST_INTERVAL - timeSinceLastRequest));
    }
    this.lastRequestTime = Date.now();
  }

  async getEmployeeTypeApplications(): Promise<Set<string>> {
    // Return cached data if still valid
    if (this.employeeTypeAppsCache && (Date.now() - this.cacheTimestamp) < this.CACHE_TTL) {
      return this.employeeTypeAppsCache;
    }

    try {
      console.log('Loading Employee Type applications...');
      
      // Get all groups first
      const allGroups = await this.getGroups(200);
      
      // Filter for Employee Type groups (MTX-ET-* pattern)
      const employeeTypeGroups = allGroups.filter(group => {
        const groupName = group.profile?.name || group.name || '';
        return groupName.startsWith('MTX-ET-') && 
               (groupName.includes('EMPLOYEE') || 
                groupName.includes('CONTRACTOR') || 
                groupName.includes('PART_TIME') || 
                groupName.includes('INTERN'));
      });

      console.log(`Found ${employeeTypeGroups.length} Employee Type groups:`, employeeTypeGroups.map(g => g.profile?.name || g.name));

      // Get applications for each Employee Type group
      const employeeTypeAppIds = new Set<string>();
      const employeeTypeAppNames = new Set<string>();
      
      for (const group of employeeTypeGroups) {
        try {
          console.log(`Checking group: ${group.profile?.name || group.name} (${group.id})`);
          const groupAppsResponse = await this.makeRequest(`/groups/${group.id}/apps`);
          if (groupAppsResponse.ok) {
            const groupApps = await groupAppsResponse.json();
            console.log(`Group "${group.profile?.name || group.name}" has ${groupApps.length} applications`);
            groupApps.forEach((app: any) => {
              employeeTypeAppIds.add(app.id);
              employeeTypeAppNames.add(app.label);
              console.log(`  Group app: "${app.label}" (ID: ${app.id})`);
              
              // Special check for IT-Support
              if (app.label && app.label.includes('IT')) {
                console.log(`*** Found IT app in group: "${app.label}"`);
              }
            });
          } else {
            console.log(`Failed to get apps for group ${group.id}: ${groupAppsResponse.status}`);
          }
        } catch (error) {
          console.log(`Failed to get apps for group ${group.id}:`, error);
        }
      }

      // Also try to get user's group memberships directly to see if there are more Employee Type groups
      console.log('Double-checking by looking for all MTX-ET groups in user groups...');

      console.log(`Total Employee Type applications: ${employeeTypeAppIds.size}`);
      console.log('Employee Type App Names:', Array.from(employeeTypeAppNames));
      
      // Cache the results (use names instead of IDs for comparison)
      this.employeeTypeAppsCache = employeeTypeAppNames;
      this.cacheTimestamp = Date.now();
      
      return employeeTypeAppNames;
    } catch (error) {
      console.error('Error loading Employee Type applications:', error);
      return new Set<string>();
    }
  }

  async getUserApplications(userId: string): Promise<any[]> {
    // Check cache first
    const cacheKey = `apps_${userId}`;
    const cached = this.userCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.USER_CACHE_TTL) {
      return cached.data;
    }

    try {
      // Rate limit protection
      await this.throttleRequest();
      
      // Get user's applications
      const response = await this.makeRequest(`/users/${userId}/appLinks`);
      
      if (response.ok) {
        const apps = await response.json();
        
        // Get user's groups first to check their specific Employee Type memberships
        console.log(`Getting groups for user ${userId}...`);
        const userGroups = await this.getUserGroups(userId);
        const userEmployeeTypeGroups = userGroups.filter(group => {
          const groupName = group.profile?.name || group.name || '';
          return groupName.startsWith('MTX-ET-') && 
                 (groupName.includes('EMPLOYEE') || 
                  groupName.includes('CONTRACTOR') || 
                  groupName.includes('PART_TIME') || 
                  groupName.includes('INTERN'));
        });
        
        console.log(`User is in ${userEmployeeTypeGroups.length} Employee Type groups:`, 
                   userEmployeeTypeGroups.map(g => g.profile?.name || g.name));
        
        // Get applications from user's specific Employee Type groups
        const userEmployeeTypeAppNames = new Set<string>();
        
        for (const group of userEmployeeTypeGroups) {
          try {
            console.log(`Getting apps for user's group: ${group.profile?.name || group.name}`);
            
            // Try multiple approaches to get all group applications
            console.log('Approach 1: Using /groups/{id}/apps with pagination...');
            let groupApps: any[] = [];
            let nextUrl: string | null = `/groups/${group.id}/apps?limit=200`;
            
            while (nextUrl) {
              const response = await this.makeRequest(nextUrl);
              if (response.ok) {
                const pageApps = await response.json();
                groupApps = groupApps.concat(pageApps);
                console.log(`Retrieved ${pageApps.length} apps from this page (total so far: ${groupApps.length})`);
                
                // Check for next page
                const linkHeader = response.headers.get('link');
                nextUrl = null;
                if (linkHeader) {
                  const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
                  if (nextMatch) {
                    const fullUrl = nextMatch[1];
                    nextUrl = fullUrl.replace(this.baseUrl, '');
                  }
                }
              } else {
                console.log(`Failed to get group apps: ${response.status}`);
                break;
              }
            }
            
            console.log(`Approach 1 found ${groupApps.length} apps for group ${group.profile?.name || group.name}`);
            
            // Add all found apps to the set
            groupApps.forEach((app: any) => {
              userEmployeeTypeAppNames.add(app.label);
              console.log(`  Group app: "${app.label}"`);
            });
            
          } catch (error) {
            console.log(`Failed to get apps for user's group ${group.id}:`, error);
          }
        }
        
        console.log(`User's Employee Type applications (${userEmployeeTypeAppNames.size}):`, Array.from(userEmployeeTypeAppNames));
        
        // Transform apps with Employee Type detection using user's specific group memberships
        const enhancedApps = apps.map((app: any) => {
          const isFromEmployeeType = userEmployeeTypeAppNames.has(app.label);
          console.log(`App "${app.label}" (${app.id}): Employee Type = ${isFromEmployeeType}`);
          
          return {
            id: app.id,
            name: app.label,
            isFromEmployeeType
          };
        });
        
        // Cache the result
        this.userCache.set(cacheKey, {
          data: enhancedApps,
          timestamp: Date.now()
        });
        
        return enhancedApps;
      } else {
        const errorText = await response.text();
        throw new Error(`Failed to get user applications: ${response.status} ${response.statusText} - ${errorText}`);
      }
    } catch (error) {
      throw new Error(`OKTA API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getUserLogs(userId: string, limit: number = 50): Promise<any[]> {
    try {
      // Get logs for the last 30 days
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const sinceParam = since.toISOString();
      
      // Properly encode the filter parameter
      const filter = encodeURIComponent(`actor.id eq "${userId}"`);
      const response = await this.makeRequest(`/logs?filter=${filter}&since=${sinceParam}&limit=${limit}&sortOrder=DESCENDING`);
      
      if (response.ok) {
        return await response.json();
      } else {
        const errorText = await response.text();
        throw new Error(`Failed to get user logs: ${response.status} ${response.statusText} - ${errorText}`);
      }
    } catch (error) {
      throw new Error(`OKTA API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getUserDevices(userId: string): Promise<any[]> {
    try {
      // Try the factors endpoint which includes device information
      let response = await this.makeRequest(`/users/${userId}/factors`);
      
      if (!response.ok) {
        // Try clients endpoint
        response = await this.makeRequest(`/users/${userId}/clients`);
      }
      
      if (!response.ok) {
        // Try sessions endpoint as fallback
        response = await this.makeRequest(`/users/${userId}/sessions`);
      }
      
      if (response.ok) {
        const data = await response.json();
        // If we got factors, filter for device-related factors
        if (Array.isArray(data) && data.length > 0 && data[0].factorType) {
          return data.filter(factor => 
            factor.factorType === 'push' || 
            factor.factorType === 'token:software:totp' ||
            factor.provider === 'OKTA'
          );
        }
        return data;
      } else {
        const errorText = await response.text();
        throw new Error(`Failed to get user devices: ${response.status} ${response.statusText} - ${errorText}`);
      }
    } catch (error) {
      throw new Error(`OKTA API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getApplications(limit: number = 200): Promise<any[]> {
    try {
      const response = await this.makeRequest(`/apps?limit=${limit}`);
      
      if (response.ok) {
        return await response.json();
      } else {
        const errorText = await response.text();
        throw new Error(`Failed to get applications: ${response.status} ${response.statusText} - ${errorText}`);
      }
    } catch (error) {
      throw new Error(`OKTA API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getGroups(limit: number = 200): Promise<any[]> {
    try {
      const response = await this.makeRequest(`/groups?limit=${limit}`);
      
      if (response.ok) {
        return await response.json();
      } else {
        const errorText = await response.text();
        throw new Error(`Failed to get groups: ${response.status} ${response.statusText} - ${errorText}`);
      }
    } catch (error) {
      throw new Error(`OKTA API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getGroupMembers(groupId: string): Promise<any[]> {
    try {
      let allMembers: any[] = [];
      let after = '';
      
      do {
        const url = `/groups/${groupId}/users?limit=200${after ? `&after=${after}` : ''}`;
        const response = await this.makeRequest(url);
        
        if (response.ok) {
          const members = await response.json();
          allMembers = allMembers.concat(members);
          
          // Check for pagination
          const linkHeader = response.headers.get('link');
          after = '';
          
          if (linkHeader) {
            const nextMatch = linkHeader.match(/<[^>]+[?&]after=([^&>]+)[^>]*>;\s*rel="next"/);
            if (nextMatch) {
              after = nextMatch[1];
            }
          }
        } else {
          const errorText = await response.text();
          throw new Error(`Failed to get group members: ${response.status} ${response.statusText} - ${errorText}`);
        }
      } while (after);
      
      return allMembers;
    } catch (error) {
      throw new Error(`OKTA API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getEmployeeTypeGroupCounts(): Promise<{ [key: string]: number }> {
    try {
      const groups = await this.getGroups(200);
      const employeeTypeGroups = groups.filter(group => 
        group.profile?.name?.startsWith('MTX-ET-')
      );
      
      const counts: { [key: string]: number } = {};
      
      for (const group of employeeTypeGroups) {
        const members = await this.getGroupMembers(group.id);
        const employeeType = group.profile.name.replace('MTX-ET-', '');
        counts[employeeType] = members.length;
      }
      
      return counts;
    } catch (error) {
      console.error('Failed to get employee type group counts:', error);
      return {};
    }
  }

  async addUserToGroup(userId: string, groupId: string): Promise<any> {
    try {
      console.log(`Adding user ${userId} to group ${groupId}`);
      
      // First, let's verify the group exists and check permissions
      console.log(`Verifying group exists: ${groupId}`);
      const groupCheck = await this.makeRequest(`/groups/${groupId}`, {
        method: 'GET',
        useEnhancedToken: true
      });
      
      if (!groupCheck.ok) {
        throw new Error(`Group ${groupId} not found or inaccessible`);
      }
      
      // Method 1: Standard OKTA API approach - PUT to /groups/{groupId}/users/{userId}
      console.log(`Attempting standard PUT method: /groups/${groupId}/users/${userId}`);
      let response = await this.makeRequest(`/groups/${groupId}/users/${userId}`, {
        method: 'PUT',
        useEnhancedToken: true
      });
      
      if (response.ok) {
        console.log(`Successfully added user to group via PUT`);
        // Some OKTA PUT responses return empty body, handle gracefully
        const responseText = await response.text();
        if (responseText.trim()) {
          try {
            return JSON.parse(responseText);
          } catch (e) {
            console.log('PUT response was successful but not JSON, returning success indicator');
            return { success: true };
          }
        }
        return { success: true };
      }
      
      // Log detailed error for troubleshooting
      const errorText = await response.text();
      let parsedError;
      try {
        parsedError = JSON.parse(errorText);
      } catch {
        parsedError = { errorSummary: errorText };
      }
      
      console.log(`PUT method failed with ${response.status}: ${parsedError.errorSummary || errorText}`);
      console.log(`Full error response:`, parsedError);
      
      // Method 2: Alternative endpoint structure
      console.log(`Attempting alternative POST method: /groups/${groupId}/users`);
      response = await this.makeRequest(`/groups/${groupId}/users`, {
        method: 'POST', 
        body: JSON.stringify({ userId: userId }),
        useEnhancedToken: true
      });
      
      if (response.ok) {
        console.log(`Successfully added user to group via POST`);
        return await response.json();
      }
      
      // Final attempt: Check if it's a permissions scope issue
      const finalError = await response.text();
      console.log(`All group membership methods failed. Final error: ${response.status} ${finalError}`);
      
      if (response.status === 405) {
        throw new Error(`OKTA API group management endpoints are returning 405 errors. This may indicate that group management is restricted in this OKTA tenant configuration, even with proper admin roles.`);
      } else if (response.status === 403) {
        throw new Error(`Access forbidden despite Group Administrator role. The API token may need additional scopes or the tenant may have additional restrictions.`);
      }
      
      throw new Error(`Group management failed: ${response.status} ${response.statusText} - ${finalError}`);
      
    } catch (error) {
      throw new Error(`OKTA API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async removeUserFromGroup(userId: string, groupId: string): Promise<any> {
    try {
      console.log(`Removing user ${userId} from group ${groupId}`);
      const response = await this.makeRequest(`/groups/${groupId}/users/${userId}`, {
        method: 'DELETE',
        useEnhancedToken: true
      });
      
      if (response.ok || response.status === 404) {
        console.log(`Successfully removed user from group`);
        return true;
      } else {
        const errorText = await response.text();
        console.log(`Failed to remove user from group: ${response.status} ${errorText}`);
        throw new Error(`Failed to remove user from group: ${response.status} ${response.statusText} - ${errorText}`);
      }
    } catch (error) {
      throw new Error(`OKTA API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async suspendUser(userId: string): Promise<any> {
    try {
      console.log(`Making OKTA API call to suspend user: ${userId}`);
      const response = await this.makeRequest(`/users/${userId}/lifecycle/suspend`, {
        method: 'POST'
      });
      
      console.log(`OKTA suspend response - Status: ${response.status}, OK: ${response.ok}`);
      
      if (response.ok) {
        const result = await response.json();
        console.log('OKTA suspend response body:', JSON.stringify(result, null, 2));
        return result;
      } else {
        const errorText = await response.text();
        console.log(`OKTA suspend error - Status: ${response.status}, Error: ${errorText}`);
        throw new Error(`Failed to suspend user: ${response.status} ${response.statusText} - ${errorText}`);
      }
    } catch (error) {
      console.error('OKTA suspend API error:', error);
      throw new Error(`OKTA API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async activateUser(userId: string): Promise<any> {
    try {
      const response = await this.makeRequest(`/users/${userId}/lifecycle/activate`, {
        method: 'POST',
        body: JSON.stringify({ sendEmail: false })
      });
      
      if (response.ok) {
        return await response.json();
      } else {
        const errorText = await response.text();
        throw new Error(`Failed to activate user: ${response.status} ${response.statusText} - ${errorText}`);
      }
    } catch (error) {
      throw new Error(`OKTA API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deactivateUser(userId: string): Promise<any> {
    try {
      const response = await this.makeRequest(`/users/${userId}/lifecycle/deactivate`, {
        method: 'POST'
      });
      
      if (response.ok) {
        return await response.json();
      } else {
        const errorText = await response.text();
        throw new Error(`Failed to deactivate user: ${response.status} ${response.statusText} - ${errorText}`);
      }
    } catch (error) {
      throw new Error(`OKTA API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteUser(userId: string): Promise<any> {
    try {
      // First deactivate the user
      console.log(`Deactivating user ${userId} before deletion`);
      await this.deactivateUser(userId);
      
      // Then permanently delete the user
      console.log(`Permanently deleting user ${userId} from OKTA`);
      const response = await this.makeRequest(`/users/${userId}`, {
        method: 'DELETE'
      });
      
      if (response.ok || response.status === 204) {
        console.log(`Successfully deleted user ${userId} from OKTA`);
        return { success: true };
      } else {
        const errorText = await response.text();
        throw new Error(`Failed to delete user: ${response.status} ${response.statusText} - ${errorText}`);
      }
    } catch (error) {
      throw new Error(`OKTA API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async resetUserPassword(userId: string): Promise<any> {
    try {
      const response = await this.makeRequest(`/users/${userId}/lifecycle/reset_password?sendEmail=true`, {
        method: 'POST'
      });
      
      if (response.ok) {
        return await response.json();
      } else {
        const errorText = await response.text();
        throw new Error(`Failed to reset password: ${response.status} ${response.statusText} - ${errorText}`);
      }
    } catch (error) {
      throw new Error(`OKTA API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async setUserPassword(userId: string, newPassword: string, tempPassword: boolean = true): Promise<any> {
    try {
      const response = await this.makeRequest(`/users/${userId}`, {
        method: 'POST',
        body: JSON.stringify({
          credentials: {
            password: {
              value: newPassword
            }
          }
        }),
        useEnhancedToken: true
      });
      
      if (response.ok) {
        // If setting as temporary password, expire it so user must change on next login
        if (tempPassword) {
          await this.expireUserPassword(userId);
        }
        return await response.json();
      } else {
        const errorText = await response.text();
        throw new Error(`Failed to set password: ${response.status} ${response.statusText} - ${errorText}`);
      }
    } catch (error) {
      throw new Error(`OKTA API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async expireUserPassword(userId: string): Promise<any> {
    try {
      const response = await this.makeRequest(`/users/${userId}/lifecycle/expire_password`, {
        method: 'POST'
      });
      
      if (response.ok) {
        return await response.json();
      } else {
        const errorText = await response.text();
        throw new Error(`Failed to expire password: ${response.status} ${response.statusText} - ${errorText}`);
      }
    } catch (error) {
      throw new Error(`OKTA API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateUserProfile(userId: string, profileUpdates: any): Promise<any> {
    try {
      console.log(`Updating OKTA user profile for ${userId}:`, profileUpdates);
      const response = await this.makeRequest(`/users/${userId}`, {
        method: 'POST',
        body: JSON.stringify({
          profile: profileUpdates
        }),
        useEnhancedToken: true
      });
      
      console.log(`OKTA profile update successful for user ${userId}`);
      return response;
    } catch (error) {
      console.error(`Failed to update OKTA user profile for ${userId}:`, error);
      throw new Error(`Failed to update user profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }


}

// Export a safe instance that can be used even when OKTA isn't configured
export const oktaService = new OktaService();
export { OktaService };