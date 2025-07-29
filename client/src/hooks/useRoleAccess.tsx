import { useAuth } from "./use-auth";
import { useQuery } from "@tanstack/react-query";

export interface AccessLevel {
  canViewDashboard: boolean;
  canViewUsers: boolean;
  canViewAdmin: boolean;
  isAdmin: boolean;
  isStandard: boolean;
}

export function useRoleAccess(): AccessLevel {
  const { user, isAuthenticated } = useAuth();
  
  // Query site access users to get the current user's access level
  const { data: siteAccessUsers } = useQuery({
    queryKey: ["/api/site-access-users"],
    enabled: isAuthenticated && !!user?.email,
  });
  
  if (!isAuthenticated || !user) {
    return {
      canViewDashboard: false,
      canViewUsers: false,
      canViewAdmin: false,
      isAdmin: false,
      isStandard: false,
    };
  }
  
  // Check if user is the local admin
  if (user.role === "admin" || user.email === "admin@mazetx.com") {
    return {
      canViewDashboard: true,
      canViewUsers: true,
      canViewAdmin: true,
      isAdmin: true,
      isStandard: false,
    };
  }
  
  // Find the current user in site access users
  const currentSiteUser = Array.isArray(siteAccessUsers) 
    ? siteAccessUsers.find((siteUser: any) => siteUser.email === user.email)
    : null;
    
  const accessLevel = currentSiteUser?.accessLevel || "standard";
  const isAdmin = accessLevel === "admin";
  const isStandard = accessLevel === "standard";
  
  return {
    canViewDashboard: true, // Both standard and admin can view dashboard
    canViewUsers: true, // Both standard and admin can view users
    canViewAdmin: isAdmin, // Only admin can view admin page
    isAdmin,
    isStandard,
  };
}

// Hook for route protection
export function useRequireAdmin() {
  const { canViewAdmin } = useRoleAccess();
  return canViewAdmin;
}

// Hook for conditional rendering
export function useIsAdmin() {
  const { isAdmin } = useRoleAccess();
  return isAdmin;
}