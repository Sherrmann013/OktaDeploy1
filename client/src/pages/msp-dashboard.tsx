import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

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
}

export default function MSPDashboard() {
  const { toast } = useToast();
  const [isCreateClientOpen, setIsCreateClientOpen] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientDescription, setNewClientDescription] = useState("");

  // Fetch clients for MSP user
  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  const handleCreateClient = async () => {
    if (!newClientName.trim()) {
      toast({
        title: "Client name required",
        description: "Please enter a client name",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newClientName,
          description: newClientDescription || null,
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
        description: `${newClientName} has been added to your client list.`,
      });
      
      // Refetch clients to update the list
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      
      setIsCreateClientOpen(false);
      setNewClientName("");
      setNewClientDescription("");
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
                    Create a new client organization to manage through your MSP dashboard.
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
              <Card key={client.id} className="hover:shadow-lg transition-shadow duration-200 cursor-pointer group">
                <Link href={`/client/${client.id}/dashboard`}>
                  <CardContent className="p-6 text-center">
                    {/* Logo Section */}
                    <div className="mb-4 flex justify-center">
                      {client.logoUrl ? (
                        <img 
                          src={client.logoUrl} 
                          alt={`${client.name} logo`}
                          className="w-16 h-16 object-contain rounded-lg"
                        />
                      ) : (
                        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                          <Building2 className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                        </div>
                      )}
                    </div>
                    
                    {/* Client Name */}
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {client.name}
                    </h3>
                  </CardContent>
                </Link>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}