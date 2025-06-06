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
import { ArrowLeft, ChevronDown, ChevronRight, Smartphone, Monitor, Shield, Eye, RefreshCw, KeyRound, Edit, Play, Pause, Trash2, Search, UserX, Save, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import ConfirmationModal from "@/components/confirmation-modal";
import { useState, useEffect } from "react";
import type { User } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const editUserSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  title: z.string().optional(),
  department: z.string().optional(),
  mobilePhone: z.string().optional(),
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
  
  const form = useForm<z.infer<typeof editUserSchema>>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      title: "",
      department: "",
      mobilePhone: "",
    },
  });
  
  const [activeTab, setActiveTab] = useState("profile");
  const [appSearchTerm, setAppSearchTerm] = useState("");

  const userId = params?.id ? parseInt(params.id) : null;

  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: ["/api/users", userId],
    enabled: !!userId,
  });

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

  // Set form values when user data loads
  useEffect(() => {
    if (user && !isEditing) {
      form.reset({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        title: user.title || "",
        department: user.department || "",
        mobilePhone: user.mobilePhone || "",
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
      return apiRequest("PATCH", `/api/users/${userId}`, userData);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User profile updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId] });
      setIsEditing(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
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
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
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

  const filteredApps = (userApps || []).filter(app =>
    app && app.label && app.label.toLowerCase().includes(appSearchTerm.toLowerCase())
  );

  return (
    <main className="flex-1 overflow-hidden">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
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
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {user.firstName || 'Unknown'} {user.lastName || 'User'}
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  {getStatusBadge(user.status || 'UNKNOWN')}
                  <span className="text-sm text-gray-500">•</span>
                  <span className="text-sm text-gray-500">{user.email || 'No email'}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncStatusMutation.mutate()}
                disabled={syncStatusMutation.isPending}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${syncStatusMutation.isPending ? 'animate-spin' : ''}`} />
                Sync Status
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Actions
                    <ChevronDown className="w-4 h-4 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {user.status === "ACTIVE" ? (
                    <DropdownMenuItem
                      onClick={() => handleStatusChange("SUSPENDED")}
                      className="text-yellow-600"
                    >
                      <Pause className="w-4 h-4 mr-2" />
                      Deactivate User
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onClick={() => handleStatusChange("ACTIVE")}
                      className="text-green-600"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Activate User
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => handlePasswordAction("reset")}>
                    <KeyRound className="w-4 h-4 mr-2" />
                    Reset Password
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handlePasswordAction("expire")}>
                    <KeyRound className="w-4 h-4 mr-2" />
                    Expire Password
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleDeleteUser}
                    className="text-red-600"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete User
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <div className="flex-shrink-0 px-6 pt-4">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="profile">Profile</TabsTrigger>
                <TabsTrigger value="groups">Groups ({userGroups.length})</TabsTrigger>
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
                        </CardContent>
                      </Card>
                    </form>
                  </Form>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Personal Information */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Personal Information</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <label className="text-sm font-medium text-gray-500">First Name</label>
                          <p className="text-gray-900">{user.firstName}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">Last Name</label>
                          <p className="text-gray-900">{user.lastName}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">Email</label>
                          <p className="text-gray-900">{user.email}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">Mobile Phone</label>
                          <p className="text-gray-900">{user.mobilePhone || 'Not specified'}</p>
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
                          <label className="text-sm font-medium text-gray-500">Title</label>
                          <p className="text-gray-900">{user.title || 'Not specified'}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">Department</label>
                          <p className="text-gray-900">{user.department || 'Not specified'}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">Employee Type</label>
                          <p className="text-gray-900">{getEmployeeType(userGroups)}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">Manager</label>
                          <p className="text-gray-900">{user.manager || 'Not specified'}</p>
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
                          <label className="text-sm font-medium text-gray-500">Account Created</label>
                          <p className="text-gray-900">
                            {user.created ? format(new Date(user.created), "MMM d, yyyy 'at' h:mm a") : 'Not available'}
                          </p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">Last Update</label>
                          <p className="text-gray-900">
                            {user.lastUpdated ? format(new Date(user.lastUpdated), "MMM d, yyyy 'at' h:mm a") : 'Not available'}
                          </p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">Last Password Change</label>
                          <p className="text-gray-900">
                            {user.passwordChanged ? format(new Date(user.passwordChanged), "MMM d, yyyy 'at' h:mm a") : 'Never changed'}
                          </p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">Last Login</label>
                          <p className="text-gray-900">
                            {user.lastLogin ? format(new Date(user.lastLogin), "MMM d, yyyy 'at' h:mm a") : 'Never logged in'}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="groups" className="space-y-4 mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle>User Groups</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {userGroups.length === 0 ? (
                      <p className="text-gray-500 text-center py-8">No groups assigned</p>
                    ) : (
                      <div className="space-y-3">
                        {userGroups.map((group) => (
                          <div key={group.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <h4 className="font-medium">{group.profile.name}</h4>
                              <p className="text-sm text-gray-500">{group.profile.description || 'No description'}</p>
                            </div>
                            <Badge variant="secondary">{group.type}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="applications" className="space-y-4 mt-0">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Applications ({userApps.length})</CardTitle>
                    <div className="relative w-64">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        placeholder="Search applications..."
                        value={appSearchTerm}
                        onChange={(e) => setAppSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </CardHeader>
                  <CardContent>
                    {filteredApps.length === 0 ? (
                      <p className="text-gray-500 text-center py-8">
                        {appSearchTerm ? `No applications found matching "${appSearchTerm}"` : 'No applications assigned'}
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {filteredApps.map((app) => (
                          <div key={app.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                              {app.logo && (
                                <img src={app.logo} alt={app.label} className="w-8 h-8 rounded" />
                              )}
                              <div>
                                <h4 className="font-medium">{app.label}</h4>
                                <p className="text-sm text-gray-500">{app.name}</p>
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
                      <div className="space-y-3">
                        {userDevices.map((device, index) => (
                          <div key={device.id || index} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                                <span className="text-lg">📱</span>
                              </div>
                              <div>
                                <h4 className="font-medium">{device.displayName || device.name || 'Unknown Device'}</h4>
                                <p className="text-sm text-gray-500">{device.platform || 'Unknown Platform'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={device.status === 'ACTIVE' ? 'default' : 'secondary'}>
                                {device.status || 'UNKNOWN'}
                              </Badge>
                              {device.lastUpdated && (
                                <span className="text-xs text-gray-500">
                                  Last seen: {new Date(device.lastUpdated).toLocaleDateString()}
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
                  <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-500 text-center py-8">Activity logs will be displayed here</p>
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
    </main>
  );
}