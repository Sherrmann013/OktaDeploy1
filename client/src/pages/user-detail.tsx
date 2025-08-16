import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import React from "react";
import { ArrowLeft, ChevronDown, ChevronRight, ChevronUp, Smartphone, Monitor, Laptop, Tablet, Shield, Eye, RefreshCw, KeyRound, Edit, Play, Pause, Trash2, Search, UserX, Save, X, Download, Copy, UserCheck, Plus, Key, CheckCircle, BookOpen, ChevronLeft } from "lucide-react";
import { DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import ConfirmationModal from "@/components/confirmation-modal";
import KnowBe4UserDisplay from "@/components/knowbe4-user-display";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useEffect, useMemo } from "react";
import type { User } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const editUserSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  login: z.string().min(1, "Login is required"),
  title: z.string().optional(),
  department: z.string().optional(),
  mobilePhone: z.string().optional(),
  manager: z.string().optional(),
  employeeType: z.enum(["EMPLOYEE", "CONTRACTOR", "PART_TIME", "INTERN", ""]).optional(),
});

// Helper function to get device icon based on platform
const getDeviceIcon = (platform: string) => {
  const platformLower = platform?.toLowerCase() || '';
  
  if (platformLower.includes('ios') || platformLower.includes('iphone') || platformLower.includes('ipad')) {
    return Smartphone;
  } else if (platformLower.includes('android')) {
    return Smartphone;
  } else if (platformLower.includes('windows') || platformLower.includes('win')) {
    return Monitor;
  } else if (platformLower.includes('mac') || platformLower.includes('osx') || platformLower.includes('macos')) {
    return Laptop;
  } else if (platformLower.includes('tablet') || platformLower.includes('ipad')) {
    return Tablet;
  } else {
    // Default fallback for unknown platforms
    return Monitor;
  }
};

export default function UserDetail() {
  const [, params] = useRoute("/client/:clientId/users/:id");
  const [location, setLocation] = useLocation();
  const { toast } = useToast();

  // Detect current client context from URL - CLIENT-AWARE
  const clientId = params?.clientId ? parseInt(params.clientId) : 
    (location.startsWith('/client/') ? parseInt(location.split('/')[2]) : 1);
  
  const [isEditing, setIsEditing] = useState(false);
  const [managerSearch, setManagerSearch] = useState("");
  const [profileSubTab, setProfileSubTab] = useState("okta");
  const [expandedSections, setExpandedSections] = useState<{[logId: string]: {[section: string]: boolean}}>({});
  const [showPasswordModal, setShowPasswordModal] = useState<"reset" | "expire" | "generate" | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [generatedPassword, setGeneratedPassword] = useState("");
  
  // Pagination state for activity logs
  const [logsPageSize, setLogsPageSize] = useState(20);
  const [logsCurrentPage, setLogsCurrentPage] = useState(1);
  const [outcomeFilter, setOutcomeFilter] = useState("ALL");
  const [confirmAction, setConfirmAction] = useState<{
    type: string;
    title: string;
    message: string;
    action: () => void;
  } | null>(null);

  // CSV download function for activity logs
  const downloadLogsAsCSV = async () => {
    // For CSV export, we need to fetch ALL logs, not just the current page
    try {
      const response = await fetch(`/api/client/${clientId}/users/${userId}/logs?limit=1000&offset=0`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch logs');
      
      const allLogsResponse = await response.json();
      const allLogs = Array.isArray(allLogsResponse?.logs) ? allLogsResponse.logs : [];
      
      if (allLogs.length === 0) {
        toast({
          title: "No data to export",
          description: "There are no activity logs to download.",
          variant: "destructive",
        });
        return;
      }

      // Convert logs to CSV format
      const headers = ['Time', 'Event Type', 'Display Message', 'Outcome', 'Actor Name', 'Actor Type', 'Client IP', 'User Agent', 'Target Names'];
      const csvData = [
        headers.join(','),
        ...allLogs.map((log: any) => {
          const time = formatEventTime(log.published);
          const eventType = log.eventType || '';
          const displayMessage = (log.displayMessage || '').replace(/"/g, '""'); // Escape quotes
          const outcome = log.outcome || '';
          const actorName = log.actor?.displayName || '';
          const actorType = log.actor?.type || '';
          const clientIP = log.client?.ipAddress || '';
          const userAgent = (log.client?.userAgent || '').replace(/"/g, '""'); // Escape quotes
          const targetNames = (log.target || []).map((t: any) => t.displayName || '').join('; ');
          
          return [
            `"${time}"`,
            `"${eventType}"`,
            `"${displayMessage}"`,
            `"${outcome}"`,
            `"${actorName}"`,
            `"${actorType}"`,
            `"${clientIP}"`,
            `"${userAgent}"`,
            `"${targetNames}"`
          ].join(',');
        })
      ].join('\n');

      // Create and download CSV file
      const blob = new Blob([csvData], { type: 'text/csv;charset-utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `user-activity-logs-${user?.firstName}-${user?.lastName}-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Export successful",
        description: `Downloaded ${allLogs.length} activity logs as CSV.`,
      });
    } catch (error) {
      console.error('Error downloading CSV:', error);
      toast({
        title: "Export failed",
        description: "Failed to download activity logs. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  const userId = params?.id ? parseInt(params.id) : null;
  
  // Fetch all users for manager auto-complete - CLIENT-AWARE
  const { data: allUsersData } = useQuery({
    queryKey: [`/api/client/${clientId}/users/all`],
    queryFn: async () => {
      const response = await fetch(`/api/client/${clientId}/users?limit=1000`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch users for manager selection');
      }
      
      return response.json();
    },
    enabled: isEditing,
  });
  
  const availableManagers = useMemo(() => {
    if (!allUsersData?.users || !managerSearch) return [];
    
    const searchTerm = managerSearch.toLowerCase().trim();
    if (searchTerm.length < 1) return [];
    
    return allUsersData.users
      .filter((u: User) => {
        if (u.id === userId) return false;
        
        const firstName = u.firstName?.toLowerCase() || '';
        const lastName = u.lastName?.toLowerCase() || '';
        const email = u.email?.toLowerCase() || '';
        const title = u.title?.toLowerCase() || '';
        const department = u.department?.toLowerCase() || '';
        const fullName = `${firstName} ${lastName}`;
        
        // Prioritize exact matches first, then partial matches
        return firstName.includes(searchTerm) ||
               lastName.includes(searchTerm) ||
               fullName.includes(searchTerm) ||
               email.includes(searchTerm) ||
               title.includes(searchTerm) ||
               department.includes(searchTerm);
      })
      .sort((a: User, b: User) => {
        // Sort by relevance - exact name matches first
        const aFullName = `${a.firstName} ${a.lastName}`.toLowerCase();
        const bFullName = `${b.firstName} ${b.lastName}`.toLowerCase();
        const aFirstName = a.firstName?.toLowerCase() || '';
        const bFirstName = b.firstName?.toLowerCase() || '';
        const aLastName = a.lastName?.toLowerCase() || '';
        const bLastName = b.lastName?.toLowerCase() || '';
        
        // Exact first name match gets highest priority
        if (aFirstName.startsWith(searchTerm) && !bFirstName.startsWith(searchTerm)) return -1;
        if (bFirstName.startsWith(searchTerm) && !aFirstName.startsWith(searchTerm)) return 1;
        
        // Exact last name match gets second priority
        if (aLastName.startsWith(searchTerm) && !bLastName.startsWith(searchTerm)) return -1;
        if (bLastName.startsWith(searchTerm) && !aLastName.startsWith(searchTerm)) return 1;
        
        // Full name match gets third priority
        if (aFullName.startsWith(searchTerm) && !bFullName.startsWith(searchTerm)) return -1;
        if (bFullName.startsWith(searchTerm) && !aFullName.startsWith(searchTerm)) return 1;
        
        // Sort alphabetically as fallback
        return aFullName.localeCompare(bFullName);
      })
      .slice(0, 25); // Increased to 25 suggestions for better usability
  }, [allUsersData, managerSearch, userId]);
  
  const form = useForm<z.infer<typeof editUserSchema>>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      login: "",
      title: "",
      department: "",
      mobilePhone: "",
      manager: "",
      employeeType: "",
    },
  });
  
  const [activeTab, setActiveTab] = useState("profile");
  const [appSearchTerm, setAppSearchTerm] = useState("");
  const [selectedAppMappings, setSelectedAppMappings] = useState<string[]>([]);
  const [isAppSelectorOpen, setIsAppSelectorOpen] = useState(false);

  // Clear problematic cache entries on mount - CLIENT-AWARE
  useEffect(() => {
    if (userId) {
      // Invalidate any cached data that might interfere
      queryClient.removeQueries({ 
        queryKey: [`/api/client/${clientId}/users`], 
        exact: false 
      });
    }
  }, [userId, clientId]);

  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: [`/api/client/${clientId}/users/${userId}`],
    enabled: !!userId,
    retry: 1,
    staleTime: 0,
    gcTime: 0, // Prevent caching issues
  });

  // Debug logging

  const { data: userGroups = [] } = useQuery<any[]>({
    queryKey: [`/api/client/${clientId}/users/${userId}/groups`],
    enabled: !!userId,
  });

  const { data: userApps = [] } = useQuery<any[]>({
    queryKey: [`/api/client/${clientId}/users/${userId}/applications`],
    enabled: !!userId,
  });

  const { data: userDevices = [] } = useQuery<any[]>({
    queryKey: [`/api/client/${clientId}/users/${userId}/devices`],
    enabled: !!userId,
  });

  // Fetch app mappings for the multi-select dropdown - CLIENT-AWARE
  const { data: appMappings = [] } = useQuery<any[]>({
    queryKey: [`/api/client/${clientId}/app-mappings`],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch user logs from OKTA with pagination - CLIENT-AWARE
  const { data: userLogsResponse, isLoading: logsLoading, error: logsError } = useQuery<{logs: any[], total: number, currentPage: number, totalPages: number}>({
    queryKey: [`/api/client/${clientId}/users/${userId}/logs`, logsPageSize, logsCurrentPage],
    queryFn: async () => {
      console.log('Fetching logs with pagination:', { logsPageSize, logsCurrentPage });
      const response = await fetch(`/api/client/${clientId}/users/${userId}/logs?limit=${logsPageSize}&offset=${(logsCurrentPage - 1) * logsPageSize}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch logs');
      const result = await response.json();
      console.log('Logs response:', result);
      return result;
    },
    enabled: !!userId && activeTab === "activity",
    retry: 1,
    staleTime: 0,
  });

  // Enhanced safety checks with debugging and outcome filtering
  const userLogs = React.useMemo(() => {
    if (!userLogsResponse) {
      console.log('No logs response yet');
      return [];
    }
    if (!Array.isArray(userLogsResponse.logs)) {
      console.error('userLogsResponse.logs is not an array:', userLogsResponse.logs);
      return [];
    }
    
    let filteredLogs = userLogsResponse.logs;
    
    // Apply outcome filter if not "ALL"
    if (outcomeFilter !== "ALL") {
      filteredLogs = userLogsResponse.logs.filter((log: any) => log.outcome === outcomeFilter);
    }
    
    console.log('userLogs array length:', filteredLogs.length, 'outcome filter:', outcomeFilter);
    return filteredLogs;
  }, [userLogsResponse, outcomeFilter]);
  
  const totalLogs = userLogsResponse?.total || 0;
  const totalPages = userLogsResponse?.totalPages || 1;

  // KnowBe4 data queries
  const { data: knowBe4Data } = useQuery({
    queryKey: [`/api/knowbe4/user/${user?.email}`],
    enabled: !!user?.email && activeTab === "monitoring",
  });

  // Get user-specific training enrollments using KnowBe4 user ID
  const { data: userTrainingData } = useQuery({
    queryKey: [`/api/knowbe4/user/${(knowBe4Data as any)?.id || 'none'}/training`],
    enabled: !!(knowBe4Data as any)?.id && activeTab === "monitoring",
  });

  // Get user-specific phishing results using KnowBe4 user ID
  const { data: userPhishingData } = useQuery({
    queryKey: [`/api/knowbe4/user/${(knowBe4Data as any)?.id || 'none'}/phishing`],
    enabled: !!(knowBe4Data as any)?.id && activeTab === "monitoring",
  });

  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  const toggleLogExpansion = (logId: string) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedLogs(newExpanded);
  };

  const getEventIcon = (eventType: string) => {
    return ''; // Icons removed per user request
  };

  const getOutcomeColor = (outcome: string) => {
    switch (outcome.toUpperCase()) {
      case 'SUCCESS': return 'text-green-600';
      case 'FAILURE': return 'text-red-600';
      case 'UNKNOWN': return 'text-gray-600';
      default: return 'text-blue-600';
    }
  };

  const formatEventTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return format(date, "MMM dd HH:mm:ss");
    } catch {
      return timestamp;
    }
  };

  const formatTimestampWithPST = (timestamp: string | Date | null) => {
    if (!timestamp) return null;
    try {
      const date = new Date(timestamp);
      return format(date, "MMM d, yyyy 'at' h:mm a") + " PST";
    } catch {
      return 'Invalid date';
    }
  };

  // Set form values when user data loads
  useEffect(() => {
    if (user && !isEditing) {
      console.log('Setting form values for user:', { employeeType: user.employeeType, user });
      form.reset({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        login: user.login || "",
        title: user.title || "",
        department: user.department || "",
        mobilePhone: user.mobilePhone || "",
        manager: user.manager || "",
        employeeType: user.employeeType || "",
      });
    }
  }, [user, form, isEditing]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ status }: { status: string }) => {
      return apiRequest("PATCH", `/api/client/${clientId}/users/${userId}`, { status });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User status updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/client/${clientId}/users`, userId] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const syncStatusMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/client/${clientId}/users/${userId}/reset-status`, {});
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Status synced with OKTA successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/client/${clientId}/users`, userId] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async (userData: z.infer<typeof editUserSchema>) => {
      const response = await apiRequest("PATCH", `/api/client/${clientId}/users/${userId}`, userData);
      return response.json();
    },
    onSuccess: (updatedUser) => {
      // Enhanced success feedback with detailed OKTA sync information
      const hasOktaId = updatedUser?.oktaId;
      const syncStatus = updatedUser?.syncStatus;
      
      let syncMessage = "User profile updated successfully";
      let syncDetails = [];
      
      if (hasOktaId) {
        syncDetails.push("✓ Profile synced to OKTA");
        
        // Check employee type sync status with detailed messaging
        if (syncStatus?.employeeTypeGroupSync === 'failed_insufficient_permissions') {
          syncDetails.push("⚠ Employee type group change failed:");
          syncDetails.push("  Requires elevated OKTA API permissions");
        } else if (syncStatus?.employeeTypeGroupSync === 'attempted_with_limitations') {
          syncDetails.push("⚠ Employee type group change attempted (limited permissions)");
        }
      } else {
        syncDetails.push("• Local update only (no OKTA ID)");
      }
      
      const fullMessage = syncDetails.length > 0 
        ? `${syncMessage}\n${syncDetails.join('\n')}`
        : syncMessage;
      
      toast({
        title: "Success",
        description: fullMessage,
        duration: 5000, // Show for 5 seconds for detailed info
      });
      
      // Force complete page reload to ensure all data is fresh
      setTimeout(() => {
        window.location.reload();
      }, 2000); // Give time for user to see the success message
      
      setIsEditing(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
        duration: 5000,
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/client/${clientId}/users/${userId}`, undefined);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User deleted successfully",
      });
      setLocation(`/client/${clientId}/users`);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const passwordResetMutation = useMutation({
    mutationFn: async (data: { action: "set_temp" | "expire" | "generate"; password?: string }) => {
      // Send action type and optionally the password to use
      const payload: { action: string; password?: string } = { action: data.action };
      if (data.password) {
        payload.password = data.password;
      }
      const response = await apiRequest("POST", `/api/client/${clientId}/users/${userId}/password/reset`, payload);
      const result = await response.json();
      return result;
    },
    onSuccess: (data: any, variables) => {
      if (variables.action === "generate" && data?.generatedPassword) {
        setNewPassword(data.generatedPassword);
        setGeneratedPassword(data.generatedPassword);
      } else if (variables.action === "set_temp") {
        toast({
          title: "Success",
          description: "Password reset successfully. User can now log in with the new password.",
        });
      } else if (variables.action === "expire") {
        toast({
          title: "Success",
          description: "Password expired successfully",
        });
      }
      queryClient.invalidateQueries({ queryKey: [`/api/client/${clientId}/users`, userId] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // OKTA-specific mutation functions
  const resetAuthenticatorsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/client/${clientId}/users/${userId}/okta/reset-authenticators`, {});
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Authenticators reset successfully. User will need to re-enroll MFA devices.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/client/${clientId}/users`, userId] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const clearSessionsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/client/${clientId}/users/${userId}/okta/clear-sessions`, {});
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "All user sessions cleared successfully. User has been signed out of all applications.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/client/${clientId}/users`, userId] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetBehaviorMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/client/${clientId}/users/${userId}/okta/reset-behavior`, {});
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Behavior profile reset successfully. User's authentication patterns have been cleared.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/client/${clientId}/users`, userId] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Application assignment mutation
  const assignAppsMutation = useMutation({
    mutationFn: async (appNames: string[]) => {
      return apiRequest("POST", `/api/client/${clientId}/users/${userId}/assign-applications`, { 
        appNames 
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User applications updated successfully",
      });
      // Invalidate all user-related queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: [`/api/client/${clientId}/users/${userId}/applications`] });
      queryClient.invalidateQueries({ queryKey: [`/api/client/${clientId}/users/${userId}/groups`] });
      queryClient.invalidateQueries({ queryKey: [`/api/client/${clientId}/users/${userId}`] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Application removal mutation
  const removeAppMutation = useMutation({
    mutationFn: async (appNames: string[]) => {
      return apiRequest("DELETE", `/api/client/${clientId}/users/${userId}/remove-applications`, { 
        appNames 
      });
    },
    onSuccess: (result: any) => {
      const response = result;
      if (response.success?.length > 0) {
        toast({
          title: "Success",
          description: `Removed access to: ${response.success.join(', ')}`,
        });
      }
      if (response.errors?.length > 0) {
        toast({
          title: "Partial Success",
          description: `Some errors occurred: ${response.errors.join(', ')}`,
          variant: "destructive",
        });
      }
      // Invalidate all user-related queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: [`/api/client/${clientId}/users/${userId}/applications`] });
      queryClient.invalidateQueries({ queryKey: [`/api/client/${clientId}/users/${userId}/groups`] });
      queryClient.invalidateQueries({ queryKey: [`/api/client/${clientId}/users/${userId}`] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleStatusChange = (status: string) => {
    const actionText = status === "ACTIVE" ? "activate" : 
                      status === "SUSPENDED" ? "suspend" : "deactivate";
    setConfirmAction({
      type: "status",
      title: `${actionText.charAt(0).toUpperCase() + actionText.slice(1)} User`,
      message: `Are you sure you want to ${actionText} this user?`,
      action: () => updateStatusMutation.mutate({ status }),
    });
  };

  const handleDelete = () => {
    setConfirmAction({
      type: "delete",
      title: "Delete User",
      message: "Are you sure you want to permanently delete this user? This action cannot be undone.",
      action: () => deleteUserMutation.mutate(),
    });
  };

  // OKTA-specific action handlers
  const handleResetAuthenticators = () => {
    setConfirmAction({
      type: "reset-auth",
      title: "Reset Authenticators",
      message: "Are you sure you want to reset all authenticators for this user? This will require them to re-enroll their MFA devices.",
      action: () => resetAuthenticatorsMutation.mutate(),
    });
  };

  const handleClearUserSessions = () => {
    setConfirmAction({
      type: "clear-sessions",
      title: "Clear User Sessions",
      message: "Are you sure you want to clear all active sessions for this user? They will be signed out of all applications.",
      action: () => clearSessionsMutation.mutate(),
    });
  };

  const handleResetBehaviorProfile = () => {
    setConfirmAction({
      type: "reset-behavior",
      title: "Reset Behavior Profile",
      message: "Are you sure you want to reset the behavior profile for this user? This will clear their learned authentication patterns.",
      action: () => resetBehaviorMutation.mutate(),
    });
  };

  const handleEditSubmit = (data: z.infer<typeof editUserSchema>) => {
    updateUserMutation.mutate(data);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    form.reset();
  };

  // Initialize selected apps based on user's current applications
  React.useEffect(() => {
    if (userApps.length > 0 && appMappings.length > 0) {
      const currentAppNames = userApps.map(app => app.label || app.name).filter(Boolean);
      const matchingMappings = appMappings
        .filter((mapping: any) => currentAppNames.includes(mapping.appName))
        .map((mapping: any) => mapping.appName);
      setSelectedAppMappings(matchingMappings);
    }
  }, [userApps, appMappings]);

  const handleAppSelectionChange = (appName: string, checked: boolean) => {
    setSelectedAppMappings(prev => {
      if (checked) {
        return [...prev, appName];
      } else {
        return prev.filter(name => name !== appName);
      }
    });
  };

  const handleSaveAppAssignments = () => {
    assignAppsMutation.mutate(selectedAppMappings);
    setIsAppSelectorOpen(false);
  };

  const handleRemoveApplication = (appName: string) => {
    setConfirmAction({
      type: "remove-app",
      title: "Remove Application Access",
      message: `Are you sure you want to remove ${appName} access for ${user?.firstName} ${user?.lastName}? This will remove them from the corresponding OKTA group.`,
      action: () => removeAppMutation.mutate([appName]),
    });
  };

  const toggleSection = (logId: string, section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [logId]: {
        ...prev[logId],
        [section]: !prev[logId]?.[section]
      }
    }));
  };

  const expandAllSections = (logId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [logId]: {
        actor: true,
        client: true,
        event: true,
        target: true
      }
    }));
  };

  const collapseAllSections = (logId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [logId]: {
        actor: false,
        client: false,
        event: false,
        target: false
      }
    }));
  };

  const isSectionExpanded = (logId: string, section: string) => {
    return expandedSections[logId]?.[section] || false;
  };

  const areAllSectionsExpanded = (logId: string) => {
    const sections = expandedSections[logId];
    return sections?.actor && sections?.client && sections?.event && sections?.target;
  };

  const generatePassword = () => {
    passwordResetMutation.mutate({ action: "generate" });
  };

  const handlePasswordReset = () => {
    if (!newPassword) {
      toast({
        title: "Error",
        description: "Please enter a password or generate one",
        variant: "destructive",
      });
      return;
    }
    
    passwordResetMutation.mutate({ action: "set_temp", password: newPassword });
    setShowPasswordModal(null);
    setNewPassword("");
    setGeneratedPassword("");
  };

  const handlePasswordExpire = () => {
    passwordResetMutation.mutate({ action: "expire" });
    setShowPasswordModal(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <Badge className="bg-green-600 text-white">Active</Badge>;
      case "SUSPENDED":
        return <Badge className="bg-yellow-100 text-yellow-800">Suspended</Badge>;
      case "DEACTIVATED":
        return <Badge className="bg-red-100 text-red-800">Deactivated</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading user details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Error Loading User</h1>
          <p className="text-gray-600 mb-6">Failed to load user data: {error.message}</p>
          <Button onClick={() => setLocation("/")} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Users
          </Button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">User Not Found</h1>
          <p className="text-gray-600 mb-6">The user you're looking for doesn't exist or has been removed.</p>
          <Button onClick={() => setLocation("/")} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Users
          </Button>
        </div>
      </div>
    );
  }

  const getEmployeeType = (groups: any[]) => {
    if (!groups || groups.length === 0) return 'Not specified';
    const etGroup = groups.find(group => group.profile && group.profile.name && group.profile.name.startsWith('MTX-ET-'));
    return etGroup ? etGroup.profile.name.replace('MTX-ET-', '').replace('_', ' ') : 'Not specified';
  };

  const filteredApps = (userApps || []).map(app => {
    // Transform string applications to objects for consistent display
    if (typeof app === 'string') {
      return {
        id: app,
        name: app,
        label: app,
        status: 'ACTIVE',
        signOnMode: 'SSO'
      };
    }
    return app;
  }).filter(app => {
    if (!app) return false;
    
    const appName = app.label || app.name || '';
    return appName.toLowerCase().includes(appSearchTerm.toLowerCase());
  });

  return (
    <div className="flex-1 overflow-hidden">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 bg-background border-b border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/")}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Users
              </Button>
              <div className="flex items-center gap-4">
                <div>
                  <h1 className="text-xl font-bold text-foreground leading-tight">
                    {user.firstName || 'Unknown'} {user.lastName || 'User'}
                  </h1>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{user.email || 'No email'}</span>
                    <span className="text-sm text-muted-foreground">•</span>
                    {getStatusBadge(user.status || 'UNKNOWN')}
                  </div>
                </div>
                
                {/* OKTA-style action buttons */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPasswordModal("reset")}
                    className="flex items-center gap-2 text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Reset Password
                  </Button>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        More Actions
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 bg-white dark:bg-gray-800 border dark:border-gray-700">
                      <DropdownMenuItem
                        onClick={handleResetAuthenticators}
                        className="flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                      >
                        <RefreshCw className="w-4 h-4 text-blue-600" />
                        Reset Authenticators
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={handleClearUserSessions}
                        className="flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                      >
                        <UserX className="w-4 h-4 text-purple-600" />
                        Clear User Sessions
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={handleResetBehaviorProfile}
                        className="flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                      >
                        <RefreshCw className="w-4 h-4 text-green-600" />
                        Reset Behavior Profile
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="border-gray-200 dark:border-gray-600" />
                      {user.status === "ACTIVE" ? (
                        <>
                          <DropdownMenuItem
                            onClick={() => handleStatusChange("SUSPENDED")}
                            className="flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                          >
                            <UserX className="w-4 h-4 text-orange-600" />
                            Suspend
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleStatusChange("DEACTIVATED")}
                            className="flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                          >
                            <UserX className="w-4 h-4 text-red-600" />
                            Deactivate
                          </DropdownMenuItem>
                        </>
                      ) : user.status === "SUSPENDED" ? (
                        <>
                          <DropdownMenuItem
                            onClick={() => handleStatusChange("ACTIVE")}
                            className="flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                          >
                            <UserCheck className="w-4 h-4 text-green-600" />
                            Activate
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleStatusChange("DEACTIVATED")}
                            className="flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                          >
                            <UserX className="w-4 h-4 text-red-600" />
                            Deactivate
                          </DropdownMenuItem>
                        </>
                      ) : user.status === "DEACTIVATED" ? (
                        <DropdownMenuItem
                          onClick={() => handleStatusChange("ACTIVE")}
                          className="flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                        >
                          <UserCheck className="w-4 h-4 text-green-600" />
                          Activate
                        </DropdownMenuItem>
                      ) : null}
                      {/* Only show Delete option for deactivated users (OKTA requirement) */}
                      {user.status === "DEACTIVATED" && (
                        <>
                          <DropdownMenuSeparator className="border-gray-200 dark:border-gray-600" />
                          <DropdownMenuItem
                            onClick={handleDelete}
                            className="flex items-center gap-2 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer text-red-600 dark:text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete User
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
            
            {/* Edit Profile button in the right corner */}
            <div className="flex items-center">
              {!isEditing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  Edit Profile
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <div className="flex-shrink-0 px-6 pt-4">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="profile">Profile</TabsTrigger>
                <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
                <TabsTrigger value="applications">Applications ({userApps.length})</TabsTrigger>
                <TabsTrigger value="devices">Devices ({userDevices.length})</TabsTrigger>
                <TabsTrigger value="activity">Recent Activity</TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-auto px-6 py-4">
              <TabsContent value="profile" className="space-y-6 mt-0">
                {isEditing ? (
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleEditSubmit)} className="space-y-6">
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                          <CardTitle>Edit Profile Information</CardTitle>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={handleCancelEdit}
                            >
                              <X className="w-4 h-4 mr-2" />
                              Cancel
                            </Button>
                            <Button
                              type="submit"
                              size="sm"
                              disabled={updateUserMutation.isPending}
                            >
                              <Save className="w-4 h-4 mr-2" />
                              Save Changes
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="firstName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>First Name</FormLabel>
                                  <FormControl>
                                    <Input {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="lastName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Last Name</FormLabel>
                                  <FormControl>
                                    <Input {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Email</FormLabel>
                                <FormControl>
                                  <Input {...field} type="email" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="title"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Job Title</FormLabel>
                                  <FormControl>
                                    <Input {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="department"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Department</FormLabel>
                                  <FormControl>
                                    <Input {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <FormField
                            control={form.control}
                            name="login"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Login</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="mobilePhone"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Mobile Phone</FormLabel>
                                <FormControl>
                                  <Input {...field} type="tel" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="manager"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Manager</FormLabel>
                                  <FormControl>
                                    <div className="relative">
                                      <Input 
                                        {...field} 
                                        onChange={(e) => {
                                          field.onChange(e);
                                          setManagerSearch(e.target.value);
                                        }}
                                        placeholder="Type to search for manager..."
                                      />
                                      {managerSearch && availableManagers.length > 0 && (
                                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                                          {availableManagers.map((manager: User) => (
                                            <div
                                              key={manager.id}
                                              className="px-3 py-2 cursor-pointer hover:bg-gray-100"
                                              onClick={() => {
                                                const fullName = `${manager.firstName} ${manager.lastName}`;
                                                field.onChange(fullName);
                                                setManagerSearch("");
                                              }}
                                            >
                                              <div className="font-medium">{manager.firstName} {manager.lastName}</div>
                                              <div className="text-sm text-gray-500">{manager.email}</div>
                                              {manager.title && (
                                                <div className="text-sm text-gray-400">{manager.title}</div>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="employeeType"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Employee Type</FormLabel>
                                  <FormControl>
                                    <select
                                      {...field}
                                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      <option value="">Select Employee Type</option>
                                      <option value="EMPLOYEE">Employee</option>
                                      <option value="CONTRACTOR">Contractor</option>
                                      <option value="PART_TIME">Part Time</option>
                                      <option value="INTERN">Intern</option>
                                    </select>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    </form>
                  </Form>
                ) : (
                  <div className="space-y-4">
                    {/* Profile Sub-tabs */}
                    <Tabs value={profileSubTab} onValueChange={setProfileSubTab} className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="okta">OKTA</TabsTrigger>
                        <TabsTrigger value="microsoft">Microsoft</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="okta" className="space-y-6 mt-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Combined Personal & Work Information */}
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-center">Personal & Work Information</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              {/* First Name --- Last Name */}
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="text-sm font-medium text-muted-foreground">First Name</label>
                                  <p className="text-foreground">{user.firstName}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-muted-foreground">Last Name</label>
                                  <p className="text-foreground">{user.lastName}</p>
                                </div>
                              </div>
                              
                              {/* Email --- Manager */}
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                                  <p className="text-foreground">{user.email}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-muted-foreground">Manager</label>
                                  <p className="text-foreground">{user.manager || 'Not specified'}</p>
                                </div>
                              </div>
                              
                              {/* Title --- Department */}
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="text-sm font-medium text-muted-foreground">Title</label>
                                  <p className="text-foreground">{user.title || 'Not specified'}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-muted-foreground">Department</label>
                                  <p className="text-foreground">{user.department || 'Not specified'}</p>
                                </div>
                              </div>
                              
                              {/* Mobile Phone --- Employee Type */}
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="text-sm font-medium text-muted-foreground">Mobile Phone</label>
                                  <p className="text-foreground">{user.mobilePhone || 'Not specified'}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-muted-foreground">Employee Type</label>
                                  <p className="text-foreground">{user.employeeType || 'Not specified'}</p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>

                          {/* Account Information */}
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-center">Account Information</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div>
                                <label className="text-sm font-medium text-muted-foreground">Account Created</label>
                                <p className="text-foreground">
                                  {formatTimestampWithPST(user.created) || 'Not available'}
                                </p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-muted-foreground">Last Update</label>
                                <p className="text-foreground">
                                  {formatTimestampWithPST(user.lastUpdated) || 'Not available'}
                                </p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-muted-foreground">Last Password Change</label>
                                <p className="text-foreground">
                                  {formatTimestampWithPST(user.passwordChanged) || 'Never changed'}
                                </p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-muted-foreground">Last Login</label>
                                <p className="text-foreground">
                                  {formatTimestampWithPST(user.lastLogin) || 'Never logged in'}
                                </p>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </TabsContent>

                      <TabsContent value="microsoft" className="space-y-6 mt-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Microsoft Account Info */}
                          <Card>
                            <CardHeader>
                              <CardTitle className="flex items-center gap-2">
                                <Monitor className="w-5 h-5 text-blue-600" />
                                Microsoft Account
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div>
                                <label className="text-sm font-medium text-muted-foreground">Azure AD User ID</label>
                                <p className="text-foreground">Loading...</p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-muted-foreground">Office 365 License</label>
                                <p className="text-foreground">Loading...</p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-muted-foreground">Teams Status</label>
                                <p className="text-foreground">Loading...</p>
                              </div>
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="w-full"
                                onClick={() => {
                                  // API call to Microsoft Graph
                                }}
                              >
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Refresh Data
                              </Button>
                            </CardContent>
                          </Card>

                          {/* API Commands */}
                          <Card>
                            <CardHeader>
                              <CardTitle>Microsoft Graph API</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">Quick Actions</label>
                                <div className="grid grid-cols-1 gap-2">
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => {
                                      // Reset MFA
                                    }}
                                  >
                                    Reset MFA
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => {
                                      // Revoke sessions
                                    }}
                                  >
                                    Revoke Sessions
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => {
                                      // Get sign-in logs
                                    }}
                                  >
                                    Get Sign-in Logs
                                  </Button>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">Custom Query</label>
                                <Input 
                                  placeholder="Enter Graph API endpoint..."
                                  className="text-sm"
                                />
                                <Button variant="default" size="sm" className="w-full">
                                  Execute Query
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="monitoring" className="space-y-6 mt-0">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                  {/* KnowBe4 Security Training */}
                  <KnowBe4UserDisplay userEmail={user.email || ''} />

                  {/* SentinelOne */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Eye className="w-5 h-5 text-purple-600" />
                        SentinelOne
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Agent Status</label>
                        <p className="text-foreground">Loading...</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Last Check-in</label>
                        <p className="text-foreground">Loading...</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Threats Detected</label>
                        <p className="text-foreground">Loading...</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Policy Compliance</label>
                        <p className="text-foreground">Loading...</p>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1"
                          onClick={() => {
                            // API call to SentinelOne
                          }}
                        >
                          <RefreshCw className="w-4 h-4 mr-1" />
                          Refresh
                        </Button>
                        <Button 
                          variant="default" 
                          size="sm" 
                          className="flex-1"
                          onClick={() => {
                            // Initiate scan
                          }}
                        >
                          Full Scan
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Device Management - Addigy & Intune */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Monitor className="w-5 h-5 text-orange-600" />
                        Device Management
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        {/* Addigy Column */}
                        <div className="space-y-3">
                          <h4 className="font-medium text-sm text-orange-600 border-b pb-1">Addigy</h4>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Status</label>
                            <div className="flex items-center gap-2">
                              <Badge className="bg-green-600 text-white text-xs">Managed</Badge>
                            </div>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Last Sync</label>
                            <p className="text-foreground text-sm">5 min ago</p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Updates</label>
                            <p className="text-foreground text-sm">Up to Date</p>
                          </div>
                        </div>
                        
                        {/* Intune Column */}
                        <div className="space-y-3">
                          <h4 className="font-medium text-sm text-blue-500 border-b pb-1">Intune</h4>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Enrollment</label>
                            <div className="flex items-center gap-2">
                              <Badge className="bg-green-600 text-white text-xs">Enrolled</Badge>
                            </div>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Check-in</label>
                            <p className="text-foreground text-sm">1 hour ago</p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Policies</label>
                            <p className="text-foreground text-sm">5/5 Applied</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 pt-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1"
                          onClick={() => {
                            // API call to Addigy
                          }}
                        >
                          <RefreshCw className="w-3 h-3 mr-1" />
                          Sync Addigy
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1"
                          onClick={() => {
                            // API call to Intune
                          }}
                        >
                          <RefreshCw className="w-3 h-3 mr-1" />
                          Sync Intune
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Jira */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Search className="w-5 h-5 text-blue-700" />
                        Jira Service Management
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Open Tickets</label>
                        <p className="text-foreground">Loading...</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Recent Activity</label>
                        <p className="text-foreground">Loading...</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Priority Issues</label>
                        <p className="text-foreground">Loading...</p>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1"
                          onClick={() => {
                            // API call to Jira
                          }}
                        >
                          <RefreshCw className="w-4 h-4 mr-1" />
                          Refresh
                        </Button>
                        <Button 
                          variant="default" 
                          size="sm" 
                          className="flex-1"
                          onClick={() => {
                            // Create new ticket
                          }}
                        >
                          Create Ticket
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="applications" className="space-y-4 mt-0">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle>Applications ({userApps.length})</CardTitle>
                      <Popover open={isAppSelectorOpen} onOpenChange={setIsAppSelectorOpen}>
                        <PopoverTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="justify-between min-w-[200px]"
                          >
                            Manage Applications
                            <ChevronDown className="ml-2 h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                          <div className="space-y-4">
                            <h4 className="font-medium leading-none mb-3">Select Applications</h4>
                            <Command className="border rounded-md bg-white dark:bg-gray-800">
                              <CommandInput 
                                placeholder="Search applications..." 
                                className="bg-white dark:bg-gray-800"
                              />
                              <CommandEmpty>No applications found.</CommandEmpty>
                              <CommandGroup className="max-h-64 overflow-auto bg-white dark:bg-gray-800">
                                {appMappings
                                  .filter((mapping: any) => !userApps.includes(mapping.appName))
                                  .map((mapping: any) => (
                                  <CommandItem
                                    key={mapping.id}
                                    className="flex items-center space-x-2 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
                                    onSelect={() => {}} // Prevent default selection behavior
                                  >
                                    <Checkbox
                                      checked={selectedAppMappings.includes(mapping.appName)}
                                      onCheckedChange={(checked) => 
                                        handleAppSelectionChange(mapping.appName, !!checked)
                                      }
                                    />
                                    <span className="flex-1">{mapping.appName}</span>
                                    {mapping.description && (
                                      <span className="text-sm text-gray-500 truncate">
                                        {mapping.description}
                                      </span>
                                    )}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </Command>
                            <div className="flex justify-between pt-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsAppSelectorOpen(false)}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                onClick={handleSaveAppAssignments}
                                disabled={assignAppsMutation.isPending}
                              >
                                {assignAppsMutation.isPending ? "Saving..." : "Save Changes"}
                              </Button>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {filteredApps.length === 0 ? (
                      <p className="text-gray-500 text-center py-8">
                        {appSearchTerm ? `No applications found matching "${appSearchTerm}"` : 'No applications assigned'}
                      </p>
                    ) : (
                      <div className="space-y-1 max-w-md">
                        {filteredApps.map((app, index) => (
                          <div key={app.id || index} className="flex items-center gap-2 py-2 px-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveApplication(app.label || app.name)}
                              className="h-6 w-6 p-0 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                            <span className="text-sm font-medium">{app.label || app.name || 'Unknown Application'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="devices" className="space-y-4 mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle>Registered Devices</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {userDevices.length === 0 ? (
                      <p className="text-gray-500 text-center py-8">No devices registered</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        {userDevices.map((device, index) => (
                          <div key={device.id || index} className="flex items-center justify-between p-3 border rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                            <div className="flex items-center gap-3 flex-1">
                              <div className="w-10 h-10 bg-gray-200 dark:bg-gray-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                {(() => {
                                  const platform = device.profile?.platform || device.platform || device.deviceType || device.provider || 'Unknown Platform';
                                  const DeviceIcon = getDeviceIcon(platform);
                                  return <DeviceIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />;
                                })()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <h4 className="font-medium text-sm truncate">
                                  {device.profile?.deviceName || 
                                   device.profile?.name || 
                                   device.profile?.displayName || 
                                   device.displayName || 
                                   device.name || 
                                   `${device.factorType || 'Device'} Factor` || 
                                   'Unknown Device'}
                                </h4>
                                <p className="text-xs text-gray-500 uppercase tracking-wide">
                                  {device.profile?.platform || 
                                   device.profile?.deviceType || 
                                   device.platform || 
                                   device.deviceType || 
                                   device.provider || 
                                   'Unknown Platform'}
                                </p>
                                {(device.profile?.serialNumber || device.serialNumber) && (
                                  <p className="text-xs text-gray-400 truncate">
                                    Serial: {device.profile?.serialNumber || device.serialNumber}
                                  </p>
                                )}
                                {device.factorType && (
                                  <p className="text-xs text-gray-400">
                                    Type: {device.factorType}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1 ml-2">
                              <Badge variant={device.status === 'ACTIVE' ? 'default' : 'secondary'} className="text-xs px-2 py-0.5">
                                {device.status || 'ACTIVE'}
                              </Badge>
                              {(device.lastUpdated || device.created) && (
                                <span className="text-xs text-gray-400 text-right">
                                  {new Date(device.lastUpdated || device.created).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="activity" className="space-y-4 mt-0">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div className="flex items-center gap-4">
                      <CardTitle>Activity Events</CardTitle>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Filter:</span>
                        <Select
                          value={outcomeFilter}
                          onValueChange={(value) => {
                            setOutcomeFilter(value);
                            setLogsCurrentPage(1); // Reset to first page when changing filter
                          }}
                        >
                          <SelectTrigger className="w-32 bg-white dark:bg-gray-800">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-white dark:bg-gray-800">
                            <SelectItem value="ALL">All Events</SelectItem>
                            <SelectItem value="SUCCESS">Success</SelectItem>
                            <SelectItem value="FAILURE">Failure</SelectItem>
                            <SelectItem value="CHALLENGE">Challenge</SelectItem>
                            <SelectItem value="UNKNOWN">Unknown</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Show:</span>
                        <Select
                          value={logsPageSize.toString()}
                          onValueChange={(value) => {
                            setLogsPageSize(parseInt(value));
                            setLogsCurrentPage(1); // Reset to first page when changing page size
                          }}
                        >
                          <SelectTrigger className="w-20 bg-white dark:bg-gray-800">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-white dark:bg-gray-800">
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="20">20</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                            <SelectItem value="100">100</SelectItem>
                          </SelectContent>
                        </Select>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          of {userLogs.length} events
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => queryClient.invalidateQueries({ queryKey: [`/api/client/${clientId}/users/${userId}/logs`] })}
                        disabled={logsLoading}
                      >
                        <RefreshCw className={`w-4 h-4 mr-2 ${logsLoading ? 'animate-spin' : ''}`} />
                        Refresh
                      </Button>
                      <Button variant="outline" size="sm" onClick={downloadLogsAsCSV}>
                        <Download className="w-4 h-4 mr-2" />
                        Download CSV
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {logsLoading ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                        <p className="text-gray-500 mt-2">Loading activity logs...</p>
                      </div>
                    ) : logsError ? (
                      <p className="text-red-500 text-center py-8">Failed to load activity logs</p>
                    ) : !Array.isArray(userLogs) || userLogs.length === 0 ? (
                      <p className="text-gray-500 text-center py-8">No recent activity found</p>
                    ) : (
                      <div className="space-y-0 border rounded-lg">
                        <div className="grid grid-cols-12 gap-4 p-3 bg-gray-50 dark:bg-gray-800 border-b text-sm font-medium text-gray-700 dark:text-gray-300">
                          <div className="col-span-2">Time</div>
                          <div className="col-span-3">Actor</div>
                          <div className="col-span-4">Event Info</div>
                          <div className="col-span-2">Targets</div>
                          <div className="col-span-1"></div>
                        </div>
                        {Array.isArray(userLogs) && userLogs.map((log: any, index: number) => (
                          <div key={log.id} className={`${index % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800'}`}>
                            <div 
                              className="grid grid-cols-12 gap-4 p-3 border-b border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors cursor-pointer"
                              onClick={() => {
                                toggleLogExpansion(log.id);
                                // Expand all sections by default when opening
                                if (!expandedLogs.has(log.id)) {
                                  expandAllSections(log.id);
                                }
                              }}
                            >
                              <div className="col-span-2 text-sm">
                                <div className="font-medium">{formatEventTime(log.published)}</div>
                              </div>
                              <div className="col-span-3 text-sm">
                                <div className="font-medium">{log.actor?.displayName || 'Unknown Actor'}</div>
                                <div className="text-gray-500">{log.client?.ipAddress || 'Unknown IP'}</div>
                              </div>
                              <div className="col-span-4 text-sm">
                                <div className="font-medium">{log.displayMessage || log.eventType}</div>
                                <div className={`${getOutcomeColor(log.outcome)} font-medium`}>
                                  {log.outcome}
                                </div>
                              </div>
                              <div className="col-span-2 text-sm">
                                {log.target && log.target.length > 0 && (
                                  <div>
                                    <div className="font-medium">{log.target[0].displayName}</div>
                                    <div className="text-gray-500">({log.target[0].type})</div>
                                  </div>
                                )}
                              </div>
                              <div className="col-span-1 flex items-center justify-end">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleLogExpansion(log.id);
                                  }}
                                  className="h-8 w-8 p-0"
                                >
                                  {expandedLogs.has(log.id) ? (
                                    <ChevronUp className="w-4 h-4" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => e.stopPropagation()}
                                  className="h-8 w-8 p-0 ml-1"
                                >
                                  <Copy className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                            
                            {expandedLogs.has(log.id) && (
                              <div className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                                <div className="p-4 space-y-4">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Actor Section */}
                                    <div>
                                      <div className="flex items-center gap-2 mb-2">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="p-0 h-auto"
                                          onClick={() => toggleSection(log.id, 'actor')}
                                        >
                                          {isSectionExpanded(log.id, 'actor') ? (
                                            <ChevronDown className="w-4 h-4 text-foreground" />
                                          ) : (
                                            <ChevronRight className="w-4 h-4 text-foreground" />
                                          )}
                                        </Button>
                                        <span className="font-semibold text-foreground">Actor</span>
                                        <Button 
                                          variant="outline" 
                                          size="sm" 
                                          className="ml-auto h-6 text-xs"
                                          onClick={() => areAllSectionsExpanded(log.id) ? collapseAllSections(log.id) : expandAllSections(log.id)}
                                        >
                                          {areAllSectionsExpanded(log.id) ? 'Collapse All' : 'Expand All'}
                                        </Button>
                                      </div>
                                      {isSectionExpanded(log.id, 'actor') && (
                                        <div className="bg-white dark:bg-gray-900 p-3 rounded border border-border space-y-2 text-sm text-foreground">
                                          <div><span className="font-medium">ID:</span> {log.actor?.id || 'N/A'}</div>
                                          <div><span className="font-medium">Display Name:</span> {log.actor?.displayName || 'N/A'}</div>
                                          <div><span className="font-medium">Type:</span> {log.actor?.type || 'N/A'}</div>
                                        </div>
                                      )}
                                    </div>

                                    {/* Client Section */}
                                    <div>
                                      <div className="flex items-center gap-2 mb-2">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="p-0 h-auto"
                                          onClick={() => toggleSection(log.id, 'client')}
                                        >
                                          {isSectionExpanded(log.id, 'client') ? (
                                            <ChevronDown className="w-4 h-4 text-foreground" />
                                          ) : (
                                            <ChevronRight className="w-4 h-4 text-foreground" />
                                          )}
                                        </Button>
                                        <span className="font-semibold text-foreground">Client</span>
                                      </div>
                                      {isSectionExpanded(log.id, 'client') && (
                                        <div className="bg-white dark:bg-gray-900 p-3 rounded border border-border space-y-2 text-sm text-foreground">
                                          <div><span className="font-medium">IP Address:</span> {log.client?.ipAddress || 'N/A'}</div>
                                          <div><span className="font-medium">User Agent:</span> 
                                            <div className="mt-1 text-xs text-muted-foreground break-all">
                                              {log.client?.userAgent || 'N/A'}
                                            </div>
                                          </div>
                                          {log.client?.geographicalContext && (
                                            <div><span className="font-medium">Location:</span> 
                                              {log.client.geographicalContext.city}, {log.client.geographicalContext.state}, {log.client.geographicalContext.country}
                                            </div>
                                          )}
                                          {/* Device Information */}
                                          {log.client?.device && (
                                            <>
                                              <div className="pt-2 border-t border-border">
                                                <span className="font-medium text-blue-600 dark:text-blue-400">Device Information</span>
                                              </div>
                                              <div><span className="font-medium">Device ID:</span> {log.client.device.id || 'N/A'}</div>
                                              <div><span className="font-medium">UDID:</span> {log.client.device.udid || 'N/A'}</div>
                                              <div><span className="font-medium">Device Name:</span> {log.client.device.name || 'N/A'}</div>
                                              <div><span className="font-medium">OS Platform:</span> {log.client.device.os_platform || 'N/A'}</div>
                                              <div><span className="font-medium">OS Version:</span> {log.client.device.os_version || 'N/A'}</div>
                                              <div><span className="font-medium">Managed:</span> 
                                                <span className={`ml-1 ${log.client.device.managed ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                  {log.client.device.managed ? 'Yes' : 'No'}
                                                </span>
                                              </div>
                                              <div><span className="font-medium">Verified:</span> 
                                                <span className={`ml-1 ${log.client.device.registered ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                  {log.client.device.registered ? 'Yes' : 'No'}
                                                </span>
                                              </div>
                                              <div><span className="font-medium">Screen Lock Type:</span> {log.client.device.screen_lock_type || 'N/A'}</div>
                                              <div><span className="font-medium">Disk Encryption Type:</span> {log.client.device.disk_encryption_type || 'N/A'}</div>
                                            </>
                                          )}
                                          {/* Request Information */}
                                          {log.request && (
                                            <>
                                              <div className="pt-2 border-t border-border">
                                                <span className="font-medium text-purple-600 dark:text-purple-400">Request Information</span>
                                              </div>
                                              <div><span className="font-medium">IP Chain:</span> 
                                                <div className="mt-1 text-xs text-muted-foreground">
                                                  {log.request.ipChain?.map((ip: any, idx: number) => (
                                                    <div key={idx} className="ml-2">
                                                      • {ip.ip} ({ip.source || 'Unknown'}) - {ip.geographicalContext?.city || 'Unknown location'}
                                                    </div>
                                                  )) || 'N/A'}
                                                </div>
                                              </div>
                                            </>
                                          )}
                                        </div>
                                      )}
                                    </div>

                                    {/* Event Section */}
                                    <div>
                                      <div className="flex items-center gap-2 mb-2">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="p-0 h-auto"
                                          onClick={() => toggleSection(log.id, 'event')}
                                        >
                                          {isSectionExpanded(log.id, 'event') ? (
                                            <ChevronDown className="w-4 h-4 text-foreground" />
                                          ) : (
                                            <ChevronRight className="w-4 h-4 text-foreground" />
                                          )}
                                        </Button>
                                        <span className="font-semibold text-foreground">Event</span>
                                      </div>
                                      {isSectionExpanded(log.id, 'event') && (
                                        <div className="bg-white dark:bg-gray-900 p-3 rounded border border-border space-y-2 text-sm text-foreground">
                                          <div><span className="font-medium">Event Type:</span> {log.eventType}</div>
                                          <div><span className="font-medium">Display Message:</span> {log.displayMessage || 'N/A'}</div>
                                          <div><span className="font-medium">Outcome:</span> 
                                            <span className={`ml-1 ${getOutcomeColor(log.outcome)}`}>{log.outcome}</span>
                                          </div>
                                          <div><span className="font-medium">Event ID:</span> {log.id}</div>
                                        </div>
                                      )}
                                    </div>

                                    {/* Target Section */}
                                    <div>
                                      <div className="flex items-center gap-2 mb-2">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="p-0 h-auto"
                                          onClick={() => toggleSection(log.id, 'target')}
                                        >
                                          {isSectionExpanded(log.id, 'target') ? (
                                            <ChevronDown className="w-4 h-4 text-foreground" />
                                          ) : (
                                            <ChevronRight className="w-4 h-4 text-foreground" />
                                          )}
                                        </Button>
                                        <span className="font-semibold text-foreground">Target</span>
                                      </div>
                                      {isSectionExpanded(log.id, 'target') && (
                                        <div className="bg-white dark:bg-gray-900 p-3 rounded border border-border space-y-2 text-sm text-foreground">
                                          {log.target && log.target.length > 0 ? (
                                            log.target.map((target: any, idx: number) => (
                                              <div key={idx} className={idx > 0 ? 'pt-2 border-t border-border' : ''}>
                                                <div><span className="font-medium">ID:</span> {target.id || 'N/A'}</div>
                                                <div><span className="font-medium">Type:</span> 
                                                  <span className="ml-1 text-green-600 dark:text-green-400">{target.type || 'N/A'}</span>
                                                </div>
                                                <div><span className="font-medium">Display Name:</span> 
                                                  <span className="ml-1 text-blue-600 dark:text-blue-400">{target.displayName || 'N/A'}</span>
                                                </div>
                                              </div>
                                            ))
                                          ) : (
                                            <div>No target information available</div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between mt-4 pt-4 border-t">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setLogsCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={logsCurrentPage === 1}
                          >
                            <ChevronLeft className="w-4 h-4 mr-1" />
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setLogsCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={logsCurrentPage === totalPages}
                          >
                            Next
                            <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Page {logsCurrentPage} of {totalPages}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>



      {/* Password Reset Modal */}
      <Dialog open={showPasswordModal === "reset"} onOpenChange={() => setShowPasswordModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for {user?.firstName} {user?.lastName}. The user will be notified and can use this password to log in immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">New Password</label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="flex-1"
                />
                <Button 
                  variant="outline" 
                  onClick={() => passwordResetMutation.mutate({ action: "generate" })}
                  className="px-3"
                >
                  Generate
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordModal(null)}>
              Cancel
            </Button>
            <Button onClick={handlePasswordReset} disabled={!newPassword} className="bg-blue-600 hover:bg-blue-700">
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Expire Modal */}
      <Dialog open={showPasswordModal === "expire"} onOpenChange={() => setShowPasswordModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Expire Password</DialogTitle>
            <DialogDescription>
              This action will expire {user?.firstName} {user?.lastName}'s current password. Here's what will happen:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0"></div>
              <span>User will be forced to change their password on next login</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0"></div>
              <span>Current password will become invalid immediately</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0"></div>
              <span>User will receive an email notification</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-2 flex-shrink-0"></div>
              <span className="text-orange-600 dark:text-orange-400">User cannot access any applications until password is changed</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordModal(null)}>
              Cancel
            </Button>
            <Button onClick={handlePasswordExpire} variant="destructive">
              Expire Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



      {/* Confirmation Modal */}
      {confirmAction && (
        <ConfirmationModal
          open={!!confirmAction}
          onClose={() => setConfirmAction(null)}
          onConfirm={() => {
            confirmAction.action();
            setConfirmAction(null);
          }}
          title={confirmAction.title}
          message={confirmAction.message}
          confirmText={confirmAction.type === "delete" ? "Delete" : "Confirm"}
          cancelText="Cancel"
          variant={confirmAction.type === "delete" ? "destructive" : "default"}
        />
      )}
    </div>
  );
}