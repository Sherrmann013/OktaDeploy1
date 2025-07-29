import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Admin() {
  const [activeTab, setActiveTab] = useState("site-access");

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
            <CardHeader>
              <CardTitle>Site Access Management</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Configure site access permissions and authentication settings.
              </p>
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