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

export default function Admin() {
  const [activeTab, setActiveTab] = useState("site-access");
  const [isNewUserOpen, setIsNewUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SiteUser | null>(null);
  const [newUser, setNewUser] = useState({
    name: "",
    username: "",
    accessLevel: ""
  });

  const queryClient = useQueryClient();

  // Fetch site access users from database
  const { data: siteUsers = [], isLoading } = useQuery<SiteUser[]>({
    queryKey: ["/api/site-access-users"],
    refetchInterval: 5000
  });

  // Create site access user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: { name: string; email: string; accessLevel: "standard" | "admin"; initials: string; color: string }) => {
      return apiRequest("/api/site-access-users", {
        method: "POST",
        body: JSON.stringify(userData)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/site-access-users"] });
      setIsNewUserOpen(false);
      setNewUser({ name: "", username: "", accessLevel: "" });
    }
  });

  // Update site access user mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({ id, userData }: { id: number; userData: { name: string; email: string; accessLevel: "standard" | "admin"; initials: string; color: string } }) => {
      return apiRequest(`/api/site-access-users/${id}`, {
        method: "PUT",
        body: JSON.stringify(userData)
      });
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
      return apiRequest(`/api/site-access-users/${id}`, {
        method: "DELETE"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/site-access-users"] });
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
                        onClick={handleAssignUser}
                        disabled={createUserMutation.isPending}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white"
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
            <CardHeader>
              <CardTitle>System Integrations</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Manage OKTA, KnowBe4, SentinelOne, and other service integrations.
              </p>
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
    </div>
  );
}