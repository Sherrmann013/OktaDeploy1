# EXACT CARBON COPY - COMPLETE REPLIT SETUP

## Critical Missing Configuration

### Updated vite.config.ts (REQUIRED FOR REPLIT)
```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  optimizeDeps: {
    exclude: ["lucide-react"],
  },
  build: {
    outDir: "dist/public",
    emptyOutDir: true,
  },
  server: {
    host: "0.0.0.0",
    hmr: {
      clientPort: 443,
    },
    allowedHosts: [
      ".replit.dev",
      ".repl.co",
    ],
  },
});
```

### Additional Required Files

#### tsconfig.node.json
```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler"
  },
  "include": ["vite.config.ts"]
}
```

#### .replit (Workflow Configuration)
```
run = "npm run dev"

[nix]
channel = "stable-24_05"

[deployment]
run = ["sh", "-c", "npm run dev"]

[[ports]]
localPort = 5000
externalPort = 80
```

### Complete UI Components Needed

#### client/src/components/ui/tooltip.tsx
```tsx
import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"

const TooltipProvider = TooltipPrimitive.Provider

const Tooltip = TooltipPrimitive.Root

const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className
    )}
    {...props}
  />
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
```

#### client/src/components/sso-layout.tsx
```tsx
import React from "react";
import { useAuth } from "@/hooks/useAuth";
import Sidebar from "@/components/sidebar";

interface SSOLayoutProps {
  children: React.ReactNode;
}

export default function SSOLayout({ children }: SSOLayoutProps) {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen bg-white dark:bg-gray-900">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900">
          {children}
        </main>
      </div>
    </div>
  );
}
```

#### client/src/components/sidebar.tsx
```tsx
import React from "react";
import { Link, useLocation } from "wouter";
import { Shield, Users, UsersRound, Grid3x3, Settings, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const navigation = [
  { name: "Users", href: "/users", icon: Users, current: true },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { user: currentUser } = useAuth();
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const { toast } = useToast();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const oktaSyncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/sync-okta");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employee-type-counts"] });
      toast({
        title: "Success",
        description: "OKTA users synchronized successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to sync OKTA users: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  return (
    <aside className="w-32 bg-white dark:bg-gray-800 shadow-md border-r border-gray-200 dark:border-gray-700 flex-shrink-0 flex flex-col">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-purple-600 dark:bg-purple-700 flex flex-col rounded-br-lg">
        <div className="text-center flex-1">
          <div className="relative inline-block mb-1">
            <div className="relative w-24 h-24 mx-auto rounded bg-purple-600 flex items-center justify-center">
              <div className="relative w-20 h-20">
                <div className="w-20 h-20 bg-white rounded-lg flex items-center justify-center">
                  <span className="text-2xl font-bold text-purple-600">M</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="text-[10px] text-white/80 leading-none mt-auto whitespace-nowrap -ml-1">Powered by ClockWerk.it</div>
      </div>
      
      <nav className="p-4 flex-1">
        <ul className="space-y-2">
          {navigation.map((item) => {
            const isActive = location === item.href || (item.href === "/" && location.startsWith("/users"));
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-center gap-3">
          <div className="relative" ref={dropdownRef}>
            <Button
              variant="ghost"
              className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center p-0 hover:bg-blue-700"
              onClick={() => setShowUserDropdown(!showUserDropdown)}
            >
              <span className="text-white text-sm font-medium">
                {currentUser?.firstName?.[0]}{currentUser?.lastName?.[0]}
              </span>
            </Button>
            {showUserDropdown && (
              <div className="absolute bottom-10 left-0 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
                <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                  <p className="font-medium text-gray-900 dark:text-gray-100">{currentUser?.firstName} {currentUser?.lastName}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{currentUser?.email}</p>
                </div>
                <div className="p-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      oktaSyncMutation.mutate();
                      setShowUserDropdown(false);
                    }}
                    disabled={oktaSyncMutation.isPending}
                    className="w-full border-orange-300 text-orange-700 hover:bg-orange-50"
                  >
                    <RotateCcw className={`w-4 h-4 mr-2 ${oktaSyncMutation.isPending ? 'animate-spin' : ''}`} />
                    Sync OKTA
                  </Button>
                </div>
              </div>
            )}
          </div>
          
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
```

#### client/src/components/theme-toggle.tsx
```tsx
import React from "react";
import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/hooks/use-theme"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      className="w-9 h-9 dark:border-none"
    >
      <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
```

#### client/src/pages/login.tsx
```tsx
import React, { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function Login() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("CW-Admin");
  const [password, setPassword] = useState("YellowDr@g0nFly");
  const { toast } = useToast();

  const loginMutation = useMutation({
    mutationFn: async (credentials: { username: string; password: string }) => {
      const response = await apiRequest("POST", "/api/login", credentials);
      return await response.json();
    },
    onSuccess: (user) => {
      queryClient.setQueryData(["/api/auth/user"], user);
      toast({
        title: "Login successful",
        description: "Welcome back!",
      });
      setLocation("/");
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (username && password && !loginMutation.isPending) {
      const timer = setTimeout(() => {
        loginMutation.mutate({ username, password });
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast({
        title: "Missing credentials",
        description: "Please enter both username and password",
        variant: "destructive",
      });
      return;
    }
    loginMutation.mutate({ username, password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Admin Login</CardTitle>
          <CardDescription>
            Sign in to access the OKTA Admin Dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                disabled={loginMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                disabled={loginMutation.isPending}
              />
            </div>
            <Button 
              type="submit" 
              className="w-full"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

This includes the critical missing Vite configuration for Replit and all required UI components.