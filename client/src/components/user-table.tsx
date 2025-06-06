import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Edit, Pause, Trash2, Play, ChevronLeft, ChevronRight, ArrowUpDown } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import ConfirmationModal from "./confirmation-modal";
import type { User } from "@shared/schema";

interface UserTableProps {
  users: User[];
  total: number;
  currentPage: number;
  totalPages: number;
  usersPerPage: number;
  isLoading: boolean;
  onUserClick: (userId: number) => void;
  onPageChange: (page: number) => void;
  onRefresh: () => void;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (column: string) => void;
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
  onRefresh,
  sortBy,
  sortOrder,
  onSort,
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
      onRefresh();
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
      onRefresh();
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

  const formatLastLogin = (lastLogin: string | null) => {
    if (!lastLogin) return "Never";
    try {
      return formatDistanceToNow(new Date(lastLogin), { addSuffix: true });
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
              <TableRow className="bg-gray-50">
                <TableHead className="px-6 py-4">
                  <Button 
                    variant="ghost" 
                    className="h-auto p-0 font-medium text-xs text-gray-500 uppercase tracking-wider hover:text-gray-700"
                    onClick={() => handleSort('firstName')}
                  >
                    User
                    {getSortIcon('firstName')}
                  </Button>
                </TableHead>
                <TableHead className="px-6 py-4">
                  <Button 
                    variant="ghost" 
                    className="h-auto p-0 font-medium text-xs text-gray-500 uppercase tracking-wider hover:text-gray-700"
                    onClick={() => handleSort('email')}
                  >
                    Email
                    {getSortIcon('email')}
                  </Button>
                </TableHead>
                <TableHead className="px-6 py-4">
                  <Button 
                    variant="ghost" 
                    className="h-auto p-0 font-medium text-xs text-gray-500 uppercase tracking-wider hover:text-gray-700"
                    onClick={() => handleSort('status')}
                  >
                    Status
                    {getSortIcon('status')}
                  </Button>
                </TableHead>
                <TableHead className="px-6 py-4">
                  <Button 
                    variant="ghost" 
                    className="h-auto p-0 font-medium text-xs text-gray-500 uppercase tracking-wider hover:text-gray-700"
                    onClick={() => handleSort('lastLogin')}
                  >
                    Last Login
                    {getSortIcon('lastLogin')}
                  </Button>
                </TableHead>
                <TableHead className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow 
                  key={user.id} 
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => onUserClick(user.id)}
                >
                  <TableCell className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-700">
                            {getUserInitials(user.firstName, user.lastName)}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {user.firstName} {user.lastName}
                        </div>
                        <div className="text-sm text-gray-500">{user.login}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <div className="text-sm text-gray-900">{user.email}</div>
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    {getStatusBadge(user.status)}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-sm text-gray-500">
                    {formatLastLogin(user.lastLogin)}
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Handle edit - could open edit modal or navigate to edit page
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      {user.status === "ACTIVE" ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStatusChange(user.id, "SUSPENDED");
                          }}
                        >
                          <Pause className="w-4 h-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStatusChange(user.id, "ACTIVE");
                          }}
                        >
                          <Play className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteUser(user.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="bg-white px-6 py-3 border-t border-gray-200 flex items-center justify-between">
          <div className="flex items-center text-sm text-gray-500">
            Showing <span className="font-medium mx-1">{startIndex}</span> to{" "}
            <span className="font-medium mx-1">{endIndex}</span> of{" "}
            <span className="font-medium mx-1">{total}</span> users
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
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <Button
                key={page}
                variant={currentPage === page ? "default" : "outline"}
                size="sm"
                onClick={() => onPageChange(page)}
                className={currentPage === page ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}
              >
                {page}
              </Button>
            ))}
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
