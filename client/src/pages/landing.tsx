import { Button } from "@/components/ui/button";

export default function Landing() {
  const handleLogin = () => {
    // Direct OKTA authorization URL
    const authUrl = `https://mazetx.okta.com/oauth2/default/v1/authorize?` +
      `client_id=0oarrurqf9mvVKYRj4x7&` +
      `response_type=code&` +
      `scope=openid email profile&` +
      `redirect_uri=${encodeURIComponent('https://mazetx.replit.app/api/okta-callback')}&` +
      `state=oauth_state`;
    window.location.href = authUrl;
  };

  const handleSSOLogin = () => {
    // Direct OKTA authorization URL
    const authUrl = `https://mazetx.okta.com/oauth2/default/v1/authorize?` +
      `client_id=0oarrurqf9mvVKYRj4x7&` +
      `response_type=code&` +
      `scope=openid email profile&` +
      `redirect_uri=${encodeURIComponent('https://mazetx.replit.app/api/okta-callback')}&` +
      `state=oauth_state`;
    window.location.href = authUrl;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-16">
            Maze User Management
          </h1>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button 
              onClick={handleLogin}
              size="lg"
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg"
            >
              Sign In
            </Button>
            
            <Button 
              onClick={handleSSOLogin}
              size="lg"
              variant="outline"
              className="border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 px-8 py-3 text-lg"
            >
              SSO Sign In
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}