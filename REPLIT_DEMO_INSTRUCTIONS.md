# EXACT REPLIT CONFIGURATION FIX

## The Missing Configuration Causing the Error

### CRITICAL: vite.config.ts (EXACTLY as needed for Replit)
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
    port: 5000,
    hmr: {
      clientPort: 443,
    },
    allowedHosts: [
      ".replit.dev",
      ".repl.co",
      "localhost",
    ],
  },
});
```

### REQUIRED: tsconfig.node.json
```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

### REQUIRED: .replit
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

### Missing Users Page Component

#### client/src/pages/users.tsx
```tsx
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User } from "@shared/schema";
import { Search, Filter, Users as UsersIcon } from "lucide-react";

export default function Users() {
  const [searchQuery, setSearchQuery] = useState("");
  const [employeeTypeFilter, setEmployeeTypeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const { data: usersData, isLoading } = useQuery({
    queryKey: ["/api/users", { search: searchQuery, employeeType: employeeTypeFilter, status: statusFilter }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (employeeTypeFilter) params.append('employeeType', employeeTypeFilter);
      if (statusFilter) params.append('status', statusFilter);
      
      const response = await fetch(`/api/users?${params}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      
      return response.json();
    },
  });

  const { data: employeeTypeCounts } = useQuery({
    queryKey: ["/api/employee-type-counts"],
    queryFn: async () => {
      const response = await fetch('/api/employee-type-counts', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch employee type counts');
      }
      
      return response.json();
    },
  });

  const users = usersData?.users || [];
  const total = usersData?.total || 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Active</Badge>;
      case 'SUSPENDED':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">Suspended</Badge>;
      case 'DEPROVISIONED':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">Deprovisioned</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100">{status}</Badge>;
    }
  };

  const getEmployeeTypeBadge = (type: string | null) => {
    if (!type) return null;
    
    const colors = {
      'EMPLOYEE': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
      'CONTRACTOR': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100',
      'INTERN': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100',
      'PART_TIME': 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100'
    };

    return (
      <Badge className={colors[type as keyof typeof colors] || colors.EMPLOYEE}>
        {type.replace('_', ' ')}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64"></div>
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <UsersIcon className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Users</h1>
            <p className="text-gray-600 dark:text-gray-400">{total} total users</p>
          </div>
        </div>
      </div>

      {/* Employee Type Counts */}
      {employeeTypeCounts && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(employeeTypeCounts).map(([type, count]) => (
            <Card key={type} className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{count as number}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {type.replace('_', ' ')}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="w-5 h-5" />
            <span>Filters</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={employeeTypeFilter} onValueChange={setEmployeeTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Employee Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Types</SelectItem>
                <SelectItem value="EMPLOYEE">Employee</SelectItem>
                <SelectItem value="CONTRACTOR">Contractor</SelectItem>
                <SelectItem value="INTERN">Intern</SelectItem>
                <SelectItem value="PART_TIME">Part Time</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Statuses</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="SUSPENDED">Suspended</SelectItem>
                <SelectItem value="DEPROVISIONED">Deprovisioned</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(searchQuery || employeeTypeFilter || statusFilter) && (
            <Button 
              variant="outline" 
              onClick={() => {
                setSearchQuery("");
                setEmployeeTypeFilter("");
                setStatusFilter("");
              }}
            >
              Clear Filters
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle>Users ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {users.map((user: User) => (
              <div key={user.id} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <div className="flex items-center space-x-4">
                  <Avatar>
                    <AvatarFallback className="bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300">
                      {user.firstName?.[0]}{user.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="font-medium text-gray-900 dark:text-gray-100">
                        {user.firstName} {user.lastName}
                      </h3>
                      {getStatusBadge(user.status)}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{user.email}</p>
                    {user.title && (
                      <p className="text-sm text-gray-500 dark:text-gray-500">{user.title}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="text-sm text-gray-600 dark:text-gray-400">{user.department}</div>
                    {user.manager && (
                      <div className="text-xs text-gray-500 dark:text-gray-500">Manager: {user.manager}</div>
                    )}
                  </div>
                  
                  {getEmployeeTypeBadge(user.employeeType)}
                </div>
              </div>
            ))}
          </div>

          {users.length === 0 && (
            <div className="text-center py-8">
              <UsersIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">No users found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

## Setup Instructions

1. Replace the `vite.config.ts` with the exact version above (includes `allowedHosts`)
2. Add the `tsconfig.node.json` file 
3. Add the `.replit` configuration file
4. Add the Users page component
5. Run `npm install` then `npm run dev`

This fixes the "host not allowed" error by adding the proper Replit domain configuration to Vite's `allowedHosts`.