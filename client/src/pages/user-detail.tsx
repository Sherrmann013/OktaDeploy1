import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ArrowLeft, ChevronDown, ChevronRight, ChevronUp, Smartphone, Monitor, Shield, Eye, RefreshCw, KeyRound, Edit, Play, Pause, Trash2, Search, UserX, Save, X, Download, Copy, UserCheck, Plus, Key } from "lucide-react";
import { DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import ConfirmationModal from "@/components/confirmation-modal";
import AssignAppModal from "@/components/assign-app-modal";
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

export default function UserDetail() {
  const [, params] = useRoute("/users/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [confirmAction, setConfirmAction] = useState<{
    type: string;
    title: string;
    message: string;
    action: () => void;
  } | null>(null);
  
  const [isEditing, setIsEditing] = useState(false);
  const [managerSearch, setManagerSearch] = useState("");
  const [profileSubTab, setProfileSubTab] = useState("okta");
  
  const userId = params?.id ? parseInt(params.id) : null;
  
  // Fetch all users for manager auto-complete
  const { data: allUsersData } = useQuery({
    queryKey: ["/api/users/all"],
    queryFn: async () => {
      const response = await fetch('/api/users?limit=1000', {
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
      .sort((a, b) => {
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
  const [showAssignAppModal, setShowAssignAppModal] = useState(false);

  // Clear problematic cache entries on mount
  useEffect(() => {
    if (userId) {
      // Invalidate any cached data that might interfere
      queryClient.removeQueries({ 
        queryKey: ["/api/users"], 
        exact: false 
      });
    }
  }, [userId]);

  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: [`/api/users/${userId}`],
    enabled: !!userId,
    retry: 1,
    staleTime: 0,
    gcTime: 0, // Prevent caching issues
  });

  // Debug logging
  console.log('User ID:', userId);
  console.log('User data:', user);
  console.log('Loading:', isLoading);
  console.log('Error:', error);

  const { data: userGroups = [] } = useQuery<any[]>({
    queryKey: [`/api/users/${userId}/groups`],
    enabled: !!userId,
  });

  const { data: userApps = [] } = useQuery<any[]>({
    queryKey: [`/api/users/${userId}/applications`],
    enabled: !!userId,
  });

  const { data: userDevices = [] } = useQuery<any[]>({
    queryKey: [`/api/users/${userId}/devices`],
    enabled: !!userId,
  });

  const { data: userLogs = [] } = useQuery<any[]>({
    queryKey: [`/api/users/${userId}/logs`],
    enabled: !!userId && activeTab === "activity",
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
    if (eventType.includes('user.authentication')) return '🔐';
    if (eventType.includes('user.session')) return '🔗';
    if (eventType.includes('app.oauth2')) return '🔑';
    if (eventType.includes('user.account')) return '👤';
    if (eventType.includes('application')) return '📱';
    return '📋';
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

  // Set form values when user data loads
  useEffect(() => {
    if (user && !isEditing) {
      form.reset({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        login: user.login || "",
        title: user.title || "",
        department: user.department || "",
        mobilePhone: user.mobilePhone || "",
        manager: user.manager || "",
        employeeType: (user.employeeType as "EMPLOYEE" | "CONTRACTOR" | "PART_TIME" | "INTERN" | "") || "",
      });
    }
  }, [user, form, isEditing]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ status }: { status: string }) => {
      return apiRequest("PATCH", `/api/users/${userId}`, { status });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User status updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId] });
      setConfirmAction(null);
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
      return apiRequest("POST", `/api/users/${userId}/reset-status`, {});
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Status synced with OKTA successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId] });
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
      const response = await apiRequest("PATCH", `/api/users/${userId}`, userData);
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
      return apiRequest("DELETE", `/api/users/${userId}`, undefined);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User deleted successfully",
      });
      setLocation("/");
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
    mutationFn: async (action: "reset" | "expire") => {
      const endpoint = action === "reset" ? "reset" : "expire";
      return apiRequest("POST", `/api/users/${userId}/password/${endpoint}`, {});
    },
    onSuccess: (_, action) => {
      const actionText = action === "reset" ? "Password reset email sent" : "Password expired successfully";
      toast({
        title: "Success",
        description: actionText,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId] });
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
    const actionText = status === "ACTIVE" ? "activate" : status === "SUSPENDED" ? "deactivate" : "deactivate";
    setConfirmAction({
      type: status,
      title: `${actionText.charAt(0).toUpperCase() + actionText.slice(1)} User`,
      message: `Are you sure you want to ${actionText} this user?`,
      action: () => updateStatusMutation.mutate({ status }),
    });
  };

  const handleDeleteUser = () => {
    setConfirmAction({
      type: "delete",
      title: "Delete User",
      message: "Are you sure you want to delete this user? This action cannot be undone.",
      action: () => deleteUserMutation.mutate(),
    });
  };

  const handlePasswordAction = (action: "reset" | "expire") => {
    const actionText = action === "reset" ? "reset password" : "expire password";
    setConfirmAction({
      type: action,
      title: `${actionText.charAt(0).toUpperCase() + actionText.slice(1)}`,
      message: `Are you sure you want to ${actionText} for this user?`,
      action: () => passwordResetMutation.mutate(action),
    });
  };

  const handleEditSubmit = (data: z.infer<typeof editUserSchema>) => {
    updateUserMutation.mutate(data);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    form.reset();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <Badge className="bg-green-600 text-white">Active</Badge>;
      case "SUSPENDED":
        return <Badge className="bg-yellow-100 text-yellow-800">Suspended</Badge>;
      case "DEPROVISIONED":
        return <Badge className="bg-red-100 text-red-800">Deprovisioned</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading user details...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Error Loading User</h1>
          <p className="text-gray-600 mb-6">Failed to load user data: {error.message}</p>
          <Button onClick={() => setLocation("/")} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Users
          </Button>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">User Not Found</h1>
          <p className="text-gray-600 mb-6">The user you're looking for doesn't exist or has been removed.</p>
          <Button onClick={() => setLocation("/")} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Users
          </Button>
        </div>
      </main>
    );
  }

  const getEmployeeType = (groups: any[]) => {
    if (!groups || groups.length === 0) return 'Not specified';
    const etGroup = groups.find(group => group.profile && group.profile.name && group.profile.name.startsWith('MTX-ET-'));
    return etGroup ? etGroup.profile.name.replace('MTX-ET-', '').replace('_', ' ') : 'Not specified';
  };

  const filteredApps = (userApps || []).filter(app => {
    if (!app) return false;
    
    const appName = app.label || app.name || '';
    return appName.toLowerCase().includes(appSearchTerm.toLowerCase());
  });

  return (
    <main className="flex-1 overflow-hidden">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 bg-background border-b border-border px-6 py-4">
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
              <div className="flex items-center gap-6">
                <div>
                  <h1 className="text-2xl font-bold text-foreground">
                    {user.firstName || 'Unknown'} {user.lastName || 'User'}
                  </h1>
                  <div className="flex items-center gap-2 mt-1">
                    {getStatusBadge(user.status || 'UNKNOWN')}
                    <span className="text-sm text-muted-foreground">•</span>
                    <span className="text-sm text-muted-foreground">{user.email || 'No email'}</span>
                  </div>
                </div>
                
                {/* Individual action buttons next to user name */}
                <div className="flex items-center gap-2">
                  {user.status === "ACTIVE" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStatusChange("SUSPENDED")}
                      className="flex items-center gap-2 text-orange-600 border-orange-300 hover:bg-orange-50"
                    >
                      <UserX className="w-4 h-4" />
                      Suspend
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStatusChange("ACTIVE")}
                      className="flex items-center gap-2 text-green-600 border-green-300 hover:bg-green-50"
                    >
                      <UserCheck className="w-4 h-4" />
                      Activate
                    </Button>
                  )}
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePasswordAction("reset")}
                    className="flex items-center gap-2 text-blue-600 border-blue-300 hover:bg-blue-50"
                  >
                    <Key className="w-4 h-4" />
                    Reset Password
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePasswordAction("expire")}
                    className="flex items-center gap-2 text-purple-600 border-purple-300 hover:bg-purple-50"
                  >
                    <KeyRound className="w-4 h-4" />
                    Expire Password
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmAction({
                      title: "Delete User",
                      message: "Are you sure you want to delete this user? This action cannot be undone.",
                      action: () => handleDeleteUser(),
                      type: "delete"
                    })}
                    className="flex items-center gap-2 text-red-600 border-red-300 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </Button>
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
                <TabsTrigger value="security">Security</TabsTrigger>
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
                          {/* Personal Information */}
                          <Card>
                            <CardHeader>
                              <CardTitle>Personal Information</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div>
                                <label className="text-sm font-medium text-muted-foreground">First Name</label>
                                <p className="text-foreground">{user.firstName}</p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-muted-foreground">Last Name</label>
                                <p className="text-foreground">{user.lastName}</p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-muted-foreground">Email</label>
                                <p className="text-foreground">{user.email}</p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-muted-foreground">Login</label>
                                <p className="text-foreground">{user.login}</p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-muted-foreground">Mobile Phone</label>
                                <p className="text-foreground">{user.mobilePhone || 'Not specified'}</p>
                              </div>
                            </CardContent>
                          </Card>

                          {/* Work Information */}
                          <Card>
                            <CardHeader>
                              <CardTitle>Work Information</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div>
                                <label className="text-sm font-medium text-muted-foreground">Title</label>
                                <p className="text-foreground">{user.title || 'Not specified'}</p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-muted-foreground">Department</label>
                                <p className="text-foreground">{user.department || 'Not specified'}</p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-muted-foreground">Manager</label>
                                <p className="text-foreground">{user.manager || 'Not specified'}</p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-muted-foreground">Employee Type</label>
                                <p className="text-foreground">{user.employeeType || 'Not specified'}</p>
                              </div>
                            </CardContent>
                          </Card>

                          {/* Account Information */}
                          <Card>
                            <CardHeader>
                              <CardTitle>Account Information</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div>
                                <label className="text-sm font-medium text-muted-foreground">Account Created</label>
                                <p className="text-foreground">
                                  {user.created ? format(new Date(user.created), "MMM d, yyyy 'at' h:mm a") : 'Not available'}
                                </p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-muted-foreground">Last Update</label>
                                <p className="text-foreground">
                                  {user.lastUpdated ? format(new Date(user.lastUpdated), "MMM d, yyyy 'at' h:mm a") : 'Not available'}
                                </p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-muted-foreground">Last Password Change</label>
                                <p className="text-foreground">
                                  {user.passwordChanged ? format(new Date(user.passwordChanged), "MMM d, yyyy 'at' h:mm a") : 'Never changed'}
                                </p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-muted-foreground">Last Login</label>
                                <p className="text-foreground">
                                  {user.lastLogin ? format(new Date(user.lastLogin), "MMM d, yyyy 'at' h:mm a") : 'Never logged in'}
                                </p>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </TabsContent>

                      <TabsContent value="microsoft" className="space-y-6 mt-4">
                        <Card>
                          <CardHeader>
                            <CardTitle>Microsoft Account Information</CardTitle>
                          </CardHeader>
                          <CardContent className="py-8">
                            <div className="text-center text-muted-foreground">
                              <Monitor className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                              <p className="text-lg font-medium mb-2">Microsoft Integration</p>
                              <p className="text-sm">Microsoft account information will be displayed here when integration is configured.</p>
                            </div>
                          </CardContent>
                        </Card>
                      </TabsContent>
                    </Tabs>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="security" className="space-y-6 mt-0">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* KnowBe4 */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-blue-600" />
                        KnowBe4
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Training Status</label>
                        <p className="text-foreground">Up to Date</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Last Training</label>
                        <p className="text-foreground">Dec 15, 2024</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Risk Score</label>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-green-600 text-white">Low Risk</Badge>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Phishing Tests</label>
                        <p className="text-foreground">3/3 Passed</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Sentinel 1 */}
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
                        <div className="flex items-center gap-2">
                          <Badge className="bg-green-600 text-white">Active</Badge>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Last Check-in</label>
                        <p className="text-foreground">2 minutes ago</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Threats Detected</label>
                        <p className="text-foreground">0 (Last 30 days)</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Policy Compliance</label>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-green-600 text-white">Compliant</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Addigy */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Monitor className="w-5 h-5 text-orange-600" />
                        Addigy
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Device Management</label>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-green-600 text-white">Managed</Badge>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Last Sync</label>
                        <p className="text-foreground">5 minutes ago</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Software Updates</label>
                        <p className="text-foreground">Up to Date</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Compliance Score</label>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-green-600 text-white">98%</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Intune */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Smartphone className="w-5 h-5 text-blue-500" />
                        Microsoft Intune
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Enrollment Status</label>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-green-600 text-white">Enrolled</Badge>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Last Check-in</label>
                        <p className="text-foreground">1 hour ago</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Policies Applied</label>
                        <p className="text-foreground">5/5 Successful</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Device Compliance</label>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-green-600 text-white">Compliant</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="applications" className="space-y-4 mt-0">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Applications ({userApps.length})</CardTitle>
                    <div className="flex items-center gap-3">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setShowAssignAppModal(true)}
                      >
                        Assign App
                      </Button>
                      <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input
                          placeholder="Search applications..."
                          value={appSearchTerm}
                          onChange={(e) => setAppSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {filteredApps.length === 0 ? (
                      <p className="text-gray-500 text-center py-8">
                        {appSearchTerm ? `No applications found matching "${appSearchTerm}"` : 'No applications assigned'}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {filteredApps.map((app) => (
                          <div key={app.id} className="flex items-center justify-between p-2 border rounded-lg">
                            <div className="flex items-center gap-3">
                              {app.logo && (
                                <img src={app.logo} alt={app.label} className="w-8 h-8 rounded" />
                              )}
                              <div>
                                <h4 className="font-medium">{app.label || app.name || 'Unknown Application'}</h4>
                                <p className="text-sm text-gray-500">{app.description || app.settings?.app?.authURL || ''}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={app.status === 'ACTIVE' ? 'default' : 'secondary'}>
                                {app.status}
                              </Badge>
                              <Badge variant="outline">{app.signOnMode}</Badge>
                            </div>
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
                      <div className="space-y-2">
                        {userDevices.map((device, index) => (
                          <div key={device.id || index} className="flex items-center justify-between p-2 border rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                                <span className="text-lg">📱</span>
                              </div>
                              <div>
                                <h4 className="font-medium">
                                  {device.profile?.deviceName || 
                                   device.profile?.name || 
                                   device.profile?.displayName || 
                                   device.displayName || 
                                   device.name || 
                                   `${device.factorType || 'Device'} Factor` || 
                                   'Unknown Device'}
                                </h4>
                                <p className="text-sm text-gray-500">
                                  {device.profile?.platform || 
                                   device.profile?.deviceType || 
                                   device.platform || 
                                   device.deviceType || 
                                   device.provider || 
                                   'Unknown Platform'}
                                </p>
                                {(device.profile?.serialNumber || device.serialNumber) && (
                                  <p className="text-xs text-gray-400">
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
                            <div className="flex items-center gap-2">
                              <Badge variant={device.status === 'ACTIVE' ? 'default' : 'secondary'}>
                                {device.status || 'UNKNOWN'}
                              </Badge>
                              {(device.lastUpdated || device.created) && (
                                <span className="text-xs text-gray-500">
                                  Last seen: {new Date(device.lastUpdated || device.created).toLocaleDateString()}
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
                    <CardTitle>Events: {userLogs.length}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm">
                        <Download className="w-4 h-4 mr-2" />
                        Download CSV
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {userLogs.length === 0 ? (
                      <p className="text-gray-500 text-center py-8">No recent activity found</p>
                    ) : (
                      <div className="space-y-0 border rounded-lg">
                        <div className="grid grid-cols-12 gap-4 p-3 bg-gray-50 border-b text-sm font-medium text-gray-700">
                          <div className="col-span-2">Time</div>
                          <div className="col-span-3">Actor</div>
                          <div className="col-span-4">Event Info</div>
                          <div className="col-span-2">Targets</div>
                          <div className="col-span-1"></div>
                        </div>
                        {userLogs.map((log, index) => (
                          <div key={log.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                            <div className="grid grid-cols-12 gap-4 p-3 border-b border-gray-200 hover:bg-blue-50 transition-colors">
                              <div className="col-span-2 text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="text-lg">{getEventIcon(log.eventType)}</span>
                                  <div>
                                    <div className="font-medium">{formatEventTime(log.published)}</div>
                                  </div>
                                </div>
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
                                  onClick={() => toggleLogExpansion(log.id)}
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
                                  className="h-8 w-8 p-0 ml-1"
                                >
                                  <Copy className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                            
                            {expandedLogs.has(log.id) && (
                              <div className="bg-gray-100 border-b border-gray-200">
                                <div className="p-4 space-y-4">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Actor Section */}
                                    <div>
                                      <div className="flex items-center gap-2 mb-2">
                                        <ChevronRight className="w-4 h-4" />
                                        <span className="font-semibold">Actor</span>
                                        <Button variant="outline" size="sm" className="ml-auto h-6 text-xs">
                                          Expand All
                                        </Button>
                                      </div>
                                      <div className="bg-white p-3 rounded border space-y-2 text-sm">
                                        <div><span className="font-medium">ID:</span> {log.actor?.id || 'N/A'}</div>
                                        <div><span className="font-medium">Display Name:</span> {log.actor?.displayName || 'N/A'}</div>
                                        <div><span className="font-medium">Type:</span> {log.actor?.type || 'N/A'}</div>
                                      </div>
                                    </div>

                                    {/* Client Section */}
                                    <div>
                                      <div className="flex items-center gap-2 mb-2">
                                        <ChevronRight className="w-4 h-4" />
                                        <span className="font-semibold">Client</span>
                                      </div>
                                      <div className="bg-white p-3 rounded border space-y-2 text-sm">
                                        <div><span className="font-medium">IP Address:</span> {log.client?.ipAddress || 'N/A'}</div>
                                        <div><span className="font-medium">User Agent:</span> 
                                          <div className="mt-1 text-xs text-gray-600 break-all">
                                            {log.client?.userAgent || 'N/A'}
                                          </div>
                                        </div>
                                        {log.client?.geographicalContext && (
                                          <div><span className="font-medium">Location:</span> 
                                            {log.client.geographicalContext.city}, {log.client.geographicalContext.state}, {log.client.geographicalContext.country}
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Event Section */}
                                    <div>
                                      <div className="flex items-center gap-2 mb-2">
                                        <ChevronRight className="w-4 h-4" />
                                        <span className="font-semibold">Event</span>
                                      </div>
                                      <div className="bg-white p-3 rounded border space-y-2 text-sm">
                                        <div><span className="font-medium">Event Type:</span> {log.eventType}</div>
                                        <div><span className="font-medium">Display Message:</span> {log.displayMessage || 'N/A'}</div>
                                        <div><span className="font-medium">Outcome:</span> 
                                          <span className={`ml-1 ${getOutcomeColor(log.outcome)}`}>{log.outcome}</span>
                                        </div>
                                        <div><span className="font-medium">Event ID:</span> {log.id}</div>
                                      </div>
                                    </div>

                                    {/* Target Section */}
                                    <div>
                                      <div className="flex items-center gap-2 mb-2">
                                        <ChevronRight className="w-4 h-4" />
                                        <span className="font-semibold">Target</span>
                                      </div>
                                      <div className="bg-white p-3 rounded border space-y-2 text-sm">
                                        {log.target && log.target.length > 0 ? (
                                          log.target.map((target: any, idx: number) => (
                                            <div key={idx} className={idx > 0 ? 'pt-2 border-t' : ''}>
                                              <div><span className="font-medium">ID:</span> {target.id || 'N/A'}</div>
                                              <div><span className="font-medium">Type:</span> {target.type || 'N/A'}</div>
                                              <div><span className="font-medium">Display Name:</span> {target.displayName || 'N/A'}</div>
                                            </div>
                                          ))
                                        ) : (
                                          <div>No target information available</div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>

      {confirmAction && (
        <ConfirmationModal
          open={true}
          onClose={() => setConfirmAction(null)}
          onConfirm={confirmAction.action}
          title={confirmAction.title}
          message={confirmAction.message}
          variant={confirmAction.type === "delete" ? "destructive" : "default"}
        />
      )}

      <AssignAppModal
        open={showAssignAppModal}
        onClose={() => setShowAssignAppModal(false)}
        userId={userId?.toString() || ""}
        userApps={userApps}
      />
    </main>
  );
}