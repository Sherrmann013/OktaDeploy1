import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Check, ChevronsUpDown, Edit, X, Settings, RefreshCw, Mail, Lock, GripVertical, Link, Eye, EyeOff } from "lucide-react";
import { LogoUploadModal } from "@/components/LogoUploadModal";
import CreateUserModal from "@/components/create-user-modal";
import { AddDashboardCardModal } from "@/components/AddDashboardCardModal";
import { AddMonitoringCardModal } from "@/components/AddMonitoringCardModal";
import { useToast } from "@/hooks/use-toast";
import { CustomSelect, CustomSelectContent, CustomSelectItem, CustomSelectTrigger, CustomSelectValue } from "@/components/ui/custom-select";
import { NewUserConfigSection } from "@/components/admin/new-user-config";
import { LayoutSection } from "@/components/admin/layout";
import { SiteAccessSection } from "@/components/admin/site-access";
import { IntegrationsSection } from "@/components/admin/integrations";
import { AppsSection } from "@/components/admin/apps";
import { AuditLogsSection } from "@/components/admin/audit-logs";

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









import ProtectedRoute from "@/components/ProtectedRoute";

function AdminComponent() {
  const { toast } = useToast();
  const [location] = useLocation();
  
  // Detect current client context from URL - CLIENT-AWARE  
  const currentClientId = location.startsWith('/client/') ? parseInt(location.split('/')[2]) : 1;
  
  const [activeTab, setActiveTab] = useState("site-access");
  const [isNewUserOpen, setIsNewUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);

  const [isDeleteUserOpen, setIsDeleteUserOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<SiteUser | null>(null);
  const [layoutTab, setLayoutTab] = useState("new-user");
  const [isLogoUploadOpen, setIsLogoUploadOpen] = useState(false);
  const [isAddDashboardCardOpen, setIsAddDashboardCardOpen] = useState(false);
  const [isAddMonitoringCardOpen, setIsAddMonitoringCardOpen] = useState(false);
  // Removed department and employee type state - starting fresh

  // Apps state for new user creation form
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  
  // Add missing state variables
  const [fieldSettings, setFieldSettings] = useState<any>({
    firstName: { required: true },
    lastName: { required: true },
    emailUsername: { required: true, domains: ["@mazetx.com"] },
    password: { required: true, showGenerateButton: true, components: [{ type: "words", count: 1 }, { type: "numbers", count: 2 }, { type: "symbols", count: 1 }], targetLength: 10 },
    title: { required: false },
    manager: { required: false },
    department: { required: true, useList: false, options: [] },
    employeeType: { required: false, useList: true, options: [] }
  });


  const queryClient = useQueryClient();










  const [editingUser, setEditingUser] = useState<SiteUser | null>(null);


  const [newUser, setNewUser] = useState({
    name: "",
    username: "",
    accessLevel: ""
  });

  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  // State moved to NewUserConfigSection component

  // Query to fetch integrations data - CLIENT-AWARE
  const { data: integrationsData = [] } = useQuery({
    queryKey: [`/api/client/${currentClientId}/integrations`],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // App mappings data query already declared above - removed duplicate

  // Query to fetch email username settings
  const { data: emailUsernameSettings, refetch: refetchEmailSettings } = useQuery({
    queryKey: ["/api/layout-settings/emailUsername"],
    enabled: activeTab === "layout" && layoutTab === "new-user",
    refetchOnMount: true,
    refetchOnWindowFocus: false
  });

  // Query to fetch password settings
  const { data: passwordSettings } = useQuery({
    queryKey: ["/api/layout-settings/password"],
    enabled: activeTab === "layout" && layoutTab === "new-user",
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  // Queries to fetch individual field required settings
  const { data: firstNameSettings } = useQuery({
    queryKey: ["/api/layout-settings/firstName"],
    enabled: activeTab === "layout" && layoutTab === "new-user",
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  const { data: lastNameSettings } = useQuery({
    queryKey: ["/api/layout-settings/lastName"],
    enabled: activeTab === "layout" && layoutTab === "new-user",
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  const { data: titleSettings } = useQuery({
    queryKey: ["/api/layout-settings/title"],
    enabled: activeTab === "layout" && layoutTab === "new-user",
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  const { data: managerSettings } = useQuery({
    queryKey: ["/api/layout-settings/manager"],
    enabled: activeTab === "layout" && layoutTab === "new-user",
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  const { data: departmentSettings, refetch: refetchDepartmentSettings } = useQuery({
    queryKey: ["/api/layout-settings/department"],
    enabled: activeTab === "layout" && layoutTab === "new-user",
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  const { data: employeeTypeSettings, refetch: refetchEmployeeTypeSettings } = useQuery({
    queryKey: ["/api/layout-settings/employeeType"],
    enabled: activeTab === "layout" && layoutTab === "new-user",
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });



  // Refetch all settings when switching to New User tab
  useEffect(() => {
    if (activeTab === "layout" && layoutTab === "new-user") {
      
      
      refetchEmailSettings();
      refetchDepartmentSettings();

    }
  }, [activeTab, layoutTab, refetchEmailSettings, refetchDepartmentSettings]);

  // Update field settings when email username settings are loaded
  useEffect(() => {
    
    if (emailUsernameSettings && (emailUsernameSettings as any).settingValue) {
      try {
        const parsedSettings = JSON.parse((emailUsernameSettings as any).settingValue);
        
        if (parsedSettings.domains && Array.isArray(parsedSettings.domains)) {
          
          setFieldSettings((prev: any) => {
            
            const newSettings = {
              ...prev,
              emailUsername: {
                ...prev.emailUsername,
                domains: parsedSettings.domains
              }
            };
            
            return newSettings;
          });
        }
      } catch (error) {
      }
    } else {
      
    }
  }, [emailUsernameSettings]);

  // Removed department and employee type useEffect hooks - starting fresh

  // Update field settings when password settings are loaded
  useEffect(() => {
    
    if (passwordSettings && (passwordSettings as any).settingValue) {
      try {
        const parsedSettings = JSON.parse((passwordSettings as any).settingValue);
        
        if (parsedSettings.components && Array.isArray(parsedSettings.components)) {
          
          setFieldSettings((prev: any) => {
            
            const newSettings = {
              ...prev,
              password: {
                ...prev.password,
                ...parsedSettings
              }
            };
            
            return newSettings;
          });
        }
      } catch (error) {
      }
    } else {
      
    }
  }, [passwordSettings]);

  // Update field settings when individual field settings are loaded
  useEffect(() => {
    
    setFieldSettings((prev: any) => {
      const newSettings = { ...prev };
      
      // Update firstName required setting
      if (firstNameSettings && (firstNameSettings as any).settingValue) {
        try {
          const parsed = JSON.parse((firstNameSettings as any).settingValue);
          newSettings.firstName = { ...newSettings.firstName, ...parsed };
          
        } catch (error) {
        }
      }
      
      // Update lastName required setting
      if (lastNameSettings && (lastNameSettings as any).settingValue) {
        try {
          const parsed = JSON.parse((lastNameSettings as any).settingValue);
          newSettings.lastName = { ...newSettings.lastName, ...parsed };
          
        } catch (error) {
        }
      }
      
      // Update title required setting
      if (titleSettings && (titleSettings as any).settingValue) {
        try {
          const parsed = JSON.parse((titleSettings as any).settingValue);
          newSettings.title = { ...newSettings.title, ...parsed };
          
        } catch (error) {
        }
      }
      
      // Update manager required setting
      if (managerSettings && (managerSettings as any).settingValue) {
        try {
          const parsed = JSON.parse((managerSettings as any).settingValue);
          newSettings.manager = { ...newSettings.manager, ...parsed };
          
        } catch (error) {
        }
      }
      
      // Update department required setting
      if (departmentSettings && (departmentSettings as any).settingValue) {
        try {
          const parsed = JSON.parse((departmentSettings as any).settingValue);
          newSettings.department = { ...newSettings.department, ...parsed };
          
        } catch (error) {
        }
      }
      
      // Update employee type required setting and options
      if (employeeTypeSettings && (employeeTypeSettings as any).settingValue) {
        try {
          const parsed = JSON.parse((employeeTypeSettings as any).settingValue);
          newSettings.employeeType = { ...newSettings.employeeType, ...parsed };
          
        } catch (error) {
        }
      }
      
      return newSettings;
    });
  }, [firstNameSettings, lastNameSettings, titleSettings, managerSettings, departmentSettings, employeeTypeSettings]);







  // Fetch site access users from database - ONLY when Site Access tab is active
  const { data: siteUsers = [], isLoading } = useQuery<SiteUser[]>({
    queryKey: ["/api/site-access-users"],
    enabled: activeTab === "site-access", // Only load when tab is active
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false,
  });






  // Fetch app mappings data for LayoutSection
  const { data: appMappingsData = [] } = useQuery({
    queryKey: [`/api/client/${currentClientId}/app-mappings`],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });







  // Create site access user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: { name: string; email: string; accessLevel: "standard" | "admin"; initials: string; color: string }) => {
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
      queryClient.invalidateQueries({ queryKey: ["/api/site-access-users"] });
      setIsNewUserOpen(false);
      setNewUser({ name: "", username: "", accessLevel: "" });
    },
    onError: (error) => {
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
      setIsDeleteUserOpen(false);
      setUserToDelete(null);
    }
  });

  const confirmDeleteUser = () => {
    if (userToDelete) {
      deleteUserMutation.mutate(userToDelete.id);
    }
  };











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
    setUserToDelete(user);
    setIsDeleteUserOpen(true);
  };

  const handleAssignUser = async () => {
    
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
    
    
    try {
      await createUserMutation.mutateAsync(userData);
    } catch (error) {
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









  return (
    <div className="p-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="site-access">Site access</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="apps">Apps</TabsTrigger>
          <TabsTrigger value="layout">Layout</TabsTrigger>
          <TabsTrigger value="audit-logs">Audit Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="site-access" className="mt-6">
          <SiteAccessSection />
        </TabsContent>
        <TabsContent value="integrations" className="mt-6">
          <IntegrationsSection />
        </TabsContent>

        <TabsContent value="audit-logs" className="mt-6">
          <AuditLogsSection />
        </TabsContent>

        <TabsContent value="apps" className="mt-6">
          <AppsSection />
        </TabsContent>

        <TabsContent value="layout" className="mt-6">
          <LayoutSection
            layoutTab={layoutTab}
            setLayoutTab={setLayoutTab}
            isLogoUploadOpen={isLogoUploadOpen}
            setIsLogoUploadOpen={setIsLogoUploadOpen}
            selectedApps={selectedApps}
            setSelectedApps={setSelectedApps}
            appMappingsData={appMappingsData}
            integrationsData={integrationsData}
            setEditingIntegration={() => {}}
            setIsConfigureIntegrationOpen={() => {}}
            setIsAddDashboardCardOpen={setIsAddDashboardCardOpen}
            setIsAddMonitoringCardOpen={setIsAddMonitoringCardOpen}
          />
        </TabsContent>

      </Tabs>

      {/* Delete User Confirmation Dialog */}
      <Dialog open={isDeleteUserOpen} onOpenChange={setIsDeleteUserOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Remove Site Access</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to remove <strong>{userToDelete?.name}</strong> from site access? 
              This action cannot be undone and will immediately revoke their access to the admin dashboard.
            </p>
          </div>
          <div className="flex justify-end space-x-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setIsDeleteUserOpen(false);
                setUserToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button 
              variant="outline"
              onClick={confirmDeleteUser}
              disabled={deleteUserMutation.isPending}
              className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950"
            >
              {deleteUserMutation.isPending ? "Removing..." : "Remove Access"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>









      {/* Logo Upload Modal */}
      <LogoUploadModal 
        isOpen={isLogoUploadOpen} 
        onClose={() => setIsLogoUploadOpen(false)} 
      />

      {/* Add Dashboard Card Modal */}
      <AddDashboardCardModal
        isOpen={isAddDashboardCardOpen}
        onClose={() => setIsAddDashboardCardOpen(false)}
        integrationsData={integrationsData}
      />

      {/* Add Monitoring Card Modal */}
      <AddMonitoringCardModal
        isOpen={isAddMonitoringCardOpen}
        onClose={() => setIsAddMonitoringCardOpen(false)}
        integrationsData={integrationsData}
      />

      {/* Create User Modal */}
      <CreateUserModal 
        open={isCreateUserModalOpen}
        onClose={() => setIsCreateUserModalOpen(false)}
        onSuccess={() => {
          setIsCreateUserModalOpen(false);
          // Could add success notification here
        }}
      />
    </div>
  );
}

export default function Admin() {
  return (
    <ProtectedRoute requireAdmin={true}>
      <AdminComponent />
    </ProtectedRoute>
  );
}