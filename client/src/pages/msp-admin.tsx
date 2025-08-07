import React, { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Users, Shield, Settings, Activity, Search, Plus, Database, Wifi, WifiOff } from "lucide-react";

export default function MSPAdmin() {
  const { toast } = useToast();
  const [location] = useLocation();
  const [activeTab, setActiveTab] = useState("site-access");

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            MSP Administration
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Manage MSP-level settings and configurations
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <TabsTrigger value="site-access" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Site Access
            </TabsTrigger>
            <TabsTrigger value="connection" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Connection
            </TabsTrigger>
            <TabsTrigger value="layout" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Layout
            </TabsTrigger>
            <TabsTrigger value="audit-logs" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Audit Logs
            </TabsTrigger>
          </TabsList>

          {/* Site Access Tab */}
          <TabsContent value="site-access" className="space-y-6">
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  MSP Site Access Management
                </CardTitle>
                <CardDescription>
                  Manage MSP administrative users and their access permissions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <Input
                        placeholder="Search MSP users..."
                        className="pl-10 w-80 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600"
                      />
                    </div>
                  </div>
                  <Button className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Add MSP User
                  </Button>
                </div>

                <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Active</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">MSP Admin</TableCell>
                        <TableCell>admin@msp.com</TableCell>
                        <TableCell>
                          <Badge variant="secondary">Super Admin</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            Active
                          </Badge>
                        </TableCell>
                        <TableCell>Just now</TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm">Edit</Button>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Connection Tab */}
          <TabsContent value="connection" className="space-y-6">
            <div className="grid gap-6">
              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Database Connections
                  </CardTitle>
                  <CardDescription>
                    Monitor and manage MSP and client database connections
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid gap-4">
                      <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Wifi className="h-5 w-5 text-green-500" />
                          <div>
                            <p className="font-medium">MSP Database</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Primary MSP database connection</p>
                          </div>
                        </div>
                        <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          Connected
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Wifi className="h-5 w-5 text-green-500" />
                          <div>
                            <p className="font-medium">Client Databases</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">3 client databases connected</p>
                          </div>
                        </div>
                        <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          All Connected
                        </Badge>
                      </div>
                    </div>

                    <div className="mt-6">
                      <Button variant="outline">Test All Connections</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardHeader>
                  <CardTitle>External Integrations</CardTitle>
                  <CardDescription>
                    MSP-level external service connections
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Shield className="h-5 w-5 text-blue-500" />
                        <div>
                          <p className="font-medium">OKTA SSO</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Single Sign-On provider</p>
                        </div>
                      </div>
                      <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        Connected
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Layout Tab */}
          <TabsContent value="layout" className="space-y-6">
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  MSP Layout Settings
                </CardTitle>
                <CardDescription>
                  Configure MSP dashboard appearance and branding
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid gap-4">
                    <div>
                      <Label htmlFor="msp-name">MSP Name</Label>
                      <Input
                        id="msp-name"
                        placeholder="Enter MSP name"
                        className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600"
                      />
                    </div>

                    <div>
                      <Label htmlFor="msp-logo">MSP Logo</Label>
                      <div className="flex items-center gap-4 mt-2">
                        <div className="w-16 h-16 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center">
                          <Settings className="h-6 w-6 text-gray-400" />
                        </div>
                        <Button variant="outline">Upload Logo</Button>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="theme">Theme</Label>
                      <Select>
                        <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600">
                          <SelectValue placeholder="Select theme" />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600">
                          <SelectItem value="light">Light</SelectItem>
                          <SelectItem value="dark">Dark</SelectItem>
                          <SelectItem value="auto">Auto</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <Button>Save Layout Settings</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audit Logs Tab */}
          <TabsContent value="audit-logs" className="space-y-6">
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  MSP Audit Logs
                </CardTitle>
                <CardDescription>
                  Monitor MSP-level administrative activities and security events
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <Input
                        placeholder="Search audit logs..."
                        className="pl-10 w-80 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600"
                      />
                    </div>
                    <Select>
                      <SelectTrigger className="w-48 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600">
                        <SelectValue placeholder="Filter by action" />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600">
                        <SelectItem value="all">All Actions</SelectItem>
                        <SelectItem value="login">Login</SelectItem>
                        <SelectItem value="logout">Logout</SelectItem>
                        <SelectItem value="client-access">Client Access</SelectItem>
                        <SelectItem value="settings">Settings Change</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Timestamp</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>Resource</TableHead>
                          <TableHead>Details</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell>2025-01-07 01:57:10</TableCell>
                          <TableCell>admin@mazetx.com</TableCell>
                          <TableCell>
                            <Badge variant="outline">LOGIN</Badge>
                          </TableCell>
                          <TableCell>MSP Admin</TableCell>
                          <TableCell>Local admin login successful</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>2025-01-07 01:55:35</TableCell>
                          <TableCell>admin@mazetx.com</TableCell>
                          <TableCell>
                            <Badge variant="outline">CLIENT_ACCESS</Badge>
                          </TableCell>
                          <TableCell>Client 12</TableCell>
                          <TableCell>Accessed client dashboard</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}