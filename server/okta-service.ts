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

  async getUserApplications(userId: string): Promise<any[]> {
    try {
      // Get user's applications with assignment details
      const response = await this.makeRequest(`/users/${userId}/apps`);
      
      if (response.ok) {
        const apps = await response.json();
        
        // Also get user's groups to determine Employee Type assignments
        const userGroups = await this.getUserGroups(userId);
        const employeeTypeGroups = userGroups.filter(group => {
          const groupName = group.profile?.name || group.name || '';
          return groupName.toLowerCase().includes('employee') || 
                 groupName.toLowerCase().includes('type') ||
                 groupName.toLowerCase().includes('staff') ||
                 groupName.toLowerCase().includes('role');
        });
        
        // Enhance each app with assignment source information
        const enhancedApps = await Promise.all(apps.map(async (app: any) => {
          try {
            // Check if this app is assigned to any of the user's Employee Type groups
            let isFromEmployeeType = false;
            
            for (const group of employeeTypeGroups) {
              try {
                const groupAppsResponse = await this.makeRequest(`/groups/${group.id}/apps`);
                if (groupAppsResponse.ok) {
                  const groupApps = await groupAppsResponse.json();
                  if (groupApps.some((groupApp: any) => groupApp.id === app.id)) {
                    isFromEmployeeType = true;
                    break;
                  }
                }
              } catch (groupError) {
                // Continue checking other groups if one fails
                continue;
              }
            }
            
            return {
              id: app.id,
              name: app.label,
              isFromEmployeeType
            };
          } catch (appError) {
            // Fallback for individual app errors
            return {
              id: app.id,
              name: app.label,
              isFromEmployeeType: false
            };
          }
        }));
        
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