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

  // Fetch training campaigns for the user
  const { data: trainingData } = useQuery({
    queryKey: [`/api/knowbe4/user/${knowbe4User?.id}/training`],
    enabled: !!knowbe4User?.id,
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
        {/* Compact Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-blue-50 p-3 rounded-lg border">
            <div className="flex items-center gap-1 mb-1">
              <Target className="h-3 w-3 text-blue-600" />
              <span className="text-xs font-medium text-blue-800">Risk Score</span>
            </div>
            <div className="text-lg font-bold text-blue-900">
              {knowbe4User.current_risk_score}
            </div>
            <Badge variant="secondary" className={`text-xs ${riskLevel.textColor}`}>
              {riskLevel.level}
            </Badge>
          </div>

          <div className="bg-orange-50 p-3 rounded-lg border">
            <div className="flex items-center gap-1 mb-1">
              <AlertTriangle className="h-3 w-3 text-orange-600" />
              <span className="text-xs font-medium text-orange-800">Phish Prone</span>
            </div>
            <div className="text-lg font-bold text-orange-900">
              {knowbe4User.phish_prone_percentage}%
            </div>
            <Badge variant={phishProneLevel.color as any} className="text-xs">
              {phishProneLevel.level}
            </Badge>
          </div>

          <div className="bg-gray-50 p-3 rounded-lg border">
            <div className="flex items-center gap-1 mb-1">
              <Clock className="h-3 w-3 text-gray-600" />
              <span className="text-xs font-medium text-gray-800">Last Sign In</span>
            </div>
            <div className="text-sm font-semibold text-gray-900">
              {formatDate(knowbe4User.last_sign_in)}
            </div>
          </div>

          <div className="bg-green-50 p-3 rounded-lg border">
            <div className="flex items-center gap-1 mb-1">
              <BookOpen className="h-3 w-3 text-green-600" />
              <span className="text-xs font-medium text-green-800">Campaigns</span>
            </div>
            <div className="text-sm font-semibold text-green-900">
              {knowbe4User.groups && knowbe4User.groups.length > 0 ? 
                `${knowbe4User.groups.length} Groups` : 
                "No Groups"
              }
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