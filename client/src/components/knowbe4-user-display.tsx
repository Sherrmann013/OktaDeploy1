import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Target, BookOpen, AlertTriangle, CheckCircle, XCircle, Clock, Users, GraduationCap, ChevronDown, ChevronRight } from "lucide-react";

interface KnowBe4UserDisplayProps {
  userEmail: string;
}

interface KnowBe4User {
  id: number;
  employee_number: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phish_prone_percentage: number;
  current_risk_score: number;
  status: string;
  joined_on: string;
  last_sign_in: string;
  job_title?: string;
  department?: string;
  manager_name?: string;
  manager_email?: string;
  phone_number?: string;
  organization?: string;
  groups?: number[];
  provisioning_managed?: boolean;
  current_training_campaign_statuses?: Array<{
    campaign_id: number;
    campaign_name: string;
    enrollment_date: string;
    completion_date: string;
    status: string;
    time_spent: number;
    policy_acknowledged: boolean;
  }>;
  phishing_campaign_stats?: Array<{
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

function formatDate(dateString: string | null) {
  if (!dateString) return "Never";
  return new Date(dateString).toLocaleDateString();
}

function getRiskLevel(score: number) {
  if (score >= 70) return { level: "High", color: "bg-red-500", textColor: "text-red-700" };
  if (score >= 40) return { level: "Medium", color: "bg-yellow-500", textColor: "text-yellow-700" };
  return { level: "Low", color: "bg-green-500", textColor: "text-green-700" };
}

function getPhishProneLevel(percentage: number) {
  if (percentage >= 30) return { level: "High Risk", color: "destructive" };
  if (percentage >= 15) return { level: "Medium Risk", color: "secondary" };
  return { level: "Low Risk", color: "default" };
}

export default function KnowBe4UserDisplay({ userEmail }: KnowBe4UserDisplayProps) {
  const [enrollmentsExpanded, setEnrollmentsExpanded] = useState(false);
  
  // Test connection first
  const { data: connectionTest, isLoading: connectionLoading } = useQuery<{success: boolean; message: string; details: any}>({
    queryKey: ['/api/knowbe4/test-connection'],
    staleTime: 5 * 60 * 1000,
  });

  // Fetch KnowBe4 user data
  const { data: knowbe4User, isLoading: userLoading, error: userError } = useQuery<KnowBe4User>({
    queryKey: [`/api/knowbe4/user/${userEmail}`],
    enabled: !!userEmail && !!connectionTest?.success,
  });

  // Get all KnowBe4 campaigns and find user enrollments within them
  const { data: allCampaigns } = useQuery({
    queryKey: ['/api/knowbe4/campaigns'],
    enabled: !!connectionTest?.success,
  });

  // Search for Baseline campaigns specifically (active campaigns only)
  const { data: baselineCampaigns } = useQuery({
    queryKey: ['baseline-campaigns', 'Baseline'],
    queryFn: async () => {
      const response = await fetch('/api/knowbe4/campaigns/search?q=Baseline');
      if (!response.ok) {
        throw new Error('Failed to search campaigns');
      }
      return response.json();
    },
    enabled: !!connectionTest?.success,
  });

  // Get training stats from user-specific endpoint
  const { data: userTrainingStats = [] } = useQuery({
    queryKey: [`/api/knowbe4/user/${knowbe4User?.id}/training`],
    enabled: !!knowbe4User?.id,
  });

  const { data: phishingResults = [] } = useQuery({
    queryKey: [`/api/knowbe4/user/${knowbe4User?.id}/phishing`],
    enabled: !!knowbe4User?.id,
  });

  // Use the working training stats from the direct user endpoint
  const campaignEnrollments = React.useMemo(() => {
    // First try to use the userTrainingStats from the direct API call
    if (userTrainingStats && Array.isArray(userTrainingStats) && userTrainingStats.length > 0) {
      return userTrainingStats;
    }
    
    // Return empty array if no data available
    if (!allCampaigns || !userEmail || !knowbe4User) return [];
    
    const userEnrollments: any[] = [];
    (allCampaigns as any[]).forEach(campaign => {
      // Check if user is enrolled in this campaign
      const userEnrollment = campaign.enrollments?.find((enrollment: any) => 
        enrollment.user?.email?.toLowerCase() === userEmail.toLowerCase() ||
        enrollment.email?.toLowerCase() === userEmail.toLowerCase() ||
        enrollment.user_email?.toLowerCase() === userEmail.toLowerCase() ||
        enrollment.recipient_email?.toLowerCase() === userEmail.toLowerCase()
      );
      
      if (userEnrollment) {
        userEnrollments.push({
          ...userEnrollment,
          campaign_name: campaign.name,
          campaign_id: campaign.campaign_id,
          status: userEnrollment.status || userEnrollment.completion_status || 'Unknown'
        });
      }
    });
    
    return userEnrollments;
  }, [userTrainingStats, allCampaigns, userEmail, knowbe4User]);

  // Debug logging for exact data structure
  console.log('=== KNOWBE4 DEBUG DATA ===');
  console.log('KnowBe4 User Data:', knowbe4User);
  console.log('All Campaigns:', allCampaigns);
  console.log('User Email:', userEmail);
  
  // Log detailed enrollment structure for first campaign
  if (allCampaigns && Array.isArray(allCampaigns) && allCampaigns.length > 0) {
    console.log('First Campaign Enrollments Structure:', allCampaigns[0]?.enrollments);
    console.log('First Campaign Enrollment Sample:', allCampaigns[0]?.enrollments?.[0]);
  }
  
  console.log('Found User Enrollments:', campaignEnrollments);
  console.log('Enrollment Count:', campaignEnrollments?.length);
  console.log('=== END DEBUG DATA ===');



  if (connectionLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            KnowBe4 Security Training
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!connectionTest?.success) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            KnowBe4 Security Training
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">KnowBe4 API Not Available</p>
                <p className="text-sm text-gray-600">
                  {connectionTest?.message || "Unable to connect to KnowBe4 API"}
                </p>
                <div className="text-xs text-gray-500 mt-2">
                  <p>Account Details:</p>
                  <p>• Organization: {connectionTest?.details?.account_name || "Unknown"}</p>
                  <p>• Subscription: {connectionTest?.details?.subscription_level || "Unknown"}</p>
                  <p>• Seats: {connectionTest?.details?.number_of_seats || "Unknown"}</p>
                  <p>• Risk Score: {connectionTest?.details?.current_risk_score || "Unknown"}</p>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (userLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            KnowBe4 Security Training
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (userError || !knowbe4User) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            KnowBe4 Security Training
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              User not found in KnowBe4 system or no training data available.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Calculate basic data for non-null user
  const riskLevel = knowbe4User ? getRiskLevel(knowbe4User.current_risk_score) : null;
  const phishProneLevel = knowbe4User ? getPhishProneLevel(knowbe4User.phish_prone_percentage) : null;

  // Calculate phishing statistics from actual data
  const phishingStats = knowbe4User?.phishing_campaign_stats || [];
  const emailsClicked = phishingStats.filter(p => p.last_clicked_date && p.last_clicked_date !== null).length;
  const emailsReported = phishingStats.filter(p => p.last_reported_date && p.last_reported_date !== null).length;
  const totalPhishingCampaigns = phishingStats.length;

  // Use the user-specific campaign enrollment data to show accurate completion status
  const finalTrainingData = campaignEnrollments || [];
  console.log('Using campaign enrollments as training stats:', finalTrainingData);
  
  const completed = finalTrainingData.filter((enrollment: any) => 
    enrollment.status === 'Completed' || enrollment.status === 'completed'
  ).length;
  
  const inProgress = finalTrainingData.filter((enrollment: any) => 
    enrollment.status === 'In Progress' || enrollment.status === 'in_progress' || 
    enrollment.status === 'Active' || enrollment.status === 'active'
  ).length;
  
  const notStarted = finalTrainingData.filter((enrollment: any) => 
    enrollment.status === 'Not Started' || enrollment.status === 'not_started' ||
    !enrollment.completion_date
  ).length;
  
  const total = finalTrainingData.length;
  const completionPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  
  console.log('User-specific training completion calculation:');
  console.log('Completed enrollments:', completed);
  console.log('In Progress enrollments:', inProgress); 
  console.log('Not Started enrollments:', notStarted);
  console.log('Total enrollments:', total);
  console.log('Completion percentage:', completionPercentage);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          KnowBe4 Security Training
        </CardTitle>
        <CardDescription>
          Security awareness and phishing simulation data from KnowBe4
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">


        {/* Last Sign In */}
        <div className="space-y-2">
          <span className="text-sm font-medium">Last Sign In</span>
          <div className="text-sm text-gray-600 dark:text-gray-300">
            {formatDate(knowbe4User.last_sign_in)}
          </div>
        </div>

        {/* 2x2 Grid Layout matching screenshot */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Phishing Results - Left Tile */}
          <Card className="bg-white border border-gray-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Phishing Results</span>
              </div>
              
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="text-4xl font-bold text-blue-600 mb-1">{knowbe4User.phish_prone_percentage}%</div>
                  <div className="text-xs text-gray-500">Phish-prone Percentage</div>
                </div>
                
                <div className="text-right space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Emails Delivered</span>
                    <span className="font-medium">{totalPhishingCampaigns}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Failures</span>
                    <span className="font-medium">{emailsClicked}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Emails Reported</span>
                    <span className="font-medium">{emailsReported}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security Training - Right Tile */}
          <Card className="bg-white border border-gray-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <GraduationCap className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Security Training</span>
              </div>
              
              {finalTrainingData.length > 0 ? (
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="text-4xl font-bold text-green-600 mb-1">{completionPercentage}%</div>
                    <div className="text-xs text-gray-500">Completion Rate</div>
                  </div>
                  
                  <div className="text-right space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Total Enrollments</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{total}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Completed</span>
                      <span className="font-medium text-green-600 dark:text-green-400">{completed}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">In Progress</span>
                      <span className="font-medium text-yellow-600 dark:text-yellow-400">{inProgress}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Not Started</span>
                      <span className="font-medium text-gray-600 dark:text-gray-400">{notStarted}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500">
                  <p className="text-sm">No training data available</p>
                  <p className="text-xs mt-1">User not enrolled in any training campaigns</p>
                </div>
              )}
            </CardContent>
          </Card>

        </div>

        {/* Collapsible Training Enrollments */}
        {finalTrainingData.length > 0 && (
          <div className="mt-6">
            <Collapsible open={enrollmentsExpanded} onOpenChange={setEnrollmentsExpanded}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="flex items-center justify-between w-full p-3 text-left hover:bg-gray-100 rounded-lg">
                  <span className="font-medium text-sm text-gray-700">
                    Training Enrollments ({finalTrainingData.length})
                  </span>
                  {enrollmentsExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 mt-2 max-h-96 overflow-y-auto">
                {finalTrainingData.map((enrollment: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium text-sm text-gray-900">
                        {enrollment.module_name || enrollment.name}
                      </div>
                      <div className="text-xs text-gray-600">
                        {enrollment.campaign_name}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Enrolled: {formatDate(enrollment.enrollment_date)}
                        {enrollment.completion_date && (
                          <span> • Completed: {formatDate(enrollment.completion_date)}</span>
                        )}
                      </div>
                    </div>
                    <div className="ml-4">
                      <Badge 
                        variant={
                          enrollment.status === 'Completed' ? 'default' : 
                          enrollment.status === 'In Progress' ? 'secondary' : 
                          'outline'
                        }
                        className={
                          enrollment.status === 'Completed' ? 'bg-green-100 text-green-800' :
                          enrollment.status === 'In Progress' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }
                      >
                        {enrollment.status || 'Not Started'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}

      </CardContent>
    </Card>
  );
}