import React from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth, AuthProvider } from "@/hooks/use-auth";
import SSOLayout from "@/components/sso-layout";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Home from "@/pages/home";
import Dashboard from "@/pages/dashboard";
import Users from "@/pages/users";
import UserDetail from "@/pages/user-detail";
import Groups from "@/pages/groups";
import Applications from "@/pages/applications";
import Security from "@/pages/security";
import Settings from "@/pages/settings";
import Admin from "@/pages/admin";
import MSPAdmin from "@/pages/msp-admin";
import MSPDashboard from "@/pages/msp-dashboard";
import NotFound from "@/pages/not-found";

function Router() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="*" component={Login} />
      </Switch>
    );
  }

  return (
    <SSOLayout>
      <Switch>
        <Route path="/msp" component={MSPDashboard} />
        <Route path="/msp/admin" component={MSPAdmin} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/users" component={Users} />
        <Route path="/users/:id" component={UserDetail} />
        <Route path="/groups" component={Groups} />
        <Route path="/applications" component={Applications} />
        <Route path="/security" component={Security} />
        <Route path="/settings" component={Settings} />
        <Route path="/admin" component={Admin} />
        <Route path="/client/:id/dashboard" component={Dashboard} />
        <Route path="/client/:id/users" component={Users} />
        <Route path="/client/:id/users/:userId" component={UserDetail} />
        <Route path="/client/:id/admin" component={Admin} />
        <Route path="/client/:id" component={Dashboard} />
        <Route path="/" component={() => { window.location.href = "/msp"; return null; }} />
        <Route component={NotFound} />
      </Switch>
    </SSOLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
