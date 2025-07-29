import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface SiteUser {
  id: string;
  name: string;
  email: string;
  accessLevel: "standard" | "admin";
  initials: string;
  color: string;
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

  // Initialize with existing users
  const [siteUsers, setSiteUsers] = useState<SiteUser[]>([
    {
      id: "1",
      name: "CW-Admin",
      email: "admin@mazetx.com",
      accessLevel: "admin",
      initials: "CW",
      color: "bg-blue-600"
    },
    {
      id: "2",
      name: "Emily Davis",
      email: "emily.davis@company.com",
      accessLevel: "standard",
      initials: "ED",
      color: "bg-green-600"
    },
    {
      id: "3",
      name: "Michael Wilson",
      email: "michael.wilson@company.com",
      accessLevel: "standard",
      initials: "MW",
      color: "bg-purple-600"
    },
    {
      id: "4",
      name: "Sarah Smith",
      email: "sarah.smith@company.com",
      accessLevel: "admin",
      initials: "SS",
      color: "bg-orange-600"
    },
    {
      id: "5",
      name: "David Johnson",
      email: "david.johnson@company.com",
      accessLevel: "standard",
      initials: "DJ",
      color: "bg-cyan-600"
    }
  ]);

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
      setSiteUsers(prev => prev.filter(u => u.id !== user.id));
    }
  };

  const handleAssignUser = () => {
    if (newUser.name && newUser.username && newUser.accessLevel) {
      const newSiteUser: SiteUser = {
        id: Date.now().toString(),
        name: newUser.name,
        email: newUser.username,
        accessLevel: newUser.accessLevel as "standard" | "admin",
        initials: getInitials(newUser.name),
        color: getRandomColor()
      };
      setSiteUsers(prev => [...prev, newSiteUser]);
      setIsNewUserOpen(false);
      setNewUser({ name: "", username: "", accessLevel: "" });
    }
  };

  const handleUpdateUser = () => {
    if (editingUser) {
      setSiteUsers(prev => prev.map(u => 
        u.id === editingUser.id ? editingUser : u
      ));
      setIsEditUserOpen(false);
      setEditingUser(null);
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
                      <Button variant="outline" onClick={() => setIsNewUserOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleAssignUser}>
                        Assign User
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
                      <Button onClick={handleUpdateUser}>
                        Update User
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <div></div>
              </div>
              
              <div className="space-y-4">
                {siteUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 ${user.color} rounded-full flex items-center justify-center text-white text-sm font-medium`}>
                        {user.initials}
                      </div>
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        user.accessLevel === "admin" 
                          ? "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200" 
                          : "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                      }`}>
                        {user.accessLevel === "admin" ? "Admin" : "Standard"}
                      </span>
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
                  </div>
                ))}
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