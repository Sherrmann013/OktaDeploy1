import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";

export default function Admin() {
  const [activeTab, setActiveTab] = useState("site-access");
  const [isNewUserOpen, setIsNewUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "",
    username: "",
    description: "",
    accessLevel: ""
  });

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
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                          id="description"
                          value={newUser.description}
                          onChange={(e) => setNewUser({ ...newUser, description: e.target.value })}
                          placeholder="Enter user description"
                          rows={3}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="accessLevel">Access Level</Label>
                        <Select value={newUser.accessLevel} onValueChange={(value) => setNewUser({ ...newUser, accessLevel: value })}>
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Select access level" />
                          </SelectTrigger>
                          <SelectContent className="z-50">
                            <SelectItem value="standard">Standard</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setIsNewUserOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={() => {
                        // Handle user assignment here
                        console.log("Assigning user:", newUser);
                        setIsNewUserOpen(false);
                        setNewUser({ name: "", username: "", description: "", accessLevel: "" });
                      }}>
                        Assign User
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <div></div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                      CW
                    </div>
                    <div>
                      <p className="font-medium">CW-Admin</p>
                      <p className="text-sm text-muted-foreground">admin@mazetx.com</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="px-3 py-1 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-full text-sm font-medium">
                      Admin
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                      ED
                    </div>
                    <div>
                      <p className="font-medium">Emily Davis</p>
                      <p className="text-sm text-muted-foreground">emily.davis@company.com</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm font-medium">
                      Standard
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                      MW
                    </div>
                    <div>
                      <p className="font-medium">Michael Wilson</p>
                      <p className="text-sm text-muted-foreground">michael.wilson@company.com</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm font-medium">
                      Standard
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-orange-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                      SS
                    </div>
                    <div>
                      <p className="font-medium">Sarah Smith</p>
                      <p className="text-sm text-muted-foreground">sarah.smith@company.com</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="px-3 py-1 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-full text-sm font-medium">
                      Admin
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-cyan-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                      DJ
                    </div>
                    <div>
                      <p className="font-medium">David Johnson</p>
                      <p className="text-sm text-muted-foreground">david.johnson@company.com</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm font-medium">
                      Standard
                    </span>
                  </div>
                </div>
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