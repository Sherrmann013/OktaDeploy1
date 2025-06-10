import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Users, Settings, BarChart3 } from "lucide-react";

export default function Landing() {
  const handleSSOLogin = () => {
    // Redirect to the users page
    window.location.href = '/users';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-16">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column - Hero Content */}
          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="text-4xl lg:text-6xl font-bold text-gray-900 dark:text-white leading-tight">
                Maze User
                <span className="text-blue-600 dark:text-blue-400"> Management</span>
              </h1>
              <p className="text-xl text-gray-600 dark:text-gray-300 leading-relaxed">
                Comprehensive admin dashboard for advanced user authentication and access management with sophisticated monitoring capabilities.
              </p>
            </div>

            {/* Feature Grid */}
            <div className="grid grid-cols-2 gap-6">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <Shield className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">OKTA Integration</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">SSO & Identity Management</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <Users className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">User Operations</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Complete CRUD Management</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <Settings className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Access Control</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Group & Permission Management</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <BarChart3 className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Activity Monitoring</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">30-Day Activity Logging</p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
              <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">Key Features</h3>
              <ul className="space-y-2 text-blue-800 dark:text-blue-200">
                <li>• Advanced user search and filtering capabilities</li>
                <li>• Employee Type to MTX group mapping</li>
                <li>• Comprehensive profile field management</li>
                <li>• Real-time synchronization with OKTA</li>
                <li>• Responsive design with dark mode support</li>
              </ul>
            </div>
          </div>

          {/* Right Column - SSO Login */}
          <div className="flex justify-center">
            <Card className="w-full max-w-md">
              <CardHeader className="space-y-1">
                <CardTitle className="text-2xl font-bold text-center">Access Dashboard</CardTitle>
                <CardDescription className="text-center">
                  Sign in with your organization credentials to access the admin dashboard
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  className="w-full h-12 text-lg"
                  onClick={handleSSOLogin}
                >
                  Sign In with SSO
                </Button>
                
                <div className="text-center text-sm text-muted-foreground">
                  <p>Secure authentication through your organization's identity provider</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}