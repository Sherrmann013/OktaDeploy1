import { ReactNode } from "react";
import { useRequireAdmin } from "@/hooks/useRoleAccess";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, AlertTriangle } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

export default function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const hasAdminAccess = useRequireAdmin();
  
  if (requireAdmin && !hasAdminAccess) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md border-red-200 dark:border-red-800">
          <CardContent className="p-6 text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-full">
                <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Access Denied
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              You need administrator privileges to access this page.
            </p>
            <div className="flex items-center justify-center space-x-2 text-sm text-gray-500 dark:text-gray-500">
              <Shield className="w-4 h-4" />
              <span>Contact your system administrator for access</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return <>{children}</>;
}