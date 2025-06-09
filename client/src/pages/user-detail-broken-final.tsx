import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ArrowLeft, ChevronDown, ChevronRight, ChevronUp, Smartphone, Monitor, Shield, Eye, RefreshCw, KeyRound, Edit, Play, Pause, Trash2, Search, UserX, Save, X, Download, Copy, UserCheck, Plus, Key, CheckCircle, BookOpen } from "lucide-react";
import { DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import ConfirmationModal from "@/components/confirmation-modal";
import AssignAppModal from "@/components/assign-app-modal";
import KnowBe4UserDisplay from "@/components/knowbe4-user-display";
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

// KnowBe4 Cards Components
function KnowBe4PhishingCard({ userEmail }: { userEmail: string }) {
  const { data: connectionTest } = useQuery<{success: boolean; message: string; details: any}>({
    queryKey: ['/api/knowbe4/test-connection'],
    staleTime: 5 * 60 * 1000,
  });

  const { data: knowbe4User } = useQuery({
    queryKey: [`/api/knowbe4/user/${userEmail}`],
    enabled: !!userEmail && !!connectionTest?.success,
  });

  if (!connectionTest?.success || !knowbe4User) {
    return (
      <div className="text-center text-gray-500">
        <p className="text-sm">No phishing data available</p>
      </div>
    );
  }

  const phishingStats = knowbe4User?.phishing_campaign_stats || [];
  const emailsClicked = phishingStats.filter((p: any) => p.last_clicked_date && p.last_clicked_date !== null).length;
  const emailsReported = phishingStats.filter((p: any) => p.last_reported_date && p.last_reported_date !== null).length;
  const totalPhishingCampaigns = phishingStats.length;

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-1">{knowbe4User.phish_prone_percentage}%</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Phish-prone Percentage</div>
        </div>
        
        <div className="text-right space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Emails Delivered</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">{totalPhishingCampaigns}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Failures</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">{emailsClicked}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Emails Reported</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">{emailsReported}</span>
          </div>
        </div>
      </div>
      
      <div className="text-sm">
        <span className="font-medium">Last Sign In: </span>
        <span className="text-gray-600 dark:text-gray-300">
          {formatDate(knowbe4User.last_sign_in)}
        </span>
      </div>
    </div>
  );
}

function KnowBe4TrainingCard({ userEmail }: { userEmail: string }) {
  const { data: connectionTest } = useQuery<{success: boolean; message: string; details: any}>({
    queryKey: ['/api/knowbe4/test-connection'],
    staleTime: 5 * 60 * 1000,
  });

  const { data: knowbe4User } = useQuery({
    queryKey: [`/api/knowbe4/user/${userEmail}`],
    enabled: !!userEmail && !!connectionTest?.success,
  });

  const { data: userTrainingStats = [] } = useQuery({
    queryKey: [`/api/knowbe4/user/${knowbe4User?.id}/training`],
    enabled: !!knowbe4User?.id,
  });

  if (!connectionTest?.success || !knowbe4User) {
    return (
      <div className="text-center text-gray-500">
        <p className="text-sm">No training data available</p>
      </div>
    );
  }

  const finalTrainingData = userTrainingStats || [];
  
  const completed = finalTrainingData.filter((enrollment: any) => 
    enrollment.status === 'Completed' || enrollment.status === 'completed' || 
    enrollment.status === 'Passed' || enrollment.status === 'passed'
  ).length;
  
  const inProgress = finalTrainingData.filter((enrollment: any) => 
    enrollment.status === 'In Progress' || enrollment.status === 'in_progress' || 
    enrollment.status === 'Active' || enrollment.status === 'active'
  ).length;
  
  const notStarted = finalTrainingData.filter((enrollment: any) => 
    enrollment.status === 'Not Started' || enrollment.status === 'not_started' ||
    !enrollment.completion_date
  ).length;
  
  const total = finalTrainingData.length;
  const completionPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  if (finalTrainingData.length === 0) {
    return (
      <div className="text-center text-gray-500">
        <p className="text-sm">No training data available</p>
        <p className="text-xs mt-1">User not enrolled in any training campaigns</p>
      </div>
    );
  }

  return (
    <div className="flex justify-between items-start">
      <div className="flex-1">
        <div className="text-4xl font-bold text-green-600 dark:text-green-400 mb-1">{completionPercentage}%</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">Completion Rate</div>
      </div>
      
      <div className="text-right space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Total Enrollments</span>
          <span className="font-medium text-gray-900 dark:text-gray-100">{total}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Completed</span>
          <span className="font-medium text-green-600 dark:text-green-400">{completed}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">In Progress</span>
          <span className="font-medium text-yellow-600 dark:text-yellow-400">{inProgress}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Not Started</span>
          <span className="font-medium text-gray-600 dark:text-gray-400">{notStarted}</span>
        </div>
      </div>
    </div>
  );
}

export default function UserDetail() {
  const [, params] = useRoute("/users/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [isEditing, setIsEditing] = useState(false);
  const [managerSearch, setManagerSearch] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [actionType, setActionType] = useState<'suspend' | 'delete' | 'activate' | 'deactivate' | 'resetPassword' | 'expirePassword' | null>(null);
  const [showAssignAppModal, setShowAssignAppModal] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedApps, setExpandedApps] = useState<Set<string>>(new Set());

  const form = useForm({
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
      employeeType: "" as const,
    },
  });

  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: [`/api/users/${params?.id}`],
    enabled: !!params?.id,
  });

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  const availableManagers = useMemo(() => {
    if (!managerSearch.trim()) return [];
    
    return allUsers
      .filter((u: User) => {
        const searchTerm = managerSearch.toLowerCase();
        const fullName = `${u.firstName} ${u.lastName}`.toLowerCase();
        const email = u.email?.toLowerCase() || '';
        return fullName.includes(searchTerm) || email.includes(searchTerm);
      })
      .sort((a: User, b: User) => {
        const aName = `${a.firstName} ${a.lastName}`;
        const bName = `${b.firstName} ${b.lastName}`;
        return aName.localeCompare(bName);
      })
      .slice(0, 10);
  }, [allUsers, managerSearch]);

  useEffect(() => {
    if (user) {
      form.reset({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        login: user.login || "",
        title: user.title || "",
        department: user.department || "",
        mobilePhone: user.mobilePhone || "",
        manager: user.manager || "",
        employeeType: (user.employeeType as any) || "",
      });
    }
  }, [user, form]);

  const editUserMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest(`/api/users/${params?.id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/users/${params?.id}`] });
      toast({ title: "User updated successfully" });
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-lg">Loading user details...</div>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-2">User Not Found</h2>
            <p className="text-gray-600 mb-4">The user you're looking for doesn't exist or has been removed.</p>
            <Button onClick={() => setLocation("/users")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Users
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const onSubmit = (data: any) => {
    editUserMutation.mutate(data);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/users")}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Users</span>
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {user.firstName} {user.lastName}
            </h1>
            <p className="text-muted-foreground">{user.email}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Badge variant={user.status === "ACTIVE" ? "default" : "secondary"}>
            {user.status}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
            className="flex items-center space-x-2"
          >
            <Edit className="w-4 h-4" />
            <span>{isEditing ? "Cancel" : "Edit Profile"}</span>
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
          <TabsTrigger value="applications">Applications</TabsTrigger>
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="activity">Recent Activity</TabsTrigger>
          <TabsTrigger value="microsoft">Microsoft</TabsTrigger>
        </TabsList>

        <TabsContent value="monitoring" className="space-y-6 mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* KnowBe4 Phishing Results */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-600" />
                  KnowBe4 Phishing
                </CardTitle>
              </CardHeader>
              <CardContent>
                <KnowBe4PhishingCard userEmail={user?.email} />
              </CardContent>
            </Card>

            {/* KnowBe4 Security Training */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-green-600" />
                  KnowBe4 Training
                </CardTitle>
              </CardHeader>
              <CardContent>
                <KnowBe4TrainingCard userEmail={user?.email} />
              </CardContent>
            </Card>

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
                      console.log('Fetching SentinelOne data...');
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
                      console.log('Initiating SentinelOne scan...');
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
                      <label className="text-xs font-medium text-muted-foreground">Enrollment</label>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-green-600 text-white text-xs">Enrolled</Badge>
                      </div>
                    </div>
                  </div>
                  
                  {/* Intune Column */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm text-blue-600 border-b pb-1">Intune</h4>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Status</label>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-green-600 text-white text-xs">Enrolled</Badge>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Enrollment</label>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-green-600 text-white text-xs">Enrolled</Badge>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2 pt-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => {
                      console.log('Refreshing device data...');
                    }}
                  >
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Refresh
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="profile" className="space-y-6 mt-0">
          {isEditing ? (
            <Card>
              <CardHeader>
                <CardTitle>Edit User Profile</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                    <div className="grid grid-cols-2 gap-4">
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
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Title</FormLabel>
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
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsEditing(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={editUserMutation.isPending}>
                        {editUserMutation.isPending ? "Saving..." : "Save Changes"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Full Name</label>
                    <p className="text-foreground">{user.firstName} {user.lastName}</p>
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
                    <label className="text-sm font-medium text-muted-foreground">Title</label>
                    <p className="text-foreground">{user.title || "Not specified"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Department</label>
                    <p className="text-foreground">{user.department || "Not specified"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Mobile Phone</label>
                    <p className="text-foreground">{user.mobilePhone || "Not specified"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Manager</label>
                    <p className="text-foreground">{user.manager || "Not specified"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Employee Type</label>
                    <p className="text-foreground">{user.employeeType || "Not specified"}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Account Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Status</label>
                    <div className="flex items-center gap-2">
                      <Badge variant={user.status === "ACTIVE" ? "default" : "secondary"}>
                        {user.status}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Created</label>
                    <p className="text-foreground">
                      {user.created ? format(new Date(user.created), "PPpp") : "Unknown"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Last Updated</label>
                    <p className="text-foreground">
                      {user.lastUpdated ? format(new Date(user.lastUpdated), "PPpp") : "Unknown"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Last Login</label>
                    <p className="text-foreground">
                      {user.lastLogin ? format(new Date(user.lastLogin), "PPpp") : "Never"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Password Changed</label>
                    <p className="text-foreground">
                      {user.passwordChanged ? format(new Date(user.passwordChanged), "PPpp") : "Never"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="applications" className="space-y-4 mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Applications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center text-gray-500 py-8">
                <p className="text-sm">Application data not available</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="devices" className="space-y-4 mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Registered Devices</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center text-gray-500 py-8">
                <p className="text-sm">Device data not available</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4 mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center text-gray-500 py-8">
                <p className="text-sm">Activity data not available</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="microsoft" className="space-y-4 mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Microsoft Integration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center text-gray-500 py-8">
                <p className="text-sm">Microsoft data not available</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}