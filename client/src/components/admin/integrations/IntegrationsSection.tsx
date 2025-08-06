import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, Settings, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

export function IntegrationsSection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [isConfigureIntegrationOpen, setIsConfigureIntegrationOpen] = useState(false);
  const [isNewIntegrationOpen, setIsNewIntegrationOpen] = useState(false);
  const [isDeleteIntegrationOpen, setIsDeleteIntegrationOpen] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<Integration | null>(null);
  const [integrationToDelete, setIntegrationToDelete] = useState<Integration | null>(null);
  const [selectedIntegrationType, setSelectedIntegrationType] = useState("");
  const [integrationSearchTerm, setIntegrationSearchTerm] = useState("");
  const [showIntegrationDropdown, setShowIntegrationDropdown] = useState(false);

  // Fetch integrations
  const { data: integrationsData = [], isLoading: integrationsLoading } = useQuery<Integration[]>({
    queryKey: ["/api/integrations"],
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Create integration mutation
  const createIntegrationMutation = useMutation({
    mutationFn: async (integrationData: { name: string; displayName: string; description: string; status: string; apiKeys: Record<string, string>; config: Record<string, any> }) => {
      const response = await fetch("/api/integrations", {
        method: "POST",
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
      setIsNewIntegrationOpen(false);
      setSelectedIntegrationType("");
      setIntegrationSearchTerm("");
      toast({
        title: "Integration added successfully",
        description: "The new integration has been created.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error creating integration",
        description: error.message || "Failed to create integration",
        variant: "destructive",
      });
    },
  });

  // Update integration mutation
  const updateIntegrationMutation = useMutation({
    mutationFn: async ({ id, integrationData }: { id: number; integrationData: { name: string; displayName: string; description: string; status: string; apiKeys: Record<string, string>; config: Record<string, any> } }) => {
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
      toast({
        title: "Integration updated successfully",
        description: "The integration has been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating integration",
        description: error.message || "Failed to update integration",
        variant: "destructive",
      });
    },
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
      setIsDeleteIntegrationOpen(false);
      setIntegrationToDelete(null);
      setIsConfigureIntegrationOpen(false);
      setEditingIntegration(null);
      toast({
        title: "Integration deleted successfully",
        description: "The integration has been removed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting integration",
        description: error.message || "Failed to delete integration",
        variant: "destructive",
      });
    },
  });

  // Available integration types - moved EXACT AS IS from admin.tsx
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

  // Get integration logo component - moved EXACT AS IS from admin.tsx
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
              <path d="M12 9l-3 3 3 3 3-3-3-3z" fill="#0052CC"/>
            </svg>
          </div>
        );
      default:
        return (
          <div className={logoClass}>
            <Settings className="w-full h-full text-gray-600" />
          </div>
        );
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
    }
  };

  const handleCreateIntegration = () => {
    if (!selectedIntegrationType) {
      toast({
        title: "Integration type required",
        description: "Please select an integration type",
        variant: "destructive",
      });
      return;
    }

    const selectedType = availableIntegrationTypes.find(type => type.value === selectedIntegrationType);
    if (!selectedType) return;

    const integrationData = {
      name: selectedIntegrationType,
      displayName: selectedType.label,
      description: `${selectedType.label} integration`,
      status: "pending",
      apiKeys: {},
      config: {}
    };

    createIntegrationMutation.mutate(integrationData);
  };

  // Render API key fields - moved EXACT AS IS from admin.tsx
  const renderApiKeyFields = (integration: Integration | null) => {
    if (!integration) return null;

    switch (integration.name) {
      case 'okta':
        return (
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="oktaDomain">OKTA Domain</Label>
              <Input
                id="oktaDomain"
                type="text"
                value={integration.apiKeys.domain || ""}
                onChange={(e) => setEditingIntegration(prev => prev ? { 
                  ...prev, 
                  apiKeys: { ...prev.apiKeys, domain: e.target.value }
                } : null)}
                placeholder="your-domain.okta.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="oktaToken">API Token</Label>
              <Input
                id="oktaToken"
                type="password"
                value={integration.apiKeys.apiToken || ""}
                onChange={(e) => setEditingIntegration(prev => prev ? { 
                  ...prev, 
                  apiKeys: { ...prev.apiKeys, apiToken: e.target.value }
                } : null)}
                placeholder="Enter OKTA API token"
              />
            </div>
          </div>
        );
      case 'knowbe4':
        return (
          <div className="grid gap-2">
            <Label htmlFor="knowbe4ApiKey">API Key</Label>
            <Input
              id="knowbe4ApiKey"
              type="password"
              value={integration.apiKeys.apiKey || ""}
              onChange={(e) => setEditingIntegration(prev => prev ? { 
                ...prev, 
                apiKeys: { ...prev.apiKeys, apiKey: e.target.value }
              } : null)}
              placeholder="Enter KnowBe4 API key"
            />
          </div>
        );
      case 'sentinelone':
        return (
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="sentineloneUrl">Management URL</Label>
              <Input
                id="sentineloneUrl"
                type="text"
                value={integration.apiKeys.managementUrl || ""}
                onChange={(e) => setEditingIntegration(prev => prev ? { 
                  ...prev, 
                  apiKeys: { ...prev.apiKeys, managementUrl: e.target.value }
                } : null)}
                placeholder="https://your-tenant.sentinelone.net"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sentineloneToken">API Token</Label>
              <Input
                id="sentineloneToken"
                type="password"
                value={integration.apiKeys.apiToken || ""}
                onChange={(e) => setEditingIntegration(prev => prev ? { 
                  ...prev, 
                  apiKeys: { ...prev.apiKeys, apiToken: e.target.value }
                } : null)}
                placeholder="Enter SentinelOne API token"
              />
            </div>
          </div>
        );
      case 'jira':
        return (
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="jiraUrl">Jira URL</Label>
              <Input
                id="jiraUrl"
                type="text"
                value={integration.apiKeys.jiraUrl || ""}
                onChange={(e) => setEditingIntegration(prev => prev ? { 
                  ...prev, 
                  apiKeys: { ...prev.apiKeys, jiraUrl: e.target.value }
                } : null)}
                placeholder="https://your-domain.atlassian.net"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="jiraEmail">Email</Label>
              <Input
                id="jiraEmail"
                type="email"
                value={integration.apiKeys.email || ""}
                onChange={(e) => setEditingIntegration(prev => prev ? { 
                  ...prev, 
                  apiKeys: { ...prev.apiKeys, email: e.target.value }
                } : null)}
                placeholder="your-email@example.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="jiraToken">API Token</Label>
              <Input
                id="jiraToken"
                type="password"
                value={integration.apiKeys.apiToken || ""}
                onChange={(e) => setEditingIntegration(prev => prev ? { 
                  ...prev, 
                  apiKeys: { ...prev.apiKeys, apiToken: e.target.value }
                } : null)}
                placeholder="Enter Jira API token"
              />
            </div>
          </div>
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
    <>
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
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setIsConfigureIntegrationOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateIntegration} disabled={updateIntegrationMutation.isPending}>
                {updateIntegrationMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
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
              <Label htmlFor="integrationType">Integration Type</Label>
              <div className="relative">
                <Input
                  id="integrationType"
                  type="text"
                  value={integrationSearchTerm || (selectedIntegrationType ? availableIntegrationTypes.find(t => t.value === selectedIntegrationType)?.label : "")}
                  onChange={(e) => {
                    setIntegrationSearchTerm(e.target.value);
                    setShowIntegrationDropdown(true);
                  }}
                  onFocus={() => setShowIntegrationDropdown(true)}
                  placeholder="Search for integration type..."
                  className="pr-8"
                />
                {showIntegrationDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {availableIntegrationTypes
                      .filter(integration => 
                        integration.label.toLowerCase().includes(integrationSearchTerm.toLowerCase()) ||
                        integration.value.toLowerCase().includes(integrationSearchTerm.toLowerCase())
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
                      integration.label.toLowerCase().includes(integrationSearchTerm.toLowerCase()) ||
                      integration.value.toLowerCase().includes(integrationSearchTerm.toLowerCase())
                    ).length === 0 && (
                      <div className="p-3 text-gray-500 dark:text-gray-400">No integrations found</div>
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
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => {
              setIsNewIntegrationOpen(false);
              setSelectedIntegrationType("");
              setIntegrationSearchTerm("");
              setShowIntegrationDropdown(false);
            }}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateIntegration}
              disabled={createIntegrationMutation.isPending || !selectedIntegrationType}
            >
              {createIntegrationMutation.isPending ? "Adding..." : "Add Integration"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Integration Confirmation Dialog */}
      <Dialog open={isDeleteIntegrationOpen} onOpenChange={setIsDeleteIntegrationOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Integration</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {integrationToDelete?.displayName}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setIsDeleteIntegrationOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={confirmDeleteIntegration}
              disabled={deleteIntegrationMutation.isPending}
            >
              {deleteIntegrationMutation.isPending ? "Deleting..." : "Delete Integration"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}