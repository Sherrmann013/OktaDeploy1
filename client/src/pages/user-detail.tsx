import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { format } from "date-fns";
import Sidebar from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ArrowLeft, ChevronDown, Smartphone, Monitor, Shield, Eye, RefreshCw, KeyRound, Edit, Play, Pause, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import ConfirmationModal from "@/components/confirmation-modal";
import { useState } from "react";
import type { User } from "@shared/schema";

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
  
  const [activeTab, setActiveTab] = useState("profile");

  const userId = params?.id ? parseInt(params.id) : null;

  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/users", userId],
    queryFn: async () => {
      const response = await fetch(`/api/users/${userId}`);
      if (!response.ok) throw new Error("Failed to fetch user");
      return response.json();
    },
    enabled: !!userId,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ status }: { status: string }) => {
      return apiRequest("PATCH", `/api/users/${userId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Success",
        description: "User status updated successfully",
      });
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
      return apiRequest("POST", `/api/users/${userId}/password/${action}`, {});
    },
    onSuccess: (_, action) => {
      toast({
        title: "Success",
        description: `Password ${action === "reset" ? "reset" : "expiration"} initiated successfully`,
      });
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
    const actionText = status === "ACTIVE" ? "activate" : status === "SUSPENDED" ? "suspend" : "deactivate";
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
    const actionText = action === "reset" ? "reset" : "expire";
    setConfirmAction({
      type: `password-${action}`,
      title: `${actionText.charAt(0).toUpperCase() + actionText.slice(1)} Password`,
      message: `Are you sure you want to ${actionText} this user's password?`,
      action: () => passwordResetMutation.mutate(action),
    });
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
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading user details...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">User Not Found</h2>
            <p className="text-gray-600 mb-4">The user you're looking for doesn't exist.</p>
            <Button onClick={() => setLocation("/")} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Users
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      
      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <Button 
              variant="ghost" 
              onClick={() => setLocation("/")}
              className="text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Users
            </Button>
          </div>

          {/* User Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {user.firstName} {user.lastName}
            </h1>
            <p className="text-gray-600 mb-4">{user.email}</p>
            
            {/* Action Buttons */}
            <div className="flex items-center space-x-3 mb-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="bg-white">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Reset or Remove password
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handlePasswordAction("reset")}>
                    <KeyRound className="w-4 h-4 mr-2" />
                    Reset password
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handlePasswordAction("expire")}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Expire password
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="bg-white">
                    More Actions
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit user
                  </DropdownMenuItem>
                  {user.status === "ACTIVE" ? (
                    <DropdownMenuItem onClick={() => handleStatusChange("SUSPENDED")}>
                      <Pause className="w-4 h-4 mr-2" />
                      Suspend user
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => handleStatusChange("ACTIVE")}>
                      <Play className="w-4 h-4 mr-2" />
                      Activate user
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={handleDeleteUser} className="text-red-600">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete user
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Status Info */}
            <div className="flex items-center space-x-6 text-sm text-gray-600">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span>User</span>
                <Button variant="link" className="p-0 h-auto text-blue-600">Change</Button>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                {getStatusBadge(user.status)}
              </div>
              <div className="flex items-center space-x-2">
                <Shield className="w-4 h-4" />
                <span>Profile sourced by Active Directory</span>
              </div>
              <Button 
                variant="link" 
                className="p-0 h-auto text-blue-600"
                onClick={() => setActiveTab("logs")}
              >
                <Eye className="w-4 h-4 mr-1" />
                View Logs
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-6 bg-white border-b">
              <TabsTrigger value="applications" className="text-left">Applications</TabsTrigger>
              <TabsTrigger value="groups" className="text-left">Groups</TabsTrigger>
              <TabsTrigger value="profile" className="text-left">Profile</TabsTrigger>
              <TabsTrigger value="devices" className="text-left">Devices</TabsTrigger>
              <TabsTrigger value="admin-roles" className="text-left">Admin roles</TabsTrigger>
              <TabsTrigger value="logs" className="text-left">Logs</TabsTrigger>
            </TabsList>

            {/* Applications Tab */}
            <TabsContent value="applications" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Applications</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-gray-500">
                    <Monitor className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>No applications assigned to this user</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Groups Tab */}
            <TabsContent value="groups" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Groups</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {user.groups && user.groups.length > 0 ? (
                      user.groups.map((group, index) => (
                        <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                          <span>{group}</span>
                          <Badge variant="secondary">Member</Badge>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <p>No groups assigned to this user</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Profile Tab */}
            <TabsContent value="profile" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Personal Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">First Name</label>
                      <p className="text-sm">{user.firstName}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Last Name</label>
                      <p className="text-sm">{user.lastName}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Email</label>
                      <p className="text-sm">{user.email}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Login</label>
                      <p className="text-sm">{user.login}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Mobile Phone</label>
                      <p className="text-sm">{user.mobilePhone || "Not provided"}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Work Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Title</label>
                      <p className="text-sm">{user.title || "Not provided"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Department</label>
                      <p className="text-sm">{user.department || "Not provided"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Employee Type</label>
                      <p className="text-sm">{user.employeeType || "Not specified"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Status</label>
                      <p className="text-sm">{getStatusBadge(user.status)}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Account Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">User ID</label>
                      <p className="text-sm font-mono">{user.oktaId}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Created</label>
                      <p className="text-sm">{user.created ? format(new Date(user.created), "PPP") : "Unknown"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Last Updated</label>
                      <p className="text-sm">{user.lastUpdated ? format(new Date(user.lastUpdated), "PPP") : "Unknown"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Last Login</label>
                      <p className="text-sm">{user.lastLogin ? format(new Date(user.lastLogin), "PPP") : "Never"}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Devices Tab */}
            <TabsContent value="devices" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Smartphone className="w-5 h-5 mr-2" />
                    Registered Devices
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-gray-500">
                    <Monitor className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <h3 className="text-lg font-medium mb-2">No devices registered</h3>
                    <p>This user has not registered any devices for authentication.</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Admin Roles Tab */}
            <TabsContent value="admin-roles" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Admin Roles</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-gray-500">
                    <Shield className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>No admin roles assigned to this user</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Logs Tab */}
            <TabsContent value="logs" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Eye className="w-5 h-5 mr-2" />
                    User Activity Logs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Sample log entries - in real implementation these would come from OKTA API */}
                    <div className="border-l-4 border-blue-500 pl-4 py-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">User login successful</span>
                        <span className="text-sm text-gray-500">
                          {user.lastLogin ? format(new Date(user.lastLogin), "PPP p") : "Recent"}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">Successful authentication via SSO</p>
                    </div>
                    
                    <div className="border-l-4 border-green-500 pl-4 py-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Profile updated</span>
                        <span className="text-sm text-gray-500">
                          {user.lastUpdated ? format(new Date(user.lastUpdated), "PPP p") : "Recent"}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">User profile information synchronized from Active Directory</p>
                    </div>

                    <div className="border-l-4 border-yellow-500 pl-4 py-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Account created</span>
                        <span className="text-sm text-gray-500">
                          {user.created ? format(new Date(user.created), "PPP p") : "Initial"}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">User account provisioned from Active Directory</p>
                    </div>

                    <div className="text-center py-4">
                      <Button variant="outline" size="sm">
                        View All Logs
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      
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
          variant={confirmAction.type === "delete" ? "destructive" : "default"}
        />
      )}
    </div>
  );
}