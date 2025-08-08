import https from 'https';

interface ClientOktaCredentials {
  domain?: string;
  apiToken?: string;
}

export async function createOktaGroup(
  clientCredentials: Record<string, string>,
  groupName: string,
  description?: string
): Promise<{
  success: boolean;
  exists?: boolean;
  groupId?: string;
  message: string;
}> {
  try {
    console.log('🔐 Creating OKTA group with client credentials:', { groupName, description });

    // Extract OKTA credentials from client integration
    const domain = clientCredentials.domain || clientCredentials.oktaDomain;
    const apiToken = clientCredentials.apiToken || clientCredentials.oktaApiToken;

    if (!domain || !apiToken) {
      console.log('❌ Missing OKTA credentials in client integration');
      return {
        success: false,
        message: 'Missing OKTA domain or API token in client integration'
      };
    }

    // Clean domain (remove protocol if present)
    const cleanDomain = domain.replace(/^https?:\/\//, '');

    console.log(`🌐 Using OKTA domain: ${cleanDomain}`);

    // Check if group already exists
    const existingGroup = await makeOktaRequest(cleanDomain, apiToken, `/groups?q=${encodeURIComponent(groupName)}`);
    
    if (existingGroup.length > 0) {
      const matchingGroup = existingGroup.find((group: any) => group.profile?.name === groupName);
      if (matchingGroup) {
        console.log(`✅ OKTA group '${groupName}' already exists`);
        return {
          success: true,
          exists: true,
          groupId: matchingGroup.id,
          message: `Group '${groupName}' already exists`
        };
      }
    }

    // Create the group
    const groupData = {
      profile: {
        name: groupName,
        description: description || `Security group: ${groupName}`
      }
    };

    const newGroup = await makeOktaRequest(
      cleanDomain,
      apiToken,
      '/groups',
      {
        method: 'POST',
        body: JSON.stringify(groupData)
      }
    );

    console.log(`✅ Created OKTA group '${groupName}' with ID: ${newGroup.id}`);
    return {
      success: true,
      exists: false,
      groupId: newGroup.id,
      message: `Successfully created group '${groupName}'`
    };

  } catch (error: any) {
    console.error('❌ Error creating OKTA group:', error);
    return {
      success: false,
      message: error.message || 'Unknown error occurred'
    };
  }
}

async function makeOktaRequest(
  domain: string,
  apiToken: string,
  endpoint: string,
  options: { method?: string; body?: string } = {}
): Promise<any> {
  return new Promise((resolve, reject) => {
    const requestOptions = {
      hostname: domain,
      port: 443,
      path: `/api/v1${endpoint}`,
      method: options.method || 'GET',
      headers: {
        'Authorization': `SSWS ${apiToken}`,
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
          const jsonData = data ? JSON.parse(data) : {};
          
          if (res.statusCode! >= 200 && res.statusCode! < 300) {
            resolve(jsonData);
          } else {
            reject(new Error(`OKTA API Error (${res.statusCode}): ${jsonData.errorSummary || data}`));
          }
        } catch (parseError) {
          reject(new Error(`Failed to parse OKTA API response: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`OKTA API Request Failed: ${error.message}`));
    });

    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}