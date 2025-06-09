interface KnowBe4Config {
  apiKey: string;
  baseUrl: string;
}

interface KnowBe4User {
  id: number;
  employee_number: string;
  first_name: string;
  last_name: string;
  email: string;
  phish_prone_percentage: number;
  phone_number: string;
  extension: string;
  mobile_phone_number: string;
  location: string;
  division: string;
  department: string;
  job_title: string;
  employee_start_date: string;
  status: string;
  organization: string;
  comment: string;
  employee_start_date_set_by_admin: boolean;
  tags: string[];
  current_risk_score: number;
  aliases: string[];
  joined_on: string;
  last_sign_in: string;
  provisioning_managed: boolean;
  provisioning_guid: string;
  groups: Array<{
    group_id: number;
    name: string;
  }>;
  current_training_campaign_statuses: Array<{
    campaign_id: number;
    campaign_name: string;
    enrollment_date: string;
    completion_date: string;
    status: string;
    time_spent: number;
    policy_acknowledged: boolean;
  }>;
  phishing_campaign_stats: Array<{
    campaign_id: number;
    campaign_name: string;
    last_phish_prone_date: string;
    last_clicked_date: string;
    last_replied_date: string;
    last_attachment_opened_date: string;
    last_macro_enabled_date: string;
    last_data_entered_date: string;
    last_reported_date: string;
    last_bounced_date: string;
  }>;
}

interface KnowBe4TrainingCampaign {
  campaign_id: number;
  name: string;
  groups: Array<{
    group_id: number;
    name: string;
  }>;
  status: string;
  modules: Array<{
    module_id: number;
    name: string;
    type: string;
    duration: number;
  }>;
  content: Array<{
    content_id: number;
    name: string;
    type: string;
    duration: number;
    policy_url: string;
  }>;
  duration_type: string;
  start_date: string;
  end_date: string;
  relative_duration: string;
  auto_enroll: boolean;
  allow_multiple_enrollments: boolean;
}

interface KnowBe4PhishingCampaign {
  campaign_id: number;
  name: string;
  groups: Array<{
    group_id: number;
    name: string;
  }>;
  last_phish_prone_percentage: number;
  last_run: string;
  status: string;
  hidden: boolean;
  send_duration: string;
  track_duration: string;
  frequency: string;
  difficulty_filter: string[];
  create_date: string;
  psts_count: number;
  psts: Array<{
    pst_id: number;
    status: string;
    name: string;
    groups: Array<{
      group_id: number;
      name: string;
    }>;
    phish_prone_percentage: number;
    started_at: string;
    duration: number;
    categories: Array<{
      category_id: number;
      name: string;
    }>;
    template: {
      id: number;
      name: string;
      difficulty: number;
      type: string;
    };
    landing_page: {
      id: number;
      name: string;
    };
    scheduled_count: number;
    delivered_count: number;
    opened_count: number;
    clicked_count: number;
    replied_count: number;
    attachment_open_count: number;
    macro_enabled_count: number;
    data_entered_count: number;
    reported_count: number;
    bounced_count: number;
  }>;
}

class KnowBe4Service {
  private config: KnowBe4Config;

  constructor() {
    this.config = {
      apiKey: process.env.KNOWBE4_API_KEY || '',
      baseUrl: 'https://us.api.knowbe4.com/v1'
    };

    if (!this.config.apiKey) {
      console.warn('KnowBe4 API key not configured');
    }
  }

  private async makeRequest(endpoint: string, options: { method?: string } = {}): Promise<any> {
    if (!this.config.apiKey) {
      throw new Error('KnowBe4 API key not configured');
    }

    const url = `${this.config.baseUrl}${endpoint}`;
    const { method = 'GET' } = options;

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Replit-KnowBe4-Integration/1.0'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`KnowBe4 API error (${response.status}): ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('KnowBe4 API request failed:', error);
      throw error;
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      console.log('Testing KnowBe4 API with token length:', this.config.apiKey ? this.config.apiKey.length : 0);
      console.log('Token starts with:', this.config.apiKey ? this.config.apiKey.substring(0, 10) : 'N/A');
      console.log('API URL:', `${this.config.baseUrl}/account`);
      
      // Try different endpoints to test API access
      let response;
      try {
        response = await this.makeRequest('/account');
      } catch (accountError) {
        console.log('Account endpoint failed, trying users endpoint...');
        response = await this.makeRequest('/users?page=1&per_page=1');
      }
      
      return {
        success: true,
        message: 'KnowBe4 API connection successful',
        details: response
      };
    } catch (error: any) {
      console.log('KnowBe4 API error details:', error);
      return {
        success: false,
        message: `KnowBe4 API connection failed: ${error.message}`,
        details: error
      };
    }
  }

  async getUsers(page: number = 1, per_page: number = 500): Promise<KnowBe4User[]> {
    const endpoint = `/users?page=${page}&per_page=${per_page}`;
    return await this.makeRequest(endpoint);
  }

  async getUserByEmail(email: string): Promise<KnowBe4User | null> {
    try {
      const users = await this.getUsers();
      return users.find(user => user.email.toLowerCase() === email.toLowerCase()) || null;
    } catch (error) {
      console.error('Error fetching KnowBe4 user:', error);
      return null;
    }
  }

  async getUserById(userId: number): Promise<KnowBe4User | null> {
    try {
      const endpoint = `/users/${userId}`;
      return await this.makeRequest(endpoint);
    } catch (error) {
      console.error('Error fetching KnowBe4 user by ID:', error);
      return null;
    }
  }

  async getTrainingCampaigns(): Promise<KnowBe4TrainingCampaign[]> {
    try {
      const endpoint = '/training/campaigns';
      return await this.makeRequest(endpoint);
    } catch (error) {
      console.error('Error fetching training campaigns:', error);
      return [];
    }
  }

  async getPhishingCampaigns(): Promise<KnowBe4PhishingCampaign[]> {
    try {
      const endpoint = '/phishing/campaigns';
      return await this.makeRequest(endpoint);
    } catch (error) {
      console.error('Error fetching phishing campaigns:', error);
      return [];
    }
  }

  async getUserTrainingEnrollments(userId: number): Promise<any[]> {
    try {
      const endpoint = `/users/${userId}/training/enrollments`;
      return await this.makeRequest(endpoint);
    } catch (error) {
      console.error('Error fetching user training enrollments:', error);
      return [];
    }
  }

  async getUserPhishingResults(userId: number): Promise<any[]> {
    try {
      const endpoint = `/users/${userId}/phishing/security_tests`;
      return await this.makeRequest(endpoint);
    } catch (error) {
      console.error('Error fetching user phishing results:', error);
      return [];
    }
  }

  async getGroups(): Promise<any[]> {
    try {
      const endpoint = '/groups';
      return await this.makeRequest(endpoint);
    } catch (error) {
      console.error('Error fetching KnowBe4 groups:', error);
      return [];
    }
  }

  async getAccountStats(): Promise<any> {
    try {
      const endpoint = '/account';
      return await this.makeRequest(endpoint);
    } catch (error) {
      console.error('Error fetching account stats:', error);
      return null;
    }
  }

  async getTrainingEnrollments(): Promise<any[]> {
    try {
      const endpoint = '/training/enrollments';
      return await this.makeRequest(endpoint);
    } catch (error) {
      console.error('Error fetching training enrollments:', error);
      return [];
    }
  }

  async getPhishingSecurityTests(): Promise<any[]> {
    try {
      const endpoint = '/phishing/security_tests';
      return await this.makeRequest(endpoint);
    } catch (error) {
      console.error('Error fetching phishing security tests:', error);
      return [];
    }
  }
}

export const knowBe4Service = new KnowBe4Service();
export type { KnowBe4User, KnowBe4TrainingCampaign, KnowBe4PhishingCampaign };