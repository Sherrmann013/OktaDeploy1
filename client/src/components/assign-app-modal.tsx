import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getQueryFn, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Application {
  id: string;
  name: string;
  label?: string;
  status: string;
  description?: string;
}

interface AssignAppModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  userApps: Application[];
}

export default function AssignAppModal({ open, onClose, userId, userApps }: AssignAppModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedApps, setSelectedApps] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get all available applications
  const { data: allApplications = [], isLoading } = useQuery({
    queryKey: ["/api/applications"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: open,
    onSuccess: (data) => {
      console.log('All Applications:', data);
      console.log('First few app IDs:', data.slice(0, 5).map((app: any) => ({ id: app.id, name: app.name || app.label })));
    }
  });

  // Initialize selected apps when modal opens
  useEffect(() => {
    if (open) {
      const currentAppIds = new Set(userApps.map(app => app.id));
      console.log('User Apps:', userApps);
      console.log('Current App IDs:', currentAppIds);
      setSelectedApps(currentAppIds);
    }
  }, [open, userApps]);

  // Filter and sort applications alphabetically
  const filteredApplications = allApplications
    .filter((app: Application) => {
      const appName = app.label || app.name || '';
      return appName.toLowerCase().includes(searchTerm.toLowerCase());
    })
    .sort((a: Application, b: Application) => {
      const nameA = (a.label || a.name || '').toLowerCase();
      const nameB = (b.label || b.name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });

  // Handle checkbox change
  const handleAppToggle = (appId: string) => {
    const newSelected = new Set(selectedApps);
    if (newSelected.has(appId)) {
      newSelected.delete(appId);
    } else {
      newSelected.add(appId);
    }
    setSelectedApps(newSelected);
  };

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      // For now, we'll just log the changes and show a success message
      // Later this will integrate with OKTA group assignment
      const currentAppIds = new Set(userApps.map(app => app.id));
      const appsToAdd = Array.from(selectedApps).filter(id => !currentAppIds.has(id));
      const appsToRemove = Array.from(currentAppIds).filter(id => !selectedApps.has(id));
      
      console.log('Apps to add:', appsToAdd);
      console.log('Apps to remove:', appsToRemove);
      
      // TODO: Implement actual OKTA group assignment API calls
      return { appsToAdd, appsToRemove };
    },
    onSuccess: () => {
      toast({
        title: "Applications Updated",
        description: "User application assignments have been updated.",
      });
      // Refresh user applications
      queryClient.invalidateQueries({ queryKey: [`/api/users/${userId}/applications`] });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    saveMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Assign Applications</DialogTitle>
          <DialogDescription>
            Select applications to assign to this user. Checked applications are currently assigned.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col flex-1 min-h-0">
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search applications..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Applications List */}
          <div className="flex-1 overflow-y-auto border rounded-lg">
            {isLoading ? (
              <div className="p-4 text-center text-gray-500">Loading applications...</div>
            ) : filteredApplications.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                {searchTerm ? `No applications found matching "${searchTerm}"` : 'No applications available'}
              </div>
            ) : (
              <div className="space-y-1 p-2">
                {filteredApplications.map((app: Application) => (
                  <div key={app.id} className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg">
                    <Checkbox
                      id={app.id}
                      checked={selectedApps.has(app.id)}
                      onCheckedChange={() => handleAppToggle(app.id)}
                    />
                    <label htmlFor={app.id} className="flex-1 cursor-pointer">
                      <div className="font-medium">{app.label || app.name}</div>
                      {app.description && (
                        <div className="text-sm text-gray-500">{app.description}</div>
                      )}
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}