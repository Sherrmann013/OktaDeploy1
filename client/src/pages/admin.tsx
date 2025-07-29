import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface SiteUser {
  id: number;
  name: string;
  email: string;
  accessLevel: "standard" | "admin";
  initials: string;
  color: string;
  created?: Date;
  lastUpdated?: Date;
}

interface Integration {
  id: number;
  name: string;
  displayName: string;
  description: string;
  status: "connected" | "pending" | "disconnected";
  apiKeys: Record<string, string>;
  config: Record<string, any>;
  created: string;
  lastUpdated: string;
}

export default function Admin() {
  const [activeTab, setActiveTab] = useState("site-access");
  const [isNewUserOpen, setIsNewUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [isConfigureIntegrationOpen, setIsConfigureIntegrationOpen] = useState(false);
  const [isNewIntegrationOpen, setIsNewIntegrationOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SiteUser | null>(null);
  const [editingIntegration, setEditingIntegration] = useState<Integration | null>(null);
  const [newUser, setNewUser] = useState({
    name: "",
    username: "",
    accessLevel: ""
  });
  const [selectedIntegrationType, setSelectedIntegrationType] = useState("");

  const queryClient = useQueryClient();

  // Fetch site access users from database
  const { data: siteUsers = [], isLoading } = useQuery<SiteUser[]>({
    queryKey: ["/api/site-access-users"],
    refetchInterval: 5000
  });

  // Fetch integrations from database
  const { data: integrationsData = [], isLoading: integrationsLoading } = useQuery<Integration[]>({
    queryKey: ["/api/integrations"],
    refetchInterval: 30000
  });

  // Create site access user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: { name: string; email: string; accessLevel: "standard" | "admin"; initials: string; color: string }) => {
      console.log('🔄 Making API request to create user:', userData);
      const response = await fetch("/api/site-access-users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify(userData)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      console.log('✅ User created successfully, refreshing data');
      queryClient.invalidateQueries({ queryKey: ["/api/site-access-users"] });
      setIsNewUserOpen(false);
      setNewUser({ name: "", username: "", accessLevel: "" });
    },
    onError: (error) => {
      console.error('❌ Failed to create user:', error);
      alert(`Failed to create user: ${error.message || 'Unknown error'}`);
    }
  });

  // Update site access user mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({ id, userData }: { id: number; userData: { name: string; email: string; accessLevel: "standard" | "admin"; initials: string; color: string } }) => {
      const response = await fetch(`/api/site-access-users/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify(userData)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/site-access-users"] });
      setIsEditUserOpen(false);
      setEditingUser(null);
    }
  });

  // Delete site access user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/site-access-users/${id}`, {
        method: "DELETE",
        credentials: "include"
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response.status === 204 ? null : response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/site-access-users"] });
    }
  });

  // Update integration mutation
  const updateIntegrationMutation = useMutation({
    mutationFn: async ({ id, integrationData }: { id: number; integrationData: { name: string; displayName: string; description: string; status: "connected" | "pending" | "disconnected"; apiKeys: Record<string, string>; config: Record<string, any> } }) => {
      const response = await fetch(`/api/integrations/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify(integrationData)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      setIsConfigureIntegrationOpen(false);
      setEditingIntegration(null);
    }
  });

  const getRandomColor = () => {
    const colors = ["bg-blue-600", "bg-green-600", "bg-purple-600", "bg-orange-600", "bg-cyan-600", "bg-pink-600", "bg-indigo-600", "bg-teal-600"];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const handleEditUser = (user: SiteUser) => {
    setEditingUser(user);
    setIsEditUserOpen(true);
  };

  const handleDeleteUser = (user: SiteUser) => {
    if (confirm(`Are you sure you want to remove ${user.name} from site access?`)) {
      deleteUserMutation.mutate(user.id);
    }
  };

  const handleAssignUser = async () => {
    console.log('🔵 Assign User clicked');
    
    if (!newUser.name.trim()) {
      alert("Please enter a name");
      return;
    }
    if (!newUser.username.trim()) {
      alert("Please enter a username");
      return;
    }
    if (!newUser.accessLevel) {
      alert("Please select an access level");
      return;
    }
    
    const userData = {
      name: newUser.name.trim(),
      email: newUser.username.trim(),
      accessLevel: newUser.accessLevel as "standard" | "admin",
      initials: getInitials(newUser.name.trim()),
      color: getRandomColor()
    };
    
    console.log('🚀 Creating user:', userData);
    
    try {
      await createUserMutation.mutateAsync(userData);
      console.log('✅ User created successfully');
    } catch (error) {
      console.error('❌ Failed to create user:', error);
    }
  };

  const handleUpdateUser = () => {
    if (editingUser) {
      const userData = {
        name: editingUser.name,
        email: editingUser.email,
        accessLevel: editingUser.accessLevel,
        initials: editingUser.initials,
        color: editingUser.color
      };
      
      updateUserMutation.mutate({ id: editingUser.id, userData });
    }
  };

  const handleConfigureIntegration = (integration: Integration) => {
    setEditingIntegration(integration);
    setIsConfigureIntegrationOpen(true);
  };

  const handleUpdateIntegration = () => {
    if (editingIntegration) {
      const integrationData = {
        name: editingIntegration.name,
        displayName: editingIntegration.displayName,
        description: editingIntegration.description,
        status: editingIntegration.status,
        apiKeys: editingIntegration.apiKeys,
        config: editingIntegration.config
      };
      
      updateIntegrationMutation.mutate({ id: editingIntegration.id, integrationData });
    }
  };

  // Available integration types for the new integration modal
  const availableIntegrations = [
    { value: "okta", label: "OKTA" },
    { value: "knowbe4", label: "KnowBe4" },
    { value: "sentinelone", label: "SentinelOne" },
    { value: "addigy", label: "Addigy" },
    { value: "microsoft", label: "Microsoft" },
    { value: "jira", label: "Jira" },
    { value: "screenconnect", label: "ScreenConnect" },
    { value: "ninjaone", label: "Ninja One" },
    { value: "zendesk", label: "Zendesk" },
    { value: "meshai", label: "Mesh AI" },
    { value: "abnormal", label: "Abnormal Security" },
    { value: "arcticwolf", label: "Arctic Wolf" },
    { value: "msdefender", label: "Microsoft Defender" },
    { value: "hexnode", label: "Hexnode" }
  ];

  // Get integration logo component
  const getIntegrationLogo = (name: string) => {
    const logoClass = "w-6 h-6 flex-shrink-0";
    
    switch (name) {
      case 'okta':
        return (
          <div className={logoClass}>
            <svg viewBox="0 0 24 24" className="w-full h-full">
              <circle cx="12" cy="12" r="12" fill="#007DC1"/>
              <path d="M12 6c3.3 0 6 2.7 6 6s-2.7 6-6 6-6-2.7-6-6 2.7-6 6-6z" fill="white"/>
              <circle cx="12" cy="12" r="2" fill="#007DC1"/>
            </svg>
          </div>
        );
      case 'knowbe4':
        return (
          <div className={logoClass}>
            <svg viewBox="0 0 24 24" className="w-full h-full">
              <circle cx="12" cy="12" r="12" fill="#FF6B35"/>
              <text x="12" y="16" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">KB4</text>
            </svg>
          </div>
        );
      case 'sentinelone':
        return (
          <div className={logoClass}>
            <svg viewBox="0 0 24 24" className="w-full h-full">
              <rect width="24" height="24" rx="4" fill="#4A1A4A"/>
              <path d="M6 8l6 4 6-4v8l-6 4-6-4V8z" fill="#8B5FBF"/>
              <path d="M6 8l6-4 6 4-6 4-6-4z" fill="#A855F7"/>
            </svg>
          </div>
        );
      case 'addigy':
        return (
          <div className={logoClass}>
            <svg viewBox="0 0 24 24" className="w-full h-full">
              <rect width="24" height="24" rx="4" fill="#10B981"/>
              <path d="M8 6h8l-2 6h2l-4 6-4-6h2l-2-6z" fill="white"/>
            </svg>
          </div>
        );
      case 'microsoft':
        return (
          <div className={logoClass}>
            <svg viewBox="0 0 24 24" className="w-full h-full">
              <rect x="2" y="2" width="9" height="9" fill="#F35325"/>
              <rect x="13" y="2" width="9" height="9" fill="#81BC06"/>
              <rect x="2" y="13" width="9" height="9" fill="#05A6F0"/>
              <rect x="13" y="13" width="9" height="9" fill="#FFBA08"/>
            </svg>
          </div>
        );
      case 'jira':
        return (
          <div className={logoClass}>
            <svg viewBox="0 0 24 24" className="w-full h-full">
              <rect width="24" height="24" rx="4" fill="#0052CC"/>
              <path d="M12 3l-6 6 3 3 3-3 3 3 3-3-6-6z" fill="white"/>
              <path d="M12 9l-3 3 3 3 3-3-3-3z" fill="#2684FF"/>
            </svg>
          </div>
        );
      case 'screenconnect':
        return (
          <div className={logoClass}>
            <svg viewBox="0 0 24 24" className="w-full h-full">
              <rect width="24" height="24" rx="4" fill="#E53E3E"/>
              <rect x="4" y="6" width="16" height="10" rx="2" fill="white"/>
              <rect x="6" y="8" width="12" height="1" fill="#E53E3E"/>
              <circle cx="18" cy="10" r="1" fill="#E53E3E"/>
            </svg>
          </div>
        );
      case 'ninjaone':
        return (
          <div className={logoClass}>
            <svg viewBox="0 0 24 24" className="w-full h-full">
              <rect width="24" height="24" rx="4" fill="#1A202C"/>
              <path d="M6 12l3-6 3 6-3 6-3-6z" fill="#4299E1"/>
              <path d="M15 12l3-6 3 6-3 6-3-6z" fill="#63B3ED"/>
            </svg>
          </div>
        );
      case 'zendesk':
        return (
          <div className={logoClass}>
            <svg viewBox="0 0 24 24" className="w-full h-full">
              <rect width="24" height="24" rx="4" fill="#03363D"/>
              <path d="M6 6h6v6L6 18V6z" fill="#17494D"/>
              <path d="M12 6h6v12l-6-6V6z" fill="#78A300"/>
            </svg>
          </div>
        );
      case 'meshai':
        return (
          <div className={logoClass}>
            <svg viewBox="0 0 24 24" className="w-full h-full">
              <rect width="24" height="24" rx="12" fill="#06B6D4"/>
              <path d="M8 8h8v2h-8V8zM8 11h6v2h-6v-2zM8 14h8v2h-8v-2z" fill="white"/>
              <circle cx="17" cy="9" r="2" fill="#0891B2"/>
            </svg>
          </div>
        );
      case 'abnormal':
        return (
          <div className={logoClass}>
            <svg viewBox="0 0 24 24" className="w-full h-full">
              <rect width="24" height="24" rx="4" fill="#DC2626"/>
              <path d="M12 3l9 18H3L12 3z" fill="white"/>
              <path d="M12 8v6M12 16h.01" stroke="#DC2626" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
        );
      case 'arcticwolf':
        return (
          <div className={logoClass}>
            <svg viewBox="0 0 24 24" className="w-full h-full">
              <rect width="24" height="24" rx="4" fill="#4338CA"/>
              <path d="M12 4l6 8-2 8h-8l-2-8 6-8z" fill="#A5B4FC"/>
              <circle cx="10" cy="10" r="1" fill="#4338CA"/>
              <circle cx="14" cy="10" r="1" fill="#4338CA"/>
            </svg>
          </div>
        );
      case 'msdefender':
        return (
          <div className={logoClass}>
            <svg viewBox="0 0 24 24" className="w-full h-full">
              <rect width="24" height="24" rx="4" fill="#1E3A8A"/>
              <path d="M12 3l8 5v6c0 5.5-8 7-8 7s-8-1.5-8-7V8l8-5z" fill="#3B82F6"/>
              <path d="M8 10l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        );
      case 'hexnode':
        return (
          <div className={logoClass}>
            <svg viewBox="0 0 24 24" className="w-full h-full">
              <rect width="24" height="24" rx="4" fill="#EA580C"/>
              <path d="M12 4l6 4v8l-6 4-6-4V8l6-4z" fill="white"/>
              <path d="M12 7l4 3v6l-4 3-4-3v-6l4-3z" fill="#EA580C"/>
            </svg>
          </div>
        );
      default:
        return (
          <div className={logoClass}>
            <svg viewBox="0 0 24 24" className="w-full h-full">
              <rect width="24" height="24" rx="4" fill="#6B7280"/>
              <text x="12" y="16" textAnchor="middle" fill="white" fontSize="10">?</text>
            </svg>
          </div>
        );
    }
  };

  const renderApiKeyFields = (integration: Integration | null) => {
    if (!integration) return null;

    switch (integration.name) {
      case 'okta':
        return (
          <>
            <div className="grid gap-2">
              <Label htmlFor="readOnly">Read Only API Key</Label>
              <Input
                id="readOnly"
                type="password"
                value={integration.apiKeys.readOnly || ""}
                onChange={(e) => setEditingIntegration(prev => prev ? { 
                  ...prev, 
                  apiKeys: { ...prev.apiKeys, readOnly: e.target.value }
                } : null)}
                placeholder="Enter Read Only API key"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="userManagement">User Management API Key</Label>
              <Input
                id="userManagement"
                type="password"
                value={integration.apiKeys.userManagement || ""}
                onChange={(e) => setEditingIntegration(prev => prev ? { 
                  ...prev, 
                  apiKeys: { ...prev.apiKeys, userManagement: e.target.value }
                } : null)}
                placeholder="Enter User Management API key"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="groupAndAppsManagement">Group and Apps Management API Key</Label>
              <Input
                id="groupAndAppsManagement"
                type="password"
                value={integration.apiKeys.groupAndAppsManagement || ""}
                onChange={(e) => setEditingIntegration(prev => prev ? { 
                  ...prev, 
                  apiKeys: { ...prev.apiKeys, groupAndAppsManagement: e.target.value }
                } : null)}
                placeholder="Enter Group and Apps Management API key"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="superAdmin">Super Admin API Key</Label>
              <Input
                id="superAdmin"
                type="password"
                value={integration.apiKeys.superAdmin || ""}
                onChange={(e) => setEditingIntegration(prev => prev ? { 
                  ...prev, 
                  apiKeys: { ...prev.apiKeys, superAdmin: e.target.value }
                } : null)}
                placeholder="Enter Super Admin API key"
              />
            </div>
          </>
        );
      case 'sentinelone':
        return (
          <>
            <div className="grid gap-2">
              <Label htmlFor="readOnlyApiKey">Read Only API Key</Label>
              <Input
                id="readOnlyApiKey"
                type="password"
                value={integration.apiKeys.readOnlyApiKey || ""}
                onChange={(e) => setEditingIntegration(prev => prev ? { 
                  ...prev, 
                  apiKeys: { ...prev.apiKeys, readOnlyApiKey: e.target.value }
                } : null)}
                placeholder="Enter Read Only API key"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="fullAccessApiKey">Full Access API Key</Label>
              <Input
                id="fullAccessApiKey"
                type="password"
                value={integration.apiKeys.fullAccessApiKey || ""}
                onChange={(e) => setEditingIntegration(prev => prev ? { 
                  ...prev, 
                  apiKeys: { ...prev.apiKeys, fullAccessApiKey: e.target.value }
                } : null)}
                placeholder="Enter Full Access API key"
              />
            </div>
          </>
        );
      case 'microsoft':
        return (
          <>
            <div className="grid gap-2">
              <Label htmlFor="tenantId">Tenant ID</Label>
              <Input
                id="tenantId"
                type="text"
                value={integration.apiKeys.tenantId || ""}
                onChange={(e) => setEditingIntegration(prev => prev ? { 
                  ...prev, 
                  apiKeys: { ...prev.apiKeys, tenantId: e.target.value }
                } : null)}
                placeholder="Enter Azure AD Tenant ID"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="clientId">Client ID</Label>
              <Input
                id="clientId"
                type="text"
                value={integration.apiKeys.clientId || ""}
                onChange={(e) => setEditingIntegration(prev => prev ? { 
                  ...prev, 
                  apiKeys: { ...prev.apiKeys, clientId: e.target.value }
                } : null)}
                placeholder="Enter Application (Client) ID"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="clientSecret">Client Secret</Label>
              <Input
                id="clientSecret"
                type="password"
                value={integration.apiKeys.clientSecret || ""}
                onChange={(e) => setEditingIntegration(prev => prev ? { 
                  ...prev, 
                  apiKeys: { ...prev.apiKeys, clientSecret: e.target.value }
                } : null)}
                placeholder="Enter Client Secret"
              />
            </div>
          </>
        );
      default:
        return (
          <div className="grid gap-2">
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              id="apiKey"
              type="password"
              value={integration.apiKeys.apiKey || ""}
              onChange={(e) => setEditingIntegration(prev => prev ? { 
                ...prev, 
                apiKeys: { ...prev.apiKeys, apiKey: e.target.value }
              } : null)}
              placeholder="Enter API key"
            />
          </div>
        );
    }
  };

  return (
    <div className="p-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="site-access">Site access</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="layout">Layout</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="site-access" className="mt-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-between items-center mb-6">
                {isLoading ? (
                  <div className="text-gray-500">Loading users...</div>
                ) : null}
                <Dialog open={isNewUserOpen} onOpenChange={setIsNewUserOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      New User
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Assign New User</DialogTitle>
                      <DialogDescription className="sr-only">
                        Assign a new user to the site access list
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="name">Name</Label>
                        <Input
                          id="name"
                          value={newUser.name}
                          onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                          placeholder="Enter full name"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="username">Username</Label>
                        <Input
                          id="username"
                          value={newUser.username}
                          onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                          placeholder="Enter username"
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="accessLevel">Access Level</Label>
                        <Select value={newUser.accessLevel} onValueChange={(value) => setNewUser({ ...newUser, accessLevel: value })}>
                          <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                            <SelectValue placeholder="Select access level" />
                          </SelectTrigger>
                          <SelectContent className="z-50 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                            <SelectItem value="standard" className="focus:bg-gray-100 dark:focus:bg-gray-700">Standard</SelectItem>
                            <SelectItem value="admin" className="focus:bg-gray-100 dark:focus:bg-gray-700">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                      <Button 
                        variant="outline" 
                        onClick={() => setIsNewUserOpen(false)}
                        className="px-4 py-2"
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          handleAssignUser();
                        }}
                        disabled={createUserMutation.isPending}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                      >
                        {createUserMutation.isPending ? "Assigning..." : "Assign User"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Edit User Dialog */}
                <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Edit User Access</DialogTitle>
                      <DialogDescription className="sr-only">
                        Edit user access level and information
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="editName">Name</Label>
                        <Input
                          id="editName"
                          value={editingUser?.name || ""}
                          onChange={(e) => setEditingUser(prev => prev ? { ...prev, name: e.target.value } : null)}
                          placeholder="Enter full name"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="editEmail">Email</Label>
                        <Input
                          id="editEmail"
                          value={editingUser?.email || ""}
                          onChange={(e) => setEditingUser(prev => prev ? { ...prev, email: e.target.value } : null)}
                          placeholder="Enter email"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="editAccessLevel">Access Level</Label>
                        <Select value={editingUser?.accessLevel || ""} onValueChange={(value) => setEditingUser(prev => prev ? { ...prev, accessLevel: value as "standard" | "admin" } : null)}>
                          <SelectTrigger className="bg-gray-800 border-gray-600">
                            <SelectValue placeholder="Select access level" />
                          </SelectTrigger>
                          <SelectContent className="z-50 bg-gray-800 border-gray-600">
                            <SelectItem value="standard" className="focus:bg-gray-700">Standard</SelectItem>
                            <SelectItem value="admin" className="focus:bg-gray-700">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setIsEditUserOpen(false)}>
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleUpdateUser}
                        disabled={updateUserMutation.isPending}
                      >
                        {updateUserMutation.isPending ? "Updating..." : "Update User"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <div></div>
              </div>
              
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Access Level</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {siteUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          <span>{user.name}</span>
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                            user.accessLevel === "admin" 
                              ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200" 
                              : "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                          }`}>
                            {user.accessLevel === "admin" ? "Admin" : "Standard"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleEditUser(user)}
                              className="h-8 w-8 p-0"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleDeleteUser(user)}
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="mt-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Integrations</h2>
                <Button onClick={() => setIsNewIntegrationOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  New Integration
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {integrationsLoading ? (
                  <div className="col-span-full text-center py-8">
                    <div className="text-muted-foreground">Loading integrations...</div>
                  </div>
                ) : (
                  integrationsData.map((integration) => (
                    <Card key={integration.id} className="bg-slate-100 dark:bg-slate-800 border-0">
                      <CardContent className="p-4 bg-gray-50 dark:bg-gray-700 rounded-md">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            {getIntegrationLogo(integration.name)}
                            <h3 className="font-semibold text-lg">{integration.displayName}</h3>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            integration.status === "connected" 
                              ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200" 
                              : integration.status === "pending"
                              ? "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200"
                              : "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200"
                          }`}>
                            {integration.status === "connected" ? "Connected" : 
                             integration.status === "pending" ? "Pending" : "Disconnected"}
                          </span>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full"
                          onClick={() => handleConfigureIntegration(integration)}
                        >
                          Configure
                        </Button>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="layout" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Layout Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Customize dashboard layout, themes, and UI preferences.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Change Log</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Track changes made to the site and its integrations.
                </p>
                <div className="space-y-3">
                  <div className="border-l-2 border-blue-500 pl-4 py-2">
                    <p className="text-sm font-medium">OKTA Integration Updated</p>
                    <p className="text-xs text-muted-foreground">July 29, 2025 - 2:15 AM</p>
                  </div>
                  <div className="border-l-2 border-green-500 pl-4 py-2">
                    <p className="text-sm font-medium">KnowBe4 API Configuration</p>
                    <p className="text-xs text-muted-foreground">July 29, 2025 - 2:03 AM</p>
                  </div>
                  <div className="border-l-2 border-orange-500 pl-4 py-2">
                    <p className="text-sm font-medium">Dashboard Layout Modified</p>
                    <p className="text-xs text-muted-foreground">July 29, 2025 - 2:00 AM</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Action Logs</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Monitor user actions within the site.
                </p>
                <div className="space-y-3">
                  <div className="border-l-2 border-purple-500 pl-4 py-2">
                    <p className="text-sm font-medium">Admin Login - CW-Admin</p>
                    <p className="text-xs text-muted-foreground">July 29, 2025 - 2:14 AM</p>
                  </div>
                  <div className="border-l-2 border-yellow-500 pl-4 py-2">
                    <p className="text-sm font-medium">User Profile Accessed - Ashley Lewis</p>
                    <p className="text-xs text-muted-foreground">July 29, 2025 - 2:05 AM</p>
                  </div>
                  <div className="border-l-2 border-red-500 pl-4 py-2">
                    <p className="text-sm font-medium">Password Reset Attempt</p>
                    <p className="text-xs text-muted-foreground">July 29, 2025 - 1:58 AM</p>
                  </div>
                  <div className="border-l-2 border-cyan-500 pl-4 py-2">
                    <p className="text-sm font-medium">Application Assignment - Christopher Walker</p>
                    <p className="text-xs text-muted-foreground">July 29, 2025 - 1:55 AM</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Configure Integration Dialog */}
      <Dialog open={isConfigureIntegrationOpen} onOpenChange={setIsConfigureIntegrationOpen}>
        <DialogContent className="sm:max-w-[425px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configure {editingIntegration?.displayName}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {renderApiKeyFields(editingIntegration)}
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsConfigureIntegrationOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateIntegration}
              disabled={updateIntegrationMutation.isPending}
            >
              {updateIntegrationMutation.isPending ? "Saving..." : "Save Configuration"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Integration Dialog */}
      <Dialog open={isNewIntegrationOpen} onOpenChange={setIsNewIntegrationOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Integration</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="integrationType">Select Integration Type</Label>
              <Select
                value={selectedIntegrationType}
                onValueChange={setSelectedIntegrationType}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose an integration..." />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                  {availableIntegrations.map((integration) => (
                    <SelectItem 
                      key={integration.value} 
                      value={integration.value}
                      className="hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        {getIntegrationLogo(integration.value)}
                        <span className="font-medium">{integration.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {selectedIntegrationType && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  {getIntegrationLogo(selectedIntegrationType)}
                  <h4 className="font-medium">
                    {availableIntegrations.find(i => i.value === selectedIntegrationType)?.label}
                  </h4>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => {
              setIsNewIntegrationOpen(false);
              setSelectedIntegrationType("");
            }}>
              Cancel
            </Button>
            <Button 
              disabled={!selectedIntegrationType}
              onClick={() => {
                // Handle integration creation
                console.log("Creating integration:", selectedIntegrationType);
                setIsNewIntegrationOpen(false);
                setSelectedIntegrationType("");
              }}
            >
              Add Integration
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}