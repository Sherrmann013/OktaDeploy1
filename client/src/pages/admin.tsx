import React, { useState, useEffect, Suspense, lazy } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { useToast } from "@/hooks/use-toast";
import { CustomSelect, CustomSelectContent, CustomSelectItem, CustomSelectTrigger, CustomSelectValue } from "@/components/ui/custom-select";

// Lazy load heavy components to reduce initial bundle size
const CreateUserModal = lazy(() => import("@/components/create-user-modal"));
const NewUserConfigSection = lazy(() => import("@/components/admin/new-user-config").then(module => ({ default: module.NewUserConfigSection })));

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



interface AuditLog {
  id: number;
  userId: number | null;
  userEmail: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  resourceName: string | null;
  details: Record<string, any>;
  oldValues: Record<string, any>;
  newValues: Record<string, any>;
  ipAddress: string | null;
  userAgent: string | null;
  timestamp: string;
}

interface AppMapping {
  id: number;
  appName: string;
  oktaGroupName: string;
  description: string | null;
  status: "active" | "inactive";
  created: string;
  lastUpdated: string;
}

import ProtectedRoute from "@/components/ProtectedRoute";

function AdminComponent() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("site-access");
  const [isNewUserOpen, setIsNewUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [isConfigureIntegrationOpen, setIsConfigureIntegrationOpen] = useState(false);
  const [isNewIntegrationOpen, setIsNewIntegrationOpen] = useState(false);
  const [isDeleteIntegrationOpen, setIsDeleteIntegrationOpen] = useState(false);
  const [isDeleteUserOpen, setIsDeleteUserOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<SiteUser | null>(null);
  const [isLogoUploadOpen, setIsLogoUploadOpen] = useState(false);
  const [layoutTab, setLayoutTab] = useState("logo");
  const [isAddDashboardCardOpen, setIsAddDashboardCardOpen] = useState(false);
  const [isAddMonitoringCardOpen, setIsAddMonitoringCardOpen] = useState(false);
  const [draggedItem, setDraggedItem] = useState<number | null>(null);
  const [dragOverItem, setDragOverItem] = useState<number | null>(null);
  const [draggedMonitoringItem, setDraggedMonitoringItem] = useState<number | null>(null);
  const [dragOverMonitoringItem, setDragOverMonitoringItem] = useState<number | null>(null);
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







  // Fetch dashboard cards - ONLY when Layout > Dashboard tab is active
  const { data: dashboardCardsData, refetch: refetchDashboardCards, error: dashboardCardsError, isLoading: dashboardCardsLoading } = useQuery({
    queryKey: ["/api/dashboard-cards"],
    enabled: activeTab === "layout" && layoutTab === "dashboard", // Only load when dashboard tab is active
    staleTime: 10 * 60 * 1000, // 10 minutes - rarely changes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // Fetch monitoring cards - ONLY when Layout > Monitoring tab is active
  const { data: monitoringCardsData, refetch: refetchMonitoringCards, error: monitoringCardsError, isLoading: monitoringCardsLoading } = useQuery({
    queryKey: ["/api/monitoring-cards"],
    enabled: activeTab === "layout" && layoutTab === "monitoring", // Only load when monitoring tab is active
    staleTime: 10 * 60 * 1000, // 10 minutes - rarely changes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // Initialize with empty arrays - only use database data
  const [dashboardCards, setDashboardCards] = useState<any[]>([]);
  const [monitoringCards, setMonitoringCards] = useState<any[]>([]);

  // Update local state when data changes - ALWAYS use database data
  useEffect(() => {
    if (dashboardCardsData) {
      console.log('🔄 Dashboard cards data received:', dashboardCardsData);
      setDashboardCards(dashboardCardsData as any[]);
    }
  }, [dashboardCardsData]);

  useEffect(() => {
    if (monitoringCardsData) {
      console.log('🔄 Monitoring cards data received:', monitoringCardsData);
      setMonitoringCards(monitoringCardsData as any[]);
    }
  }, [monitoringCardsData]);

  // Debug authentication issues
  useEffect(() => {
    if (dashboardCardsError) {
      console.error('Dashboard cards fetch error:', dashboardCardsError);
      // Try to refetch after a short delay if authentication failed
      if (dashboardCardsError.message?.includes('Unauthorized')) {
        setTimeout(() => {
          console.log('Retrying dashboard cards fetch...');
          refetchDashboardCards();
        }, 2000);
      }
    }
  }, [dashboardCardsError, refetchDashboardCards]);

  useEffect(() => {
    if (monitoringCardsError) {
      console.error('Monitoring cards fetch error:', monitoringCardsError);
      // Try to refetch after a short delay if authentication failed
      if (monitoringCardsError.message?.includes('Unauthorized')) {
        setTimeout(() => {
          console.log('Retrying monitoring cards fetch...');
          refetchMonitoringCards();
        }, 2000);
      }
    }
  }, [monitoringCardsError, refetchMonitoringCards]);

  // Trigger fetch when dashboard tab is selected
  useEffect(() => {
    if (layoutTab === "dashboard") {
      console.log('Dashboard tab selected, fetching cards...');
      refetchDashboardCards();
    }
  }, [layoutTab, refetchDashboardCards]);

  // Trigger fetch when monitoring tab is selected
  useEffect(() => {
    if (layoutTab === "monitoring") {
      console.log('Monitoring tab selected, fetching cards...');
      refetchMonitoringCards();
    }
  }, [layoutTab, refetchMonitoringCards]);

  // Mutation to update dashboard card positions
  const updateCardPositionsMutation = useMutation({
    mutationFn: async (cards: any[]) => {
      console.log('🔄 Updating card positions:', cards);
      const response = await fetch("/api/dashboard-cards/positions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cards }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Failed to update positions:', response.status, errorText);
        throw new Error(`Failed to update card positions: ${response.status} ${errorText}`);
      }
      const result = await response.json();
      console.log('✅ Card positions updated successfully:', result);
      return result;
    },
    onSuccess: () => {
      console.log('🔄 Refetching dashboard cards after position update...');
      refetchDashboardCards();
    },
    onError: (error) => {
      console.error('❌ Mutation error:', error);
    },
  });

  // Mutation to update monitoring card positions
  const updateMonitoringCardPositionsMutation = useMutation({
    mutationFn: async (cards: any[]) => {
      console.log('🔄 Updating monitoring card positions:', cards);
      const response = await fetch("/api/monitoring-cards/positions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cards }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Failed to update monitoring positions:', response.status, errorText);
        throw new Error(`Failed to update monitoring card positions: ${response.status} ${errorText}`);
      }
      const result = await response.json();
      console.log('✅ Monitoring card positions updated successfully:', result);
      return result;
    },
    onSuccess: () => {
      console.log('🔄 Refetching monitoring cards after position update...');
      refetchMonitoringCards();
    },
    onError: (error) => {
      console.error('❌ Monitoring mutation error:', error);
    },
  });

  // Enhanced drag and drop functions with micro-interactions
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedItem(index);
    setDragOverItem(null);
    e.dataTransfer.effectAllowed = 'move';
    
    // Add custom drag image with reduced opacity
    const target = e.currentTarget as HTMLElement;
    const dragImage = target.cloneNode(true) as HTMLElement;
    dragImage.style.opacity = '0.8';
    dragImage.style.transform = 'rotate(2deg)';
    dragImage.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.3)';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 0, 0);
    
    // Clean up the temporary drag image
    setTimeout(() => {
      if (document.body.contains(dragImage)) {
        document.body.removeChild(dragImage);
      }
    }, 0);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverItem(null);
  };

  const handleDragEnter = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedItem !== null && draggedItem !== index) {
      setDragOverItem(index);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only reset if we're leaving the entire card area
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOverItem(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedItem === null) return;

    const newCards = [...dashboardCards];
    const draggedCard = newCards[draggedItem];
    
    // Remove the dragged item
    newCards.splice(draggedItem, 1);
    
    // Insert at new position
    if (dropIndex >= newCards.length) {
      newCards.push(draggedCard);
    } else {
      newCards.splice(dropIndex, 0, draggedCard);
    }
    
    // Update positions in the new array
    const updatedCards = newCards.map((card, index) => ({
      ...card,
      position: index
    }));
    
    setDashboardCards(updatedCards);
    setDraggedItem(null);
    setDragOverItem(null);
    
    // Update positions in the database
    console.log('🎯 Calling mutation with cards:', updatedCards.map(card => ({ id: card.id, position: card.position })));
    updateCardPositionsMutation.mutate(
      updatedCards.map(card => ({ id: card.id, position: card.position }))
    );
  };

  const removeDashboardCard = (cardId: number) => {
    setDashboardCards(cards => cards.filter(card => card.id !== cardId));
  };

  const addDashboardCard = (cardName: string, cardDescription: string) => {
    // For existing integrations, use their type. For custom cards, use 'custom' as type
    const integration = integrationsData?.find(i => i.displayName === cardName);
    const cardType = integration ? integration.name : 'custom';
    
    // Create dashboard card via API instead of local state
    const createDashboardCard = async () => {
      try {
        const response = await apiRequest("POST", "/api/dashboard-cards", {
          name: cardName,
          type: cardType,
          enabled: true,
          position: dashboardCards.length // Add at the end
        });
        
        if (response.ok) {
          // Refresh the dashboard cards list
          refetchDashboardCards();
          toast({
            title: "Success",
            description: `Dashboard card "${cardName}" added successfully`,
          });
        } else {
          throw new Error('Failed to create dashboard card');
        }
      } catch (error) {
        console.error('Failed to add dashboard card:', error);
        toast({
          title: "Error",
          description: "Failed to add dashboard card",
          variant: "destructive",
        });
      }
    };
    
    createDashboardCard();
  };

  // Monitoring drag and drop handlers
  const handleMonitoringDragStart = (e: React.DragEvent, index: number) => {
    setDraggedMonitoringItem(index);
    setDragOverMonitoringItem(null);
    e.dataTransfer.effectAllowed = 'move';
    
    // Add custom drag image with reduced opacity
    const target = e.currentTarget as HTMLElement;
    const dragImage = target.cloneNode(true) as HTMLElement;
    dragImage.style.opacity = '0.8';
    dragImage.style.transform = 'rotate(2deg)';
    dragImage.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.3)';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 0, 0);
    
    // Clean up the temporary drag image
    setTimeout(() => {
      if (document.body.contains(dragImage)) {
        document.body.removeChild(dragImage);
      }
    }, 0);
  };

  const handleMonitoringDragEnd = () => {
    setDraggedMonitoringItem(null);
    setDragOverMonitoringItem(null);
  };

  const handleMonitoringDragEnter = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedMonitoringItem !== null && draggedMonitoringItem !== index) {
      setDragOverMonitoringItem(index);
    }
  };

  const handleMonitoringDragLeave = (e: React.DragEvent) => {
    // Only reset if we're leaving the entire card area
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOverMonitoringItem(null);
    }
  };

  const handleMonitoringDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedMonitoringItem === null) return;

    const newCards = [...monitoringCards];
    const draggedCard = newCards[draggedMonitoringItem];
    
    // Remove the dragged item
    newCards.splice(draggedMonitoringItem, 1);
    
    // Insert at new position
    if (dropIndex >= newCards.length) {
      newCards.push(draggedCard);
    } else {
      newCards.splice(dropIndex, 0, draggedCard);
    }
    
    // Update positions in the new array
    const updatedCards = newCards.map((card, index) => ({
      ...card,
      position: index
    }));
    
    setMonitoringCards(updatedCards);
    setDraggedMonitoringItem(null);
    setDragOverMonitoringItem(null);
    
    // Update positions in the database
    console.log('🎯 Calling monitoring mutation with cards:', updatedCards.map(card => ({ id: card.id, position: card.position })));
    updateMonitoringCardPositionsMutation.mutate(
      updatedCards.map(card => ({ id: card.id, position: card.position }))
    );
  };

  const handleToggleMonitoringCard = async (card: any) => {
    try {
      const response = await fetch(`/api/monitoring-cards/${card.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !card.enabled }),
      });
      if (response.ok) {
        refetchMonitoringCards();
      }
    } catch (error) {
      console.error('Failed to toggle monitoring card:', error);
    }
  };

  const handleDeleteMonitoringCard = async (card: any) => {
    if (confirm(`Are you sure you want to delete the "${card.name}" monitoring card?`)) {
      try {
        const response = await fetch(`/api/monitoring-cards/${card.id}`, {
          method: "DELETE",
        });
        if (response.ok) {
          refetchMonitoringCards();
        }
      } catch (error) {
        console.error('Failed to delete monitoring card:', error);
      }
    }
  };

  const handleAddMonitoringCard = async () => {
    const getCardName = (type: string, customName?: string) => {
      if (type === "custom") return customName || "Custom Monitor";
      const names = {
        users: "User Activity Monitor",
        security: "Security Events",
        devices: "Device Status", 
        alerts: "Active Alerts",
        performance: "System Performance"
      };
      return names[type as keyof typeof names] || type;
    };

    try {
      const response = await fetch("/api/monitoring-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: getCardName(selectedMonitoringCardType, customMonitoringCardName),
          type: selectedMonitoringCardType,
          enabled: true,
          position: monitoringCards.length
        }),
      });

      if (response.ok) {
        refetchMonitoringCards();
        toast({
          title: "Success",
          description: "Monitoring card added successfully",
        });
        setIsAddMonitoringCardOpen(false);
        setSelectedMonitoringCardType("");
        setCustomMonitoringCardName("");
      } else {
        throw new Error('Failed to create monitoring card');
      }
    } catch (error) {
      console.error('Failed to add monitoring card:', error);
      toast({
        title: "Error", 
        description: "Failed to add monitoring card",
        variant: "destructive",
      });
    }
  };

  // Get current logo setting - ONLY when Layout > Logo tab is active
  const { data: logoSetting } = useQuery({
    queryKey: ['/api/layout-settings/company_logo'],
    enabled: activeTab === "layout" && layoutTab === "logo", // Only load when logo tab is active
  });

  // Get current logo text setting - ONLY when Layout > Logo tab is active
  const { data: logoTextSetting } = useQuery({
    queryKey: ['/api/layout-settings/logo_text'],
    enabled: activeTab === "layout" && layoutTab === "logo", // Only load when logo tab is active
  });
  const [editingUser, setEditingUser] = useState<SiteUser | null>(null);
  const [editingIntegration, setEditingIntegration] = useState<Integration | null>(null);
  const [isNewMappingOpen, setIsNewMappingOpen] = useState(false);
  const [logoText, setLogoText] = useState("");
  const [newMapping, setNewMapping] = useState({ appName: "", oktaGroups: [""], description: "" });
  const [integrationToDelete, setIntegrationToDelete] = useState<Integration | null>(null);
  const [mappingToDelete, setMappingToDelete] = useState<AppMapping | null>(null);
  const [editingMapping, setEditingMapping] = useState<AppMapping | null>(null);
  const [isEditMappingOpen, setIsEditMappingOpen] = useState(false);
  const [editMappingData, setEditMappingData] = useState({ appName: "", oktaGroups: [""] });
  const [newUser, setNewUser] = useState({
    name: "",
    username: "",
    accessLevel: ""
  });
  const [selectedIntegrationType, setSelectedIntegrationType] = useState("");
  const [integrationSearchTerm, setIntegrationSearchTerm] = useState("");
  const [showIntegrationDropdown, setShowIntegrationDropdown] = useState(false);
  const [customCardName, setCustomCardName] = useState("");
  const [customCardDescription, setCustomCardDescription] = useState("");
  const [selectedMonitoringCardType, setSelectedMonitoringCardType] = useState("");
  const [customMonitoringCardName, setCustomMonitoringCardName] = useState("");
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  // State moved to NewUserConfigSection component

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
      console.log('🔍 New User tab selected, refetching all settings...');
      console.log('🔍 Current field settings before refetch:', fieldSettings);
      refetchEmailSettings();
      refetchDepartmentSettings();

    }
  }, [activeTab, layoutTab, refetchEmailSettings, refetchDepartmentSettings]);

  // Update field settings when email username settings are loaded
  useEffect(() => {
    console.log('🔍 Email username settings effect triggered:', emailUsernameSettings);
    if (emailUsernameSettings && (emailUsernameSettings as any).settingValue) {
      try {
        const parsedSettings = JSON.parse((emailUsernameSettings as any).settingValue);
        console.log('🔍 Parsed email settings:', parsedSettings);
        if (parsedSettings.domains && Array.isArray(parsedSettings.domains)) {
          console.log('🔍 Loading saved domains:', parsedSettings.domains);
          setFieldSettings((prev: any) => {
            console.log('🔍 Previous field settings:', prev);
            const newSettings = {
              ...prev,
              emailUsername: {
                ...prev.emailUsername,
                domains: parsedSettings.domains
              }
            };
            console.log('🔍 New field settings:', newSettings);
            return newSettings;
          });
        }
      } catch (error) {
        console.error('🔍 Failed to parse email username settings:', error);
      }
    } else {
      console.log('🔍 No email username settings found, using defaults');
    }
  }, [emailUsernameSettings]);

  // Removed department and employee type useEffect hooks - starting fresh

  // Update field settings when password settings are loaded
  useEffect(() => {
    console.log('🔍 Password settings effect triggered:', passwordSettings);
    if (passwordSettings && (passwordSettings as any).settingValue) {
      try {
        const parsedSettings = JSON.parse((passwordSettings as any).settingValue);
        console.log('🔍 Parsed password settings:', parsedSettings);
        if (parsedSettings.components && Array.isArray(parsedSettings.components)) {
          console.log('🔍 Loading saved password components:', parsedSettings);
          setFieldSettings((prev: any) => {
            console.log('🔍 Previous password field settings:', prev);
            const newSettings = {
              ...prev,
              password: {
                ...prev.password,
                ...parsedSettings
              }
            };
            console.log('🔍 New password field settings:', newSettings);
            return newSettings;
          });
        }
      } catch (error) {
        console.error('🔍 Failed to parse password settings:', error);
      }
    } else {
      console.log('🔍 No password settings found, using defaults');
    }
  }, [passwordSettings]);

  // Update field settings when individual field settings are loaded
  useEffect(() => {
    console.log('🔍 Field settings loaded - updating state');
    setFieldSettings((prev: any) => {
      const newSettings = { ...prev };
      
      // Update firstName required setting
      if (firstNameSettings && (firstNameSettings as any).settingValue) {
        try {
          const parsed = JSON.parse((firstNameSettings as any).settingValue);
          newSettings.firstName = { ...newSettings.firstName, ...parsed };
          console.log('🔍 Updated firstName setting:', parsed);
        } catch (error) {
          console.error('Failed to parse firstName settings:', error);
        }
      }
      
      // Update lastName required setting
      if (lastNameSettings && (lastNameSettings as any).settingValue) {
        try {
          const parsed = JSON.parse((lastNameSettings as any).settingValue);
          newSettings.lastName = { ...newSettings.lastName, ...parsed };
          console.log('🔍 Updated lastName setting:', parsed);
        } catch (error) {
          console.error('Failed to parse lastName settings:', error);
        }
      }
      
      // Update title required setting
      if (titleSettings && (titleSettings as any).settingValue) {
        try {
          const parsed = JSON.parse((titleSettings as any).settingValue);
          newSettings.title = { ...newSettings.title, ...parsed };
          console.log('🔍 Updated title setting:', parsed);
        } catch (error) {
          console.error('Failed to parse title settings:', error);
        }
      }
      
      // Update manager required setting
      if (managerSettings && (managerSettings as any).settingValue) {
        try {
          const parsed = JSON.parse((managerSettings as any).settingValue);
          newSettings.manager = { ...newSettings.manager, ...parsed };
          console.log('🔍 Updated manager setting:', parsed);
        } catch (error) {
          console.error('Failed to parse manager settings:', error);
        }
      }
      
      // Update department required setting
      if (departmentSettings && (departmentSettings as any).settingValue) {
        try {
          const parsed = JSON.parse((departmentSettings as any).settingValue);
          newSettings.department = { ...newSettings.department, ...parsed };
          console.log('🔍 Updated department setting:', parsed);
        } catch (error) {
          console.error('Failed to parse department settings:', error);
        }
      }
      
      // Update employee type required setting and options
      if (employeeTypeSettings && (employeeTypeSettings as any).settingValue) {
        try {
          const parsed = JSON.parse((employeeTypeSettings as any).settingValue);
          newSettings.employeeType = { ...newSettings.employeeType, ...parsed };
          console.log('🔍 Updated employee type setting:', parsed);
        } catch (error) {
          console.error('Failed to parse employee type settings:', error);
        }
      }
      
      return newSettings;
    });
  }, [firstNameSettings, lastNameSettings, titleSettings, managerSettings, departmentSettings, employeeTypeSettings]);

  // Update logo text when setting loads
  useEffect(() => {
    if ((logoTextSetting as any)?.settingValue) {
      setLogoText((logoTextSetting as any).settingValue);
    } else {
      setLogoText("Powered by ClockWerk.it"); // Default text
    }
  }, [logoTextSetting]);

  // Logo text update mutation
  const updateLogoTextMutation = useMutation({
    mutationFn: async (text: string) => {
      const response = await apiRequest("POST", "/api/layout-settings", {
        settingKey: "logo_text",
        settingValue: text,
        settingType: "logo",
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/layout-settings/logo_text'] });
      toast({
        title: "Success",
        description: "Logo text updated successfully",
      });
    },
    onError: (error) => {
      console.error("Failed to update logo text:", error);
      toast({
        title: "Error",
        description: "Failed to update logo text",
        variant: "destructive",
      });
    },
  });

  // Fetch site access users from database - ONLY when Site Access tab is active
  const { data: siteUsers = [], isLoading } = useQuery<SiteUser[]>({
    queryKey: ["/api/site-access-users"],
    enabled: activeTab === "site-access", // Only load when tab is active
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false,
  });

  // Fetch integrations from database - ONLY when Integrations tab is active
  const { data: integrationsData = [], isLoading: integrationsLoading } = useQuery<Integration[]>({
    queryKey: ["/api/integrations"],
    enabled: activeTab === "integrations", // Only load when tab is active
    staleTime: 10 * 60 * 1000, // 10 minutes - integrations rarely change
    refetchOnWindowFocus: false,
  });

  // Fetch audit logs from database - ONLY when Audit Logs tab is active
  const { data: auditLogsData, isLoading: auditLogsLoading } = useQuery<{logs: AuditLog[], pagination: any}>({
    queryKey: ["/api/audit-logs"],
    enabled: activeTab === "audit-logs", // Only load when tab is active
    staleTime: 5 * 60 * 1000, // 5 minutes - logs don't change frequently
    refetchOnWindowFocus: false,
  });

  // Fetch app mappings from database - ONLY when App Mappings tab is active
  const { data: appMappingsData = [], isLoading: appMappingsLoading } = useQuery<AppMapping[]>({
    queryKey: ["/api/app-mappings"],
    enabled: activeTab === "app-mappings", // Only load when tab is active
    staleTime: 5 * 60 * 1000, // 5 minutes - app mappings change occasionally
    refetchOnWindowFocus: false,
  });





  // Get active apps for the dropdown - matching UserModal logic
  const availableApps = appMappingsData
    .filter(app => app.status === 'active')
    .map(app => app.appName);

  console.log('🔍 Available apps for dropdown:', availableApps);

  // Note: department and employee type app mappings are already declared above

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
      setIsDeleteUserOpen(false);
      setUserToDelete(null);
    }
  });

  const confirmDeleteUser = () => {
    if (userToDelete) {
      deleteUserMutation.mutate(userToDelete.id);
    }
  };

  // App mapping mutations
  const createAppMappingMutation = useMutation({
    mutationFn: async (mappingData: { appName: string; oktaGroups: string[]; description?: string }) => {
      // Create multiple mappings for each group
      const mappings = mappingData.oktaGroups.filter(group => group.trim()).map(oktaGroupName => ({
        appName: mappingData.appName,
        oktaGroupName: oktaGroupName.trim(),
        description: mappingData.description
      }));
      
      // Send all mappings at once
      const response = await fetch("/api/app-mappings/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mappings })
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/app-mappings"] });
      setIsNewMappingOpen(false);
      setNewMapping({ appName: "", oktaGroups: [""], description: "" });
    }
  });

  // Helper function to add new group input
  const addGroupInput = () => {
    setNewMapping(prev => ({
      ...prev,
      oktaGroups: [...prev.oktaGroups, ""]
    }));
  };

  // Helper function to remove group input
  const removeGroupInput = (index: number) => {
    setNewMapping(prev => ({
      ...prev,
      oktaGroups: prev.oktaGroups.filter((_, i) => i !== index)
    }));
  };

  // Helper function to update group input
  const updateGroupInput = (index: number, value: string) => {
    setNewMapping(prev => ({
      ...prev,
      oktaGroups: prev.oktaGroups.map((group, i) => i === index ? value : group)
    }));
  };

  const deleteAppMappingMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/app-mappings/${id}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (!response.ok) throw new Error("Failed to delete app mapping");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/app-mappings"] });
      setMappingToDelete(null);
    }
  });

  const handleDeleteMapping = () => {
    if (mappingToDelete) {
      deleteAppMappingMutation.mutate(mappingToDelete.id);
    }
  };

  const handleEditMapping = (mapping: AppMapping) => {
    setEditingMapping(mapping);
    setEditMappingData({
      appName: mapping.appName,
      oktaGroups: [mapping.oktaGroupName]
    });
    setIsEditMappingOpen(true);
  };

  const updateAppMappingMutation = useMutation({
    mutationFn: async ({ id, mappingData }: { id: number; mappingData: { appName: string; oktaGroups: string[] } }) => {
      // Delete existing mapping and create new ones (bulk replace)
      await fetch(`/api/app-mappings/${id}`, {
        method: "DELETE",
        credentials: "include"
      });
      
      const validGroups = mappingData.oktaGroups.filter(group => group.trim());
      const mappings = validGroups.map(group => ({
        appName: mappingData.appName,
        oktaGroupName: group.trim(),
        description: null
      }));
      
      const response = await fetch('/api/app-mappings/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          mappings: mappings
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/app-mappings"] });
      setIsEditMappingOpen(false);
      setEditingMapping(null);
      setEditMappingData({ appName: "", oktaGroups: [""] });
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

  // Create integration mutation
  const createIntegrationMutation = useMutation({
    mutationFn: async (data: { name: string; displayName: string }) => {
      const response = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: data.name,
          displayName: data.displayName,
          description: '',
          status: 'disconnected',
          apiKeys: {},
          config: {},
          lastUpdated: new Date().toISOString()
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      setIsNewIntegrationOpen(false);
      setSelectedIntegrationType("");
      setIntegrationSearchTerm("");
      setShowIntegrationDropdown(false);
    }
  });

  // Delete integration mutation
  const deleteIntegrationMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/integrations/${id}`, {
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
    setUserToDelete(user);
    setIsDeleteUserOpen(true);
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

  const handleDeleteIntegration = (integration: Integration) => {
    setIntegrationToDelete(integration);
    setIsDeleteIntegrationOpen(true);
  };

  const confirmDeleteIntegration = () => {
    if (integrationToDelete) {
      deleteIntegrationMutation.mutate(integrationToDelete.id);
      setIsDeleteIntegrationOpen(false);
      setIntegrationToDelete(null);
    }
  };

  // Available integration types for the new integration modal
  const availableIntegrationTypes = [
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

  // Map dashboard card types to integration types
  const mapCardTypeToIntegrationType = (cardType: string) => {
    const mapping: Record<string, string> = {
      'device_management': 'addigy', // Map device_management to addigy logo
      'knowbe4': 'knowbe4',
      'sentinelone': 'sentinelone', 
      'jira': 'jira'
    };
    return mapping[cardType] || cardType;
  };

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
      case 'custom':
        return (
          <div className={logoClass}>
            <svg viewBox="0 0 24 24" className="w-full h-full">
              <rect width="24" height="24" rx="4" fill="#8B5CF6"/>
              <path d="M12 8v8m-4-4h8" stroke="white" strokeWidth="2" strokeLinecap="round"/>
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
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="site-access">Site access</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="apps">Apps</TabsTrigger>
          <TabsTrigger value="layout">Layout</TabsTrigger>
          <TabsTrigger value="audit-logs">Audit Logs</TabsTrigger>
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
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                      <Plus className="w-4 h-4 mr-2" />
                      New Admin
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
                        className="bg-blue-600 hover:bg-blue-700 text-white"
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
                <Button 
                  onClick={() => setIsNewIntegrationOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
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

        <TabsContent value="audit-logs" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Audit Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Track all administrative actions and system changes with detailed audit logging.
              </p>
              {auditLogsLoading ? (
                <div className="text-center py-8">
                  <div className="text-muted-foreground">Loading audit logs...</div>
                </div>
              ) : auditLogsData?.logs.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-muted-foreground">No audit logs found</div>
                </div>
              ) : (
                <div className="space-y-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Resource</TableHead>
                        <TableHead>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogsData?.logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-sm">
                            {new Date(log.timestamp).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-sm font-medium">
                            {log.userEmail}
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              log.action.includes('DELETE') ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                              log.action.includes('CREATE') ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                              log.action.includes('UPDATE') ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                              log.action.includes('LOGIN') ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                              'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                            }`}>
                              {log.action}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm">
                            <div>
                              <div className="font-medium">{log.resourceType}</div>
                              {log.resourceName && (
                                <div className="text-muted-foreground">{log.resourceName}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm max-w-xs">
                            <div className="truncate">
                              {log.details.action || Object.keys(log.details).map(key => 
                                `${key}: ${JSON.stringify(log.details[key])}`
                              ).join(', ')}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  
                  {auditLogsData?.pagination && auditLogsData.pagination.total > 50 && (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      Showing latest {auditLogsData.logs.length} of {auditLogsData.pagination.total} audit logs
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="apps" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>OKTA Application Mappings</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Configure application-to-group mappings for OKTA integration
                  </p>
                </div>
                <Button 
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => setIsNewMappingOpen(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Mapping
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {appMappingsLoading ? (
                <div className="text-center py-8">
                  <div className="text-muted-foreground">Loading app mappings...</div>
                </div>
              ) : appMappingsData.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-muted-foreground">No app mappings configured</div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Create your first mapping to connect applications with OKTA security groups
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {appMappingsData.map((mapping) => (
                    <div key={mapping.id} className="flex items-center justify-between p-4 border rounded-lg dark:border-gray-700">
                      <div className="flex items-center space-x-4">
                        <div>
                          <h4 className="font-semibold">{mapping.appName}</h4>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="text-right">
                          <p className="text-sm font-medium">{mapping.oktaGroupName}</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:text-green-300 dark:hover:bg-green-950"
                          onClick={() => handleEditMapping(mapping)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950"
                          onClick={() => setMappingToDelete(mapping)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="layout" className="mt-6">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-8">


                {/* Layout Customization Tabs */}
                <div>
                  <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                    <button 
                      onClick={() => setLayoutTab("logo")}
                      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                        layoutTab === "logo" 
                          ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm" 
                          : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                      }`}
                    >
                      Logo
                    </button>
                    <button 
                      onClick={() => {
                        console.log('📊 Dashboard tab clicked');
                        setLayoutTab("dashboard");
                        setTimeout(() => {
                          console.log('🔄 Triggering dashboard cards fetch...');
                          refetchDashboardCards();
                        }, 100);
                      }}
                      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                        layoutTab === "dashboard" 
                          ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm" 
                          : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                      }`}
                    >
                      Dashboard
                    </button>
                    <button 
                      onClick={() => setLayoutTab("new-user")}
                      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                        layoutTab === "new-user" 
                          ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm" 
                          : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                      }`}
                    >
                      New User
                    </button>
                    <button 
                      onClick={() => setLayoutTab("profile")}
                      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                        layoutTab === "profile" 
                          ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm" 
                          : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                      }`}
                    >
                      Profile
                    </button>
                    <button 
                      onClick={() => {
                        console.log('📊 Monitoring tab clicked');
                        setLayoutTab("monitoring");
                        setTimeout(() => {
                          console.log('🔄 Triggering monitoring cards fetch...');
                          refetchMonitoringCards();
                        }, 100);
                      }}
                      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                        layoutTab === "monitoring" 
                          ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm" 
                          : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                      }`}
                    >
                      Monitoring
                    </button>
                  </div>

                  {/* Tab Content */}
                  <div className="mt-6">
                    {layoutTab === "logo" && (
                      <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-6">
                        <h4 className="text-lg font-semibold mb-4">Company Logo & Branding</h4>
                        
                        {/* Logo Section */}
                        <div className="mb-6">
                          <h5 className="text-md font-medium mb-3">Logo</h5>
                          <div className="flex items-center gap-4">
                            <div className="flex-shrink-0">
                              {(logoSetting as any)?.settingValue ? (
                                <img 
                                  src={(logoSetting as any).settingValue} 
                                  alt="Company logo" 
                                  className="max-h-12 w-auto object-contain"
                                />
                              ) : (
                                <div className="w-16 h-16 bg-purple-600 rounded flex items-center justify-center overflow-hidden">
                                  <div className="relative w-14 h-14">
                                    <img 
                                      src="/maze-logo.png" 
                                      alt="MAZE Logo" 
                                      className="w-14 h-14 absolute inset-0 object-contain"
                                      style={{ filter: "invert(1)" }}
                                    />
                                    <div 
                                      className="w-14 h-14 absolute inset-0" 
                                      style={{ backgroundColor: "#f97316", mixBlendMode: "multiply" }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                            <Button 
                              onClick={() => setIsLogoUploadOpen(true)}
                              className="bg-blue-600 hover:bg-blue-700 text-white flex items-center"
                            >
                              <Settings className="w-4 h-4 mr-2" />
                              Customize Logo
                            </Button>
                          </div>
                        </div>

                        {/* Logo Text Section */}
                        <div>
                          <h5 className="text-md font-medium mb-3">Logo Text</h5>
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <Input
                                id="logoText"
                                value={logoText}
                                onChange={(e) => setLogoText(e.target.value)}
                                placeholder="Enter text to display under logo"
                                className="w-1/4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                              />
                              <Button 
                                onClick={() => updateLogoTextMutation.mutate(logoText)}
                                disabled={updateLogoTextMutation.isPending || logoText === ((logoTextSetting as any)?.settingValue || "Powered by ClockWerk.it")}
                                className="bg-green-600 hover:bg-green-700 text-white"
                              >
                                {updateLogoTextMutation.isPending ? "Updating..." : "Update Text"}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {layoutTab === "dashboard" && (
                      <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-6">
                        <div className="flex items-center justify-between mb-6">
                          <h4 className="text-lg font-semibold">Dashboard Layout</h4>
                          <div className="flex gap-2">
                            <Button 
                              onClick={() => {
                                console.log('🔄 Manual refresh clicked');
                                refetchDashboardCards();
                              }}
                              variant="outline"
                              className="flex items-center"
                            >
                              <RefreshCw className="w-4 h-4 mr-2" />
                              Refresh
                            </Button>
                            <Button 
                              onClick={() => setIsAddDashboardCardOpen(true)}
                              className="bg-blue-600 hover:bg-blue-700 text-white flex items-center"
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Add Integration
                            </Button>
                          </div>
                        </div>
                        
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                          Drag and drop cards to reorganize your dashboard. Click "Add Integration" to add new app cards.
                        </p>

                        {/* Dashboard Grid Preview */}
                        {dashboardCardsError && (
                          <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg">
                            Error loading dashboard cards: {dashboardCardsError.message}. Click Refresh to try again.
                          </div>
                        )}
                        {dashboardCardsLoading && (
                          <div className="mb-4 p-3 bg-blue-100 border border-blue-300 text-blue-700 rounded-lg">
                            Loading dashboard cards...
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                          {dashboardCards.map((card, index) => (
                            <div
                              key={card.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, index)}
                              onDragEnd={handleDragEnd}
                              onDragEnter={(e) => handleDragEnter(e, index)}
                              onDragLeave={handleDragLeave}
                              onDragOver={handleDragOver}
                              onDrop={(e) => handleDrop(e, index)}
                              className={`
                                group relative p-4 border-2 rounded-lg cursor-move 
                                transition-all duration-200 ease-in-out
                                transform-gpu
                                ${draggedItem === index 
                                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 opacity-60 scale-105 rotate-1 shadow-lg border-solid' 
                                  : dragOverItem === index
                                    ? 'border-blue-400 bg-blue-25 dark:bg-blue-900/20 scale-102 shadow-md border-solid'
                                    : 'border-dashed border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-sm hover:scale-101'
                                }
                                bg-gray-50 dark:bg-gray-800
                                hover:bg-gray-100 dark:hover:bg-gray-750
                              `}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <div className={`
                                    transition-transform duration-200 ease-in-out
                                    ${draggedItem === index ? 'scale-110' : ''}
                                  `}>
                                    {getIntegrationLogo(mapCardTypeToIntegrationType(card.type))}
                                  </div>
                                  <span className={`
                                    font-medium text-sm transition-all duration-200
                                    ${draggedItem === index ? 'text-blue-600 dark:text-blue-400' : ''}
                                  `}>
                                    {card.name || `${card.type} Integration`}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      // Find matching integration and open configure dialog
                                      const integration = integrationsData.find(i => i.name === card.type);
                                      if (integration) {
                                        setEditingIntegration(integration);
                                        setIsConfigureIntegrationOpen(true);
                                      }
                                    }}
                                    className={`
                                      text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950
                                      transition-all duration-200 ease-in-out
                                      ${draggedItem === index ? 'opacity-50' : 'hover:scale-110'}
                                    `}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeDashboardCard(card.id)}
                                    className={`
                                      text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950
                                      transition-all duration-200 ease-in-out
                                      ${draggedItem === index ? 'opacity-50' : 'hover:scale-110'}
                                    `}
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                              <div className={`
                                text-xs transition-colors duration-200
                                ${draggedItem === index ? 'text-blue-500 dark:text-blue-400' : 'text-gray-500'}
                              `}>
                                {card.type === 'knowbe4' ? 'KnowBe4 phishing simulation progress' :
                                 card.type === 'sentinelone' ? 'SentinelOne device protection status' :
                                 card.type === 'device_management' ? 'Addigy/Intune managed devices' :
                                 card.type === 'jira' ? 'Jira Service Management tickets' :
                                 'Integration dashboard card'}
                              </div>
                              
                              {/* Drag handle indicator */}
                              <div className={`
                                absolute top-2 right-8 text-gray-400 transition-opacity duration-200
                                ${draggedItem === index ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'}
                              `}>
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
                                </svg>
                              </div>
                            </div>
                          ))}
                          
                          {/* Enhanced empty slots with drop zone interactions */}
                          {Array.from({ length: 4 - dashboardCards.length }, (_, index) => {
                            const slotIndex = dashboardCards.length + index;
                            return (
                              <div
                                key={`empty-${index}`}
                                onDragEnter={(e) => handleDragEnter(e, slotIndex)}
                                onDragLeave={handleDragLeave}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, slotIndex)}
                                className={`
                                  p-4 border-2 border-dashed rounded-lg 
                                  flex items-center justify-center min-h-[100px]
                                  transition-all duration-200 ease-in-out
                                  ${dragOverItem === slotIndex
                                    ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 scale-102 border-solid'
                                    : draggedItem !== null
                                      ? 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800'
                                      : 'border-gray-200 dark:border-gray-700'
                                  }
                                `}
                              >
                                <span className={`text-sm transition-colors duration-200 ${
                                  dragOverItem === slotIndex 
                                    ? 'text-blue-600 dark:text-blue-400' 
                                    : 'text-gray-400'
                                }`}>
                                  {dragOverItem === slotIndex ? 'Drop here' : 'Empty slot'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {layoutTab === "new-user" && (
                      <Suspense fallback={<div className="animate-pulse bg-gray-100 dark:bg-gray-800 h-64 rounded-lg"></div>}>
                        <NewUserConfigSection
                          selectedApps={selectedApps}
                          setSelectedApps={setSelectedApps}
                          appMappingsData={appMappingsData}
                        />
                      </Suspense>
                    )}

                    {layoutTab === "profile" && (
                      <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-6">
                        <h4 className="text-lg font-semibold mb-4">Profile Settings</h4>
                        <p className="text-blue-600 dark:text-blue-400 mb-6">Hello there</p>
                        <p className="text-sm text-muted-foreground">
                          Configure profile-related settings and preferences.
                        </p>
                      </div>
                    )}

                    {layoutTab === "monitoring" && (
                      <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-6">
                        <div className="flex justify-between items-center mb-6">
                          <div>
                            <h4 className="text-lg font-semibold">Monitoring Dashboard Cards</h4>
                            <p className="text-sm text-muted-foreground">
                              Arrange monitoring dashboard cards. Changes are saved automatically when you drag and drop.
                            </p>
                          </div>
                          <Button 
                            onClick={() => setIsAddMonitoringCardOpen(true)}
                            className="bg-orange-600 hover:bg-orange-700 text-white"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Card
                          </Button>
                        </div>

                        {monitoringCardsLoading ? (
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {[1, 2, 3, 4].map((i) => (
                              <div key={i} className="animate-pulse">
                                <div className="bg-gray-200 dark:bg-gray-700 h-32 rounded-lg"></div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                              {monitoringCards
                                .sort((a, b) => a.position - b.position)
                                .map((card, index) => (
                                <div
                                  key={card.id}
                                  draggable
                                  onDragStart={(e) => handleMonitoringDragStart(e, index)}
                                  onDragEnd={handleMonitoringDragEnd}
                                  onDragEnter={(e) => handleMonitoringDragEnter(e, index)}
                                  onDragOver={(e) => e.preventDefault()}
                                  onDragLeave={handleMonitoringDragLeave}
                                  onDrop={(e) => handleMonitoringDrop(e, index)}
                                  className={`bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border-2 cursor-move transition-all duration-200 ${
                                    draggedMonitoringItem === index 
                                      ? 'opacity-50 scale-95 border-blue-400' 
                                      : dragOverMonitoringItem === index 
                                        ? 'border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                                  }`}
                                >
                                  <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                      <h5 className="font-medium text-gray-900 dark:text-gray-100 mb-1">{card.name}</h5>
                                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Type: {card.type}</p>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500 dark:text-gray-400">Position: {card.position}</span>
                                        <span className={`text-xs px-2 py-1 rounded-full ${
                                          card.enabled 
                                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' 
                                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                        }`}>
                                          {card.enabled ? 'Enabled' : 'Disabled'}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleToggleMonitoringCard(card)}
                                        className="h-8 w-8 p-0"
                                      >
                                        {card.enabled ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteMonitoringCard(card)}
                                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Empty slots for visual feedback */}
                            {monitoringCards.length < 6 && (
                              <div className="mt-4">
                                <h6 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Available Slots</h6>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                  {Array.from({ length: 6 - monitoringCards.length }, (_, i) => {
                                    const slotIndex = monitoringCards.length + i;
                                    return (
                                      <div
                                        key={`empty-${slotIndex}`}
                                        className={`border-2 border-dashed rounded-lg p-4 h-32 flex items-center justify-center transition-colors duration-200 ${
                                          dragOverMonitoringItem === slotIndex 
                                            ? 'border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                                            : 'border-gray-300 dark:border-gray-600'
                                        }`}
                                        onDragEnter={(e) => handleMonitoringDragEnter(e, slotIndex)}
                                        onDragOver={(e) => e.preventDefault()}
                                        onDragLeave={handleMonitoringDragLeave}
                                        onDrop={(e) => handleMonitoringDrop(e, slotIndex)}
                                      >
                                        <span className={`text-sm transition-colors duration-200 ${
                                          dragOverMonitoringItem === slotIndex 
                                            ? 'text-blue-600 dark:text-blue-400' 
                                            : 'text-gray-400'
                                        }`}>
                                          {dragOverMonitoringItem === slotIndex ? 'Drop here' : 'Empty slot'}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
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

      {/* Configure Integration Dialog */}
      <Dialog open={isConfigureIntegrationOpen} onOpenChange={setIsConfigureIntegrationOpen}>
        <DialogContent className="sm:max-w-[425px] max-h-[80vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>Configure {editingIntegration?.displayName}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {renderApiKeyFields(editingIntegration)}
          </div>
          <div className="flex justify-between items-center">
            <Button 
              variant="outline"
              onClick={() => editingIntegration && handleDeleteIntegration(editingIntegration)}
              disabled={deleteIntegrationMutation.isPending}
              className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950"
            >
              {deleteIntegrationMutation.isPending ? "Deleting..." : "Delete Integration"}
            </Button>
            <Button 
              onClick={handleUpdateIntegration}
              disabled={updateIntegrationMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
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
              <div className="relative">
                <div className="flex">
                  <Input
                    placeholder="Search integrations..."
                    value={integrationSearchTerm}
                    onChange={(e) => {
                      setIntegrationSearchTerm(e.target.value);
                      setShowIntegrationDropdown(true);
                    }}
                    onFocus={() => setShowIntegrationDropdown(true)}
                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm h-9"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowIntegrationDropdown(!showIntegrationDropdown)}
                    className="ml-1 h-9 px-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                  >
                    <ChevronsUpDown className="h-4 w-4" />
                  </Button>
                </div>
                
                {showIntegrationDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 max-h-[200px] overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50">
                    {availableIntegrationTypes
                      .filter(integration => 
                        !integrationSearchTerm || integration.label.toLowerCase().includes(integrationSearchTerm.toLowerCase())
                      )
                      .map((integration) => (
                        <div
                          key={integration.value}
                          onClick={() => {
                            setSelectedIntegrationType(integration.value);
                            setIntegrationSearchTerm("");
                            setShowIntegrationDropdown(false);
                          }}
                          className="flex items-center gap-2 p-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                        >
                          {getIntegrationLogo(integration.value)}
                          <span className="font-medium">{integration.label}</span>
                        </div>
                      ))
                    }
                    {availableIntegrationTypes.filter(integration => 
                      !integrationSearchTerm || integration.label.toLowerCase().includes(integrationSearchTerm.toLowerCase())
                    ).length === 0 && (
                      <div className="p-3 text-muted-foreground">No integration found.</div>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            {selectedIntegrationType && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  {getIntegrationLogo(selectedIntegrationType)}
                  <h4 className="font-medium">
                    {availableIntegrationTypes.find(i => i.value === selectedIntegrationType)?.label}
                  </h4>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => {
              setIsNewIntegrationOpen(false);
              setSelectedIntegrationType("");
              setIntegrationSearchTerm("");
              setShowIntegrationDropdown(false);
            }}>
              Cancel
            </Button>
            <Button 
              disabled={!selectedIntegrationType || createIntegrationMutation.isPending}
              onClick={() => {
                const selectedIntegration = availableIntegrationTypes.find(i => i.value === selectedIntegrationType);
                if (selectedIntegration) {
                  createIntegrationMutation.mutate({
                    name: selectedIntegration.value,
                    displayName: selectedIntegration.label
                  });
                }
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {createIntegrationMutation.isPending ? "Adding..." : "Add Integration"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit App Mapping Dialog */}
      <Dialog open={isEditMappingOpen} onOpenChange={setIsEditMappingOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit App Mapping</DialogTitle>
            <DialogDescription>
              Update the application mapping configuration
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-app-name">Application Name</Label>
              <Input
                id="edit-app-name"
                value={editMappingData.appName}
                onChange={(e) => setEditMappingData(prev => ({ ...prev, appName: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="edit-okta-groups">OKTA Group Name(s)</Label>
              <div className="space-y-2 mt-1">
                {editMappingData.oktaGroups.map((group, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditMappingData(prev => ({
                          ...prev,
                          oktaGroups: [...prev.oktaGroups, ""]
                        }));
                      }}
                      className="flex-shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                    <Input
                      value={group}
                      onChange={(e) => {
                        setEditMappingData(prev => ({
                          ...prev,
                          oktaGroups: prev.oktaGroups.map((g, i) => i === index ? e.target.value : g)
                        }));
                      }}
                      className="flex-1"
                    />
                    {editMappingData.oktaGroups.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditMappingData(prev => ({
                            ...prev,
                            oktaGroups: prev.oktaGroups.filter((_, i) => i !== index)
                          }));
                        }}
                        className="flex-shrink-0 text-red-600 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end space-x-2 mt-6">
            <Button 
              variant="outline" 
              onClick={() => {
                setIsEditMappingOpen(false);
                setEditingMapping(null);
                setEditMappingData({ appName: "", oktaGroups: [""] });
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (editingMapping && editMappingData.appName && editMappingData.oktaGroups.some(g => g.trim())) {
                  updateAppMappingMutation.mutate({
                    id: editingMapping.id,
                    mappingData: editMappingData
                  });
                }
              }}
              disabled={updateAppMappingMutation.isPending || !editMappingData.appName || !editMappingData.oktaGroups.some(g => g.trim())}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {updateAppMappingMutation.isPending ? "Updating..." : "Update Mapping"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete App Mapping Confirmation Dialog */}
      <Dialog open={!!mappingToDelete} onOpenChange={() => setMappingToDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete App Mapping</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the mapping for "{mappingToDelete?.appName}" → "{mappingToDelete?.oktaGroupName}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2 mt-4">
            <Button 
              variant="outline" 
              onClick={() => setMappingToDelete(null)}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleDeleteMapping}
              disabled={deleteAppMappingMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteAppMappingMutation.isPending ? "Deleting..." : "Delete Mapping"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Integration Confirmation Dialog */}
      <Dialog open={isDeleteIntegrationOpen} onOpenChange={setIsDeleteIntegrationOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Integration</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete the <strong>{integrationToDelete?.displayName}</strong> integration? 
              This action cannot be undone and all configuration data will be permanently removed.
            </p>
          </div>
          <div className="flex justify-end space-x-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setIsDeleteIntegrationOpen(false);
                setIntegrationToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button 
              variant="outline"
              onClick={confirmDeleteIntegration}
              disabled={deleteIntegrationMutation.isPending}
              className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950"
            >
              {deleteIntegrationMutation.isPending ? "Deleting..." : "Delete Integration"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Logo Upload Modal */}
      <LogoUploadModal 
        isOpen={isLogoUploadOpen} 
        onClose={() => setIsLogoUploadOpen(false)} 
      />

      {/* Add Dashboard Card Dialog */}
      <Dialog open={isAddDashboardCardOpen} onOpenChange={setIsAddDashboardCardOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Integration Card</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="cardName">Integration Name</Label>
              <Select onValueChange={(value) => {
                if (value === "custom") {
                  setSelectedIntegrationType("custom");
                } else {
                  const integration = integrationsData?.find(i => i.displayName === value);
                  if (integration) {
                    addDashboardCard(integration.displayName, integration.description || 'Integration dashboard card');
                    setIsAddDashboardCardOpen(false);
                  }
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an integration" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                  {integrationsData?.map((integration) => (
                    <SelectItem 
                      key={integration.id} 
                      value={integration.displayName}
                      className="bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <div className="flex items-center gap-2">
                        {getIntegrationLogo(integration.name)}
                        {integration.displayName}
                      </div>
                    </SelectItem>
                  ))}
                  {/* Custom option at the bottom */}
                  <SelectItem 
                    value="custom"
                    className="bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border-t border-gray-200 dark:border-gray-600"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 flex-shrink-0 bg-gray-400 rounded flex items-center justify-center">
                        <Plus className="w-4 h-4 text-white" />
                      </div>
                      Custom Card
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Custom card creation form */}
            {selectedIntegrationType === "custom" && (
              <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                <div className="grid gap-2">
                  <Label htmlFor="customCardName">Custom Card Name</Label>
                  <Input
                    id="customCardName"
                    value={customCardName}
                    onChange={(e) => setCustomCardName(e.target.value)}
                    placeholder="Enter custom integration name"
                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="customCardDescription">Description (optional)</Label>
                  <Input
                    id="customCardDescription"
                    value={customCardDescription}
                    onChange={(e) => setCustomCardDescription(e.target.value)}
                    placeholder="Enter card description"
                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                  />
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => {
              setIsAddDashboardCardOpen(false);
              setSelectedIntegrationType("");
              setCustomCardName("");
              setCustomCardDescription("");
            }}>
              Cancel
            </Button>
            {selectedIntegrationType === "custom" && (
              <Button 
                onClick={() => {
                  if (customCardName.trim()) {
                    addDashboardCard(customCardName, customCardDescription || 'Custom integration card');
                    setIsAddDashboardCardOpen(false);
                    setSelectedIntegrationType("");
                    setCustomCardName("");
                    setCustomCardDescription("");
                  }
                }}
                disabled={!customCardName.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Add Custom Card
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Monitoring Card Dialog */}
      <Dialog open={isAddMonitoringCardOpen} onOpenChange={setIsAddMonitoringCardOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Monitoring Card</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Add a new card to the monitoring dashboard
            </p>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="monitoringCardType">Card Type</Label>
              <Select 
                value={selectedMonitoringCardType} 
                onValueChange={setSelectedMonitoringCardType}
              >
                <SelectTrigger className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                  <SelectValue placeholder="Select monitoring card type" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                  <SelectItem value="users" className="bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700">
                    User Activity Monitor
                  </SelectItem>
                  <SelectItem value="security" className="bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700">
                    Security Events
                  </SelectItem>
                  <SelectItem value="devices" className="bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700">
                    Device Status
                  </SelectItem>
                  <SelectItem value="alerts" className="bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700">
                    Active Alerts
                  </SelectItem>
                  <SelectItem value="performance" className="bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700">
                    System Performance
                  </SelectItem>
                  <SelectItem value="custom" className="bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700">
                    Custom Monitor
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Custom card creation form */}
            {selectedMonitoringCardType === "custom" && (
              <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                <div className="grid gap-2">
                  <Label htmlFor="customMonitoringCardName">Custom Card Name</Label>
                  <Input
                    id="customMonitoringCardName"
                    value={customMonitoringCardName}
                    onChange={(e) => setCustomMonitoringCardName(e.target.value)}
                    placeholder="Enter custom monitoring card name"
                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                  />
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => {
              setIsAddMonitoringCardOpen(false);
              setSelectedMonitoringCardType("");
              setCustomMonitoringCardName("");
            }}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddMonitoringCard}
              disabled={!selectedMonitoringCardType || (selectedMonitoringCardType === "custom" && !customMonitoringCardName.trim())}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              Add Card
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add App Mapping Dialog */}
      <Dialog open={isNewMappingOpen} onOpenChange={setIsNewMappingOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add App Mapping</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Create a new mapping between an application and OKTA security group
            </p>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="appName" className="text-sm font-medium">
                Application Name
              </label>
              <input
                id="appName"
                type="text"
                placeholder=""
                value={newMapping.appName}
                onChange={(e) => setNewMapping({ ...newMapping, appName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                OKTA Group Name(s)
              </label>
              <div className="space-y-2">
                {newMapping.oktaGroups.map((group, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={addGroupInput}
                      className="text-gray-400 hover:text-blue-500 focus:outline-none p-1"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <div className="flex-1">
                      <input
                        type="text"
                        placeholder=""
                        value={group}
                        onChange={(e) => updateGroupInput(index, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    {newMapping.oktaGroups.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeGroupInput(index)}
                        className="text-gray-400 hover:text-red-500 focus:outline-none p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium">
                Description (Optional)
              </label>
              <input
                id="description"
                type="text"
                placeholder=""
                value={newMapping.description}
                onChange={(e) => setNewMapping({ ...newMapping, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setIsNewMappingOpen(false);
                setNewMapping({ appName: "", oktaGroups: [""], description: "" });
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={() => createAppMappingMutation.mutate(newMapping)}
              disabled={!newMapping.appName.trim() || !newMapping.oktaGroups.some(g => g.trim()) || createAppMappingMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {createAppMappingMutation.isPending ? "Creating..." : "Create Mapping"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>



      {/* Create User Modal */}
      {isCreateUserModalOpen && (
        <Suspense fallback={<div className="fixed inset-0 bg-black/50 flex items-center justify-center"><div className="animate-pulse bg-white dark:bg-gray-800 rounded-lg w-96 h-64"></div></div>}>
          <CreateUserModal 
            open={isCreateUserModalOpen}
            onClose={() => setIsCreateUserModalOpen(false)}
            onSuccess={() => {
              setIsCreateUserModalOpen(false);
              // Could add success notification here
            }}
          />
        </Suspense>
      )}
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