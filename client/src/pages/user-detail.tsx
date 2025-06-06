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
import { ArrowLeft, ChevronDown, ChevronRight, Smartphone, Monitor, Shield, Eye, RefreshCw, KeyRound, Edit, Play, Pause, Trash2, Search } from "lucide-react";
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
  const [appSearchTerm, setAppSearchTerm] = useState("");

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

  // Query for user groups
  const { data: userGroups, isLoading: groupsLoading } = useQuery({
    queryKey: ["/api/users", userId, "groups"],
    queryFn: async () => {
      const response = await fetch(`/api/users/${userId}/groups`);
      if (!response.ok) throw new Error("Failed to fetch user groups");
      return response.json();
    },
    enabled: !!userId && activeTab === "groups",
  });

  // Query for user applications
  const { data: userApplications, isLoading: appsLoading } = useQuery({
    queryKey: ["/api/users", userId, "applications"],
    queryFn: async () => {
      const response = await fetch(`/api/users/${userId}/applications`);
      if (!response.ok) throw new Error("Failed to fetch user applications");
      return response.json();
    },
    enabled: !!userId && activeTab === "applications",
  });

  // Query for enhanced user logs (30-day timeframe)
  const { data: userLogs, isLoading: logsLoading } = useQuery({
    queryKey: ["/api/users", userId, "logs"],
    queryFn: async () => {
      const response = await fetch(`/api/users/${userId}/logs`);
      if (!response.ok) throw new Error("Failed to fetch user logs");
      return response.json();
    },
    enabled: !!userId && activeTab === "activity",
  });

  // Query for user devices
  const { data: userDevices, isLoading: devicesLoading } = useQuery({
    queryKey: ["/api/users", userId, "devices"],
    queryFn: async () => {
      const response = await fetch(`/api/users/${userId}/devices`);
      if (!response.ok) throw new Error("Failed to fetch user devices");
      return response.json();
    },
    enabled: !!userId && activeTab === "devices",
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
    const actionText = action === "reset" ? "reset password" : "expire password";
    setConfirmAction({
      type: action,
      title: `${actionText.charAt(0).toUpperCase() + actionText.slice(1)}`,
      message: `Are you sure you want to ${actionText} for this user?`,
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
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading user details...</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
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
    );
  }

  return (
    <>
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
            <div className="flex items-center gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                    <KeyRound className="w-4 h-4 mr-2" />
                    Reset or Remove password
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handlePasswordAction("reset")}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Reset Password
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handlePasswordAction("expire")}>
                    <KeyRound className="w-4 h-4 mr-2" />
                    Expire Password
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button variant="outline" className="text-gray-600 hover:text-gray-900">
                <Edit className="w-4 h-4 mr-2" />
                More
              </Button>

              {user.status === "ACTIVE" ? (
                <Button 
                  variant="outline" 
                  onClick={() => handleStatusChange("SUSPENDED")}
                  className="text-orange-600 hover:text-orange-700 border-orange-200 hover:border-orange-300"
                >
                  <Pause className="w-4 h-4 mr-2" />
                  Suspend
                </Button>
              ) : (
                <Button 
                  variant="outline"
                  onClick={() => handleStatusChange("ACTIVE")}
                  className="text-green-600 hover:text-green-700 border-green-200 hover:border-green-300"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Activate
                </Button>
              )}

              <Button 
                variant="outline"
                onClick={handleDeleteUser}
                className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>

          {/* Profile Info Row */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              <span className="text-sm text-gray-600">User</span>
              <Button variant="link" className="p-0 h-auto text-blue-600 hover:text-blue-700 text-sm">
                Change
              </Button>
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              {getStatusBadge(user.status)}
            </div>
            <div className="text-sm text-gray-600">
              Profile sourced by Active Directory
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="applications">Applications</TabsTrigger>
              <TabsTrigger value="groups">Groups</TabsTrigger>
              <TabsTrigger value="devices">Devices</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="profile">
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
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="applications">
              <Card>
                <CardHeader>
                  <CardTitle>Applications</CardTitle>
                </CardHeader>
                <CardContent>
                  {appsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                  ) : userApplications && userApplications.length > 0 ? (
                    <div className="space-y-4">
                      {/* Search Input */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <Input
                          placeholder="Search applications..."
                          value={appSearchTerm}
                          onChange={(e) => setAppSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      
                      {/* Applications Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {userApplications
                          .filter((app: any) => 
                            app.name.toLowerCase().includes(appSearchTerm.toLowerCase())
                          )
                          .sort((a: any, b: any) => a.name.localeCompare(b.name))
                          .map((app: any) => (
                            <div key={app.id} className="p-2 border border-gray-200 rounded text-center bg-gray-50 hover:bg-gray-100 transition-colors">
                              <h4 className="text-sm font-medium text-gray-900 truncate" title={app.name}>
                                {app.name}
                              </h4>
                            </div>
                          ))}
                      </div>
                      
                      {userApplications.filter((app: any) => 
                        app.name.toLowerCase().includes(appSearchTerm.toLowerCase())
                      ).length === 0 && appSearchTerm && (
                        <p className="text-gray-600 py-8 text-center">No applications found matching "{appSearchTerm}".</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-600 py-8 text-center">No applications assigned to this user.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="groups">
              <Card>
                <CardHeader>
                  <CardTitle>Groups</CardTitle>
                </CardHeader>
                <CardContent>
                  {groupsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                  ) : userGroups && userGroups.length > 0 ? (
                    <div className="space-y-3">
                      {userGroups
                        .filter((group: any) => 
                          group.type !== "BUILT_IN" && group.type !== "APP_GROUP"
                        )
                        .map((group: any) => (
                          <div key={group.id} className="p-3 border border-gray-200 rounded-lg">
                            <h4 className="font-medium text-gray-900">{group.profile?.name || group.name}</h4>
                            <p className="text-sm text-gray-600 mt-1">{group.profile?.description || "No description"}</p>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-gray-600 py-8 text-center">No groups assigned to this user.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="devices">
              <Card>
                <CardHeader>
                  <CardTitle>Devices</CardTitle>
                </CardHeader>
                <CardContent>
                  {devicesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                  ) : userDevices && userDevices.length > 0 ? (
                    <div className="space-y-3">
                      {userDevices.map((device: any, index: number) => {
                        const getDeviceIcon = (userAgent: string) => {
                          if (userAgent?.toLowerCase().includes('mobile') || userAgent?.toLowerCase().includes('iphone') || userAgent?.toLowerCase().includes('android')) {
                            return Smartphone;
                          }
                          return Monitor;
                        };

                        const Icon = getDeviceIcon(device.userAgent?.rawUserAgent);

                        return (
                          <div key={index} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                            <Icon className="w-5 h-5 text-gray-600" />
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900">
                                {device.deviceType || device.userAgent?.browser || 'Unknown Device'}
                              </h4>
                              <p className="text-sm text-gray-600">
                                {device.userAgent?.rawUserAgent || 'No user agent info'}
                              </p>
                              {device.lastSeen && (
                                <p className="text-xs text-gray-500 mt-1">
                                  Last seen: {format(new Date(device.lastSeen), "MMM d, yyyy 'at' h:mm a")}
                                </p>
                              )}
                            </div>
                            <Badge variant={device.status === "TRUSTED" ? "default" : "secondary"}>
                              {device.status || "Unknown"}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-gray-600 py-8 text-center">No devices found for this user.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="activity">
              <Card>
                <CardHeader>
                  <CardTitle>Activity Logs (Last 30 Days)</CardTitle>
                </CardHeader>
                <CardContent>
                  {logsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                  ) : userLogs && userLogs.length > 0 ? (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {userLogs.map((log: any) => {
                        const getEventIcon = (eventType: string) => {
                          if (eventType.includes("user.session")) return Shield;
                          if (eventType.includes("user.authentication")) return KeyRound;
                          if (eventType.includes("application")) return Monitor;
                          return Eye;
                        };

                        const getEventColor = (outcome: string) => {
                          if (outcome === "SUCCESS") return "green";
                          if (outcome === "FAILURE") return "red";
                          return "gray";
                        };

                        const Icon = getEventIcon(log.eventType);
                        const color = getEventColor(log.outcome);

                        return (
                          <Collapsible key={log.id}>
                            <div className={`border-l-4 border-${color}-500 bg-${color}-50`}>
                              <CollapsibleTrigger className="w-full p-3 hover:bg-gray-100 transition-colors">
                                <div className="flex items-start gap-3">
                                  <Icon className={`w-4 h-4 text-${color}-600 mt-0.5 flex-shrink-0`} />
                                  <div className="flex-1 min-w-0 text-left">
                                    <div className="flex items-center justify-between">
                                      <p className="text-sm font-medium">{log.displayMessage}</p>
                                      <ChevronRight className="w-4 h-4 text-gray-400 transition-transform group-data-[state=open]:rotate-90" />
                                    </div>
                                    <p className="text-xs text-gray-600 mt-1">
                                      {format(new Date(log.published), "MMM d, yyyy 'at' h:mm a")}
                                    </p>
                                    <div className="flex items-center gap-2 mt-2">
                                      <Badge variant={log.outcome === "SUCCESS" ? "default" : "destructive"} className="text-xs">
                                        {log.outcome}
                                      </Badge>
                                      <span className="text-xs text-gray-500">{log.eventType}</span>
                                    </div>
                                  </div>
                                </div>
                              </CollapsibleTrigger>
                              
                              <CollapsibleContent className="px-3 pb-3">
                                <div className="ml-7 space-y-2 text-xs">
                                  {log.client?.ipAddress && (
                                    <div>
                                      <span className="font-medium">IP Address:</span> {log.client.ipAddress}
                                    </div>
                                  )}
                                  
                                  {log.client?.geographicalContext && (
                                    <div>
                                      <span className="font-medium">Location:</span> 
                                      {log.client.geographicalContext.city && ` ${log.client.geographicalContext.city}`}
                                      {log.client.geographicalContext.state && `, ${log.client.geographicalContext.state}`}
                                      {log.client.geographicalContext.country && ` ${log.client.geographicalContext.country}`}
                                    </div>
                                  )}
                                  
                                  {log.client?.userAgent?.rawUserAgent && (
                                    <div>
                                      <span className="font-medium">User Agent:</span> {log.client.userAgent.rawUserAgent}
                                    </div>
                                  )}
                                  
                                  {log.actor?.displayName && (
                                    <div>
                                      <span className="font-medium">Actor:</span> {log.actor.displayName} ({log.actor.type})
                                    </div>
                                  )}
                                  
                                  {log.target && log.target.length > 0 && (
                                    <div>
                                      <span className="font-medium">Target:</span>
                                      <ul className="mt-1 ml-4">
                                        {log.target.map((target: any, index: number) => (
                                          <li key={index}>
                                            {target.displayName} ({target.type})
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  
                                  <div>
                                    <span className="font-medium">Event ID:</span> {log.id}
                                  </div>
                                </div>
                              </CollapsibleContent>
                            </div>
                          </Collapsible>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-gray-600 py-8 text-center">No activity logs found for the last 30 days.</p>
                  )}
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
    </>
  );
}