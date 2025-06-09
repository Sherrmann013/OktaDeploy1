interface KnowBe4GraphConfig {
  apiKey: string;
  baseUrl: string;
}

interface GraphQLQuery {
  query: string;
  variables?: Record<string, any>;
}

interface GraphQLResponse<T = any> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
  }>;
}

class KnowBe4GraphService {
  private config: KnowBe4GraphConfig;

  constructor() {
    const apiKey = process.env.KNOWBE4_GRAPH_API_KEY;
    const graphApiUrl = process.env.KNOWBE4_GRAPH_API_URL;
    
    // If KNOWBE4_GRAPH_API_URL is a JWT token, use it as the API key and construct the URL
    let baseUrl = 'https://us.api.knowbe4.com/graphql';
    let finalApiKey = apiKey;
    
    if (graphApiUrl && graphApiUrl.startsWith('eyJ')) {
      // This looks like a JWT token, use it as the API key
      finalApiKey = graphApiUrl;
      try {
        // Decode JWT to extract site information
        const payload = JSON.parse(atob(graphApiUrl.split('.')[1]));
        if (payload.site) {
          baseUrl = `https://${payload.site}/graphql`;
        }
      } catch (e) {
        console.warn('Could not decode JWT token for site extraction, using default URL');
      }
    } else if (graphApiUrl) {
      baseUrl = graphApiUrl;
    }

    if (!finalApiKey) {
      throw new Error('KNOWBE4_GRAPH_API_KEY environment variable is required');
    }

    this.config = {
      apiKey: finalApiKey,
      baseUrl,
    };
  }

  private async makeGraphQLRequest<T = any>(query: GraphQLQuery): Promise<GraphQLResponse<T>> {
    try {
      console.log('Making GraphQL request to:', this.config.baseUrl);
      console.log('Using API key (first 10 chars):', this.config.apiKey.substring(0, 10) + '...');
      
      const response = await fetch(this.config.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Accept': 'application/json',
        },
        body: JSON.stringify(query),
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.log('Error response body:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      console.log('GraphQL response:', result);
      return result;
    } catch (error) {
      console.error('GraphQL request failed:', error);
      throw error;
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const query: GraphQLQuery = {
        query: `
          query {
            __schema {
              queryType {
                fields {
                  name
                  description
                  type {
                    name
                  }
                }
              }
            }
          }
        `
      };

      const response = await this.makeGraphQLRequest(query);
      
      if (response.errors) {
        return {
          success: false,
          message: `GraphQL errors: ${response.errors.map(e => e.message).join(', ')}`,
          details: response.errors
        };
      }

      return {
        success: true,
        message: 'KnowBe4 Graph API connection successful',
        details: response.data?.account
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to connect to KnowBe4 Graph API: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: error
      };
    }
  }

  async getUserByEmail(email: string): Promise<any> {
    try {
      const query: GraphQLQuery = {
        query: `
          query GetUserByEmail($email: String!) {
            user(email: $email) {
              id
              employeeNumber
              firstName
              lastName
              email
              phishPronePercentage
              currentRiskScore
              status
              joinedOn
              lastSignIn
              jobTitle
              department
              managerName
              managerEmail
              phoneNumber
              organization
              groups {
                id
                name
              }
              trainingEnrollments {
                id
                campaign {
                  id
                  name
                  status
                  startDate
                  endDate
                  durationType
                  groups {
                    id
                    name
                  }
                }
                status
                enrollmentDate
                completionDate
                timeSpent
                policyAcknowledged
              }
              phishingResults {
                id
                campaign {
                  id
                  name
                }
                lastPhishProneDate
                lastClickedDate
                lastRepliedDate
                lastAttachmentOpenedDate
                lastMacroEnabledDate
                lastDataEnteredDate
                lastReportedDate
                lastBouncedDate
              }
            }
          }
        `,
        variables: { email }
      };

      const response = await this.makeGraphQLRequest(query);
      
      if (response.errors) {
        console.error('GraphQL errors:', response.errors);
        return null;
      }

      return response.data?.user;
    } catch (error) {
      console.error('Error fetching user by email from Graph API:', error);
      return null;
    }
  }

  async getTrainingCampaigns(): Promise<any[]> {
    try {
      const query: GraphQLQuery = {
        query: `
          query GetTrainingCampaigns {
            trainingCampaigns {
              id
              name
              status
              startDate
              endDate
              durationType
              autoEnroll
              allowMultipleEnrollments
              groups {
                id
                name
              }
              modules {
                id
                name
                type
                duration
              }
              content {
                id
                name
                type
                duration
                policyUrl
              }
              enrollments {
                id
                user {
                  id
                  email
                  firstName
                  lastName
                }
                status
                enrollmentDate
                completionDate
                timeSpent
                policyAcknowledged
              }
            }
          }
        `
      };

      const response = await this.makeGraphQLRequest(query);
      
      if (response.errors) {
        console.error('GraphQL errors:', response.errors);
        return [];
      }

      return response.data?.trainingCampaigns || [];
    } catch (error) {
      console.error('Error fetching training campaigns from Graph API:', error);
      return [];
    }
  }

  async getUserTrainingEnrollments(userId: string): Promise<any[]> {
    try {
      const query: GraphQLQuery = {
        query: `
          query GetUserTrainingEnrollments($userId: ID!) {
            user(id: $userId) {
              trainingEnrollments {
                id
                campaign {
                  id
                  name
                  status
                  startDate
                  endDate
                  durationType
                }
                status
                enrollmentDate
                completionDate
                timeSpent
                policyAcknowledged
              }
            }
          }
        `,
        variables: { userId }
      };

      const response = await this.makeGraphQLRequest(query);
      
      if (response.errors) {
        console.error('GraphQL errors:', response.errors);
        return [];
      }

      return response.data?.user?.trainingEnrollments || [];
    } catch (error) {
      console.error('Error fetching user training enrollments from Graph API:', error);
      return [];
    }
  }

  async getPhishingCampaigns(): Promise<any[]> {
    try {
      const query: GraphQLQuery = {
        query: `
          query GetPhishingCampaigns {
            phishingCampaigns {
              id
              name
              status
              lastPhishPronePercentage
              lastRun
              sendDuration
              trackDuration
              frequency
              difficultyFilter
              createDate
              groups {
                id
                name
              }
              tests {
                id
                name
                status
                phishPronePercentage
                startedAt
                duration
                categories {
                  id
                  name
                }
                template {
                  id
                  name
                  difficulty
                  type
                }
                landingPage {
                  id
                  name
                }
                results {
                  scheduledCount
                  deliveredCount
                  openedCount
                  clickedCount
                  repliedCount
                  attachmentOpenCount
                  macroEnabledCount
                  dataEnteredCount
                  reportedCount
                  bouncedCount
                }
              }
            }
          }
        `
      };

      const response = await this.makeGraphQLRequest(query);
      
      if (response.errors) {
        console.error('GraphQL errors:', response.errors);
        return [];
      }

      return response.data?.phishingCampaigns || [];
    } catch (error) {
      console.error('Error fetching phishing campaigns from Graph API:', error);
      return [];
    }
  }

  async searchCampaignsByName(searchTerm: string, campaignType?: 'training' | 'phishing'): Promise<any[]> {
    try {
      let query: GraphQLQuery;

      if (campaignType === 'training') {
        query = {
          query: `
            query SearchTrainingCampaigns($searchTerm: String!) {
              trainingCampaigns(filter: { name: { contains: $searchTerm } }) {
                id
                name
                status
                startDate
                endDate
                durationType
                groups {
                  id
                  name
                }
              }
            }
          `,
          variables: { searchTerm }
        };
      } else if (campaignType === 'phishing') {
        query = {
          query: `
            query SearchPhishingCampaigns($searchTerm: String!) {
              phishingCampaigns(filter: { name: { contains: $searchTerm } }) {
                id
                name
                status
                lastPhishPronePercentage
                lastRun
                groups {
                  id
                  name
                }
              }
            }
          `,
          variables: { searchTerm }
        };
      } else {
        // Search both types
        query = {
          query: `
            query SearchAllCampaigns($searchTerm: String!) {
              trainingCampaigns(filter: { name: { contains: $searchTerm } }) {
                id
                name
                status
                type: __typename
                startDate
                endDate
                groups {
                  id
                  name
                }
              }
              phishingCampaigns(filter: { name: { contains: $searchTerm } }) {
                id
                name
                status
                type: __typename
                lastRun
                groups {
                  id
                  name
                }
              }
            }
          `,
          variables: { searchTerm }
        };
      }

      const response = await this.makeGraphQLRequest(query);
      
      if (response.errors) {
        console.error('GraphQL errors:', response.errors);
        return [];
      }

      if (campaignType === 'training') {
        return response.data?.trainingCampaigns || [];
      } else if (campaignType === 'phishing') {
        return response.data?.phishingCampaigns || [];
      } else {
        // Combine both types
        const training = response.data?.trainingCampaigns || [];
        const phishing = response.data?.phishingCampaigns || [];
        return [...training, ...phishing];
      }
    } catch (error) {
      console.error('Error searching campaigns from Graph API:', error);
      return [];
    }
  }
}

export const knowBe4GraphService = new KnowBe4GraphService();