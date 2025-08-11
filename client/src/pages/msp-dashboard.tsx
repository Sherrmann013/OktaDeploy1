import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Building2, ExternalLink, Edit2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ClientLogoDisplay } from "@/components/ClientLogoDisplay";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useMutation } from "@tanstack/react-query";

// Update the interface to match the new MSP schema
interface Client {
  id: number;
  name: string;
  description?: string | null;
  domain?: string | null;
  status: "ACTIVE" | "SUSPENDED" | "ARCHIVED";
  databaseUrl: string;
  databaseName: string;
  primaryContact?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  logoUrl?: string | null;
  timezone?: string | null;
  created: Date;
  lastUpdated: Date;
  // Additional display properties
  userCount?: number;
  lastActivity?: string;
  // New fields for edit form
  displayName?: string;
  companyName?: string;
  companyInitials?: string;
  identityProvider?: string;
  notes?: string;
}

export default function MSPDashboard() {
  const { toast } = useToast();
  const [isCreateClientOpen, setIsCreateClientOpen] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientDescription, setNewClientDescription] = useState("");
  const [selectedIdentityProvider, setSelectedIdentityProvider] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  
  // Edit client state
  const [isEditClientOpen, setIsEditClientOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editCompanyName, setEditCompanyName] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // Fetch clients for MSP user
  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    staleTime: 0, // Always fetch fresh data
    gcTime: 0, // Don't cache at all (v5 syntax)
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
  });

  // Debug clients data changes
  React.useEffect(() => {
    if (clients.length > 0) {
      console.log('📊 CLIENTS DATA UPDATED:', {
        clientCount: clients.length,
        clients: clients.map(c => ({ 
          id: c.id, 
          name: c.name, 
          displayName: c.displayName,
          companyName: c.companyName,
          companyInitials: c.companyInitials,
          identityProvider: c.identityProvider,
          notes: c.notes,
          rawClientData: c // Show the complete object
        })),
        timestamp: new Date().toISOString()
      });
    }
  }, [clients]);

  // Update client mutation
  const updateClientMutation = useMutation({
    mutationFn: async (updatedClient: { id: number; [key: string]: any }) => {
      const response = await apiRequest("PUT", `/api/clients/${updatedClient.id}`, updatedClient);
      if (!response.ok) {
        throw new Error('Failed to update client');
      }
      return response.json();
    },
    onSuccess: async (data) => {
      console.log('🟢 CLIENT UPDATE SUCCESS - UI DEBUGGING:', {
        updatedData: data,
        timestamp: new Date().toISOString()
      });
      
      // Force complete cache removal and refetch with detailed logging
      console.log('🔄 STEP 1: Removing queries from cache');
      queryClient.removeQueries({ queryKey: ["/api/clients"] });
      
      console.log('🔄 STEP 2: Invalidating queries');
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      
      console.log('🔄 STEP 3: Manually refetching queries');
      const refetchResult = await queryClient.refetchQueries({ queryKey: ["/api/clients"] });
      console.log('🔄 STEP 3 RESULT:', refetchResult);
      
      // Add a small delay to ensure state updates
      setTimeout(() => {
        console.log('🔄 STEP 4: Checking if UI will update...');
      }, 100);
      
      toast({
        title: "Client updated successfully", 
        description: "Client information has been updated.",
      });
      setIsEditClientOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating client",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete client mutation
  const deleteClientMutation = useMutation({
    mutationFn: async (clientId: number) => {
      const response = await apiRequest("DELETE", `/api/clients/${clientId}`, {});
      if (!response.ok) {
        throw new Error('Failed to delete client');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Client deleted successfully",
        description: "Client has been permanently deleted.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting client",
        description: error.message,
        variant: "destructive",
      });
    },
  });



  // Handle edit client
  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    setEditDisplayName(client.displayName || client.name || "");
    setEditCompanyName(client.companyName || client.name || "");
    setEditNotes(client.notes || "");
    setIsEditClientOpen(true);
  };

  // Handle save edited client
  const handleSaveEditedClient = () => {
    if (!editingClient) return;

    const updateData = {
      id: editingClient.id,
      displayName: editDisplayName,
      companyName: editCompanyName,
      notes: editNotes,
    };
    
    console.log('🔵 CLIENT UPDATE MUTATION START - UI DEBUGGING:', {
      updateData,
      editingClient: editingClient.id,
      timestamp: new Date().toISOString()
    });

    updateClientMutation.mutate(updateData);
  };

  // Handle delete client
  const handleDeleteClient = (clientId: number) => {
    deleteClientMutation.mutate(clientId);
  };

  const handleCreateClient = async () => {
    if (!newClientName.trim()) {
      toast({
        title: "Client name required",
        description: "Please enter a client name",
        variant: "destructive",
      });
      return;
    }

    if (!selectedIdentityProvider) {
      toast({
        title: "Identity provider required",
        description: "Please select an identity provider",
        variant: "destructive",
      });
      return;
    }

    if (!selectedTemplate) {
      toast({
        title: "Template required",
        description: "Please select a client template",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch('/api/clients/create-with-template', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newClientName,
          description: newClientDescription || null,
          identityProvider: selectedIdentityProvider,
          templateClientId: selectedTemplate,
          status: 'ACTIVE',
          databaseName: `client_${newClientName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`,
          databaseUrl: `postgresql://localhost:5432/client_${newClientName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create client');
      }

      const newClient = await response.json();
      
      toast({
        title: "Client created successfully",
        description: `${newClientName} has been created with ${selectedIdentityProvider} integration and template data.`,
      });
      
      // Refetch clients to update the list
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      
      setIsCreateClientOpen(false);
      setNewClientName("");
      setNewClientDescription("");
      setSelectedIdentityProvider("");
      setSelectedTemplate("");
    } catch (error) {
      console.error('Error creating client:', error);
      toast({
        title: "Error creating client",
        description: "Failed to create the new client. Please try again.",
        variant: "destructive",
      });
    }
  };



  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading clients...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                MSP Dashboard
              </h1>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Manage your client organizations and access their dashboards
              </p>
            </div>
            <Dialog open={isCreateClientOpen} onOpenChange={setIsCreateClientOpen}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Client
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Add New Client</DialogTitle>
                  <DialogDescription>
                    Create a new client organization with identity provider integration and template configuration.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="clientName">Client Name</Label>
                    <Input
                      id="clientName"
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      placeholder="Enter client organization name"
                      className="bg-white dark:bg-gray-800 border"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="clientDescription">Description (Optional)</Label>
                    <Textarea
                      id="clientDescription"
                      value={newClientDescription}
                      onChange={(e) => setNewClientDescription(e.target.value)}
                      placeholder="Brief description of the client organization"
                      className="bg-white dark:bg-gray-800 border"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="identityProvider">Identity Provider</Label>
                    <Select value={selectedIdentityProvider} onValueChange={setSelectedIdentityProvider}>
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
                  <div className="grid gap-2">
                    <Label htmlFor="template">Client Template</Label>
                    <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                      <SelectTrigger className="bg-white dark:bg-gray-800 border">
                        <SelectValue placeholder="Select template to copy from" />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-gray-800 border">
                        {clients.map((client) => (
                          <SelectItem key={client.id} value={client.id.toString()}>
                            {client.name} Template
                          </SelectItem>
                        ))}
                        <SelectItem value="default">Default Template</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      All settings, integrations, and configurations will be copied from the selected template.
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setIsCreateClientOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateClient}>
                    Create Client
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Client Grid */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {clients.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              No Clients Yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Get started by adding your first client organization.
            </p>
            <Button onClick={() => setIsCreateClientOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Client
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {clients.map((client) => (
              <Card key={client.id} className="hover:shadow-lg transition-shadow duration-200 group">
                <CardContent className="p-6">
                  {/* Logo and Name Section */}
                  <div className="flex items-center gap-4 mb-4 cursor-pointer" onClick={() => window.location.href = `/client/${client.id}`}>
                    <ClientLogoDisplay 
                      clientId={client.id} 
                      clientName={client.name}
                      className="w-12 h-12 flex-shrink-0"
                    />
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {client.displayName || client.name}
                      </h3>
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditClient(client);
                      }}
                      className="flex-1"
                    >
                      <Edit2 className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950"
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Client</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete <strong>{client.name}</strong>? This action cannot be undone and will permanently delete all client data including users, integrations, and settings.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => handleDeleteClient(client.id)}
                            className="bg-red-600 hover:bg-red-700 text-white"
                          >
                            Delete Client
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Edit Client Dialog */}
      <Dialog open={isEditClientOpen} onOpenChange={setIsEditClientOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
            <DialogDescription>
              Update client information and configuration.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="editDisplayName">Display Name</Label>
              <Input
                id="editDisplayName"
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
                placeholder="Display name for the client"
                className="bg-white dark:bg-gray-800 border"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editCompanyName">Company Name</Label>
              <Input
                id="editCompanyName"
                value={editCompanyName}
                onChange={(e) => setEditCompanyName(e.target.value)}
                placeholder="Official company name"
                className="bg-white dark:bg-gray-800 border"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="editNotes">Notes</Label>
              <Textarea
                id="editNotes"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Additional notes about this client"
                rows={3}
                className="bg-white dark:bg-gray-800 border"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsEditClientOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveEditedClient} 
              disabled={updateClientMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {updateClientMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}