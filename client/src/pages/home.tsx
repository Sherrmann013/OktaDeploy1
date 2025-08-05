import React from "react";
import { useAuth } from "@/hooks/useAuth";
import { User } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, Users, Shield, Settings, BarChart3 } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  const { user } = useAuth();

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Admin Console
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.profileImageUrl} alt={user?.firstName || "User"} />
                  <AvatarFallback>
                    {user?.firstName?.[0]}{user?.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:block">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {user?.email}
                  </p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleLogout}
                className="flex items-center space-x-2"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Welcome back, {user?.firstName}
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Link href="/dashboard">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow border-0 shadow-md">
              <CardHeader className="text-center">
                <BarChart3 className="h-12 w-12 text-blue-600 mx-auto mb-2" />
                <CardTitle>Dashboard</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  View analytics and key metrics for your organization
                </CardDescription>
              </CardContent>
            </Card>
          </Link>

          <Link href="/users">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow border-0 shadow-md">
              <CardHeader className="text-center">
                <Users className="h-12 w-12 text-green-600 mx-auto mb-2" />
                <CardTitle>Users</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Create, update, and manage user accounts
                </CardDescription>
              </CardContent>
            </Card>
          </Link>

          <Link href="/security">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow border-0 shadow-md">
              <CardHeader className="text-center">
                <Shield className="h-12 w-12 text-red-600 mx-auto mb-2" />
                <CardTitle>Security</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Monitor security events and manage policies
                </CardDescription>
              </CardContent>
            </Card>
          </Link>

          <Link href="/settings">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow border-0 shadow-md">
              <CardHeader className="text-center">
                <Settings className="h-12 w-12 text-purple-600 mx-auto mb-2" />
                <CardTitle>Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Configure organization and system settings
                </CardDescription>
              </CardContent>
            </Card>
          </Link>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>
                Common administrative tasks
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/users?action=create">
                <Button variant="outline" className="w-full justify-start">
                  <Users className="h-4 w-4 mr-2" />
                  Create New User
                </Button>
              </Link>
              <Link href="/security">
                <Button variant="outline" className="w-full justify-start">
                  <Shield className="h-4 w-4 mr-2" />
                  View Security Events
                </Button>
              </Link>
              <Link href="/applications">
                <Button variant="outline" className="w-full justify-start">
                  <Settings className="h-4 w-4 mr-2" />
                  Manage Applications
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle>System Status</CardTitle>
              <CardDescription>
                Current system health and connectivity
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-300">Authentication Service</span>
                <div className="flex items-center space-x-2">
                  <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-green-600">Online</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-300">Directory Sync</span>
                <div className="flex items-center space-x-2">
                  <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-green-600">Connected</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-300">Security Monitoring</span>
                <div className="flex items-center space-x-2">
                  <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-green-600">Active</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}