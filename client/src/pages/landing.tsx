import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Users, Settings, BarChart3 } from "lucide-react";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
            Admin Console
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
            Secure identity and access management platform for your organization
          </p>
          <Button 
            onClick={handleLogin}
            size="lg"
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg"
          >
            Sign In
          </Button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <Card className="text-center border-0 shadow-lg">
            <CardHeader>
              <Users className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <CardTitle>User Management</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Create, update, and manage user accounts with comprehensive profile controls
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="text-center border-0 shadow-lg">
            <CardHeader>
              <Shield className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <CardTitle>Security Controls</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Monitor security events, manage MFA settings, and enforce password policies
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="text-center border-0 shadow-lg">
            <CardHeader>
              <Settings className="h-12 w-12 text-purple-600 mx-auto mb-4" />
              <CardTitle>Application Access</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Control application assignments and manage group memberships
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="text-center border-0 shadow-lg">
            <CardHeader>
              <BarChart3 className="h-12 w-12 text-orange-600 mx-auto mb-4" />
              <CardTitle>Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                View detailed reports and insights on user activity and security metrics
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        <div className="max-w-4xl mx-auto">
          <Card className="border-0 shadow-xl">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Secure Access Required</CardTitle>
              <CardDescription className="text-lg">
                This administrative console requires authentication to access user management features
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 mb-6">
                <Shield className="h-16 w-16 text-blue-600 mx-auto mb-4" />
                <p className="text-gray-700 dark:text-gray-300">
                  Your organization's identity and access management platform provides secure,
                  centralized control over user accounts, applications, and security policies.
                </p>
              </div>
              <Button 
                onClick={handleLogin}
                size="lg"
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Authenticate to Continue
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}