# REAL WORKING COMPONENTS FROM YOUR PROJECT

## Problem Analysis
The current demo is using placeholder/skeleton components instead of your actual working code. Based on your screenshot and the real files I found, here are the EXACT working components:

## 1. REAL SIDEBAR (client/src/components/sidebar.tsx)
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

  // Close dropdown when clicking outside
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

  // OKTA sync mutation
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
                <img 
                  src="/maze-logo.png" 
                  alt="MAZE Logo" 
                  className="w-20 h-20 absolute inset-0 object-contain"
                  style={{
                    filter: 'invert(1)'
                  }}
                />
                <div 
                  className="w-20 h-20 absolute inset-0"
                  style={{
                    backgroundColor: '#f97316',
                    mixBlendMode: 'multiply'
                  }}
                />
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
      
      {/* User Profile and Controls at Bottom */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-center gap-3">
          {/* User Dropdown */}
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
          
          {/* Theme Toggle */}
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
```

## 2. REAL USER TABLE COMPONENT (client/src/components/user-table.tsx)
**The current implementation has a major issue - it's missing the actual table rendering with avatars and proper formatting. Here's the REAL implementation:**

```tsx
import React, { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit, Pause, Trash2, Play, ChevronLeft, ChevronRight, ArrowUpDown, FilterIcon, Calendar, Check, ChevronsUpDown, GripVertical } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import ConfirmationModal from "./confirmation-modal";
import type { User } from "@shared/schema";

// Column definitions for dynamic table rendering
const COLUMN_DEFINITIONS = {
  name: { label: 'Name', sortKey: 'firstName', hasFilter: false },
  login: { label: 'Login', sortKey: 'firstName', hasFilter: false },
  title: { label: 'Title', sortKey: 'title', hasFilter: false },
  department: { label: 'Department', sortKey: 'department', hasFilter: false },
  employeeType: { label: 'Employee Type', sortKey: 'employeeType', hasFilter: true },
  manager: { label: 'Manager', sortKey: 'manager', hasFilter: true },
  mobilePhone: { label: 'Mobile Phone', sortKey: 'mobilePhone', hasFilter: true },
  status: { label: 'Status', sortKey: 'status', hasFilter: true },
  disabled: { label: 'Disabled On', sortKey: 'lastUpdated', hasFilter: false },
  activated: { label: 'Account Created', sortKey: 'activated', hasFilter: true },
  lastLogin: { label: 'Last Login', sortKey: 'lastLogin', hasFilter: true },
  lastUpdated: { label: 'Last Updated', sortKey: 'lastUpdated', hasFilter: true },
  passwordChanged: { label: 'Password Changed', sortKey: 'passwordChanged', hasFilter: true },
};

interface ColumnConfig {
  id: string;
  visible: boolean;
  width?: number;
  order: number;
}

interface UserTableProps {
  users: User[];
  total: number;
  currentPage: number;
  totalPages: number;
  usersPerPage: number;
  isLoading: boolean;
  onUserClick: (userId: number) => void;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
  onRefresh?: () => void;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (column: string) => void;
  visibleColumns?: string[];
  columnConfig?: ColumnConfig[];
  onColumnReorder?: (columns: ColumnConfig[]) => void;
  filters?: {
    employeeType: string[];
    mobilePhone: string;
    manager: string;
    status: string[];
    lastLogin: string;
  };
  onFiltersChange?: (filters: { employeeType: string[]; mobilePhone: string; manager: string; status: string[]; lastLogin: string }) => void;
  getEmployeeTypeColor?: (employeeType: string) => string;
}

export default function UserTable({
  users,
  total,
  currentPage,
  totalPages,
  usersPerPage,
  isLoading,
  onUserClick,
  onPageChange,
  onPerPageChange,
  sortBy,
  sortOrder,
  onSort,
  visibleColumns = ['name', 'login', 'title', 'department', 'manager', 'employeeType', 'status'],
  columnConfig,
  onColumnReorder,
  filters,
  onFiltersChange,
  getEmployeeTypeColor,
}: UserTableProps) {
  const { toast } = useToast();
  const [confirmAction, setConfirmAction] = useState<{
    type: string;
    title: string;
    message: string;
    action: () => void;
  } | null>(null);

  // Generate user initials for avatars
  const getUserInitials = (user: User) => {
    const firstInitial = user.firstName?.charAt(0) || '';
    const lastInitial = user.lastName?.charAt(0) || '';
    return (firstInitial + lastInitial).toUpperCase() || 'U';
  };

  // Get status badge color
  const getStatusBadgeColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'ACTIVE': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'SUSPENDED': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'DEPROVISIONED': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  // Format date for display
  const formatDate = (date: string | null) => {
    if (!date) return '—';
    try {
      return format(new Date(date), 'MMM dd, yyyy');
    } catch {
      return '—';
    }
  };

  // Render table cell content based on column type
  const renderCellContent = (user: User, columnId: string) => {
    switch (columnId) {
      case 'name':
        return (
          <div className="flex items-center space-x-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-blue-600 text-white text-xs">
                {getUserInitials(user)}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium text-gray-900 dark:text-gray-100">
                {user.firstName} {user.lastName}
              </div>
            </div>
          </div>
        );
      case 'login':
        return <span className="text-gray-600 dark:text-gray-400">{user.login || '—'}</span>;
      case 'title':
        return <span className="text-gray-900 dark:text-gray-100">{user.title || '—'}</span>;
      case 'department':
        return <span className="text-gray-900 dark:text-gray-100">{user.department || '—'}</span>;
      case 'manager':
        return <span className="text-gray-900 dark:text-gray-100">{user.manager || '—'}</span>;
      case 'employeeType':
        return (
          <Badge className={getEmployeeTypeColor ? getEmployeeTypeColor(user.employeeType || '') : ''}>
            {user.employeeType || 'UNKNOWN'}
          </Badge>
        );
      case 'status':
        return (
          <Badge className={getStatusBadgeColor(user.status || '')}>
            {user.status || 'UNKNOWN'}
          </Badge>
        );
      case 'mobilePhone':
        return <span className="text-gray-900 dark:text-gray-100">{user.mobilePhone || '—'}</span>;
      case 'lastLogin':
        return <span className="text-gray-600 dark:text-gray-400">{formatDate(user.lastLogin)}</span>;
      case 'activated':
        return <span className="text-gray-600 dark:text-gray-400">{formatDate(user.created)}</span>;
      case 'lastUpdated':
        return <span className="text-gray-600 dark:text-gray-400">{formatDate(user.lastUpdated)}</span>;
      case 'passwordChanged':
        return <span className="text-gray-600 dark:text-gray-400">{formatDate(user.passwordChanged)}</span>;
      default:
        return <span>—</span>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-[200px]" />
                  <Skeleton className="h-4 w-[150px]" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 dark:bg-gray-800">
                {visibleColumns.map((columnId) => {
                  const column = COLUMN_DEFINITIONS[columnId as keyof typeof COLUMN_DEFINITIONS];
                  if (!column) return null;
                  
                  return (
                    <TableHead 
                      key={columnId}
                      className="text-center font-semibold text-gray-700 dark:text-gray-300"
                    >
                      <div className="flex items-center justify-center space-x-1">
                        <span>{column.label}</span>
                        {onSort && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0"
                            onClick={() => onSort(column.sortKey)}
                          >
                            <ArrowUpDown className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow 
                  key={user.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer user-table-row"
                  onClick={() => onUserClick(user.id)}
                >
                  {visibleColumns.map((columnId) => (
                    <TableCell key={columnId} className="text-center">
                      {renderCellContent(user, columnId)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing {Math.min((currentPage - 1) * usersPerPage + 1, total)} to{' '}
            {Math.min(currentPage * usersPerPage, total)} of {total} users
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Select value={usersPerPage.toString()} onValueChange={(value) => onPerPageChange(parseInt(value))}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 per page</SelectItem>
              <SelectItem value="25">25 per page</SelectItem>
              <SelectItem value="50">50 per page</SelectItem>
              <SelectItem value="100">100 per page</SelectItem>
            </SelectContent>
          </Select>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Page {currentPage} of {totalPages}
          </span>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        open={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => {
          if (confirmAction) {
            confirmAction.action();
            setConfirmAction(null);
          }
        }}
        title={confirmAction?.title || ""}
        message={confirmAction?.message || ""}
        variant={confirmAction?.type === "DELETE" ? "destructive" : "default"}
      />
    </div>
  );
}
```

## 3. REAL CREATE USER MODAL (client/src/components/create-user-modal.tsx)
The current one is just a placeholder. Here's the REAL working implementation:

```tsx
import { useState, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertUserSchema, type InsertUser, type User } from "@shared/schema";
import { X, Check, RefreshCw } from "lucide-react";

interface CreateUserModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateUserModal({ open, onClose, onSuccess }: CreateUserModalProps) {
  const { toast } = useToast();
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [managerSearch, setManagerSearch] = useState("");
  const [showManagerDropdown, setShowManagerDropdown] = useState(false);

  // Fetch existing users for manager dropdown
  const { data: usersData } = useQuery({
    queryKey: ["/api/users", "all"],
    queryFn: async () => {
      const response = await fetch('/api/users?limit=1000', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch users for manager selection');
      }
      
      return response.json();
    },
    enabled: open,
  });

  const availableManagers = usersData?.users || [];

  // Filter managers based on search input
  const filteredManagers = useMemo(() => {
    if (!managerSearch || managerSearch.length < 1) return [];
    
    const searchTerm = managerSearch.toLowerCase().trim();
    
    return availableManagers
      .filter((user: User) => {
        const firstName = user.firstName?.toLowerCase() || '';
        const lastName = user.lastName?.toLowerCase() || '';
        const email = user.email?.toLowerCase() || '';
        const title = user.title?.toLowerCase() || '';
        const department = user.department?.toLowerCase() || '';
        const fullName = `${firstName} ${lastName}`;
        
        return firstName.startsWith(searchTerm) ||
               firstName.includes(searchTerm) ||
               lastName.startsWith(searchTerm) ||
               fullName.includes(searchTerm) ||
               email.includes(searchTerm) ||
               title.includes(searchTerm) ||
               department.includes(searchTerm);
      })
      .sort((a: User, b: User) => {
        const aFirstName = a.firstName?.toLowerCase() || '';
        const bFirstName = b.firstName?.toLowerCase() || '';
        const aFullName = `${aFirstName} ${a.lastName?.toLowerCase() || ''}`;
        const bFullName = `${bFirstName} ${b.lastName?.toLowerCase() || ''}`;
        
        const aFirstStartsWithSearch = aFirstName.startsWith(managerSearch.toLowerCase());
        const bFirstStartsWithSearch = bFirstName.startsWith(managerSearch.toLowerCase());
        
        if (aFirstStartsWithSearch && !bFirstStartsWithSearch) return -1;
        if (bFirstStartsWithSearch && !aFirstStartsWithSearch) return 1;
        
        return aFullName.localeCompare(bFullName);
      })
      .slice(0, 15);
  }, [availableManagers, managerSearch]);

  const form = useForm<InsertUser>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      login: "",
      password: "",
      department: "",
      title: "",
      employeeType: "",
      managerId: undefined,
      status: "ACTIVE",
      groups: [],
      applications: [],
      sendActivationEmail: true,
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (userData: InsertUser) => {
      return apiRequest("POST", "/api/users", userData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Success",
        description: "User created successfully",
      });
      form.reset();
      setSelectedGroups([]);
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create user",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertUser) => {
    const userData = {
      ...data,
      groups: selectedGroups,
      applications: selectedApps,
    };
    createUserMutation.mutate(userData);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Personal Information */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter first name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter last name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email *</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="Enter email address" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="login"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Login Username *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter login username" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Work Information */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter job title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter department" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="employeeType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Employee Type *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select employee type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="EMPLOYEE">Employee</SelectItem>
                      <SelectItem value="CONTRACTOR">Contractor</SelectItem>
                      <SelectItem value="INTERN">Intern</SelectItem>
                      <SelectItem value="PART_TIME">Part Time</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-6 border-t">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={createUserMutation.isPending}>
                {createUserMutation.isPending && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                Create User
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

## Key Issues Found:

1. **Sidebar**: Current implementation doesn't match the purple gradient with MAZE logo
2. **User Table**: Missing proper avatar rendering and table formatting  
3. **Create User Modal**: Using placeholder instead of functional form
4. **Theme Integration**: Not properly implementing the dark theme variables
5. **Component Imports**: Using wrong or missing UI components

## Next Steps:
Replace the existing placeholder components with these REAL working implementations from your project.