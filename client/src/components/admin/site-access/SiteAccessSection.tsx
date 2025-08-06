import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Eye, EyeOff, Edit, Trash2, Settings } from "lucide-react";

interface SiteUser {
  id: number;
  name: string;
  email: string;
  accessLevel: "standard" | "admin";
  initials: string;
  color: string;
}

interface SiteAccessSectionProps {
  // Props passed from parent admin component if needed
}

export function SiteAccessSection({}: SiteAccessSectionProps) {
  const queryClient = useQueryClient();

  // State for dialogs and forms
  const [isNewUserOpen, setIsNewUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [isDeleteUserOpen, setIsDeleteUserOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<SiteUser | null>(null);
  const [editingUser, setEditingUser] = useState<SiteUser | null>(null);
  const [newUser, setNewUser] = useState({
    name: "",
    username: "",
    accessLevel: ""
  });

  // Fetch site access users
  const { data: siteUsers = [], isLoading } = useQuery<SiteUser[]>({
    queryKey: ["/api/site-access-users"],
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false,
  });

  // Helper functions
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

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: { name: string; email: string; accessLevel: "standard" | "admin"; initials: string; color: string }) => {
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
      queryClient.invalidateQueries({ queryKey: ["/api/site-access-users"] });
      setIsNewUserOpen(false);
      setNewUser({ name: "", username: "", accessLevel: "" });
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

  // Event handlers
  const handleEditUser = (user: SiteUser) => {
    setEditingUser(user);
    setIsEditUserOpen(true);
  };

  const handleDeleteUser = (user: SiteUser) => {
    setUserToDelete(user);
    setIsDeleteUserOpen(true);
  };

  const handleAssignUser = async () => {
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
    
    try {
      await createUserMutation.mutateAsync(userData);
    } catch (error) {
      // Error handling is done in the mutation
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

  const confirmDeleteUser = () => {
    if (userToDelete) {
      deleteUserMutation.mutate(userToDelete.id);
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
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => {
                  setIsNewUserOpen(false);
                  setNewUser({ name: "", username: "", accessLevel: "" });
                }}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleAssignUser}
                  disabled={createUserMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {createUserMutation.isPending ? "Assigning..." : "Assign User"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Users Table */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between p-3 border rounded-lg animate-pulse">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                    <div>
                      <div className="w-32 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                      <div className="w-24 h-3 bg-gray-200 dark:bg-gray-700 rounded mt-1"></div>
                    </div>
                  </div>
                  <div className="flex space-x-1">
                    <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {siteUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold"
                      style={{ backgroundColor: user.color }}
                    >
                      {user.initials}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">{user.name}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 capitalize">
                        {user.accessLevel} access
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditUser(user)}
                      className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteUser(user)}
                      className="text-red-600 hover:text-red-800 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Edit User Dialog */}
        <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription className="sr-only">
                Edit user details and access level
              </DialogDescription>
            </DialogHeader>
            {editingUser && (
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-name">Name</Label>
                  <Input
                    id="edit-name"
                    value={editingUser.name}
                    onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                    placeholder="Enter full name"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    value={editingUser.email}
                    onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                    placeholder="Enter email"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-access-level">Access Level</Label>
                  <Select 
                    value={editingUser.accessLevel} 
                    onValueChange={(value: "standard" | "admin") => setEditingUser({ ...editingUser, accessLevel: value })}
                  >
                    <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-50 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                      <SelectItem value="standard" className="focus:bg-gray-100 dark:focus:bg-gray-700">Standard</SelectItem>
                      <SelectItem value="admin" className="focus:bg-gray-100 dark:focus:bg-gray-700">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => {
                setIsEditUserOpen(false);
                setEditingUser(null);
              }}>
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

        {/* Delete User Confirmation Dialog */}
        <Dialog open={isDeleteUserOpen} onOpenChange={setIsDeleteUserOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Delete User</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete {userToDelete?.name}? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
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
                {deleteUserMutation.isPending ? "Deleting..." : "Delete User"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}