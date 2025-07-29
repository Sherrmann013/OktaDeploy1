import React, { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
      type: "DELETE",
      title: "Delete User",
      message: "Are you sure you want to delete this user? This action cannot be undone.",
      action: () => deleteUserMutation.mutate(userId),
    });
  };

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
