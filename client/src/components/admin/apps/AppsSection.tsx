import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Plus, Edit, Trash2, X } from "lucide-react";
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

export function AppsSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location] = useLocation();
  
  // 🔥 CRITICAL: Detect current client context from URL for database isolation
  const currentClientId = location.startsWith('/client/') ? parseInt(location.split('/')[2]) : 1;
  
  const [isNewMappingOpen, setIsNewMappingOpen] = useState(false);
  const [newMapping, setNewMapping] = useState({ appName: "", oktaGroups: [""], description: "" });
  const [mappingToDelete, setMappingToDelete] = useState<AppMapping | null>(null);
  const [editingMapping, setEditingMapping] = useState<AppMapping | null>(null);
  const [isEditMappingOpen, setIsEditMappingOpen] = useState(false);
  const [editMappingData, setEditMappingData] = useState({ appName: "", oktaGroups: [""] });

  // Fetch app mappings from database - CLIENT-AWARE for database isolation
  const { data: appMappingsData = [], isLoading: appMappingsLoading } = useQuery<AppMapping[]>({
    queryKey: [`/api/client/${currentClientId}/app-mappings`],
    staleTime: 5 * 60 * 1000, // 5 minutes - app mappings change occasionally
    refetchOnWindowFocus: false,
  });

  // App mapping mutations
  const createAppMappingMutation = useMutation({
    mutationFn: async (mappingData: { appName: string; oktaGroups: string[]; description?: string }) => {
      // Create multiple mappings for each group
      const mappings = mappingData.oktaGroups.filter(group => group.trim()).map(oktaGroupName => ({
        appName: mappingData.appName,
        oktaGroupName: oktaGroupName.trim(),
        description: mappingData.description || null
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/client/${currentClientId}/app-mappings`] });
      setIsNewMappingOpen(false);
      setNewMapping({ appName: "", oktaGroups: [""], description: "" });
      toast({
        title: "App mapping(s) created successfully",
        description: "The new mapping(s) have been added.",
      });
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

  return (
    <>
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
              <label htmlFor="oktaGroups" className="text-sm font-medium">
                OKTA Group Name(s)
              </label>
              <div className="space-y-2">
                {newMapping.oktaGroups.map((group, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setNewMapping(prev => ({
                          ...prev,
                          oktaGroups: [...prev.oktaGroups, ""]
                        }));
                      }}
                      className="flex-shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                    <input
                      type="text"
                      value={group}
                      onChange={(e) => {
                        setNewMapping(prev => ({
                          ...prev,
                          oktaGroups: prev.oktaGroups.map((g, i) => i === index ? e.target.value : g)
                        }));
                      }}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 bg-white dark:bg-gray-800"
                    />
                    {newMapping.oktaGroups.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setNewMapping(prev => ({
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
            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium">
                Description (optional)
              </label>
              <textarea
                id="description"
                value={newMapping.description}
                onChange={(e) => setNewMapping(prev => ({ ...prev, description: e.target.value }))}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 bg-white dark:bg-gray-800"
                placeholder="Brief description of this mapping..."
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
              onClick={() => {
                if (newMapping.appName && newMapping.oktaGroups.some(g => g.trim())) {
                  createAppMappingMutation.mutate(newMapping);
                }
              }}
              disabled={createAppMappingMutation.isPending || !newMapping.appName || !newMapping.oktaGroups.some(g => g.trim())}
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
    </>
  );
}