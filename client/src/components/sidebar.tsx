import React from "react";
import { Link, useLocation } from "wouter";
import { Shield, Users, UsersRound, Grid3x3, Settings, RotateCcw, LayoutDashboard, Gauge, LogOut, Building2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/hooks/use-auth";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Client interface for sidebar dropdown
interface Client {
  id: number;
  name: string;
  status: string;
}

// Navigation items will be filtered based on user access level

export default function Sidebar() {
  const [location] = useLocation();
  const { user: currentUser } = useAuth();
  const { canViewAdmin } = useRoleAccess();
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const { toast } = useToast();

  // Detect current client context from URL
  const currentClientId = location.startsWith('/client/') ? location.split('/')[2] : null;
  
  // Update selected client based on current URL
  useEffect(() => {
    if (currentClientId && selectedClient !== currentClientId) {
      setSelectedClient(currentClientId);
    } else if (location === '/msp' && selectedClient !== 'msp') {
      setSelectedClient('msp');
    }
  }, [location, currentClientId]);

  // Handle client selection
  const handleClientSelect = (clientId: string) => {
    setSelectedClient(clientId);
    if (clientId === "msp") {
      // Navigate to MSP dashboard
      window.location.href = `/msp`;
    } else {
      // Navigate to the selected client's dashboard
      window.location.href = `/client/${clientId}/dashboard`;
    }
  };
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch clients for dropdown (only if user can view admin)
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    enabled: canViewAdmin,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Get active company logo
  const { data: activeLogo } = useQuery({
    queryKey: ['/api/company-logos/active'],
    retry: false,
  });

  // Get custom logo text setting
  const { data: logoTextSetting } = useQuery({
    queryKey: ['/api/layout-settings/logo_text'],
  });

  // Get logo background color setting
  const { data: logoBackgroundSetting } = useQuery({
    queryKey: ['/api/layout-settings/logo_background_color'],
  });

  // Get logo text visibility setting
  const { data: logoTextVisibilitySetting } = useQuery({
    queryKey: ['/api/layout-settings/logo_text_visible'],
  });

  // Logo data loaded silently

  // Dynamic navigation based on current context (client vs MSP)
  const getNavigation = () => {
    // If we're on the MSP page, don't show any navigation items
    if (location === '/msp') {
      return [];
    }
    
    const baseUrl = currentClientId ? `/client/${currentClientId}` : '';
    
    return [
      { 
        name: "Dashboard", 
        href: currentClientId ? `${baseUrl}/dashboard` : "/dashboard", 
        icon: Gauge, 
        current: true 
      },
      { 
        name: "Users", 
        href: currentClientId ? `${baseUrl}/users` : "/users", 
        icon: Users, 
        current: false 
      },
      ...(canViewAdmin ? [{ 
        name: "Admin", 
        href: currentClientId ? `${baseUrl}/admin` : "/admin", 
        icon: Settings, 
        current: false 
      }] : []),
      // MSP option removed - access only through client dropdown
    ];
  };

  const navigation = getNavigation();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/logout");
      return response.json();
    },
    onSuccess: () => {
      // Clear all queries and redirect to login
      queryClient.clear();
      // Force a full page reload to ensure clean logout
      window.location.replace('/login');
    },
    onError: (error) => {
      // Still redirect even if logout fails on server
      window.location.replace('/login');
    },
  });

  // OKTA sync mutation
  const oktaSyncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/sync-okta");
      return response.json();
    },
    onSuccess: () => {
      // Clear user cache for the current client context
      if (currentClientId) {
        queryClient.invalidateQueries({ queryKey: [`/api/client/${currentClientId}/users`] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/employee-type-counts"] });
      toast({
        title: "Success",
        description: "OKTA users synchronized successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to sync OKTA users: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  return (
    <aside className="w-32 bg-white dark:bg-gray-800 shadow-md border-r border-gray-200 dark:border-gray-700 flex-shrink-0 flex flex-col">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 sidebar-purple flex flex-col rounded-br-lg">
        <div className="text-center flex-1">
          <div className="relative inline-block mb-1">
            <div 
              className="relative w-24 h-24 mx-auto rounded flex items-center justify-center"
              style={{ 
                backgroundColor: (logoBackgroundSetting as any)?.settingValue === "transparent" ? "transparent" : ((logoBackgroundSetting as any)?.settingValue || "#7c3aed")
              }}
            >
              <div className="relative w-20 h-20">
                {(activeLogo as any)?.logoData ? (
                  <img 
                    src={(activeLogo as any).logoData} 
                    alt="Company Logo" 
                    className="w-20 h-20 absolute inset-0 object-contain"
                  />
                ) : (
                  <div className="w-20 h-20 flex items-center justify-center text-gray-400 dark:text-gray-500 text-xs text-center">
                    No Logo
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        {/* Only show logo text if visibility setting is true (default: true) */}
        {((logoTextVisibilitySetting as any)?.settingValue !== 'false') && (
          <div className="text-[10px] text-white/80 leading-none mt-auto whitespace-nowrap -ml-1">
            {(logoTextSetting as any)?.settingValue || "Powered by ClockWerk.it"}
          </div>
        )}
      </div>
      
      <nav className="p-4 flex-1">
        {/* Client Selector - Only show for admin users */}
        {canViewAdmin && (
          <div className="mb-4">
            <Select value={selectedClient} onValueChange={handleClientSelect}>
              <SelectTrigger className="w-full h-8 text-xs bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600">
                <SelectValue placeholder="Select Client" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600">
                <SelectItem value="msp">
                  <span className="text-blue-600">MSP Dashboard</span>
                </SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id.toString()}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <ul className="space-y-2">
          {navigation.map((item) => {
            const isActive = location === item.href || (item.href === "/users" && location.startsWith("/users"));
            
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center justify-start space-x-2 px-2 py-2 rounded-lg text-xs font-medium transition-colors w-full",
                    isActive
                      ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100"
                  )}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  <span className="text-left">{item.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      
      {/* User Profile and Controls at Bottom */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-center gap-3">
          {/* User Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <Button
              variant="ghost"
              className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center p-0 hover:bg-blue-700"
              onClick={() => setShowUserDropdown(!showUserDropdown)}
            >
              <span className="text-white text-sm font-medium">
                {currentUser?.firstName?.[0]}{currentUser?.lastName?.[0]}
              </span>
            </Button>
            {showUserDropdown && (
              <div className="absolute bottom-10 left-0 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
                <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                  <p className="font-medium text-gray-900 dark:text-gray-100">{currentUser?.firstName} {currentUser?.lastName}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{currentUser?.email}</p>
                </div>
                <div className="p-3 space-y-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      oktaSyncMutation.mutate();
                      setShowUserDropdown(false);
                    }}
                    disabled={oktaSyncMutation.isPending}
                    className="w-full border-orange-300 text-orange-700 hover:bg-orange-50"
                  >
                    <RotateCcw className={`w-4 h-4 mr-2 ${oktaSyncMutation.isPending ? 'animate-spin' : ''}`} />
                    Sync OKTA
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      logoutMutation.mutate();
                      setShowUserDropdown(false);
                    }}
                    disabled={logoutMutation.isPending}
                    className="w-full border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    {logoutMutation.isPending ? 'Signing out...' : 'Sign Out'}
                  </Button>
                </div>
              </div>
            )}
          </div>
          
          {/* Theme Toggle */}
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
