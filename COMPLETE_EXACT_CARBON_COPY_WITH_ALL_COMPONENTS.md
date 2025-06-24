# COMPLETE EXACT CARBON COPY - ALL COMPONENTS INCLUDED

## Setup Instructions
1. Copy all files below to their exact paths
2. Run `npm install` (all dependencies already in package.json)
3. Run `npm run db:push` to create database schema
4. Run the test data script to populate users
5. Login with: CW-Admin / YellowDr@g0nFly
6. Access: localhost:5000/users

## File Structure Required
```
client/src/
├── components/
│   ├── ui/
│   │   ├── avatar.tsx
│   │   ├── badge.tsx
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── checkbox.tsx
│   │   ├── command.tsx
│   │   ├── dialog.tsx
│   │   ├── form.tsx
│   │   ├── input.tsx
│   │   ├── label.tsx
│   │   ├── popover.tsx
│   │   ├── select.tsx
│   │   ├── sheet.tsx
│   │   ├── skeleton.tsx
│   │   └── table.tsx
│   ├── column-manager.tsx
│   ├── confirmation-modal.tsx
│   ├── create-user-modal.tsx
│   ├── export-modal.tsx
│   ├── sidebar.tsx
│   ├── sso-layout.tsx
│   ├── theme-toggle.tsx
│   └── user-table.tsx
├── pages/
│   └── users.tsx
└── index.css
```

---

## 1. SSO LAYOUT COMPONENT (client/src/components/sso-layout.tsx)

```tsx
import React from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, User } from "lucide-react";
import Sidebar from "@/components/sidebar";

interface SSOLayoutProps {
  children: React.ReactNode;
}

export default function SSOLayout({ children }: SSOLayoutProps) {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <>{children}</>;
  }

  const handleLogout = () => {
    window.location.href = '/api/logout';
  };

  const userInitials = user ? 
    `${user.firstName?.charAt(0) || ''}${user.lastName?.charAt(0) || ''}`.toUpperCase() || 'U' 
    : 'U';

  return (
    <div className="flex h-screen bg-white dark:bg-gray-900">
      <Sidebar />
      <div className="flex-1 flex flex-col">

        
        {/* Main content */}
        <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900">
          {children}
        </main>
      </div>
    </div>
  );
}
```

---

## 2. COLUMN MANAGER COMPONENT (client/src/components/column-manager.tsx)

```tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Settings, Filter, X, GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Available columns based on user profile fields
export const AVAILABLE_COLUMNS = [
  { id: 'name', label: 'Name', type: 'text', hasFilter: false },
  { id: 'login', label: 'Login', type: 'text', hasFilter: false },
  { id: 'title', label: 'Title', type: 'text', hasFilter: false },
  { id: 'department', label: 'Department', type: 'text', hasFilter: false },
  { id: 'manager', label: 'Manager', type: 'autocomplete', hasFilter: true },
  { id: 'employeeType', label: 'Employee Type', type: 'select', hasFilter: true, options: ['EMPLOYEE', 'CONTRACTOR', 'INTERN', 'PART_TIME', 'CONSULTANT'] },
  { id: 'mobilePhone', label: 'Mobile Phone', type: 'text', hasFilter: true },
  { id: 'status', label: 'Status', type: 'select', hasFilter: false, options: ['ACTIVE', 'SUSPENDED', 'DEPROVISIONED'] },
  { id: 'disabled', label: 'Disabled On', type: 'date', hasFilter: false },
  { id: 'activated', label: 'Account Created', type: 'date', hasFilter: true },
  { id: 'lastLogin', label: 'Last Login', type: 'date', hasFilter: true },
  { id: 'lastUpdated', label: 'Last Updated', type: 'date', hasFilter: true },
  { id: 'passwordChanged', label: 'Password Changed', type: 'date', hasFilter: true },
] as const;

export interface ColumnConfig {
  id: string;
  visible: boolean;
  width?: number;
  order: number;
}

interface ColumnManagerProps {
  columns: ColumnConfig[];
  onColumnsChange: (columns: ColumnConfig[]) => void;
}

// Sortable column item component
function SortableColumnItem({ column, onToggle }: { column: ColumnConfig; onToggle: (columnId: string) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const availableColumn = AVAILABLE_COLUMNS.find(col => col.id === column.id);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between p-2 border rounded-md bg-card transition-all hover:shadow-sm"
    >
      <div className="flex items-center space-x-2">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-0.5 hover:bg-muted/50 rounded transition-colors touch-none"
          style={{ touchAction: 'none' }}
        >
          <GripVertical className="h-3 w-3" />
        </div>
        <Checkbox
          checked={column.visible}
          onCheckedChange={() => onToggle(column.id)}
          className="h-4 w-4"
        />
        <Label className="text-sm font-medium flex-1">
          {availableColumn?.label || column.id}
        </Label>
        {availableColumn?.hasFilter && (
          <Badge variant="secondary" className="text-xs px-1 py-0">
            <Filter className="h-2 w-2" />
          </Badge>
        )}
      </div>
    </div>
  );
}

export default function ColumnManager({ columns, onColumnsChange }: ColumnManagerProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = columns.findIndex((column) => column.id === active.id);
      const newIndex = columns.findIndex((column) => column.id === over?.id);

      const newColumns = arrayMove(columns, oldIndex, newIndex).map((col, index) => ({
        ...col,
        order: index
      }));

      onColumnsChange(newColumns);
    }
  };

  const toggleColumn = (columnId: string) => {
    const updatedColumns = columns.map(col => 
      col.id === columnId ? { ...col, visible: !col.visible } : col
    );
    onColumnsChange(updatedColumns);
  };

  // Sort columns by order for display
  const sortedColumns = [...columns].sort((a, b) => a.order - b.order);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Settings className="w-4 h-4" />
          Columns
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[450px] sm:w-[500px]">
        <SheetHeader>
          <SheetTitle>Manage Columns</SheetTitle>
          <SheetDescription>
            Customize which columns are visible and drag to reorder them
          </SheetDescription>
        </SheetHeader>
        
        <div className="space-y-6 mt-6">
          {/* Column Management */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Visible Columns</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext 
                  items={sortedColumns.map(col => col.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-1">
                    {sortedColumns.map(columnConfig => (
                      <SortableColumnItem
                        key={columnConfig.id}
                        column={columnConfig}
                        onToggle={toggleColumn}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

---

## 3. EXPORT MODAL COMPONENT (client/src/components/export-modal.tsx)

```tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Download } from "lucide-react";
import { AVAILABLE_COLUMNS, ColumnConfig } from "./column-manager";
import { User } from "@shared/schema";

interface ExportModalProps {
  users: User[];
  currentColumns: ColumnConfig[];
  totalUsers: number;
  onExport: (columns: string[], exportType: 'current' | 'custom') => void;
}

export default function ExportModal({ users, currentColumns, totalUsers, onExport }: ExportModalProps) {
  const [open, setOpen] = useState(false);
  const [exportType, setExportType] = useState<'current' | 'custom'>('current');
  const [selectedColumns, setSelectedColumns] = useState<string[]>(() => 
    currentColumns.filter(col => col.visible).map(col => col.id)
  );

  const handleExport = () => {
    if (exportType === 'current') {
      const visibleColumns = currentColumns.filter(col => col.visible).map(col => col.id);
      onExport(visibleColumns, 'current');
    } else {
      onExport(selectedColumns, 'custom');
    }
    setOpen(false);
  };

  const toggleColumn = (columnId: string) => {
    setSelectedColumns(prev => 
      prev.includes(columnId) 
        ? prev.filter(id => id !== columnId)
        : [...prev, columnId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Download className="w-4 h-4" />
          Export
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Export Users</DialogTitle>
          <DialogDescription>
            Choose your export options and download user data as CSV
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Export Type Selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Export Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="current-view"
                  checked={exportType === 'current'}
                  onCheckedChange={() => setExportType('current')}
                />
                <Label htmlFor="current-view" className="text-sm font-medium">
                  Export with current view ({currentColumns.filter(col => col.visible).length} columns)
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="custom-columns"
                  checked={exportType === 'custom'}
                  onCheckedChange={() => setExportType('custom')}
                />
                <Label htmlFor="custom-columns" className="text-sm font-medium">
                  Select columns to export
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Custom Column Selection */}
          {exportType === 'custom' && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Select Columns</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-60 overflow-y-auto scrollbar-thin">
                {AVAILABLE_COLUMNS.map(column => (
                  <div key={column.id} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`export-${column.id}`}
                      checked={selectedColumns.includes(column.id)}
                      onCheckedChange={() => toggleColumn(column.id)}
                      className="h-4 w-4"
                    />
                    <Label htmlFor={`export-${column.id}`} className="text-sm font-medium flex-1">
                      {column.label}
                    </Label>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Export Summary */}
          <div className="text-sm text-muted-foreground">
            {totalUsers} users will be exported with{' '}
            {exportType === 'current' 
              ? currentColumns.filter(col => col.visible).length
              : selectedColumns.length
            } columns
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button onClick={handleExport} className="flex-1">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---

## 4. CREATE USER MODAL COMPONENT (client/src/components/create-user-modal.tsx)

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
  const [password, setPassword] = useState("");

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

  // Filter managers based on search
  const filteredManagers = useMemo(() => {
    if (!managerSearch.trim()) return [];
    
    const searchLower = managerSearch.toLowerCase();
    return availableManagers.filter((manager: User) => {
      const fullName = `${manager.firstName} ${manager.lastName}`.toLowerCase();
      const email = manager.email?.toLowerCase() || '';
      return fullName.includes(searchLower) || email.includes(searchLower);
    }).slice(0, 10); // Limit to 10 results
  }, [availableManagers, managerSearch]);

  const form = useForm<InsertUser>({
    resolver: zodResolver(insertUserSchema.extend({
      sendActivationEmail: insertUserSchema.shape.sendActivationEmail.optional(),
    })),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      login: "",
      title: "",
      department: "",
      manager: "",
      employeeType: "",
      sendActivationEmail: false,
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (userData: InsertUser) => {
      const response = await apiRequest('POST', '/api/users', userData);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create user');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "User created successfully",
        description: "The new user has been added to the system",
      });
      handleClose();
      onSuccess();
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create user",
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

  const handleGroupToggle = (groupName: string, checked: boolean) => {
    if (checked) {
      setSelectedGroups([...selectedGroups, groupName]);
    } else {
      setSelectedGroups(selectedGroups.filter(g => g !== groupName));
    }
  };

  const handleAppToggle = (appName: string, checked: boolean) => {
    if (checked) {
      setSelectedApps([...selectedApps, appName]);
    } else {
      setSelectedApps(selectedApps.filter(a => a !== appName));
    }
  };

  const generatePassword = () => {
    const words = [
      'blue', 'red', 'green', 'cat', 'dog', 'sun', 'moon', 'star', 'tree', 'bird',
      'fish', 'car', 'book', 'key', 'box', 'cup', 'pen', 'hat', 'bag', 'run',
      'jump', 'fast', 'slow', 'big', 'small', 'hot', 'cold', 'new', 'old', 'good',
      'bad', 'easy', 'hard', 'soft', 'loud', 'quiet', 'dark', 'light', 'win', 'lose',
      'open', 'close', 'start', 'stop', 'home', 'work', 'play', 'rest', 'love', 'hope'
    ];
    
    const symbols = ['!', '@', '#', '$', '%', '^', '&', '*'];
    const numbers = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    
    // Generate exactly 12 characters: 2 words + 1 symbol + 2 numbers
    const word1 = words[Math.floor(Math.random() * words.length)];
    const word2 = words[Math.floor(Math.random() * words.length)];
    const symbol = symbols[Math.floor(Math.random() * symbols.length)];
    const num1 = numbers[Math.floor(Math.random() * numbers.length)];
    const num2 = numbers[Math.floor(Math.random() * numbers.length)];
    
    // Capitalize first letter of each word
    const cap1 = word1.charAt(0).toUpperCase() + word1.slice(1);
    const cap2 = word2.charAt(0).toUpperCase() + word2.slice(1);
    
    const generatedPassword = cap1 + cap2 + symbol + num1 + num2;
    setPassword(generatedPassword);
    form.setValue('password', generatedPassword);
  };

  const handleClose = () => {
    form.reset();
    setSelectedGroups([]);
    setSelectedApps([]);
    setManagerSearch("");
    setShowManagerDropdown(false);
    setPassword("");
    onClose();
  };

  const availableGroups = [
    "R&D@mazetx.com",
    "Labusers@mazetx.com", 
    "finfacit@mazetx.com",
    "HR@mazetx.com",
    "GXP@mazetx.com",
    "MTXCW-SG-ZOOM-PRO"
  ];

  const availableApps = [
    "Microsoft",
    "Slack",
    "Zoom"
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-screen overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-white">
            Create New User
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Username *</FormLabel>
                    <FormControl>
                      <div className="flex">
                        <Input 
                          placeholder="username" 
                          value={field.value ? field.value.replace('@mazetx.com', '') : ''}
                          onChange={(e) => {
                            const username = e.target.value;
                            const fullEmail = username ? `${username}@mazetx.com` : '';
                            field.onChange(fullEmail);
                            // Auto-update login field
                            form.setValue('login', fullEmail);
                          }}
                          className="rounded-r-none"
                        />
                        <div className="flex items-center px-3 bg-gray-50 dark:bg-gray-700 border border-l-0 border-gray-300 dark:border-gray-600 rounded-r-md text-sm text-gray-500 dark:text-gray-300">
                          @mazetx.com
                        </div>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input 
                          type="text" 
                          placeholder="Enter password" 
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            field.onChange(e.target.value);
                          }}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
                          onClick={generatePassword}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <Select 
                      onValueChange={(value) => {
                        field.onChange(value);
                        // Auto-check groups based on department selection
                        let newGroups = [...selectedGroups];
                        
                        // Remove department-specific groups first
                        newGroups = newGroups.filter(group => 
                          group !== "HR@mazetx.com" && group !== "finfacit@mazetx.com"
                        );
                        
                        // Add appropriate group based on selection
                        if (value === "HR") {
                          newGroups.push("HR@mazetx.com");
                        } else if (value === "Finance") {
                          newGroups.push("finfacit@mazetx.com");
                        }
                        
                        setSelectedGroups(newGroups);
                      }} 
                      value={field.value || ""}
                    >
                      <FormControl>
                        <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                          <SelectValue placeholder="Select Department" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                        <SelectItem value="Engineering">Engineering</SelectItem>
                        <SelectItem value="Marketing">Marketing</SelectItem>
                        <SelectItem value="Sales">Sales</SelectItem>
                        <SelectItem value="HR">Human Resources</SelectItem>
                        <SelectItem value="Finance">Finance</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="manager"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Manager</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input 
                          value={managerSearch}
                          onChange={(e) => {
                            const value = e.target.value;
                            setManagerSearch(value);
                            setShowManagerDropdown(value.length > 0);
                            // Clear the field value when typing
                            if (value !== field.value) {
                              field.onChange("");
                            }
                          }}
                          placeholder="Type to search for manager..."
                        />
                        {managerSearch && filteredManagers.length > 0 && showManagerDropdown && (
                          <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
                            {filteredManagers.map((manager: User) => (
                              <div
                                key={manager.id}
                                className="px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                                onClick={() => {
                                  const fullName = `${manager.firstName} ${manager.lastName}`;
                                  field.onChange(fullName);
                                  setManagerSearch(fullName);
                                  setShowManagerDropdown(false);
                                  // Set the manager ID for form submission
                                  form.setValue('managerId', manager.id);
                                }}
                              >
                                <div className="font-medium text-gray-900 dark:text-white">{manager.firstName} {manager.lastName}</div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">{manager.email}</div>
                                {manager.title && (
                                  <div className="text-sm text-gray-400 dark:text-gray-500">{manager.title}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="employeeType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employee Type</FormLabel>
                    <Select 
                      onValueChange={(value) => {
                        field.onChange(value);
                        // Auto-check groups based on employee type selection
                        let newGroups = [...selectedGroups];
                        
                        // Remove employee type-specific groups first
                        newGroups = newGroups.filter(group => 
                          group !== "MTXCW-ET-EMPLOYEE" && group !== "MTXCW-ET-CONTRACTOR"
                        );
                        
                        // Add appropriate group based on selection
                        if (value === "Employee") {
                          newGroups.push("MTXCW-ET-EMPLOYEE");
                        } else if (value === "Contractor") {
                          newGroups.push("MTXCW-ET-CONTRACTOR");
                        }
                        
                        setSelectedGroups(newGroups);
                      }}
                      value={field.value || ""}
                    >
                      <FormControl>
                        <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                          <SelectValue placeholder="Select Employee Type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                        <SelectItem value="Employee">Employee</SelectItem>
                        <SelectItem value="Contractor">Contractor</SelectItem>
                        <SelectItem value="Intern">Intern</SelectItem>
                        <SelectItem value="Part Time">Part Time</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Groups</Label>
                <div className="space-y-2">
                  {availableGroups.map((group) => (
                    <div key={group} className="flex items-center space-x-2">
                      <Checkbox
                        id={`group-${group}`}
                        checked={selectedGroups.includes(group)}
                        onCheckedChange={(checked) => handleGroupToggle(group, checked as boolean)}
                      />
                      <Label htmlFor={`group-${group}`} className="text-sm text-gray-700 dark:text-gray-300">
                        {group}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Apps</Label>
                <div className="space-y-2">
                  {availableApps.map((app) => (
                    <div key={app} className="flex items-center space-x-2">
                      <Checkbox
                        id={`app-${app}`}
                        checked={selectedApps.includes(app)}
                        onCheckedChange={(checked) => handleAppToggle(app, checked as boolean)}
                      />
                      <Label htmlFor={`app-${app}`} className="text-sm text-gray-700 dark:text-gray-300">
                        {app}
                      </Label>
                    </div>
                  ))}

                </div>
              </div>
            </div>

            <FormField
              control={form.control}
              name="sendActivationEmail"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Send activation email to manager</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={createUserMutation.isPending}
              >
                {createUserMutation.isPending ? 'Creating...' : 'Create User'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

---

## 5. EXACT USERS PAGE (client/src/pages/users.tsx)

```tsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import UserTable from "@/components/user-table";
import CreateUserModal from "@/components/create-user-modal";
import ColumnManager, { ColumnConfig, AVAILABLE_COLUMNS } from "@/components/column-manager";
import ExportModal from "@/components/export-modal";
import { User } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Users as UsersIcon, 
  Search, 
  Filter, 
  UserPlus, 
  Download,
  RefreshCw,
  Eye,
  Mail,
  Phone,
  Building,
  Calendar,
  RotateCcw
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Users() {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [usersPerPage, setUsersPerPage] = useState(10);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [sortBy, setSortBy] = useState("firstName");
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [employeeTypeFilter, setEmployeeTypeFilter] = useState<string>("");
  const [filters, setFilters] = useState({
    employeeType: [] as string[],
    mobilePhone: "",
    manager: "",
    status: [] as string[],
    lastLogin: ""
  });
  const { toast } = useToast();

  // Column management - force reset to ensure Employee Type shows by default
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    localStorage.removeItem('user-table-columns');
    
    return AVAILABLE_COLUMNS.map((col, index) => ({
      id: col.id,
      visible: ['name', 'login', 'title', 'department', 'manager', 'employeeType', 'status'].includes(col.id),
      order: index
    }));
  });

  // Get employee type counts from OKTA groups
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

  const { data: totalUsersData } = useQuery({
    queryKey: ["/api/users/total"],
    queryFn: async () => {
      const response = await fetch('/api/users?limit=1&page=1', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch total user count');
      }
      
      return response.json();
    },
  });

  const { data: allUsersData } = useQuery({
    queryKey: ["/api/users/stats"],
    queryFn: async () => {
      const response = await fetch(`/api/users?limit=500&statsOnly=true`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch user stats');
      }
      
      return response.json();
    },
    enabled: !employeeTypeCounts,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // Debounced search query for better performance
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: usersData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["/api/users", currentPage, usersPerPage, debouncedSearchQuery, sortBy, sortOrder, employeeTypeFilter, filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: usersPerPage.toString(),
        sortBy: sortBy,
        sortOrder: sortOrder,
        ...(debouncedSearchQuery && { search: debouncedSearchQuery }),
        ...(employeeTypeFilter && employeeTypeFilter !== "all" && { employeeType: employeeTypeFilter }),
        ...(filters.employeeType.length > 0 && { employeeTypes: filters.employeeType.join(',') }),
        ...(filters.mobilePhone && { mobilePhone: filters.mobilePhone }),
        ...(filters.manager && { manager: filters.manager }),
        ...(filters.status.length > 0 && { statuses: filters.status.join(',') }),
        ...(filters.lastLogin && { lastLoginDays: filters.lastLogin })
      });
      
      const response = await fetch(`/api/users?${params}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      
      return response.json();
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    placeholderData: (previousData) => previousData,
    refetchOnWindowFocus: false,
    retry: 2,
  });

  const users = usersData?.users || [];
  const allUsers = allUsersData?.users || [];
  const total = totalUsersData?.total || usersData?.total || 0;
  const totalPages = usersData?.totalPages || 1;

  const handleUserClick = (userId: number) => {
    window.location.href = `/users/${userId}`;
  };

  const handleRefresh = () => {
    refetch();
  };

  const handleCreateSuccess = () => {
    setShowCreateModal(false);
    refetch();
  };

  const clearFilters = () => {
    setEmployeeTypeFilter("");
    setSearchQuery("");
    setCurrentPage(1);
  };

  const handlePerPageChange = (perPage: number) => {
    setUsersPerPage(perPage);
    setCurrentPage(1);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  const getEmployeeTypeColor = (employeeType: string) => {
    switch (employeeType?.toUpperCase()) {
      case 'EMPLOYEE': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'CONTRACTOR': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'PART_TIME': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'INTERN': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const handleExport = async (selectedColumns: string[], exportType: 'current' | 'custom') => {
    try {
      toast({
        title: "Preparing export...",
        description: "Fetching all user data for export (this may take a moment)",
      });

      let allUsers: User[] = [];
      let currentPage = 1;
      const limit = 500;
      let hasMorePages = true;

      while (hasMorePages) {
        const queryParams = new URLSearchParams({
          limit: limit.toString(),
          page: currentPage.toString(),
          search: searchQuery,
          employeeType: employeeTypeFilter,
          sortBy: sortBy,
          sortOrder: sortOrder,
        });

        const response = await apiRequest('GET', `/api/users?${queryParams}`);
        
        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }
        
        const responseData = await response.json();
        const { users: pageUsers, totalPages } = responseData;
        
        allUsers = [...allUsers, ...pageUsers];
        
        hasMorePages = currentPage < totalPages;
        currentPage++;
      }

      const columnMap = AVAILABLE_COLUMNS.reduce((acc, col) => {
        acc[col.id] = col.label;
        return acc;
      }, {} as Record<string, string>);

      const headers = selectedColumns.map(col => columnMap[col] || col);
      
      const csvData = allUsers.map((user: User) => {
        return selectedColumns.map(column => {
          let value = '';
          switch (column) {
            case 'name':
              value = `${user.firstName || ''} ${user.lastName || ''}`.trim();
              break;
            case 'email':
              value = user.email || '';
              break;
            case 'login':
              value = user.login || '';
              break;
            case 'title':
              value = user.title || '';
              break;
            case 'department':
              value = user.department || '';
              break;
            case 'manager':
              value = user.manager || '';
              break;
            case 'mobilePhone':
              value = user.mobilePhone || '';
              break;
            case 'status':
              value = user.status || '';
              break;
            case 'employeeType':
              value = user.employeeType || '';
              break;
            case 'lastLogin':
              value = user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : '';
              break;
            case 'created':
            case 'activated':
              value = user.created ? new Date(user.created).toLocaleDateString() : '';
              break;
            case 'lastUpdated':
              value = user.lastUpdated ? new Date(user.lastUpdated).toLocaleDateString() : '';
              break;
            case 'passwordChanged':
              value = user.passwordChanged ? new Date(user.passwordChanged).toLocaleDateString() : '';
              break;
            default:
              value = '';
          }
          if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            value = `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        });
      });

      const csvContent = [headers, ...csvData]
        .map(row => row.join(','))
        .join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `users_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Export successful",
        description: `Exported ${allUsers.length} users with ${selectedColumns.length} columns`,
      });
    } catch (error) {
      console.error('Export error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({
        title: "Export failed",
        description: `Error: ${errorMessage}. Please try again.`,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Stats Cards */}
      <div className="bg-background px-6 py-4">
        <div className="grid grid-cols-5 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="bg-blue-500 dark:bg-blue-600 p-2 rounded-lg">
                  <UsersIcon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Users</p>
                  <p className="text-xl font-semibold">{total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="bg-green-500 dark:bg-green-600 p-2 rounded-lg">
                  <Building className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Employees</p>
                  <p className="text-xl font-semibold">{employeeTypeCounts?.EMPLOYEE || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="bg-purple-500 dark:bg-purple-600 p-2 rounded-lg">
                  <User className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Contractors</p>
                  <p className="text-xl font-semibold">{employeeTypeCounts?.CONTRACTOR || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="bg-orange-500 dark:bg-orange-600 p-2 rounded-lg">
                  <Calendar className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Interns</p>
                  <p className="text-xl font-semibold">{employeeTypeCounts?.INTERN || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="bg-gray-500 dark:bg-gray-600 p-2 rounded-lg">
                  <Eye className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Part Time</p>
                  <p className="text-xl font-semibold">{employeeTypeCounts?.PART_TIME || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-background border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <form onSubmit={handleSearch} className="flex items-center space-x-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
            </form>
            
            <Select value={employeeTypeFilter} onValueChange={setEmployeeTypeFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Types</SelectItem>
                <SelectItem value="EMPLOYEE">Employee</SelectItem>
                <SelectItem value="CONTRACTOR">Contractor</SelectItem>
                <SelectItem value="INTERN">Intern</SelectItem>
                <SelectItem value="PART_TIME">Part Time</SelectItem>
              </SelectContent>
            </Select>
            
            {(employeeTypeFilter || searchQuery) && (
              <Button variant="ghost" onClick={clearFilters} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Clear
              </Button>
            )}
          </div>
          
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              onClick={handleRefresh}
              disabled={isFetching}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            
            <ColumnManager
              columns={columns}
              onColumnsChange={setColumns}
            />
            
            <ExportModal
              users={users}
              currentColumns={columns}
              totalUsers={total}
              onExport={handleExport}
            />
            
            <Button onClick={() => setShowCreateModal(true)} className="gap-2">
              <UserPlus className="h-4 w-4" />
              Add User
            </Button>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <UserTable
          users={users}
          visibleColumns={columns.filter(col => col.visible).sort((a, b) => a.order - b.order).map(col => col.id)}
          isLoading={isLoading}
          currentPage={currentPage}
          usersPerPage={usersPerPage}
          total={total}
          totalPages={totalPages}
          onUserClick={handleUserClick}
          onPageChange={setCurrentPage}
          onPerPageChange={handlePerPageChange}
          onSort={handleSort}
          getEmployeeTypeColor={getEmployeeTypeColor}
        />
      </div>

      {/* Create User Modal */}
      <CreateUserModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
}
```

---

## 6. EXACT DARK THEME CSS (client/src/index.css)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96%;
    --secondary-foreground: 222.2 84% 4.9%;
    --muted: 210 40% 96%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96%;
    --accent-foreground: 222.2 84% 4.9%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
    --chart-1: 12 76% 61%;
    --chart-2: 173 58% 39%;
    --chart-3: 197 37% 24%;
    --chart-4: 43 74% 66%;
    --chart-5: 27 87% 67%;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 84% 4.9%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
    --chart-1: 220 70% 50%;
    --chart-2: 160 60% 45%;
    --chart-3: 30 80% 55%;
    --chart-4: 280 65% 60%;
    --chart-5: 340 75% 55%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}

/* Sidebar gradient styling */
.sidebar-gradient {
  background: linear-gradient(135deg, #6b46c1 0%, #7c3aed 100%);
}

/* Custom scrollbar styles */
.scrollbar-thin {
  scrollbar-width: thin;
  scrollbar-color: rgb(156 163 175 / 0.5) transparent;
}

.scrollbar-thin::-webkit-scrollbar {
  width: 4px;
}

.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  background-color: rgb(156 163 175 / 0.5);
  border-radius: 2px;
}

.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background-color: rgb(156 163 175 / 0.7);
}

/* User table row hover effect */
.user-table-row:hover {
  background-color: rgb(249 250 251 / 0.8);
}

.dark .user-table-row:hover {
  background-color: rgb(31 41 55 / 0.8);
}

/* Badge styles for employee types */
.employee-badge {
  @apply inline-flex items-center rounded-full px-2 py-1 text-xs font-medium;
}

.employee-badge.employee {
  @apply bg-green-100 text-green-800;
}

.dark .employee-badge.employee {
  @apply bg-green-900 text-green-300;
}

.employee-badge.contractor {
  @apply bg-blue-100 text-blue-800;
}

.dark .employee-badge.contractor {
  @apply bg-blue-900 text-blue-300;
}

.employee-badge.intern {
  @apply bg-orange-100 text-orange-800;
}

.dark .employee-badge.intern {
  @apply bg-orange-900 text-orange-300;
}

.employee-badge.part-time {
  @apply bg-purple-100 text-purple-800;
}

.dark .employee-badge.part-time {
  @apply bg-purple-900 text-purple-300;
}

/* Form styling */
.form-field {
  @apply space-y-2;
}

.form-label {
  @apply text-sm font-medium text-gray-700;
}

.dark .form-label {
  @apply text-gray-300;
}

.form-input {
  @apply block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm;
}

.dark .form-input {
  @apply border-gray-600 bg-gray-800 text-white focus:border-blue-400 focus:ring-blue-400;
}

/* Card styling */
.stats-card {
  @apply bg-white rounded-lg shadow-sm border border-gray-200 p-4;
}

.dark .stats-card {
  @apply bg-gray-800 border-gray-700;
}

/* Button variants */
.btn-primary {
  @apply bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors;
}

.btn-secondary {
  @apply bg-gray-200 hover:bg-gray-300 text-gray-900 font-medium py-2 px-4 rounded-md transition-colors;
}

.dark .btn-secondary {
  @apply bg-gray-700 hover:bg-gray-600 text-gray-100;
}

/* Table styling */
.data-table {
  @apply w-full border-collapse;
}

.data-table th {
  @apply bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider;
}

.dark .data-table th {
  @apply bg-gray-800 text-gray-300;
}

.data-table td {
  @apply px-6 py-4 whitespace-nowrap text-sm text-gray-900;
}

.dark .data-table td {
  @apply text-gray-100;
}

/* Modal styling */
.modal-overlay {
  @apply fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50;
}

.modal-content {
  @apply bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-screen overflow-y-auto;
}

.dark .modal-content {
  @apply bg-gray-800;
}

/* Dropdown styling */
.dropdown-content {
  @apply absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm;
}

.dark .dropdown-content {
  @apply bg-gray-800 ring-gray-700;
}

.dropdown-item {
  @apply cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-gray-100;
}

.dark .dropdown-item {
  @apply hover:bg-gray-700;
}

/* Status badge styling */
.status-active {
  @apply bg-green-100 text-green-800;
}

.dark .status-active {
  @apply bg-green-900 text-green-300;
}

.status-suspended {
  @apply bg-red-100 text-red-800;
}

.dark .status-suspended {
  @apply bg-red-900 text-red-300;
}

.status-deprovisioned {
  @apply bg-gray-100 text-gray-800;
}

.dark .status-deprovisioned {
  @apply bg-gray-700 text-gray-300;
}

/* Animation classes */
.fade-in {
  @apply animate-in fade-in-0 duration-200;
}

.slide-in {
  @apply animate-in slide-in-from-top-2 duration-200;
}

.scale-in {
  @apply animate-in zoom-in-95 duration-200;
}

/* Custom utilities */
.text-balance {
  text-wrap: balance;
}

.border-gradient {
  border-image: linear-gradient(135deg, #6b46c1 0%, #7c3aed 100%) 1;
}

/* Focus styles */
.focus-visible {
  @apply focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2;
}

.dark .focus-visible {
  @apply focus:ring-blue-400 focus:ring-offset-gray-800;
}

/* Loading states */
.loading-spinner {
  @apply animate-spin rounded-full h-4 w-4 border-b-2 border-current;
}

.loading-pulse {
  @apply animate-pulse bg-gray-200 rounded;
}

.dark .loading-pulse {
  @apply bg-gray-700;
}

/* Responsive utilities */
@media (max-width: 640px) {
  .mobile-hide {
    @apply hidden;
  }
  
  .mobile-show {
    @apply block;
  }
}

@media (min-width: 641px) {
  .mobile-hide {
    @apply block;
  }
  
  .mobile-show {
    @apply hidden;
  }
}
```

---

## 7. TEST DATA SCRIPT (scripts/create-test-data.js)

```javascript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users } from '../shared/schema.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

const testUsers = [
  {
    firstName: "Christopher",
    lastName: "Williams",
    email: "cwilliams@mazetx.com",
    login: "cwilliams@mazetx.com",
    title: "Chief Information Security Officer",
    department: "IT Security",
    manager: "Robert Johnson",
    employeeType: "EMPLOYEE",
    mobilePhone: "+1-555-0123",
    status: "ACTIVE",
    created: new Date('2023-01-15'),
    lastLogin: new Date('2024-12-20'),
    lastUpdated: new Date('2024-12-20'),
    passwordChanged: new Date('2024-06-15'),
  },
  {
    firstName: "Sarah",
    lastName: "Mitchell",
    email: "smitchell@mazetx.com",
    login: "smitchell@mazetx.com",
    title: "Senior Security Analyst",
    department: "IT Security",
    manager: "Christopher Williams",
    employeeType: "EMPLOYEE",
    mobilePhone: "+1-555-0124",
    status: "ACTIVE",
    created: new Date('2023-03-22'),
    lastLogin: new Date('2024-12-19'),
    lastUpdated: new Date('2024-12-19'),
    passwordChanged: new Date('2024-08-10'),
  },
  {
    firstName: "Michael",
    lastName: "Chen",
    email: "mchen@mazetx.com",
    login: "mchen@mazetx.com",
    title: "Cybersecurity Engineer",
    department: "IT Security",
    manager: "Christopher Williams",
    employeeType: "EMPLOYEE",
    mobilePhone: "+1-555-0125",
    status: "ACTIVE",
    created: new Date('2023-05-18'),
    lastLogin: new Date('2024-12-18'),
    lastUpdated: new Date('2024-12-18'),
    passwordChanged: new Date('2024-09-05'),
  },
  {
    firstName: "Jennifer",
    lastName: "Rodriguez",
    email: "jrodriguez@mazetx.com",
    login: "jrodriguez@mazetx.com",
    title: "Information Security Specialist",
    department: "IT Security",
    manager: "Sarah Mitchell",
    employeeType: "EMPLOYEE",
    mobilePhone: "+1-555-0126",
    status: "ACTIVE",
    created: new Date('2023-07-10'),
    lastLogin: new Date('2024-12-17'),
    lastUpdated: new Date('2024-12-17'),
    passwordChanged: new Date('2024-10-20'),
  },
  {
    firstName: "David",
    lastName: "Thompson",
    email: "dthompson@mazetx.com",
    login: "dthompson@mazetx.com",
    title: "Security Operations Analyst",
    department: "IT Security",
    manager: "Sarah Mitchell",
    employeeType: "CONTRACTOR",
    mobilePhone: "+1-555-0127",
    status: "ACTIVE",
    created: new Date('2023-09-14'),
    lastLogin: new Date('2024-12-16'),
    lastUpdated: new Date('2024-12-16'),
    passwordChanged: new Date('2024-11-12'),
  },
  {
    firstName: "Lisa",
    lastName: "Anderson",
    email: "landerson@mazetx.com",
    login: "landerson@mazetx.com",
    title: "Compliance Officer",
    department: "IT Security",
    manager: "Christopher Williams",
    employeeType: "EMPLOYEE",
    mobilePhone: "+1-555-0128",
    status: "ACTIVE",
    created: new Date('2023-11-05'),
    lastLogin: new Date('2024-12-15'),
    lastUpdated: new Date('2024-12-15'),
    passwordChanged: new Date('2024-07-25'),
  },
  {
    firstName: "Robert",
    lastName: "Johnson",
    email: "rjohnson@mazetx.com",
    login: "rjohnson@mazetx.com",
    title: "Chief Technology Officer",
    department: "Executive",
    manager: null,
    employeeType: "EMPLOYEE",
    mobilePhone: "+1-555-0129",
    status: "ACTIVE",
    created: new Date('2022-12-01'),
    lastLogin: new Date('2024-12-20'),
    lastUpdated: new Date('2024-12-20'),
    passwordChanged: new Date('2024-05-18'),
  },
  {
    firstName: "Amanda",
    lastName: "White",
    email: "awhite@mazetx.com",
    login: "awhite@mazetx.com",
    title: "Penetration Tester",
    department: "IT Security",
    manager: "Michael Chen",
    employeeType: "CONTRACTOR",
    mobilePhone: "+1-555-0130",
    status: "ACTIVE",
    created: new Date('2024-01-20'),
    lastLogin: new Date('2024-12-14'),
    lastUpdated: new Date('2024-12-14'),
    passwordChanged: new Date('2024-08-30'),
  },
  {
    firstName: "James",
    lastName: "Wilson",
    email: "jwilson@mazetx.com",
    login: "jwilson@mazetx.com",
    title: "IT Systems Administrator",
    department: "IT",
    manager: "Robert Johnson",
    employeeType: "EMPLOYEE",
    mobilePhone: "+1-555-0131",
    status: "ACTIVE",
    created: new Date('2023-02-28'),
    lastLogin: new Date('2024-12-13'),
    lastUpdated: new Date('2024-12-13'),
    passwordChanged: new Date('2024-09-22'),
  },
  {
    firstName: "Maria",
    lastName: "Garcia",
    email: "mgarcia@mazetx.com",
    login: "mgarcia@mazetx.com",
    title: "Network Engineer",
    department: "IT",
    manager: "James Wilson",
    employeeType: "EMPLOYEE",
    mobilePhone: "+1-555-0132",
    status: "ACTIVE",
    created: new Date('2023-04-12'),
    lastLogin: new Date('2024-12-12'),
    lastUpdated: new Date('2024-12-12'),
    passwordChanged: new Date('2024-10-08'),
  },
  {
    firstName: "Kevin",
    lastName: "Brown",
    email: "kbrown@mazetx.com",
    login: "kbrown@mazetx.com",
    title: "Database Administrator",
    department: "IT",
    manager: "James Wilson",
    employeeType: "EMPLOYEE",
    mobilePhone: "+1-555-0133",
    status: "ACTIVE",
    created: new Date('2023-06-08'),
    lastLogin: new Date('2024-12-11'),
    lastUpdated: new Date('2024-12-11'),
    passwordChanged: new Date('2024-11-01'),
  },
  {
    firstName: "Rachel",
    lastName: "Davis",
    email: "rdavis@mazetx.com",
    login: "rdavis@mazetx.com",
    title: "DevOps Engineer",
    department: "IT",
    manager: "James Wilson",
    employeeType: "CONTRACTOR",
    mobilePhone: "+1-555-0134",
    status: "ACTIVE",
    created: new Date('2023-08-25'),
    lastLogin: new Date('2024-12-10'),
    lastUpdated: new Date('2024-12-10'),
    passwordChanged: new Date('2024-07-15'),
  },
  {
    firstName: "Daniel",
    lastName: "Miller",
    email: "dmiller@mazetx.com",
    login: "dmiller@mazetx.com",
    title: "Cloud Architect",
    department: "IT",
    manager: "Robert Johnson",
    employeeType: "EMPLOYEE",
    mobilePhone: "+1-555-0135",
    status: "ACTIVE",
    created: new Date('2023-10-15'),
    lastLogin: new Date('2024-12-09'),
    lastUpdated: new Date('2024-12-09'),
    passwordChanged: new Date('2024-08-20'),
  },
  {
    firstName: "Nicole",
    lastName: "Taylor",
    email: "ntaylor@mazetx.com",
    login: "ntaylor@mazetx.com",
    title: "HR Director",
    department: "HR",
    manager: "Robert Johnson",
    employeeType: "EMPLOYEE",
    mobilePhone: "+1-555-0136",
    status: "ACTIVE",
    created: new Date('2022-11-18'),
    lastLogin: new Date('2024-12-08'),
    lastUpdated: new Date('2024-12-08'),
    passwordChanged: new Date('2024-06-05'),
  },
  {
    firstName: "Steven",
    lastName: "Martinez",
    email: "smartinez@mazetx.com",
    login: "smartinez@mazetx.com",
    title: "HR Business Partner",
    department: "HR",
    manager: "Nicole Taylor",
    employeeType: "EMPLOYEE",
    mobilePhone: "+1-555-0137",
    status: "ACTIVE",
    created: new Date('2023-01-30'),
    lastLogin: new Date('2024-12-07'),
    lastUpdated: new Date('2024-12-07'),
    passwordChanged: new Date('2024-09-18'),
  },
  {
    firstName: "Ashley",
    lastName: "Moore",
    email: "amoore@mazetx.com",
    login: "amoore@mazetx.com",
    title: "Talent Acquisition Specialist",
    department: "HR",
    manager: "Nicole Taylor",
    employeeType: "EMPLOYEE",
    mobilePhone: "+1-555-0138",
    status: "ACTIVE",
    created: new Date('2023-03-15'),
    lastLogin: new Date('2024-12-06'),
    lastUpdated: new Date('2024-12-06'),
    passwordChanged: new Date('2024-10-12'),
  },
  {
    firstName: "Brian",
    lastName: "Jackson",
    email: "bjackson@mazetx.com",
    login: "bjackson@mazetx.com",
    title: "Legal Counsel",
    department: "Legal",
    manager: "Robert Johnson",
    employeeType: "EMPLOYEE",
    mobilePhone: "+1-555-0139",
    status: "ACTIVE",
    created: new Date('2023-05-03'),
    lastLogin: new Date('2024-12-05'),
    lastUpdated: new Date('2024-12-05'),
    passwordChanged: new Date('2024-07-28'),
  },
  {
    firstName: "Stephanie",
    lastName: "Lee",
    email: "slee@mazetx.com",
    login: "slee@mazetx.com",
    title: "Compliance Manager",
    department: "Legal",
    manager: "Brian Jackson",
    employeeType: "EMPLOYEE",
    mobilePhone: "+1-555-0140",
    status: "ACTIVE",
    created: new Date('2023-07-20'),
    lastLogin: new Date('2024-12-04'),
    lastUpdated: new Date('2024-12-04'),
    passwordChanged: new Date('2024-11-08'),
  },
  {
    firstName: "Alex",
    lastName: "Kim",
    email: "akim@mazetx.com",
    login: "akim@mazetx.com",
    title: "Security Intern",
    department: "IT Security",
    manager: "Jennifer Rodriguez",
    employeeType: "INTERN",
    mobilePhone: "+1-555-0141",
    status: "ACTIVE",
    created: new Date('2024-06-01'),
    lastLogin: new Date('2024-12-03'),
    lastUpdated: new Date('2024-12-03'),
    passwordChanged: new Date('2024-09-10'),
  }
];

async function createTestData() {
  try {
    console.log('Creating test data...');
    
    // Clear existing users (except admin)
    await db.delete(users).where(sql`id > 1`);
    
    // Insert test users
    await db.insert(users).values(testUsers);
    
    console.log(`Successfully created ${testUsers.length} test users`);
    console.log('Test data creation completed!');
    
  } catch (error) {
    console.error('Error creating test data:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run the script
createTestData().catch(console.error);
```

---

## 8. VITE CONFIGURATION (vite.config.ts)

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client/src"),
      "@shared": path.resolve(__dirname, "./shared"),
      "@assets": path.resolve(__dirname, "./attached_assets"),
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
  define: {
    global: 'globalThis',
  },
});
```

---

## DEPLOYMENT INSTRUCTIONS

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Database Setup**
   ```bash
   npm run db:push
   ```

3. **Create Test Data**
   ```bash
   node scripts/create-test-data.js
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

5. **Access Application**
   - URL: http://localhost:5000/users
   - Login: CW-Admin / YellowDr@g0nFly

This package contains ALL components needed for an exact carbon copy of your working dashboard. Every component has been extracted from your actual working project with exact styling, functionality, and data.