import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Edit, X, Settings, RefreshCw, Eye, EyeOff, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogoUploadModal } from "@/components/LogoUploadModal";
import { useToast } from "@/hooks/use-toast";
import { NewUserConfigSection } from "@/components/admin/new-user-config";
import { useLocation } from "wouter";

interface LayoutSectionProps {
  layoutTab: string;
  setLayoutTab: (tab: string) => void;
  isLogoUploadOpen: boolean;
  setIsLogoUploadOpen: (open: boolean) => void;
  selectedApps: string[];
  setSelectedApps: (apps: string[]) => void;
  appMappingsData: any;
  integrationsData: any;
  setEditingIntegration: (integration: any) => void;
  setIsConfigureIntegrationOpen: (open: boolean) => void;
  setIsAddDashboardCardOpen: (open: boolean) => void;
  setIsAddMonitoringCardOpen: (open: boolean) => void;
}

export function LayoutSection({
  layoutTab,
  setLayoutTab,
  isLogoUploadOpen,
  setIsLogoUploadOpen,
  selectedApps,
  setSelectedApps,
  appMappingsData,
  integrationsData,
  setEditingIntegration,
  setIsConfigureIntegrationOpen,
  setIsAddDashboardCardOpen,
  setIsAddMonitoringCardOpen
}: LayoutSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location] = useLocation();
  
  // Detect current client context from URL
  const currentClientId = location.startsWith('/client/') ? parseInt(location.split('/')[2]) : 1;
  
  const [draggedItem, setDraggedItem] = useState<number | null>(null);
  const [dragOverItem, setDragOverItem] = useState<number | null>(null);
  const [draggedMonitoringItem, setDraggedMonitoringItem] = useState<number | null>(null);
  const [dragOverMonitoringItem, setDragOverMonitoringItem] = useState<number | null>(null);

  // Fetch dashboard cards for current client - ONLY when Layout > Dashboard tab is active
  const dashboardCardsEndpoint = `/api/client/${currentClientId}/dashboard-cards`;
  const { data: dashboardCardsData, refetch: refetchDashboardCards, error: dashboardCardsError, isLoading: dashboardCardsLoading } = useQuery({
    queryKey: [dashboardCardsEndpoint],
    enabled: layoutTab === "dashboard", // Only load when dashboard tab is active
    staleTime: 10 * 60 * 1000, // 10 minutes - rarely changes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // Fetch monitoring cards - CLIENT-AWARE, ONLY when Layout > Monitoring tab is active
  const monitoringCardsEndpoint = `/api/client/${currentClientId}/monitoring-cards`;
  const { data: monitoringCardsData, refetch: refetchMonitoringCards, error: monitoringCardsError, isLoading: monitoringCardsLoading } = useQuery({
    queryKey: [monitoringCardsEndpoint],
    enabled: layoutTab === "monitoring", // Only load when monitoring tab is active
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
      setDashboardCards(dashboardCardsData as any[]);
    }
  }, [dashboardCardsData]);

  useEffect(() => {
    if (monitoringCardsData) {
      setMonitoringCards(monitoringCardsData as any[]);
    }
  }, [monitoringCardsData]);

  // Debug authentication issues
  useEffect(() => {
    if (dashboardCardsError) {
      // Try to refetch after a short delay if authentication failed
      if (dashboardCardsError.message?.includes('Unauthorized')) {
        setTimeout(() => {
          refetchDashboardCards();
        }, 2000);
      }
    }
  }, [dashboardCardsError, refetchDashboardCards]);

  useEffect(() => {
    if (monitoringCardsError) {
      // Try to refetch after a short delay if authentication failed
      if (monitoringCardsError.message?.includes('Unauthorized')) {
        setTimeout(() => {
          refetchMonitoringCards();
        }, 2000);
      }
    }
  }, [monitoringCardsError, refetchMonitoringCards]);

  // Trigger fetch when dashboard tab is selected
  useEffect(() => {
    if (layoutTab === "dashboard") {
      refetchDashboardCards();
    }
  }, [layoutTab, refetchDashboardCards]);

  // Trigger fetch when monitoring tab is selected
  useEffect(() => {
    if (layoutTab === "monitoring") {
      refetchMonitoringCards();
    }
  }, [layoutTab, refetchMonitoringCards]);

  // Get active company logo - CLIENT-SPECIFIC, ONLY when Layout > Logo tab is active
  const shouldFetchLogo = layoutTab === "logo" && Boolean(currentClientId);
  const { data: activeLogo, refetch: refetchActiveLogo } = useQuery({
    queryKey: [`/api/client/${currentClientId}/company-logos/active`],
    enabled: shouldFetchLogo,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Get current logo text setting - CLIENT-AWARE, ONLY when Layout > Logo tab is active
  const { data: logoTextSetting, refetch: refetchLogoTextSetting } = useQuery({
    queryKey: [`/api/client/${currentClientId}/layout-settings/logo_text`],
    enabled: shouldFetchLogo, // Only load when logo tab is active and we have a client
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Get logo background color setting - CLIENT-AWARE, ONLY when Layout > Logo tab is active
  const { data: logoBackgroundSetting, refetch: refetchLogoBackgroundSetting } = useQuery({
    queryKey: [`/api/client/${currentClientId}/layout-settings/logo_background_color`],
    enabled: shouldFetchLogo, // Only load when logo tab is active and we have a client
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Get logo text visibility setting - CLIENT-AWARE, ONLY when Layout > Logo tab is active
  const { data: logoTextVisibilitySetting, refetch: refetchLogoTextVisibilitySetting } = useQuery({
    queryKey: [`/api/client/${currentClientId}/layout-settings/logo_text_visible`],
    enabled: shouldFetchLogo, // Only load when logo tab is active and we have a client
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Local state for logo settings
  const [logoText, setLogoText] = useState("Powered by ClockWerk.it");
  const [logoBackgroundColor, setLogoBackgroundColor] = useState("#7c3aed");
  const [showLogoText, setShowLogoText] = useState(true);

  // Update local state when settings change
  useEffect(() => {
    if (logoTextSetting) {
      setLogoText((logoTextSetting as any)?.settingValue || "Powered by ClockWerk.it");
    }
  }, [logoTextSetting]);

  useEffect(() => {
    if (logoBackgroundSetting) {
      setLogoBackgroundColor((logoBackgroundSetting as any)?.settingValue || "#7c3aed");
    }
  }, [logoBackgroundSetting]);

  useEffect(() => {
    if (logoTextVisibilitySetting) {
      setShowLogoText((logoTextVisibilitySetting as any)?.settingValue === "true" || (logoTextVisibilitySetting as any)?.settingValue === true);
    }
  }, [logoTextVisibilitySetting]);

  // Mutations for logo settings
  const updateLogoTextMutation = useMutation({
    mutationFn: async (newText: string) => {
      const response = await apiRequest("POST", `/api/client/${currentClientId}/layout-settings`, {
        settingKey: "logo_text",
        settingValue: newText,
        settingType: "logo"
      });
      if (!response.ok) {
        throw new Error("Failed to update logo text");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Logo text updated successfully",
      });
      refetchLogoTextSetting();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update logo text",
        variant: "destructive",
      });
    },
  });

  const updateLogoBackgroundColorMutation = useMutation({
    mutationFn: async (newColor: string) => {
      const response = await apiRequest("POST", `/api/client/${currentClientId}/layout-settings`, {
        settingKey: "logo_background_color",
        settingValue: newColor,
        settingType: "logo"
      });
      if (!response.ok) {
        throw new Error("Failed to update logo background color");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success", 
        description: "Logo background color updated successfully",
      });
      refetchLogoBackgroundSetting();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update logo background color",
        variant: "destructive",
      });
    },
  });

  const updateLogoTextVisibilityMutation = useMutation({
    mutationFn: async (visible: boolean) => {
      const response = await apiRequest("POST", `/api/client/${currentClientId}/layout-settings`, {
        settingKey: "logo_text_visible",
        settingValue: visible.toString(),
        settingType: "logo"
      });
      if (!response.ok) {
        throw new Error("Failed to update logo text visibility");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `Logo text ${showLogoText ? 'shown' : 'hidden'} successfully`,
      });
      refetchLogoTextVisibilitySetting();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update logo text visibility",
        variant: "destructive",
      });
    },
  });

  // Mutation to create dashboard card directly
  const createDashboardCardMutation = useMutation({
    mutationFn: async (cardData: any) => {
      const endpoint = `/api/client/${currentClientId}/dashboard-cards`;
      const response = await apiRequest("POST", endpoint, cardData);
      if (!response.ok) {
        throw new Error("Failed to create dashboard card");
      }
      return response.json();
    },
    onSuccess: () => {
      refetchDashboardCards();
      toast({
        title: "Success",
        description: "Dashboard card added successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add dashboard card",
        variant: "destructive",
      });
    },
  });

  // Mutation to update dashboard card positions
  const updateCardPositionsMutation = useMutation({
    mutationFn: async (cards: any[]) => {
      // Use the detected client ID from URL context
      const response = await fetch(`/api/client/${currentClientId}/dashboard-cards/positions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cards }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update card positions: ${response.status} ${errorText}`);
      }
      const result = await response.json();
      return result;
    },
    onSuccess: () => {
      refetchDashboardCards();
    },
    onError: (error) => {
    },
  });

  // Mutation to update monitoring card positions
  const updateMonitoringCardPositionsMutation = useMutation({
    mutationFn: async (cards: any[]) => {
      const response = await fetch("/api/monitoring-cards/positions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cards }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update monitoring card positions: ${response.status} ${errorText}`);
      }
      const result = await response.json();
      return result;
    },
    onSuccess: () => {
      refetchMonitoringCards();
    },
    onError: (error) => {
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
    updateCardPositionsMutation.mutate(
      updatedCards.map(card => ({ id: card.id, position: card.position }))
    );
  };

  const removeDashboardCard = (cardId: number) => {
    setDashboardCards(cards => cards.filter(card => card.id !== cardId));
  };

  const addDashboardCard = (cardName: string, cardDescription: string) => {
    // For existing integrations, use their type. For custom cards, use 'custom' as type
    const integration = integrationsData?.find((i: any) => i.displayName === cardName);
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
      }
    }
  };

  const handleAddMonitoringCard = async () => {
    // Implementation for adding monitoring card
  };

  // Function to handle adding integration card directly from dropdown
  const handleAddIntegrationCard = (integrationType: string) => {
    const integration = integrationsData?.find((i: any) => i.name === integrationType);
    if (!integration) return;

    const cardData = {
      name: integration.displayName || integration.name,
      type: integrationType,
      description: `${integration.displayName || integration.name} integration card`,
      enabled: true,
      clientId: currentClientId,
      position: 999 // Will be adjusted by backend
    };

    createDashboardCardMutation.mutate(cardData);
  };

  // Helper functions
  const getIntegrationLogo = (integrationType: string) => {
    // Return appropriate logo based on integration type
    return <div className="w-6 h-6 bg-gray-300 rounded"></div>;
  };

  const mapCardTypeToIntegrationType = (cardType: string) => {
    return cardType;
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-8">

          {/* Layout Customization Tabs */}
          <div>
            <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
              <button 
                onClick={() => setLayoutTab("new-user")}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  layoutTab === "new-user" 
                    ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm" 
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                }`}
              >
                New User Template
              </button>
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
                  setLayoutTab("dashboard");
                  setTimeout(() => {
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
                  setLayoutTab("monitoring");
                  setTimeout(() => {
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
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        <div 
                          className="p-3 rounded-lg flex items-center justify-center"
                          style={{ 
                            backgroundColor: logoBackgroundColor === "transparent" ? "transparent" : logoBackgroundColor,
                            backgroundImage: logoBackgroundColor === "transparent" ? "linear-gradient(45deg, #f0f0f0 25%, transparent 25%), linear-gradient(-45deg, #f0f0f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f0f0f0 75%), linear-gradient(-45deg, transparent 75%, #f0f0f0 75%)" : "none",
                            backgroundSize: logoBackgroundColor === "transparent" ? "8px 8px" : "auto",
                            backgroundPosition: logoBackgroundColor === "transparent" ? "0 0, 0 4px, 4px -4px, -4px 0px" : "auto"
                          }}
                        >
                          {(activeLogo as any)?.logoData ? (
                            <img 
                              src={(activeLogo as any).logoData} 
                              alt="Company logo" 
                              className="max-h-12 w-auto object-contain"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-white/20 rounded flex items-center justify-center">
                              <span className="text-white text-xs">No Logo</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-3">
                        <Button 
                          onClick={() => setIsLogoUploadOpen(true)}
                          className="bg-blue-600 hover:bg-blue-700 text-white flex items-center"
                        >
                          <Settings className="w-4 h-4 mr-2" />
                          Manage Logos
                        </Button>
                        
                        {/* Background Color Section */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Background Color:
                          </label>
                          
                          {/* Option Selection */}
                          <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="logoBackground"
                                checked={logoBackgroundColor === "transparent"}
                                onChange={() => setLogoBackgroundColor("transparent")}
                                className="w-4 h-4 text-blue-600"
                              />
                              <span className="text-sm text-gray-700 dark:text-gray-300">
                                None/Transparent
                              </span>
                            </label>
                            
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="logoBackground"
                                checked={logoBackgroundColor !== "transparent"}
                                onChange={() => {
                                  if (logoBackgroundColor === "transparent") {
                                    setLogoBackgroundColor("#7c3aed");
                                  }
                                }}
                                className="w-4 h-4 text-blue-600"
                              />
                              <span className="text-sm text-gray-700 dark:text-gray-300">
                                Custom Color
                              </span>
                            </label>
                          </div>
                          
                          {/* Color Controls - only show when not transparent */}
                          {logoBackgroundColor !== "transparent" && (
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                id="logoBackgroundColor"
                                value={logoBackgroundColor}
                                onChange={(e) => setLogoBackgroundColor(e.target.value)}
                                className="w-8 h-8 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                              />
                              <Input
                                value={logoBackgroundColor}
                                onChange={(e) => setLogoBackgroundColor(e.target.value)}
                                placeholder="#7c3aed"
                                className="w-24 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                              />
                            </div>
                          )}
                          
                          {/* Update Button */}
                          <Button 
                            onClick={() => updateLogoBackgroundColorMutation.mutate(logoBackgroundColor)}
                            disabled={updateLogoBackgroundColorMutation.isPending || logoBackgroundColor === ((logoBackgroundSetting as any)?.settingValue || "#7c3aed")}
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            {updateLogoBackgroundColorMutation.isPending ? "Updating..." : "Update Background"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Logo Text Section */}
                  <div>
                    <h5 className="text-md font-medium mb-3">Logo Text</h5>
                    <div className="space-y-3">
                      {/* Show/Hide Toggle */}
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={showLogoText}
                            onChange={(e) => {
                              const newValue = e.target.checked;
                              setShowLogoText(newValue);
                              updateLogoTextVisibilityMutation.mutate(newValue);
                            }}
                            className="w-4 h-4 text-blue-600 rounded border border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                          />
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Show logo text in sidebar
                          </span>
                        </label>
                      </div>
                      
                      {/* Text Input - only show when text is enabled */}
                      {showLogoText && (
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
                      )}
                    </div>
                  </div>
                </div>
              )}

              {layoutTab === "dashboard" && (
                <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h4 className="text-lg font-semibold">Dashboard Layout</h4>
                    <div className="flex gap-2">
                      <Select onValueChange={(value) => handleAddIntegrationCard(value)}>
                        <SelectTrigger className="w-48 bg-blue-600 hover:bg-blue-700 text-white border-blue-600">
                          <div className="flex items-center">
                            <Plus className="w-4 h-4 mr-2" />
                            <SelectValue placeholder="Add Integration" />
                          </div>
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-gray-800 border">
                          {integrationsData?.length === 0 ? (
                            <div className="p-2 text-sm text-gray-500">No integrations available</div>
                          ) : integrationsData?.filter((integration: any) => integration.status === 'connected').length === 0 ? (
                            <div className="p-2 text-sm text-gray-500">No connected integrations found</div>
                          ) : (
                            integrationsData?.filter((integration: any) => integration.status === 'connected').map((integration: any) => (
                              <SelectItem key={integration.name} value={integration.name}>
                                {integration.displayName || integration.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                    Drag and drop cards to reorganize your dashboard. Select from active integrations to add new cards.
                  </p>

                  {/* Dashboard Grid Preview */}
                  {dashboardCardsError && (
                    <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg">
                      Error loading dashboard cards: {dashboardCardsError.message}. Please try reloading the page.
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
                                const integration = integrationsData.find((i: any) => i.name === card.type);
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
                <NewUserConfigSection
                  selectedApps={selectedApps}
                  setSelectedApps={setSelectedApps}
                  appMappingsData={appMappingsData}
                />
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
                      {[1, 2, 3, 4].map((i: number) => (
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
  );
}