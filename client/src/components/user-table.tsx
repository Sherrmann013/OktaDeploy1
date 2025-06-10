import React, { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import {
  CSS,
} from '@dnd-kit/utilities';

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

// Sortable table header component
function SortableTableHeader({ columnId, children, onColumnReorder, columnConfig }: {
  columnId: string;
  children: React.ReactNode;
  onColumnReorder?: (columns: ColumnConfig[]) => void;
  columnConfig?: ColumnConfig[];
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: columnId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <TableHead 
      ref={setNodeRef} 
      style={style}
      className={`relative px-6 py-4 text-center ${isDragging ? 'opacity-50 z-50' : ''}`}
    >
      <div className="flex items-center justify-center gap-2 w-full">
        {onColumnReorder && (
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ touchAction: 'none' }}
          >
            <GripVertical className="h-3 w-3" />
          </div>
        )}
        {children}
      </div>
    </TableHead>
  );
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
  visibleColumns = ['name', 'status', 'lastLogin'],
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

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && onColumnReorder && columnConfig) {
      const oldIndex = columnConfig.findIndex(col => col.id === active.id);
      const newIndex = columnConfig.findIndex(col => col.id === over.id);
      
      const newColumns = arrayMove(columnConfig, oldIndex, newIndex).map((col, index) => ({
        ...col,
        order: index
      }));
      
      onColumnReorder(newColumns);
    }
  };
  
  // Use external filter state or fallback to local state
  const mobilePhoneFilter = filters?.mobilePhone || "";
  const employeeTypeFilter = filters?.employeeType || [];
  const managerFilter = filters?.manager || "";
  const statusFilter = filters?.status || [];
  const lastLoginFilter = filters?.lastLogin || "";
  
  const setMobilePhoneFilter = (value: string) => {
    if (onFiltersChange) {
      onFiltersChange({ employeeType: employeeTypeFilter, mobilePhone: value, manager: managerFilter, status: statusFilter, lastLogin: lastLoginFilter });
    }
  };
  
  const setEmployeeTypeFilter = (value: string[]) => {
    if (onFiltersChange) {
      onFiltersChange({ employeeType: value, mobilePhone: mobilePhoneFilter, manager: managerFilter, status: statusFilter, lastLogin: lastLoginFilter });
    }
  };

  const setManagerFilter = (value: string) => {
    if (onFiltersChange) {
      onFiltersChange({ employeeType: employeeTypeFilter, mobilePhone: mobilePhoneFilter, manager: value, status: statusFilter, lastLogin: lastLoginFilter });
    }
  };

  const setStatusFilter = (value: string[]) => {
    if (onFiltersChange) {
      onFiltersChange({ employeeType: employeeTypeFilter, mobilePhone: mobilePhoneFilter, manager: managerFilter, status: value, lastLogin: lastLoginFilter });
    }
  };

  const setLastLoginFilter = (value: string) => {
    if (onFiltersChange) {
      onFiltersChange({ employeeType: employeeTypeFilter, mobilePhone: mobilePhoneFilter, manager: managerFilter, status: statusFilter, lastLogin: value });
    }
  };

  // Manager autocomplete state and functionality
  const [managerSearchQuery, setManagerSearchQuery] = useState("");
  const [managerOpen, setManagerOpen] = useState(false);

  // Fetch manager suggestions for autocomplete with debouncing
  const { data: managerSuggestions = [] } = useQuery({
    queryKey: ["/api/managers", managerSearchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (managerSearchQuery.trim()) {
        params.append("q", managerSearchQuery.trim());
      }
      const response = await fetch(`/api/managers?${params}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch manager suggestions: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: managerOpen,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ userId, status }: { userId: number; status: string }) => {
      return apiRequest("PATCH", `/api/users/${userId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Success",
        description: "User status updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      return apiRequest("DELETE", `/api/users/${userId}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Success",
        description: "User deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleStatusChange = (userId: number, status: string) => {
    const actionText = status === "ACTIVE" ? "activate" : "suspend";
    setConfirmAction({
      type: status,
      title: `${actionText.charAt(0).toUpperCase() + actionText.slice(1)} User`,
      message: `Are you sure you want to ${actionText} this user?`,
      action: () => updateStatusMutation.mutate({ userId, status }),
    });
  };

  const handleDeleteUser = (userId: number) => {
    setConfirmAction({
      type: "delete",
      title: "Delete User",
      message: "Are you sure you want to delete this user? This action cannot be undone.",
      action: () => deleteUserMutation.mutate(userId),
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>;
      case "SUSPENDED":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Suspended</Badge>;
      case "DEPROVISIONED":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Deprovisioned</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getUserInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const formatLastLogin = (lastLogin: Date | string | null) => {
    if (!lastLogin) return "Never";
    try {
      const date = lastLogin instanceof Date ? lastLogin : new Date(lastLogin);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return "Unknown";
    }
  };

  const getSortIcon = (column: string) => {
    if (sortBy !== column || !onSort) {
      return <ArrowUpDown className="ml-1 w-3 h-3 opacity-50" />;
    }
    return sortOrder === 'asc' ? 
      <ArrowUpDown className="ml-1 w-3 h-3 rotate-180" /> : 
      <ArrowUpDown className="ml-1 w-3 h-3" />;
  };

  const handleSort = (column: string) => {
    if (onSort) {
      onSort(column);
    }
  };

  // Determine column order from columnConfig or fallback to visibleColumns
  const orderedColumns = useMemo(() => {
    if (columnConfig) {
      return columnConfig
        .filter(col => col.visible)
        .sort((a, b) => a.order - b.order)
        .map(col => col.id);
    }
    return visibleColumns;
  }, [columnConfig, visibleColumns]);

  const renderEmployeeTypeFilter = () => {
    const employeeTypes = ['EMPLOYEE', 'CONTRACTOR', 'INTERN', 'PART_TIME', 'CONSULTANT'];
    
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <FilterIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg z-50" align="start">
          <div className="space-y-3">
            <Label className="text-sm font-medium">Employee Type</Label>
            <div className="space-y-2">
              {employeeTypes.map((type) => (
                <div key={type} className="flex items-center space-x-2">
                  <Checkbox
                    id={type}
                    checked={employeeTypeFilter.includes(type)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setEmployeeTypeFilter([...employeeTypeFilter, type]);
                      } else {
                        setEmployeeTypeFilter(employeeTypeFilter.filter(t => t !== type));
                      }
                    }}
                  />
                  <Label htmlFor={type} className="text-sm font-normal">{type}</Label>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setEmployeeTypeFilter([])}
                className="text-xs"
              >
                Clear
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  const renderStatusFilter = () => {
    const statusOptions = ['ACTIVE', 'SUSPENDED', 'DEPROVISIONED', 'PROVISIONED', 'STAGED', 'RECOVERY', 'LOCKED_OUT', 'PASSWORD_EXPIRED'];
    
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <FilterIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg z-50" align="start">
          <div className="space-y-3">
            <Label className="text-sm font-medium">Status</Label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {statusOptions.map((status) => (
                <div key={status} className="flex items-center space-x-2">
                  <Checkbox
                    id={status}
                    checked={statusFilter.includes(status)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setStatusFilter([...statusFilter, status]);
                      } else {
                        setStatusFilter(statusFilter.filter(s => s !== status));
                      }
                    }}
                  />
                  <Label htmlFor={status} className="text-sm font-normal">{status}</Label>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setStatusFilter([])}
                className="text-xs"
              >
                Clear
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  const renderLastLoginFilter = () => {
    const lastLoginOptions = [
      { value: "1", label: "Last 1 day" },
      { value: "3", label: "Last 3 days" },
      { value: "7", label: "Last 7 days" },
      { value: "14", label: "Last 14 days" },
      { value: "30", label: "Last 30 days" },
      { value: "31", label: "Longer than 30 days" },
      { value: "never", label: "Never logged in" }
    ];
    
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <FilterIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg z-50" align="start">
          <div className="space-y-3">
            <Label className="text-sm font-medium">Last Login</Label>
            <div className="space-y-2">
              {lastLoginOptions.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id={option.value}
                    name="lastLogin"
                    value={option.value}
                    checked={lastLoginFilter === option.value}
                    onChange={(e) => setLastLoginFilter(e.target.value)}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500"
                  />
                  <Label htmlFor={option.value} className="text-sm font-normal">{option.label}</Label>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setLastLoginFilter("")}
                className="text-xs"
              >
                Clear
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  const renderMobilePhoneFilter = () => {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <FilterIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56" align="start">
          <div className="space-y-3">
            <Label className="text-sm font-medium">Mobile Phone</Label>
            <Input
              placeholder="Search phone number..."
              value={mobilePhoneFilter}
              onChange={(e) => setMobilePhoneFilter(e.target.value)}
              className="text-sm"
            />
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setMobilePhoneFilter("")}
              className="text-xs"
            >
              Clear
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  const renderManagerFilter = () => {
    return (
      <Popover open={managerOpen} onOpenChange={setManagerOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <FilterIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg z-50" align="start">
          <Command shouldFilter={false}>
            <CommandInput 
              placeholder="Search manager..." 
              value={managerSearchQuery}
              onValueChange={setManagerSearchQuery}
              autoFocus
            />
            <CommandList>
              <CommandEmpty>No managers found.</CommandEmpty>
              <CommandGroup>
                {managerFilter && (
                  <CommandItem
                    onSelect={() => {
                      setManagerFilter("");
                      setManagerSearchQuery("");
                      setManagerOpen(false);
                    }}
                  >
                    <span className="text-muted-foreground">Clear filter</span>
                  </CommandItem>
                )}
                {managerSuggestions.map((manager: string) => (
                  <CommandItem
                    key={manager}
                    onSelect={() => {
                      setManagerFilter(manager);
                      setManagerSearchQuery("");
                      setManagerOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        managerFilter === manager ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {manager}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  };

  const renderCellContent = (user: User, columnId: string) => {
    switch (columnId) {
      case 'name':
        return (
          <div className="flex items-center">
            <div className="flex-shrink-0 h-10 w-10">
              <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center">
                <span className="text-sm font-medium text-white">
                  {getUserInitials(user.firstName, user.lastName)}
                </span>
              </div>
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-foreground">
                {user.firstName} {user.lastName}
              </div>
            </div>
          </div>
        );
      case 'login':
        return <div className="text-sm text-foreground">{user.login}</div>;
      case 'title':
        return <div className="text-sm text-foreground">{user.title || '-'}</div>;
      case 'department':
        return <div className="text-sm text-foreground">{user.department || '-'}</div>;
      case 'employeeType':
        const getEmployeeTypeBadge = (employeeType: string) => {
          switch (employeeType?.toUpperCase()) {
            case 'EMPLOYEE':
              return (
                <Badge 
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                  style={{ backgroundColor: '#10b981', color: '#ffffff', border: '1px solid #047857' }}
                >
                  Employee
                </Badge>
              );
            case 'CONTRACTOR':
              return (
                <Badge 
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                  style={{ backgroundColor: '#3b82f6', color: '#ffffff', border: '1px solid #1e40af' }}
                >
                  Contractor
                </Badge>
              );
            case 'PART_TIME':
              return (
                <Badge 
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                  style={{ backgroundColor: '#8b5cf6', color: '#ffffff', border: '1px solid #6d28d9' }}
                >
                  Part Time
                </Badge>
              );
            case 'INTERN':
              return (
                <Badge 
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                  style={{ backgroundColor: '#f97316', color: '#ffffff', border: '1px solid #ea580c' }}
                >
                  Intern
                </Badge>
              );
            default:
              return (
                <Badge 
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                  style={{ backgroundColor: '#6b7280', color: '#ffffff', border: '1px solid #4b5563' }}
                >
                  Not specified
                </Badge>
              );
          }
        };
        
        return getEmployeeTypeBadge(user.employeeType || '');
      case 'manager':
        return <div className="text-sm text-foreground">{user.manager || '-'}</div>;
      case 'mobilePhone':
        return <div className="text-sm text-foreground">{user.mobilePhone || '-'}</div>;
      case 'status':
        return getStatusBadge(user.status);
      case 'disabled':
        const isDisabled = user.status === 'SUSPENDED' || user.status === 'DEPROVISIONED';
        if (isDisabled && user.lastUpdated) {
          return (
            <div className="text-sm text-red-600 dark:text-red-400">
              {format(new Date(user.lastUpdated), 'MMM dd, yyyy')}
            </div>
          );
        }
        return <div className="text-sm text-muted-foreground">-</div>;
      case 'activated':
        return (
          <div className="text-sm text-muted-foreground">
            {user.created ? format(new Date(user.created), 'MMM dd, yyyy') : '-'}
          </div>
        );
      case 'lastLogin':
        return (
          <div className="text-sm text-muted-foreground">
            {formatLastLogin(user.lastLogin as Date | string | null)}
          </div>
        );
      case 'lastUpdated':
        return (
          <div className="text-sm text-muted-foreground">
            {user.lastUpdated ? format(new Date(user.lastUpdated), 'MMM dd, yyyy') : '-'}
          </div>
        );
      case 'passwordChanged':
        return (
          <div className="text-sm text-muted-foreground">
            {user.passwordChanged ? format(new Date(user.passwordChanged), 'MMM dd, yyyy') : '-'}
          </div>
        );
      default:
        return <div className="text-sm text-foreground">-</div>;
    }
  };

  const startIndex = (currentPage - 1) * usersPerPage + 1;
  const endIndex = Math.min(currentPage * usersPerPage, total);
  
  // Memoized user rows for performance optimization
  const memoizedUsers = useMemo(() => users, [users]);
  
  // Virtualized rendering for large datasets
  const itemHeight = 57; // Height of each table row in pixels
  const containerHeight = Math.min(600, Math.max(300, users.length * itemHeight));

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <div className="overflow-x-auto">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <Table>
              <TableHeader>
                <TableRow className="group">
                  <SortableContext 
                    items={orderedColumns} 
                    strategy={horizontalListSortingStrategy}
                  >
                    {orderedColumns.map((columnId) => {
                      const column = COLUMN_DEFINITIONS[columnId as keyof typeof COLUMN_DEFINITIONS];
                      if (!column) return null;
                      
                      return (
                        <SortableTableHeader
                          key={columnId}
                          columnId={columnId}
                          onColumnReorder={onColumnReorder}
                          columnConfig={columnConfig}
                        >
                          <div className="flex items-center justify-center space-x-2 w-full">
                            <Button 
                              variant="ghost" 
                              className="h-auto p-0 font-medium text-xs text-muted-foreground uppercase tracking-wider hover:text-foreground"
                              onClick={() => handleSort(column.sortKey)}
                            >
                              {column.label}
                              {getSortIcon(column.sortKey)}
                            </Button>
                            {column.hasFilter && columnId === 'employeeType' && renderEmployeeTypeFilter()}
                            {column.hasFilter && columnId === 'mobilePhone' && renderMobilePhoneFilter()}
                            {column.hasFilter && columnId === 'manager' && renderManagerFilter()}
                            {column.hasFilter && columnId === 'status' && renderStatusFilter()}
                            {column.hasFilter && columnId === 'lastLogin' && renderLastLoginFilter()}
                          </div>
                        </SortableTableHeader>
                      );
                    })}
                  </SortableContext>
                </TableRow>
              </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow 
                  key={user.id} 
                  className="table-row-light cursor-pointer"
                  onClick={() => onUserClick(user.id)}
                >
                  {orderedColumns.map((columnId) => (
                    <TableCell key={columnId} className="px-6 py-4 text-center">
                      {renderCellContent(user, columnId)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
            </Table>
          </DndContext>
        </div>

        {/* Pagination */}
        <div className="bg-background px-6 py-3 border-t border-border flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center text-sm text-muted-foreground">
              Showing <span className="font-medium mx-1">{startIndex}</span> to{" "}
              <span className="font-medium mx-1">{endIndex}</span> of{" "}
              <span className="font-medium mx-1">{total}</span> users
            </div>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <span>Show:</span>
              <Select value={usersPerPage.toString()} onValueChange={(value) => onPerPageChange(parseInt(value))}>
                <SelectTrigger className="w-20 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="200">200</SelectItem>
                  <SelectItem value="500">500</SelectItem>
                </SelectContent>
              </Select>
              <span>per page</span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            {(() => {
              const pages = [];
              const maxVisiblePages = 5;
              
              if (totalPages <= maxVisiblePages) {
                // Show all pages if total is small
                for (let i = 1; i <= totalPages; i++) {
                  pages.push(i);
                }
              } else {
                // Smart pagination: 1, 2, 3, 4, ..., last
                if (currentPage <= 3) {
                  // Show first 4 pages, then ellipsis and last
                  pages.push(1, 2, 3, 4);
                  if (totalPages > 5) {
                    pages.push('...', totalPages);
                  } else {
                    pages.push(5);
                  }
                } else if (currentPage >= totalPages - 2) {
                  // Show first, ellipsis, then last 4 pages
                  pages.push(1, '...');
                  for (let i = totalPages - 3; i <= totalPages; i++) {
                    pages.push(i);
                  }
                } else {
                  // Show first, ellipsis, current-1, current, current+1, ellipsis, last
                  pages.push(1, '...');
                  for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                    pages.push(i);
                  }
                  pages.push('...', totalPages);
                }
              }
              
              return pages.map((page, index) => {
                if (page === '...') {
                  return (
                    <span key={`ellipsis-${index}`} className="px-2 text-gray-400">
                      ...
                    </span>
                  );
                }
                
                const pageNum = page as number;
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => onPageChange(pageNum)}
                    className={currentPage === pageNum ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}
                  >
                    {pageNum}
                  </Button>
                );
              });
            })()}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      <ConfirmationModal
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        title={confirmAction?.title || ""}
        message={confirmAction?.message || ""}
        onConfirm={() => {
          confirmAction?.action();
          setConfirmAction(null);
        }}
        confirmText={confirmAction?.type === "delete" ? "Delete" : "Confirm"}
        variant={confirmAction?.type === "delete" ? "destructive" : "default"}
      />
    </>
  );
}
