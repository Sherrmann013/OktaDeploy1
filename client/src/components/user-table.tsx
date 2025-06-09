import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit, Pause, Trash2, Play, ChevronLeft, ChevronRight, ArrowUpDown, FilterIcon } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import ConfirmationModal from "./confirmation-modal";
import type { User } from "@shared/schema";

// Column definitions for dynamic table rendering
const COLUMN_DEFINITIONS = {
  firstName: { label: 'First Name', sortKey: 'firstName' },
  lastName: { label: 'Last Name', sortKey: 'lastName' },
  email: { label: 'Email', sortKey: 'email' },
  login: { label: 'Login', sortKey: 'login' },
  title: { label: 'Title', sortKey: 'title' },
  department: { label: 'Department', sortKey: 'department' },
  employeeType: { label: 'Employee Type', sortKey: 'employeeType' },
  manager: { label: 'Manager', sortKey: 'manager' },
  mobilePhone: { label: 'Mobile Phone', sortKey: 'mobilePhone' },
  status: { label: 'Status', sortKey: 'status' },
  activated: { label: 'Account Created', sortKey: 'activated' },
  lastLogin: { label: 'Last Login', sortKey: 'lastLogin' },
  lastUpdated: { label: 'Last Updated', sortKey: 'lastUpdated' },
  passwordChanged: { label: 'Password Changed', sortKey: 'passwordChanged' },
};

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
  visibleColumns = ['firstName', 'lastName', 'email', 'status', 'lastLogin'],
}: UserTableProps) {
  const { toast } = useToast();
  const [confirmAction, setConfirmAction] = useState<{
    type: string;
    title: string;
    message: string;
    action: () => void;
  } | null>(null);

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

  const renderCellContent = (user: User, columnId: string) => {
    switch (columnId) {
      case 'firstName':
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
              <div className="text-sm text-muted-foreground">{user.login}</div>
            </div>
          </div>
        );
      case 'lastName':
        return <div className="text-sm text-foreground">{user.lastName}</div>;
      case 'email':
        return <div className="text-sm text-foreground">{user.email}</div>;
      case 'login':
        return <div className="text-sm text-foreground">{user.login}</div>;
      case 'title':
        return <div className="text-sm text-foreground">{user.title || '-'}</div>;
      case 'department':
        return <div className="text-sm text-foreground">{user.department || '-'}</div>;
      case 'employeeType':
        return <Badge variant="outline">{user.employeeType}</Badge>;
      case 'manager':
        return <div className="text-sm text-foreground">{user.manager || '-'}</div>;
      case 'mobilePhone':
        return <div className="text-sm text-foreground">{user.mobilePhone || '-'}</div>;
      case 'status':
        return getStatusBadge(user.status);
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
          <Table>
            <TableHeader>
              <TableRow>
                {visibleColumns.map((columnId) => {
                  const column = COLUMN_DEFINITIONS[columnId as keyof typeof COLUMN_DEFINITIONS];
                  if (!column) return null;
                  
                  return (
                    <TableHead key={columnId} className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <Button 
                          variant="ghost" 
                          className="h-auto p-0 font-medium text-xs text-muted-foreground uppercase tracking-wider hover:text-foreground"
                          onClick={() => handleSort(column.sortKey)}
                        >
                          {column.label}
                          {getSortIcon(column.sortKey)}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <FilterIcon className="h-3 w-3" />
                        </Button>
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
                  className="table-row-light cursor-pointer"
                  onClick={() => onUserClick(user.id)}
                >
                  {visibleColumns.map((columnId) => (
                    <TableCell key={columnId} className="px-6 py-4">
                      {renderCellContent(user, columnId)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
