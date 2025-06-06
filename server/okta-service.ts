import https from 'https';

interface OktaConfig {
  domain: string;
  apiToken: string;
}

class OktaService {
  private config: OktaConfig;
  private baseUrl: string;

  constructor() {
    const domain = process.env.OKTA_DOMAIN;
    const apiToken = process.env.OKTA_API_TOKEN;

    if (!domain || !apiToken) {
      throw new Error('OKTA_DOMAIN and OKTA_API_TOKEN environment variables are required');
    }

    this.config = {
      domain: domain.replace(/^https?:\/\//, ''), // Remove protocol if present
      apiToken
    };
    
    this.baseUrl = `https://${this.config.domain}/api/v1`;
  }

  private async makeRequest(endpoint: string, options: { method?: string; body?: string } = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      const requestOptions = {
        hostname: this.config.domain,
        port: 443,
        path: `/api/v1${endpoint}`,
        method: options.method || 'GET',
        headers: {
          'Authorization': `SSWS ${this.config.apiToken}`,
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
        
        // Debug logging for manager field issue
        if (email === 'kboundy@mazetx.com') {
          console.log('=== OKTA DEBUG FOR kboundy@mazetx.com ===');
          console.log('Manager field:', userData.profile?.manager);
          console.log('ManagerId field:', userData.profile?.managerId);
          console.log('Full profile keys:', Object.keys(userData.profile || {}));
          console.log('Profile object:', JSON.stringify(userData.profile, null, 2));
        }
        
        return userData;
      } else {
        const errorText = await response.text();
        throw new Error(`Failed to get user: ${response.status} ${response.statusText} - ${errorText}`);
      }
    } catch (error) {
      throw new Error(`OKTA API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getUsers(limit: number = 200): Promise<any[]> {
    try {
      let allUsers: any[] = [];
      let after = '';
      
      do {
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
      
      return allUsers;
    } catch (error) {
      throw new Error(`OKTA API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getUserGroups(userId: string): Promise<any[]> {
    try {
      const response = await this.makeRequest(`/users/${userId}/groups`);
      
      if (response.ok) {
        return await response.json();
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
    try {
      // Clear cache to force reload with new group filtering logic
      this.employeeTypeAppsCache = null;
      
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
}

export const oktaService = new OktaService();