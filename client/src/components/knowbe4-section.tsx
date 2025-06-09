import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Target, BookOpen, AlertTriangle, CheckCircle, XCircle, Clock } from "lucide-react";

interface KnowBe4SectionProps {
  userEmail: string;
}

interface KnowBe4User {
  id: number;
  employee_number: string;
  first_name: string;
  last_name: string;
  email: string;
  phish_prone_percentage: number;
  current_risk_score: number;
  status: string;
  joined_on: string;
  last_sign_in: string;
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

function formatDate(dateString: string | null) {
  if (!dateString) return "Never";
  return new Date(dateString).toLocaleDateString();
}

function getRiskLevel(score: number) {
  if (score >= 80) return { level: "High", color: "bg-red-500", textColor: "text-red-700" };
  if (score >= 60) return { level: "Medium", color: "bg-yellow-500", textColor: "text-yellow-700" };
  if (score >= 40) return { level: "Low", color: "bg-blue-500", textColor: "text-blue-700" };
  return { level: "Very Low", color: "bg-green-500", textColor: "text-green-700" };
}

function getTrainingStatus(status: string) {
  switch (status.toLowerCase()) {
    case 'completed':
      return { icon: CheckCircle, color: "text-green-600", bg: "bg-green-100" };
    case 'in_progress':
      return { icon: Clock, color: "text-yellow-600", bg: "bg-yellow-100" };
    case 'not_started':
      return { icon: XCircle, color: "text-red-600", bg: "bg-red-100" };
    default:
      return { icon: AlertTriangle, color: "text-gray-600", bg: "bg-gray-100" };
  }
}

export default function KnowBe4Section({ userEmail }: KnowBe4SectionProps) {
  const [testConnection, setTestConnection] = useState<any>(null);

  // Test KnowBe4 connection
  const { data: connectionTest, isLoading: connectionLoading, refetch: testKnowBe4 } = useQuery({
    queryKey: ['/api/knowbe4/test-connection'],
  });

  // Fetch KnowBe4 user data only if connection is successful
  const { data: knowbe4User, isLoading: userLoading, error: userError } = useQuery<KnowBe4User>({
    queryKey: ['/api/knowbe4/user', userEmail],
    enabled: !!userEmail && !!connectionTest?.success,
  });

  // Fetch training data
  const { data: trainingData, isLoading: trainingLoading } = useQuery({
    queryKey: ['/api/knowbe4/user', knowbe4User?.id, 'training'],
    enabled: !!knowbe4User?.id,
  });

  // Fetch phishing data
  const { data: phishingData, isLoading: phishingLoading } = useQuery({
    queryKey: ['/api/knowbe4/user', knowbe4User?.id, 'phishing'],
    enabled: !!knowbe4User?.id,
  });

  // Show connection status and configuration guidance
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
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">KnowBe4 API Configuration Required</p>
                <p className="text-sm text-gray-600">
                  {connectionTest?.message || "Unable to connect to KnowBe4 API"}
                </p>
                <div className="text-xs text-gray-500 mt-2">
                  <p>To enable KnowBe4 integration:</p>
                  <ol className="list-decimal list-inside mt-1 space-y-1">
                    <li>Ensure Reporting API is enabled in KnowBe4 console</li>
                    <li>Verify KCM token has "Read Only" permissions</li>
                    <li>Wait 5-10 minutes after enabling for token activation</li>
                  </ol>
                </div>
              </div>
            </AlertDescription>
          </Alert>
          <Button 
            onClick={() => testKnowBe4()} 
            variant="outline" 
            size="sm"
            disabled={connectionLoading}
          >
            Test Connection
          </Button>
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
              User not found in KnowBe4 system. This user may not be enrolled in security training.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const riskLevel = getRiskLevel(knowbe4User.current_risk_score);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          KnowBe4 Security Training
        </CardTitle>
        <CardDescription>
          Security awareness and training status for {knowbe4User.first_name} {knowbe4User.last_name}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="training">Training</TabsTrigger>
            <TabsTrigger value="phishing">Phishing Tests</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Risk Score</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{knowbe4User.current_risk_score}%</div>
                  <Badge variant="secondary" className={riskLevel.textColor}>
                    {riskLevel.level} Risk
                  </Badge>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Phish Prone %</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{knowbe4User.phish_prone_percentage}%</div>
                  <Progress value={knowbe4User.phish_prone_percentage} className="mt-2" />
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge variant={knowbe4User.status === 'Active' ? 'default' : 'secondary'}>
                    {knowbe4User.status}
                  </Badge>
                  <div className="text-sm text-muted-foreground mt-2">
                    Last Sign In: {formatDate(knowbe4User.last_sign_in)}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="training" className="space-y-4">
            {trainingLoading ? (
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            ) : knowbe4User.current_training_campaign_statuses?.length > 0 ? (
              <div className="space-y-3">
                {knowbe4User.current_training_campaign_statuses.map((training) => {
                  const statusInfo = getTrainingStatus(training.status);
                  const StatusIcon = statusInfo.icon;
                  
                  return (
                    <Card key={training.campaign_id}>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${statusInfo.bg}`}>
                              <StatusIcon className={`h-4 w-4 ${statusInfo.color}`} />
                            </div>
                            <div>
                              <div className="font-medium">{training.campaign_name}</div>
                              <div className="text-sm text-muted-foreground">
                                Enrolled: {formatDate(training.enrollment_date)}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge variant="outline" className={statusInfo.color}>
                              {training.status.replace('_', ' ')}
                            </Badge>
                            {training.completion_date && (
                              <div className="text-sm text-muted-foreground mt-1">
                                Completed: {formatDate(training.completion_date)}
                              </div>
                            )}
                          </div>
                        </div>
                        {training.time_spent > 0 && (
                          <div className="mt-3 text-sm text-muted-foreground">
                            Time Spent: {Math.round(training.time_spent / 60)} minutes
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Alert>
                <BookOpen className="h-4 w-4" />
                <AlertDescription>No training campaigns found for this user.</AlertDescription>
              </Alert>
            )}
          </TabsContent>
          
          <TabsContent value="phishing" className="space-y-4">
            {phishingLoading ? (
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            ) : knowbe4User.phishing_campaign_stats?.length > 0 ? (
              <div className="space-y-3">
                {knowbe4User.phishing_campaign_stats.map((phishing) => (
                  <Card key={phishing.campaign_id}>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Target className="h-5 w-5 text-orange-500" />
                          <div className="font-medium">{phishing.campaign_name}</div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">Last Clicked</div>
                          <div className="font-medium">{formatDate(phishing.last_clicked_date)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Last Reported</div>
                          <div className="font-medium text-green-600">{formatDate(phishing.last_reported_date)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Last Reply</div>
                          <div className="font-medium">{formatDate(phishing.last_replied_date)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Data Entered</div>
                          <div className="font-medium">{formatDate(phishing.last_data_entered_date)}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Alert>
                <Target className="h-4 w-4" />
                <AlertDescription>No phishing test data found for this user.</AlertDescription>
              </Alert>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}