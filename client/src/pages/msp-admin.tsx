import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Users, Shield, Settings, Activity, Search, Plus, Database, Wifi, WifiOff, Upload, Eye, EyeOff, Trash2, Image } from "lucide-react";
import { LogoUploadModal } from "@/components/LogoUploadModal";

export default function MSPAdmin() {
  const { toast } = useToast();
  const [location] = useLocation();
  const [activeTab, setActiveTab] = useState("site-access");
  const [layoutTab, setLayoutTab] = useState("logo");
  const [isLogoUploadOpen, setIsLogoUploadOpen] = useState(false);
  const queryClient = useQueryClient();

  // MSP logo queries - using global endpoints since this is MSP-level
  const { data: activeLogo, refetch: refetchActiveLogo } = useQuery({
    queryKey: ['/api/company-logos/active'],
    enabled: layoutTab === "logo",
    staleTime: 2 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const { data: logoTextSetting, refetch: refetchLogoTextSetting } = useQuery({
    queryKey: ['/api/layout-settings/logo_text'],
    enabled: layoutTab === "logo",
    staleTime: 2 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const { data: logoBackgroundSetting, refetch: refetchLogoBackgroundSetting } = useQuery({
    queryKey: ['/api/layout-settings/logo_background_color'],
    enabled: layoutTab === "logo",
    staleTime: 2 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const { data: logoTextVisibilitySetting, refetch: refetchLogoTextVisibilitySetting } = useQuery({
    queryKey: ['/api/layout-settings/logo_text_visible'],
    enabled: layoutTab === "logo",
    staleTime: 2 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Local state for logo settings
  const [logoText, setLogoText] = useState("Powered by ClockWerk.it");
  const [logoBackgroundColor, setLogoBackgroundColor] = useState("#7c3aed");
  const [showLogoText, setShowLogoText] = useState(true);

  // Update local state when settings change
  useEffect(() => {
    if (logoTextSetting) {
      setLogoText((logoTextSetting as any)?.settingValue || "Powered by ClockWerk.it");
    }
  }, [logoTextSetting]);

  useEffect(() => {
    if (logoBackgroundSetting) {
      setLogoBackgroundColor((logoBackgroundSetting as any)?.settingValue || "#7c3aed");
    }
  }, [logoBackgroundSetting]);

  useEffect(() => {
    if (logoTextVisibilitySetting) {
      setShowLogoText((logoTextVisibilitySetting as any)?.settingValue === "true" || (logoTextVisibilitySetting as any)?.settingValue === true);
    }
  }, [logoTextVisibilitySetting]);

  // Mutations for logo settings
  const updateLogoTextMutation = useMutation({
    mutationFn: async (newText: string) => {
      const response = await apiRequest("POST", "/api/layout-settings", {
        settingKey: "logo_text",
        settingValue: newText,
        settingType: "logo"
      });
      if (!response.ok) {
        throw new Error("Failed to update logo text");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Logo text updated successfully",
      });
      refetchLogoTextSetting();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update logo text",
        variant: "destructive",
      });
    },
  });

  const updateLogoBackgroundColorMutation = useMutation({
    mutationFn: async (newColor: string) => {
      const response = await apiRequest("POST", "/api/layout-settings", {
        settingKey: "logo_background_color",
        settingValue: newColor,
        settingType: "logo"
      });
      if (!response.ok) {
        throw new Error("Failed to update logo background color");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Logo background color updated successfully",
      });
      refetchLogoBackgroundSetting();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update logo background color",
        variant: "destructive",
      });
    },
  });

  const updateLogoTextVisibilityMutation = useMutation({
    mutationFn: async (isVisible: boolean) => {
      const response = await apiRequest("POST", "/api/layout-settings", {
        settingKey: "logo_text_visible",
        settingValue: isVisible.toString(),
        settingType: "logo"
      });
      if (!response.ok) {
        throw new Error("Failed to update logo text visibility");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Logo text visibility updated successfully",
      });
      refetchLogoTextVisibilitySetting();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update logo text visibility",
        variant: "destructive",
      });
    },
  });

  // Delete logo mutation
  const deleteLogoMutation = useMutation({
    mutationFn: async (logoId: number) => {
      const response = await apiRequest("DELETE", `/api/company-logos/${logoId}`);
      if (!response.ok) {
        throw new Error("Failed to delete logo");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Logo deleted successfully",
      });
      refetchActiveLogo();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete logo",
        variant: "destructive",
      });
    },
  });

  const handleLogoTextSave = () => {
    updateLogoTextMutation.mutate(logoText);
  };

  const handleLogoBackgroundColorSave = () => {
    updateLogoBackgroundColorMutation.mutate(logoBackgroundColor);
  };

  const handleLogoTextVisibilityToggle = () => {
    const newVisibility = !showLogoText;
    setShowLogoText(newVisibility);
    updateLogoTextVisibilityMutation.mutate(newVisibility);
  };

  const handleDeleteLogo = () => {
    if ((activeLogo as any)?.id) {
      deleteLogoMutation.mutate((activeLogo as any).id);
    }
  };

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
                <Tabs value={layoutTab} onValueChange={setLayoutTab} className="space-y-6">
                  <TabsList className="grid w-full grid-cols-1 bg-gray-100 dark:bg-gray-700">
                    <TabsTrigger value="logo" className="flex items-center gap-2">
                      <Image className="h-4 w-4" />
                      Logo
                    </TabsTrigger>
                  </TabsList>

                  {/* Logo Sub-Tab - EXACT COPY FROM CLIENT */}
                  <TabsContent value="logo" className="space-y-6">
                    <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-6">
                      <h4 className="text-lg font-semibold mb-6">Logo Management</h4>
                      
                      {/* Logo Display Section */}
                      <div className="space-y-6">
                        {/* Current Active Logo */}
                        <div>
                          <h5 className="text-md font-medium mb-3">Active Logo</h5>
                          <div className="flex items-center gap-4">
                            <div 
                              className="relative w-24 h-24 rounded-lg flex items-center justify-center border-2 border-gray-200 dark:border-gray-600"
                              style={{ 
                                backgroundColor: logoBackgroundColor === "transparent" ? "transparent" : logoBackgroundColor
                              }}
                            >
                              {(activeLogo as any)?.logoData ? (
                                <img 
                                  src={(activeLogo as any).logoData} 
                                  alt="Active Logo" 
                                  className="w-20 h-20 object-contain"
                                />
                              ) : (
                                <div className="text-gray-400 dark:text-gray-500 text-xs text-center">
                                  No Logo
                                </div>
                              )}
                            </div>
                            <div className="space-y-2">
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {(activeLogo as any)?.logoData ? "This logo appears in the sidebar" : "No logo currently active"}
                              </p>
                              {(activeLogo as any)?.logoData && (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={handleDeleteLogo}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete Current Logo
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Manage Logos Button */}
                        <Button 
                          onClick={() => setIsLogoUploadOpen(true)}
                          className="bg-orange-600 hover:bg-orange-700 text-white"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Manage Logos
                        </Button>
                        
                        {/* Background Color Section */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Background Color:
                          </label>
                          
                          {/* Option Selection */}
                          <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="logoBackground"
                                checked={logoBackgroundColor === "transparent"}
                                onChange={() => setLogoBackgroundColor("transparent")}
                                className="w-4 h-4 text-blue-600"
                              />
                              <span className="text-sm text-gray-700 dark:text-gray-300">
                                None/Transparent
                              </span>
                            </label>
                            
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="logoBackground"
                                checked={logoBackgroundColor !== "transparent"}
                                onChange={() => {
                                  if (logoBackgroundColor === "transparent") {
                                    setLogoBackgroundColor("#7c3aed");
                                  }
                                }}
                                className="w-4 h-4 text-blue-600"
                              />
                              <span className="text-sm text-gray-700 dark:text-gray-300">
                                Custom Color
                              </span>
                            </label>
                          </div>
                          
                          {/* Color Controls - only show when not transparent */}
                          {logoBackgroundColor !== "transparent" && (
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                id="logoBackgroundColor"
                                value={logoBackgroundColor}
                                onChange={(e) => setLogoBackgroundColor(e.target.value)}
                                className="w-8 h-8 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                              />
                              <Input
                                value={logoBackgroundColor}
                                onChange={(e) => setLogoBackgroundColor(e.target.value)}
                                placeholder="#7c3aed"
                                className="w-24 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                              />
                            </div>
                          )}
                          
                          {/* Update Button */}
                          <Button 
                            onClick={() => updateLogoBackgroundColorMutation.mutate(logoBackgroundColor)}
                            disabled={updateLogoBackgroundColorMutation.isPending || logoBackgroundColor === ((logoBackgroundSetting as any)?.settingValue || "#7c3aed")}
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            {updateLogoBackgroundColorMutation.isPending ? "Updating..." : "Update Background"}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Logo Text Section */}
                    <div>
                      <h5 className="text-md font-medium mb-3">Logo Text</h5>
                      <div className="space-y-3">
                        {/* Show/Hide Toggle */}
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={showLogoText}
                              onChange={(e) => {
                                const newValue = e.target.checked;
                                setShowLogoText(newValue);
                                updateLogoTextVisibilityMutation.mutate(newValue);
                              }}
                              className="w-4 h-4 text-blue-600 rounded border border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              Show logo text in sidebar
                            </span>
                          </label>
                        </div>
                        
                        {/* Text Input - only show when text is enabled */}
                        {showLogoText && (
                          <div className="flex items-center gap-3">
                            <Input
                              id="logoText"
                              value={logoText}
                              onChange={(e) => setLogoText(e.target.value)}
                              placeholder="Enter text to display under logo"
                              className="w-1/4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                            />
                            <Button 
                              onClick={() => updateLogoTextMutation.mutate(logoText)}
                              disabled={updateLogoTextMutation.isPending || logoText === ((logoTextSetting as any)?.settingValue || "Powered by ClockWerk.it")}
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              {updateLogoTextMutation.isPending ? "Updating..." : "Update Text"}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
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

      {/* Logo Upload Modal */}
      <LogoUploadModal 
        isOpen={isLogoUploadOpen}
        onClose={() => setIsLogoUploadOpen(false)}
        onUploadSuccess={() => {
          refetchActiveLogo();
          setIsLogoUploadOpen(false);
        }}
      />
    </div>
  );
}