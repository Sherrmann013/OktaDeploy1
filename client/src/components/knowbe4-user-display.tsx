import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Target, BookOpen, AlertTriangle, CheckCircle, XCircle, Clock, Users } from "lucide-react";

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

  const riskLevel = getRiskLevel(knowbe4User.current_risk_score);
  const phishProneLevel = getPhishProneLevel(knowbe4User.phish_prone_percentage);

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
      <CardContent className="space-y-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg border">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-blue-600" />
              <span className="font-medium text-blue-800">Risk Score</span>
            </div>
            <div className="text-2xl font-bold text-blue-900">
              {knowbe4User.current_risk_score}
            </div>
            <Badge variant="secondary" className={`mt-1 ${riskLevel.textColor}`}>
              {riskLevel.level} Risk
            </Badge>
          </div>

          <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-4 rounded-lg border">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <span className="font-medium text-orange-800">Phish Prone</span>
            </div>
            <div className="text-2xl font-bold text-orange-900">
              {knowbe4User.phish_prone_percentage}%
            </div>
            <Badge variant={phishProneLevel.color as any} className="mt-1">
              {phishProneLevel.level}
            </Badge>
          </div>

          <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg border">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="font-medium text-green-800">Status</span>
            </div>
            <div className="text-2xl font-bold text-green-900 capitalize">
              {knowbe4User.status}
            </div>
            <Badge variant="default" className="mt-1 bg-green-100 text-green-800">
              {knowbe4User.provisioning_managed ? "Managed" : "Manual"}
            </Badge>
          </div>
        </div>

        {/* User Details */}
        <div className="space-y-4">
          <h4 className="font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" />
            User Information
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Name:</span>
              <p>{knowbe4User.first_name} {knowbe4User.last_name}</p>
            </div>
            <div>
              <span className="font-medium">Email:</span>
              <p>{knowbe4User.email}</p>
            </div>
            {knowbe4User.job_title && (
              <div>
                <span className="font-medium">Job Title:</span>
                <p>{knowbe4User.job_title}</p>
              </div>
            )}
            {knowbe4User.department && (
              <div>
                <span className="font-medium">Department:</span>
                <p>{knowbe4User.department}</p>
              </div>
            )}
            {knowbe4User.manager_name && (
              <div>
                <span className="font-medium">Manager:</span>
                <p>{knowbe4User.manager_name}</p>
                {knowbe4User.manager_email && (
                  <p className="text-gray-600">({knowbe4User.manager_email})</p>
                )}
              </div>
            )}
            {knowbe4User.phone_number && (
              <div>
                <span className="font-medium">Phone:</span>
                <p>{knowbe4User.phone_number}</p>
              </div>
            )}
            <div>
              <span className="font-medium">Joined KnowBe4:</span>
              <p>{formatDate(knowbe4User.joined_on)}</p>
            </div>
            <div>
              <span className="font-medium">Last Sign In:</span>
              <p>{formatDate(knowbe4User.last_sign_in)}</p>
            </div>
            {knowbe4User.organization && (
              <div>
                <span className="font-medium">Organization:</span>
                <p>{knowbe4User.organization}</p>
              </div>
            )}
            {knowbe4User.groups && knowbe4User.groups.length > 0 && (
              <div>
                <span className="font-medium">Groups:</span>
                <p>{knowbe4User.groups.length} security groups</p>
              </div>
            )}
          </div>
        </div>

        {/* Risk Assessment */}
        <div className="space-y-4">
          <h4 className="font-semibold">Risk Assessment</h4>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium">Current Risk Score</span>
                <span className="text-sm text-gray-600">{knowbe4User.current_risk_score}/100</span>
              </div>
              <Progress value={knowbe4User.current_risk_score} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium">Phish Prone Percentage</span>
                <span className="text-sm text-gray-600">{knowbe4User.phish_prone_percentage}%</span>
              </div>
              <Progress value={knowbe4User.phish_prone_percentage} className="h-2" />
            </div>
          </div>
        </div>

        {/* Account Info */}
        {connectionTest?.details && (
          <div className="text-xs text-gray-500 pt-4 border-t">
            <p>Connected to {connectionTest.details.account_name} ({connectionTest.details.subscription_level})</p>
            <p>{connectionTest.details.number_of_seats} seats • Risk Score: {connectionTest.details.current_risk_score}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}