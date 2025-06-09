import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Target, BookOpen, AlertTriangle, CheckCircle, XCircle, Clock, Users, GraduationCap } from "lucide-react";

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

  // Extract training campaign data from the existing KnowBe4 user data
  const campaignEnrollments = knowbe4User?.current_training_campaign_statuses || [];

  // Debug logging for exact data structure
  console.log('=== KNOWBE4 DEBUG DATA ===');
  console.log('KnowBe4 User Data:', knowbe4User);
  console.log('Training Campaign Statuses:', knowbe4User?.current_training_campaign_statuses);
  console.log('Phishing Campaign Stats:', knowbe4User?.phishing_campaign_stats);
  console.log('Campaign Enrollments:', campaignEnrollments);
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
  const trainingStats = campaignEnrollments || [];
  console.log('Using campaign enrollments as training stats:', trainingStats);
  
  const completed = trainingStats.filter(enrollment => 
    enrollment.status === 'Completed' || enrollment.status === 'completed'
  ).length;
  
  const inProgress = trainingStats.filter(enrollment => 
    enrollment.status === 'In Progress' || enrollment.status === 'in_progress' || 
    enrollment.status === 'Active' || enrollment.status === 'active'
  ).length;
  
  const notStarted = trainingStats.filter(enrollment => 
    enrollment.status === 'Not Started' || enrollment.status === 'not_started' ||
    !enrollment.completion_date
  ).length;
  
  const total = trainingStats.length;
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
          <div className="text-sm text-gray-600">
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

          {/* Training Assignments - Right Tile */}
          <Card className="bg-white border border-gray-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <GraduationCap className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Training Assignments</span>
              </div>
              
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="text-4xl font-bold text-blue-600 mb-1">{completionPercentage}%</div>
                  <div className="text-xs text-gray-500">Total Assignment Completions</div>
                </div>
                
                <div className="text-right space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Completed</span>
                    <span className="font-medium">{completed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">In Progress</span>
                    <span className="font-medium">{inProgress}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Not Started</span>
                    <span className="font-medium">{notStarted}</span>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 flex justify-end">
                <button className="bg-gray-500 hover:bg-gray-600 text-white text-xs px-3 py-1 rounded">
                  View Training Details
                </button>
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Detailed Training Enrollment Information */}
        <div className="mt-6">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Training Campaign Status</h4>
          {trainingStats.length > 0 ? (
            <div className="space-y-2">
              {trainingStats.map((enrollment, index) => (
                <div key={index} className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">{enrollment.campaign_name}</div>
                    <div className="text-xs text-gray-500">
                      Status: {enrollment.status} • Enrolled: {enrollment.enrollment_date ? new Date(enrollment.enrollment_date).toLocaleDateString() : 'N/A'}
                      {enrollment.completion_date && ` • Completed: ${new Date(enrollment.completion_date).toLocaleDateString()}`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {enrollment.status === 'Completed' ? 'Completed' : 'In Progress'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {enrollment.time_spent ? `${Math.round(enrollment.time_spent / 60)}min spent` : 'No time logged'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-4 px-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-600" />
                <div className="text-sm text-yellow-800">
                  <div className="font-medium">No Active Training Campaigns</div>
                  <div className="text-xs text-yellow-700 mt-1">
                    This user is not currently enrolled in any KnowBe4 training campaigns.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

      </CardContent>
    </Card>
  );
}