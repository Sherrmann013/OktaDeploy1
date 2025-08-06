import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

export function SiteAccessSection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [isNewUserOpen, setIsNewUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SiteUser | null>(null);
  const [newUser, setNewUser] = useState({
    name: "",
    username: "",
    accessLevel: ""
  });

  const { data: siteUsers = [], isLoading } = useQuery<SiteUser[]>({
    queryKey: ["/api/site-access-users"],
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false,
  });

  const createUserMutation = useMutation({
    mutationFn: async (userData: { name: string; email: string; accessLevel: "standard" | "admin"; initials: string; color: string }) => {
      return apiRequest("/api/site-access-users", {
        method: "POST",
        body: userData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/site-access-users"] });
      setIsNewUserOpen(false);
      setNewUser({ name: "", username: "", accessLevel: "" });
      toast({
        title: "User created successfully",
        description: "The new user has been added to site access.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error creating user",
        description: error.message || "Failed to create user",
        variant: "destructive",
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, userData }: { id: number; userData: { name: string; email: string; accessLevel: "standard" | "admin"; initials: string; color: string } }) => {
      return apiRequest(`/api/site-access-users/${id}`, {
        method: "PUT",
        body: userData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/site-access-users"] });
      setIsEditUserOpen(false);
      setEditingUser(null);
      toast({
        title: "User updated successfully",
        description: "The user information has been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating user",
        description: error.message || "Failed to update user",
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/site-access-users/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/site-access-users"] });
      toast({
        title: "User deleted successfully",
        description: "The user has been removed from site access.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting user",
        description: error.message || "Failed to delete user",
        variant: "destructive",
      });
    },
  });

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const getRandomColor = () => {
    const colors = [
      "#3B82F6", // Blue
      "#10B981", // Green  
      "#F59E0B", // Yellow
      "#EF4444", // Red
      "#8B5CF6", // Purple
      "#F97316", // Orange
      "#06B6D4", // Cyan
      "#84CC16", // Lime
      "#EC4899", // Pink
      "#6366F1"  // Indigo
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  const handleAssignUser = async () => {
    if (!newUser.name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for the user",
        variant: "destructive",
      });
      return;
    }
    if (!newUser.username.trim()) {
      toast({
        title: "Username required",
        description: "Please enter a username for the user",
        variant: "destructive",
      });
      return;
    }
    if (!newUser.accessLevel) {
      toast({
        title: "Access level required",
        description: "Please select an access level",
        variant: "destructive",
      });
      return;
    }
    
    const userData = {
      name: newUser.name.trim(),
      email: newUser.username.trim(),
      accessLevel: newUser.accessLevel as "standard" | "admin",
      initials: getInitials(newUser.name.trim()),
      color: getRandomColor()
    };
    
    createUserMutation.mutate(userData);
  };

  const handleEditUser = (user: SiteUser) => {
    setEditingUser(user);
    setIsEditUserOpen(true);
  };

  const handleDeleteUser = (user: SiteUser) => {
    if (confirm(`Are you sure you want to delete ${user.name}? This action cannot be undone.`)) {
      deleteUserMutation.mutate(user.id);
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
                  onClick={() => {
                    setIsEditUserOpen(false);
                    setEditingUser(null);
                  }}
                  className="px-4 py-2"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleUpdateUser}
                  disabled={updateUserMutation.isPending}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                >
                  {updateUserMutation.isPending ? "Updating..." : "Update User"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
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
  );
}