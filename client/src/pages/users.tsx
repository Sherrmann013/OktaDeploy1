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
import { useAuth } from "@/hooks/use-auth";
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
    // Clear any cached column settings
    localStorage.removeItem('user-table-columns');
    
    return AVAILABLE_COLUMNS.map((col, index) => ({
      id: col.id,
      visible: ['name', 'login', 'title', 'department', 'manager', 'employeeType', 'status'].includes(col.id),
      order: index
    }));
  });

  // OKTA Sync Mutation
  const oktaSyncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("GET", "/api/okta/sync-all");
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "OKTA Sync Completed",
        description: `${data.message}. Total: ${data.totalUsers}, New: ${data.newUsers}, Updated: ${data.updatedUsers}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      refetch();
    },
    onError: (error) => {
      toast({
        title: "OKTA Sync Failed", 
        description: error.message,
        variant: "destructive",
      });
    },
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

  // Get total user count separately (doesn't change with search)
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

  // Get all users for fallback stats if OKTA counts fail - optimized with smaller limit and caching
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
    staleTime: 10 * 60 * 1000, // 10 minutes cache
    gcTime: 30 * 60 * 1000, // 30 minutes garbage collection
  });

  // Debounced search query for better performance
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300); // 300ms debounce
    
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
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    placeholderData: (previousData) => previousData, // Keep previous data while fetching new data
    refetchOnWindowFocus: false, // Prevent unnecessary refetches
    retry: 2, // Reduce retry attempts for faster failure feedback
  });

  const users = usersData?.users || [];
  const allUsers = allUsersData?.users || [];
  const total = totalUsersData?.total || usersData?.total || 0;
  const totalPages = usersData?.totalPages || 1;
  const dataSource = usersData?.source || 'unknown';

  const handleUserClick = (userId: number) => {
    // Navigate to user detail page
    window.location.href = `/users/${userId}`;
  };

  const handleRefresh = () => {
    refetch();
  };

  const handleCreateSuccess = () => {
    setShowCreateModal(false);
    refetch();
  };

  const handleEmployeeTypeFilter = (employeeType: string) => {
    if (employeeTypeFilter === employeeType) {
      // If already filtered by this type, clear the filter
      setEmployeeTypeFilter("");
    } else {
      // Set new filter
      setEmployeeTypeFilter(employeeType);
    }
    setCurrentPage(1); // Reset to first page when filtering
  };

  const clearFilters = () => {
    setEmployeeTypeFilter("");
    setSearchQuery("");
    setCurrentPage(1);
  };

  const handlePerPageChange = (perPage: number) => {
    setUsersPerPage(perPage);
    setCurrentPage(1); // Reset to first page when changing per-page count
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setSearchQuery("");
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

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'ACTIVE': return 'bg-green-100 text-green-800';
      case 'STAGED': return 'bg-yellow-100 text-yellow-800';
      case 'SUSPENDED': return 'bg-red-100 text-red-800';
      case 'DEPROVISIONED': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getEmployeeTypeColor = (employeeType: string) => {
    switch (employeeType?.toUpperCase()) {
      case 'EMPLOYEE': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'CONTRACTOR': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'PART_TIME': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'INTERN': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const handleExport = async (selectedColumns: string[], exportType: 'current' | 'custom') => {
    try {
      // Show loading toast
      toast({
        title: "Preparing export...",
        description: "Fetching all user data for export (this may take a moment)",
      });

      // Fetch all users with current filters using pagination
      let allUsers: User[] = [];
      let currentPage = 1;
      const limit = 500; // Maximum allowed by server
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

        console.log(`Export: Fetching page ${currentPage} - /api/users?${queryParams}`);
        const response = await apiRequest('GET', `/api/users?${queryParams}`);
        
        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }
        
        const responseData = await response.json();
        const { users: pageUsers, totalPages } = responseData;
        
        allUsers = [...allUsers, ...pageUsers];
        console.log(`Export: Page ${currentPage} - fetched ${pageUsers.length} users, total so far: ${allUsers.length}`);
        
        hasMorePages = currentPage < totalPages;
        currentPage++;
      }

      console.log(`Export: Completed fetching all ${allUsers.length} users`);

      // Get column mapping for human-readable headers
      const columnMap = AVAILABLE_COLUMNS.reduce((acc, col) => {
        acc[col.id] = col.label;
        return acc;
      }, {} as Record<string, string>);

      // Create CSV headers
      const headers = selectedColumns.map(col => columnMap[col] || col);
      
      // Format user data for selected columns
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
          // Escape quotes and wrap in quotes if contains comma, quote, or newline
          if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            value = `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        });
      });

      // Combine headers and data
      const csvContent = [headers, ...csvData]
        .map(row => row.join(','))
        .join('\n');

      // Create and download file
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
      console.error('Export error details:', errorMessage);
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
            <CardContent className="p-3">
              <div className="flex flex-col items-center text-center">
                <UsersIcon className="w-6 h-6 text-blue-600 mb-1" />
                <p className="text-xs font-medium text-muted-foreground">Total Users</p>
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{total}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-3">
              <div className="flex flex-col items-center text-center">
                <UsersIcon className={`w-6 h-6 mb-1 ${
                  employeeTypeFilter === 'EMPLOYEE' ? 'text-blue-700' : 'text-blue-600'
                }`} />
                <p className="text-xs font-medium text-muted-foreground">Employees</p>
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {employeeTypeCounts?.EMPLOYEE ?? allUsers.filter((u: User) => u.employeeType === 'EMPLOYEE').length}
                </p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-3">
              <div className="flex flex-col items-center text-center">
                <Building className={`w-6 h-6 mb-1 ${
                  employeeTypeFilter === 'CONTRACTOR' ? 'text-green-700' : 'text-green-600'
                }`} />
                <p className="text-xs font-medium text-muted-foreground">Contractors</p>
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {employeeTypeCounts?.CONTRACTOR ?? allUsers.filter((u: User) => u.employeeType === 'CONTRACTOR').length}
                </p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-3">
              <div className="flex flex-col items-center text-center">
                <Calendar className="w-6 h-6 mb-1 text-purple-600" />
                <p className="text-xs font-medium text-muted-foreground">Part Time</p>
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {employeeTypeCounts?.PART_TIME ?? allUsers.filter((u: User) => u.employeeType === 'PART_TIME').length}
                </p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-3">
              <div className="flex flex-col items-center text-center">
                <Eye className="w-6 h-6 mb-1 text-orange-600" />
                <p className="text-xs font-medium text-muted-foreground">Interns</p>
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {employeeTypeCounts?.INTERN ?? allUsers.filter((u: User) => u.employeeType === 'INTERN').length}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Search and Controls */}
      <div className="bg-background border-b border-border px-6 py-4">
        <form onSubmit={handleSearch} className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-96 relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search users by name, email, or login..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 border-blue-500 ring-1 ring-blue-500 focus:border-blue-600 focus:ring-blue-600"
              />
            </div>
            
            <Button onClick={() => setShowCreateModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
              <UserPlus className="w-4 h-4 mr-2" />
              Add User
            </Button>
          </div>
          
          <div className="flex items-center space-x-4">
            {(searchQuery || employeeTypeFilter) && (
              <Button type="button" variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
            )}
            
            <ExportModal
              users={users}
              currentColumns={columns}
              totalUsers={total}
              onExport={handleExport}
            />
            
            <ColumnManager
              columns={columns}
              onColumnsChange={setColumns}
            />
          </div>
        </form>
      </div>

      {/* Users Table */}
      <div className="flex-1 overflow-auto bg-background">
        <UserTable
          users={users}
          total={total}
          currentPage={currentPage}
          totalPages={totalPages}
          usersPerPage={usersPerPage}
          isLoading={isLoading || isFetching}
          onUserClick={handleUserClick}
          onPageChange={setCurrentPage}
          onPerPageChange={handlePerPageChange}
          onRefresh={handleRefresh}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
          visibleColumns={columns.filter(col => col.visible).map(col => col.id)}
          columnConfig={columns}
          onColumnReorder={setColumns}
          filters={filters}
          onFiltersChange={setFilters}
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