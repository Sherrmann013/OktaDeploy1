import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Shield, Database, Users } from "lucide-react";

export default function Admin() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Admin Panel</h1>
        <p className="text-muted-foreground mt-2">
          System administration and configuration settings.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <Settings className="h-5 w-5 mr-2" />
            <CardTitle>System Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Configure system-wide settings and preferences.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <Shield className="h-5 w-5 mr-2" />
            <CardTitle>Security Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Manage security policies and authentication settings.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <Database className="h-5 w-5 mr-2" />
            <CardTitle>Database Management</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Database administration and maintenance tools.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <Users className="h-5 w-5 mr-2" />
            <CardTitle>User Administration</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Advanced user management and bulk operations.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}