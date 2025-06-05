import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { format } from "date-fns";
import Sidebar from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ArrowLeft, Edit, RotateCcw, Trash2, Play, Pause, ChevronDown, Smartphone, Monitor, Shield, Eye, RefreshCw, KeyRound } from "lucide-react";
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>;
      case "SUSPENDED":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Suspended</Badge>;
      case "DEPROVISIONED":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Deprovisioned</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getUserInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
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
        <div className="p-6 max-w-4xl mx-auto">
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
            <div className="flex items-center space-x-3">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                <Edit className="w-4 h-4 mr-2" />
                Edit User
              </Button>
              <Button variant="outline">
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset Password
              </Button>
            </div>
          </div>

          {/* User Profile Card */}
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 bg-gray-300 rounded-full flex items-center justify-center">
                    <span className="text-xl font-medium text-gray-700">
                      {getUserInitials(user.firstName, user.lastName)}
                    </span>
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900">
                    {user.firstName} {user.lastName}
                  </h3>
                  <p className="text-gray-500 mb-2">{user.email}</p>
                  <div className="flex items-center space-x-4">
                    {getStatusBadge(user.status)}
                    <span className="text-sm text-gray-500">
                      User ID: <span className="font-mono">{user.oktaId}</span>
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 mt-4">
                    {user.status === "SUSPENDED" && (
                      <Button 
                        size="sm" 
                        onClick={() => handleStatusChange("ACTIVE")}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <Play className="w-4 h-4 mr-1" />
                        Activate
                      </Button>
                    )}
                    {user.status === "ACTIVE" && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleStatusChange("SUSPENDED")}
                      >
                        <Pause className="w-4 h-4 mr-1" />
                        Suspend
                      </Button>
                    )}
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={handleDeleteUser}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* User Details Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Personal Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">First Name</dt>
                  <dd className="text-sm text-gray-900">{user.firstName}</dd>
                </div>
                <Separator />
                <div>
                  <dt className="text-sm font-medium text-gray-500">Last Name</dt>
                  <dd className="text-sm text-gray-900">{user.lastName}</dd>
                </div>
                <Separator />
                <div>
                  <dt className="text-sm font-medium text-gray-500">Email</dt>
                  <dd className="text-sm text-gray-900">{user.email}</dd>
                </div>
                <Separator />
                <div>
                  <dt className="text-sm font-medium text-gray-500">Mobile Phone</dt>
                  <dd className="text-sm text-gray-900">{user.mobilePhone || "Not provided"}</dd>
                </div>
                <Separator />
                <div>
                  <dt className="text-sm font-medium text-gray-500">Department</dt>
                  <dd className="text-sm text-gray-900">{user.department || "Not specified"}</dd>
                </div>
                <Separator />
                <div>
                  <dt className="text-sm font-medium text-gray-500">Title</dt>
                  <dd className="text-sm text-gray-900">{user.title || "Not specified"}</dd>
                </div>
              </CardContent>
            </Card>

            {/* Account Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Account Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Login</dt>
                  <dd className="text-sm text-gray-900 font-mono">{user.login}</dd>
                </div>
                <Separator />
                <div>
                  <dt className="text-sm font-medium text-gray-500">Status</dt>
                  <dd className="text-sm">{getStatusBadge(user.status)}</dd>
                </div>
                <Separator />
                <div>
                  <dt className="text-sm font-medium text-gray-500">Created</dt>
                  <dd className="text-sm text-gray-900">
                    {user.created ? format(new Date(user.created), "MMMM d, yyyy 'at' h:mm a") : "Unknown"}
                  </dd>
                </div>
                <Separator />
                <div>
                  <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
                  <dd className="text-sm text-gray-900">
                    {user.lastUpdated ? format(new Date(user.lastUpdated), "MMMM d, yyyy 'at' h:mm a") : "Unknown"}
                  </dd>
                </div>
                <Separator />
                <div>
                  <dt className="text-sm font-medium text-gray-500">Last Login</dt>
                  <dd className="text-sm text-gray-900">
                    {user.lastLogin ? format(new Date(user.lastLogin), "MMMM d, yyyy 'at' h:mm a") : "Never"}
                  </dd>
                </div>
                <Separator />
                <div>
                  <dt className="text-sm font-medium text-gray-500">Password Changed</dt>
                  <dd className="text-sm text-gray-900">
                    {user.passwordChanged ? format(new Date(user.passwordChanged), "MMMM d, yyyy") : "Never"}
                  </dd>
                </div>
              </CardContent>
            </Card>

            {/* Group Memberships */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Group Memberships</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {user.groups && user.groups.length > 0 ? (
                    user.groups.map((group, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <span className="text-gray-400">👥</span>
                          <span className="text-sm font-medium">{group}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">No group memberships</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Application Access */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Application Access</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {user.applications && user.applications.length > 0 ? (
                    user.applications.map((app, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <span className="text-gray-400">📱</span>
                          <span className="text-sm font-medium">{app}</span>
                        </div>
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">No application access</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <ConfirmationModal
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        title={confirmAction?.title || ""}
        message={confirmAction?.message || ""}
        onConfirm={() => {
          confirmAction?.action();
          setConfirmAction(null);
        }}
        confirmText={confirmAction?.type === "delete" ? "Delete" : "Confirm"}
        variant={confirmAction?.type === "delete" ? "destructive" : "default"}
      />
    </div>
  );
}
