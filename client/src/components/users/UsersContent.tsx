import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import UserTable from "@/components/user-table";
import CreateUserModal from "@/components/create-user-modal";
import UserDetailModal from "@/components/user-detail-modal";
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

export function UsersContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [usersPerPage, setUsersPerPage] = useState(10);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [showUserDetail, setShowUserDetail] = useState(false);
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
    staleTime: 15 * 60 * 1000, // 15 minutes - rarely changes
    refetchOnWindowFocus: false,
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
    staleTime: 10 * 60 * 1000, // 10 minutes - changes slowly
    refetchOnWindowFocus: false,
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
    staleTime: 2 * 60 * 1000, // 2 minutes - user data changes frequently
    refetchOnWindowFocus: false,
  });

  const resetTableFilters = () => {
    setSearchQuery("");
    setEmployeeTypeFilter("");
    setFilters({
      employeeType: [],
      mobilePhone: "",
      manager: "",
      status: [],
      lastLogin: ""
    });
    setSortBy("firstName");
    setSortOrder('asc');
    setCurrentPage(1);
  };

  const handleUserClick = (userId: number) => {
    setSelectedUserId(userId);
    setShowUserDetail(true);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const [showExportModal, setShowExportModal] = useState(false);
  const [showColumnManager, setShowColumnManager] = useState(false);

  // Handle column changes with localStorage
  const handleColumnsChange = useCallback((newColumns: ColumnConfig[]) => {
    setColumns(newColumns);
    // Save to localStorage for persistence
    localStorage.setItem('user-table-columns', JSON.stringify(newColumns));
  }, []);

  // Load column preferences on component mount
  useEffect(() => {
    const savedColumns = localStorage.getItem('user-table-columns');
    if (savedColumns) {
      try {
        const parsedColumns = JSON.parse(savedColumns);
        setColumns(parsedColumns);
      } catch (error) {
        // If parsing fails, use default columns
        console.warn('Failed to parse saved column preferences:', error);
      }
    }
  }, []);

  // Calculate stats for the cards - prefer OKTA counts, fallback to user data
  const statsData = useMemo(() => {
    if (employeeTypeCounts) {
      return {
        total: employeeTypeCounts.totalUsers,
        employees: employeeTypeCounts.employees,
        contractors: employeeTypeCounts.contractors,
        interns: employeeTypeCounts.interns,
        partTime: employeeTypeCounts.partTime
      };
    }
    
    // Fallback to allUsersData
    if (allUsersData?.users && Array.isArray(allUsersData.users)) {
      const users = allUsersData.users;
      return {
        total: users.length,
        employees: users.filter((u: User) => u.employeeType === 'EMPLOYEE').length,
        contractors: users.filter((u: User) => u.employeeType === 'CONTRACTOR').length,
        interns: users.filter((u: User) => u.employeeType === 'INTERN').length,
        partTime: users.filter((u: User) => u.employeeType === 'PART_TIME').length
      };
    }
    
    // Final fallback to totalUsersData
    if (totalUsersData?.totalUsers) {
      return {
        total: totalUsersData.totalUsers,
        employees: 0,
        contractors: 0,
        interns: 0,
        partTime: 0
      };
    }
    
    return {
      total: 0,
      employees: 0,
      contractors: 0,
      interns: 0,
      partTime: 0
    };
  }, [employeeTypeCounts, allUsersData, totalUsersData]);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <UsersIcon className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold text-blue-600">{statsData.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Building className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Employees</p>
                <p className="text-2xl font-bold text-green-600">{statsData.employees}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <UsersIcon className="w-5 h-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Contractors</p>
                <p className="text-2xl font-bold text-purple-600">{statsData.contractors}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-orange-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Interns</p>
                <p className="text-2xl font-bold text-orange-600">{statsData.interns}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <UsersIcon className="w-5 h-5 text-teal-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Part-Time</p>
                <p className="text-2xl font-bold text-teal-600">{statsData.partTime}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UsersIcon className="w-5 h-5" />
                Users Management
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Manage user accounts, permissions, and access controls
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() => setShowCreateModal(true)}
                className="bg-green-600 hover:bg-green-700"
                size="sm"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Add User
              </Button>

              <Button
                onClick={() => oktaSyncMutation.mutate()}
                disabled={oktaSyncMutation.isPending}
                variant="outline"
                size="sm"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${oktaSyncMutation.isPending ? 'animate-spin' : ''}`} />
                Sync OKTA
              </Button>

              <Button
                onClick={() => setShowExportModal(true)}
                variant="outline"
                size="sm"
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>

              <Button
                onClick={() => setShowColumnManager(true)}
                variant="outline"
                size="sm"
              >
                <Eye className="w-4 h-4 mr-2" />
                Columns
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Search and Filters */}
          <div className="flex flex-col lg:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search by name, email, or title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white dark:bg-gray-800"
                />
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <Select value={employeeTypeFilter} onValueChange={setEmployeeTypeFilter}>
                <SelectTrigger className="w-[140px] bg-white dark:bg-gray-800">
                  <SelectValue placeholder="Employee Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Types</SelectItem>
                  <SelectItem value="EMPLOYEE">Employee</SelectItem>
                  <SelectItem value="CONTRACTOR">Contractor</SelectItem>
                  <SelectItem value="INTERN">Intern</SelectItem>
                  <SelectItem value="PART_TIME">Part-Time</SelectItem>
                </SelectContent>
              </Select>

              <Button
                onClick={resetTableFilters}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </Button>
            </div>
          </div>

          {/* Users Table */}
          <UserTable
            data={usersData}
            isLoading={isLoading}
            isFetching={isFetching}
            currentPage={currentPage}
            usersPerPage={usersPerPage}
            onPageChange={handlePageChange}
            onUsersPerPageChange={setUsersPerPage}
            onUserClick={handleUserClick}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={(field, order) => {
              setSortBy(field);
              setSortOrder(order);
              setCurrentPage(1);
            }}
            searchQuery={searchQuery}
            employeeTypeFilter={employeeTypeFilter}
            filters={filters}
            onFiltersChange={setFilters}
            columns={columns}
          />
        </CardContent>
      </Card>

      {/* Modals */}
      <CreateUserModal 
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          refetch();
          queryClient.invalidateQueries({ queryKey: ["/api/users"] });
          queryClient.invalidateQueries({ queryKey: ["/api/users/total"] });
          queryClient.invalidateQueries({ queryKey: ["/api/employee-type-counts"] });
        }}
      />

      <UserDetailModal
        userId={selectedUserId}
        isOpen={showUserDetail}
        onClose={() => {
          setShowUserDetail(false);
          setSelectedUserId(null);
        }}
        onUpdate={() => {
          refetch();
          queryClient.invalidateQueries({ queryKey: ["/api/users"] });
        }}
      />

      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        usersData={usersData}
        searchQuery={searchQuery}
        employeeTypeFilter={employeeTypeFilter}
        filters={filters}
      />

      <ColumnManager
        isOpen={showColumnManager}
        onClose={() => setShowColumnManager(false)}
        columns={columns}
        onColumnsChange={handleColumnsChange}
      />
    </div>
  );
}