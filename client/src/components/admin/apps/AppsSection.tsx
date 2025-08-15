import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, X, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AppMapping {
  id: number;
  appName: string;
  oktaGroupName: string;
  description: string | null;
  status: "active" | "inactive";
  created: string;
  lastUpdated: string;
}

interface LayoutSetting {
  id: number;
  settingKey: string;
  settingValue: string;
  settingType: string;
  metadata: any;
  updatedBy: number | null;
  updatedAt: string;
}

export function AppsSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location] = useLocation();
  
  // 🔥 CRITICAL: Detect current client context from URL for database isolation
  const currentClientId = location.startsWith('/client/') ? parseInt(location.split('/')[2]) : 1;
  
  const [isNewMappingOpen, setIsNewMappingOpen] = useState(false);
  const [newMapping, setNewMapping] = useState({ appName: "", oktaGroupSuffix: "", description: "" });
  const [mappingToDelete, setMappingToDelete] = useState<AppMapping | null>(null);
  const [editingMapping, setEditingMapping] = useState<AppMapping | null>(null);
  const [isEditMappingOpen, setIsEditMappingOpen] = useState(false);
  const [editMappingData, setEditMappingData] = useState({ appName: "", oktaGroups: [""] });

  // Client configuration state
  const [isClientConfigOpen, setIsClientConfigOpen] = useState(false);
  const [clientInitials, setClientInitials] = useState("");
  const [identityProvider, setIdentityProvider] = useState("");
  const [serviceProvider, setServiceProvider] = useState("");

  // Fetch app mappings from database - CLIENT-AWARE for database isolation
  const { data: appMappingsData = [], isLoading: appMappingsLoading } = useQuery<AppMapping[]>({
    queryKey: [`/api/client/${currentClientId}/app-mappings`],
    staleTime: 5 * 60 * 1000, // 5 minutes - app mappings change occasionally
    refetchOnWindowFocus: false,
  });

  // Fetch client configuration from layout settings
  const { data: clientInitialsData } = useQuery<LayoutSetting>({
    queryKey: [`/api/client/${currentClientId}/layout-settings/client_initials`],
    staleTime: 5 * 60 * 1000,
  });

  const { data: identityProviderData } = useQuery<LayoutSetting>({
    queryKey: [`/api/client/${currentClientId}/layout-settings/identity_provider`],
    staleTime: 5 * 60 * 1000,
  });

  const { data: serviceProviderData } = useQuery<LayoutSetting>({
    queryKey: [`/api/client/${currentClientId}/layout-settings/service_provider`],
    staleTime: 5 * 60 * 1000,
  });

  // App mapping mutations
  const createAppMappingMutation = useMutation({
    mutationFn: async (mappingData: { appName: string; oktaGroupSuffix: string; description?: string }) => {
      // Create single mapping with description passed to OKTA group
      const clientInitials = clientInitialsData?.settingValue || 'XX';
      const fullGroupName = `${clientInitials}-SG-${mappingData.oktaGroupSuffix.trim()}`;
      const mapping = {
        appName: mappingData.appName,
        oktaGroupName: fullGroupName,
        description: mappingData.description || null // This will be used for OKTA group description
      };
      
      const response = await fetch(`/api/client/${currentClientId}/app-mappings/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          mappings: [mapping]
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/client/${currentClientId}/app-mappings`] });
      setIsNewMappingOpen(false);
      setNewMapping({ appName: "", oktaGroupSuffix: "", description: "" });
      
      // Check for errors and warnings in response
      if (data.errors && data.errors.length > 0) {
        const oktaError = data.errors.find((e: any) => e.type === 'oktaGroupCreationFailed');
        if (oktaError) {
          toast({
            title: "App mapping creation failed",
            description: `${oktaError.message}. Database entries were not created to maintain data integrity.`,
            variant: "destructive",
          });
        }
      } else if (data.warnings && data.warnings.length > 0) {
        const oktaWarning = data.warnings.find((w: any) => w.type === 'oktaIntegrationMissing');
        if (oktaWarning) {
          toast({
            title: "App mappings created with warnings",
            description: `Some mappings not saved: ${oktaWarning.message}`,
            variant: "destructive",
          });
        }
      } else if (data.successfulMappings > 0) {
        toast({
          title: "App mapping(s) created successfully",
          description: `${data.successfulMappings} mapping(s) added and OKTA groups created.`,
        });
      } else {
        toast({
          title: "No mappings created",
          description: "All mapping attempts failed. Please check OKTA integration and try again.",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating app mapping",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const updateAppMappingMutation = useMutation({
    mutationFn: async ({ id, mappingData }: { id: number; mappingData: { appName: string; oktaGroups: string[] } }) => {
      // Filter out empty groups
      const validGroups = mappingData.oktaGroups.filter(group => group.trim());
      if (validGroups.length === 0) {
        throw new Error('At least one OKTA group is required');
      }

      // If there's more than one group, we need to delete the original and create multiple new ones
      if (validGroups.length > 1) {
        // First delete the original - CLIENT-AWARE
        await fetch(`/api/client/${currentClientId}/app-mappings/${id}`, {
          method: 'DELETE',
          credentials: 'include'
        });
        
        // Then create new mappings for each group
        const mappings = validGroups.map(group => ({
          appName: mappingData.appName,
          oktaGroupName: group.trim(),
          description: null
        }));
        
        const response = await fetch(`/api/client/${currentClientId}/app-mappings/bulk`, {
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
      } else {
        // Single group - just update the existing mapping - CLIENT-AWARE
        const response = await fetch(`/api/client/${currentClientId}/app-mappings/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            appName: mappingData.appName,
            oktaGroupName: validGroups[0].trim(),
            description: null
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/client/${currentClientId}/app-mappings`] });
      setIsEditMappingOpen(false);
      setEditingMapping(null);
      setEditMappingData({ appName: "", oktaGroups: [""] });
      toast({
        title: "App mapping updated successfully",
        description: "The mapping has been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating app mapping",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const deleteAppMappingMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/client/${currentClientId}/app-mappings/${id}`, {
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
      queryClient.invalidateQueries({ queryKey: [`/api/client/${currentClientId}/app-mappings`] });
      setMappingToDelete(null);
      toast({
        title: "App mapping deleted successfully",
        description: "The mapping has been removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting app mapping",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Client configuration mutations
  const updateClientConfigMutation = useMutation({
    mutationFn: async ({ setting, value }: { setting: string; value: string }) => {
      console.log('🔧 CLIENT CONFIG SAVE START:', {
        endpoint: `/api/client/${currentClientId}/layout-settings/${setting}`,
        setting,
        value,
        currentClientId,
        timestamp: new Date().toISOString()
      });

      const response = await fetch(`/api/client/${currentClientId}/layout-settings/${setting}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          settingKey: setting,
          settingValue: value,
          settingType: 'text'
        })
      });

      console.log('🔧 CLIENT CONFIG RESPONSE:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ CLIENT CONFIG ERROR:', errorText);
        throw new Error(`Failed to update ${setting}: ${response.status} ${errorText}`);
      }
      
      // Check if response has content before parsing JSON
      const responseText = await response.text();
      console.log('📄 CLIENT CONFIG RAW RESPONSE:', responseText);
      
      let result;
      try {
        result = responseText ? JSON.parse(responseText) : {};
        console.log('✅ CLIENT CONFIG SUCCESS:', result);
      } catch (parseError) {
        console.log('❌ CLIENT CONFIG JSON PARSE ERROR:', parseError);
        console.log('❌ RESPONSE TEXT THAT FAILED TO PARSE:', responseText);
        throw new Error(`Invalid JSON response: ${responseText}`);
      }
      
      return result;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/client/${currentClientId}/layout-settings/${variables.setting}`] });
      toast({
        title: "Configuration updated",
        description: `${variables.setting === 'client_initials' ? 'Client Initials' : 
                      variables.setting === 'identity_provider' ? 'Identity Provider' : 
                      'Service Provider'} updated successfully.`,
      });
    },
    onError: (error: Error, variables) => {
      toast({
        title: "Update failed",
        description: `Failed to update ${variables.setting}: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  const handleSaveClientConfig = async () => {
    try {
      if (clientInitials !== (clientInitialsData?.settingValue || '')) {
        await updateClientConfigMutation.mutateAsync({
          setting: 'client_initials',
          value: clientInitials
        });
      }

      if (identityProvider !== (identityProviderData?.settingValue || '')) {
        await updateClientConfigMutation.mutateAsync({
          setting: 'identity_provider', 
          value: identityProvider
        });
      }

      if (serviceProvider !== (serviceProviderData?.settingValue || '')) {
        await updateClientConfigMutation.mutateAsync({
          setting: 'service_provider', 
          value: serviceProvider
        });
      }

      setIsClientConfigOpen(false);
    } catch (error) {
      // Error already handled by mutation onError
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

  const handleDeleteMapping = () => {
    if (mappingToDelete) {
      deleteAppMappingMutation.mutate(mappingToDelete.id);
    }
  };

  // Initialize client configuration state when data loads
  React.useEffect(() => {
    if (clientInitialsData?.settingValue && clientInitials === "") {
      setClientInitials(clientInitialsData.settingValue);
    }
  }, [clientInitialsData?.settingValue]);

  React.useEffect(() => {
    if (identityProviderData?.settingValue && identityProvider === "") {
      setIdentityProvider(identityProviderData.settingValue);
    }
  }, [identityProviderData?.settingValue]);

  React.useEffect(() => {
    if (serviceProviderData?.settingValue && serviceProvider === "") {
      setServiceProvider(serviceProviderData.settingValue);
    }
  }, [serviceProviderData?.settingValue]);

  return (
    <>
      {/* Client Configuration Card */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Client Configuration</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Configure client initials and identity provider settings
              </p>
            </div>
            <Button 
              variant="outline"
              onClick={() => {
                setClientInitials(clientInitialsData?.settingValue || '');
                setIdentityProvider(identityProviderData?.settingValue || '');
                setServiceProvider(serviceProviderData?.settingValue || '');
                setIsClientConfigOpen(true);
              }}
            >
              <Settings className="w-4 h-4 mr-2" />
              Configure
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Client Initials</Label>
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {clientInitialsData?.settingValue || 'Not configured'}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Identity Provider</Label>
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {identityProviderData?.settingValue || 'Not configured'}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Service Provider</Label>
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {serviceProviderData?.settingValue || 'Not configured'}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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
                onChange={(e) => setNewMapping(prev => ({ ...prev, appName: e.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 bg-white dark:bg-gray-800"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="oktaGroupSuffix" className="text-sm font-medium">
                OKTA Group Name
              </label>
              <div className="space-y-2">
                <div className="flex items-center border border-input rounded-md bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 bg-white dark:bg-gray-800">
                  {/* Non-editable prefix box */}
                  <div className="flex-shrink-0 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm font-medium border-r border-gray-300 dark:border-gray-600 rounded-l-md">
                    {clientInitialsData?.settingValue || 'XX'}-SG-
                  </div>
                  {/* Editable suffix input */}
                  <input
                    id="oktaGroupSuffix"
                    type="text"
                    value={newMapping.oktaGroupSuffix}
                    onChange={(e) => {
                      setNewMapping(prev => ({
                        ...prev,
                        oktaGroupSuffix: e.target.value
                      }));
                    }}
                    placeholder="[group name]"
                    className="flex-1 h-10 px-3 py-2 text-sm bg-transparent border-0 ring-0 focus:outline-none focus:ring-0"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium">
                Description (optional)
              </label>
              <textarea
                id="description"
                value={newMapping.description}
                onChange={(e) => setNewMapping(prev => ({ ...prev, description: e.target.value }))}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 bg-white dark:bg-gray-800"
                placeholder="Brief description of this mapping (will be used as OKTA group description)..."
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setIsNewMappingOpen(false);
                setNewMapping({ appName: "", oktaGroupSuffix: "", description: "" });
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (newMapping.appName && newMapping.oktaGroupSuffix.trim()) {
                  createAppMappingMutation.mutate(newMapping);
                }
              }}
              disabled={createAppMappingMutation.isPending || !newMapping.appName || !newMapping.oktaGroupSuffix.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {createAppMappingMutation.isPending ? "Creating..." : "Create Mapping"}
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

      {/* Client Configuration Dialog */}
      <Dialog open={isClientConfigOpen} onOpenChange={setIsClientConfigOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Client Configuration</DialogTitle>
            <DialogDescription>
              Configure client initials, identity provider, and service provider settings
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="clientInitials">Client Initials</Label>
              <Input
                id="clientInitials"
                value={clientInitials}
                onChange={(e) => setClientInitials(e.target.value)}
                placeholder="e.g., CW"
                className="bg-white dark:bg-gray-800 border"
              />
              <p className="text-xs text-muted-foreground">
                Used in OKTA group naming pattern: {clientInitials || '{initials}'}-ET-{'{employee_type}'}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="identityProvider">Identity Provider</Label>
              <Select value={identityProvider} onValueChange={setIdentityProvider}>
                <SelectTrigger className="bg-white dark:bg-gray-800 border">
                  <SelectValue placeholder="Select identity provider" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-800 border">
                  <SelectItem value="okta">OKTA</SelectItem>
                  <SelectItem value="azure_ad">Azure Active Directory</SelectItem>
                  <SelectItem value="google_workspace">Google Workspace</SelectItem>
                  <SelectItem value="local">Local Authentication</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="serviceProvider">Service Provider</Label>
              <Select value={serviceProvider} onValueChange={setServiceProvider}>
                <SelectTrigger className="bg-white dark:bg-gray-800 border">
                  <SelectValue placeholder="Select service provider" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-800 border">
                  <SelectItem value="Microsoft">Microsoft</SelectItem>
                  <SelectItem value="Google">Google</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button 
              variant="outline" 
              onClick={() => setIsClientConfigOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSaveClientConfig}
              disabled={updateClientConfigMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {updateClientConfigMutation.isPending ? "Saving..." : "Save Configuration"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}