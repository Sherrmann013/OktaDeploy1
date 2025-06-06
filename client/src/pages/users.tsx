import { useState } from "react";
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
import ColumnManager, { ColumnConfig, FilterConfig, AVAILABLE_COLUMNS } from "@/components/column-manager";
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
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  // Column and filter management
  const [columns, setColumns] = useState<ColumnConfig[]>(() => 
    AVAILABLE_COLUMNS.map(col => ({
      id: col.id,
      visible: ['firstName', 'lastName', 'email', 'title', 'department', 'employeeType', 'status'].includes(col.id)
    }))
  );
  const [filters, setFilters] = useState<FilterConfig[]>([]);

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

  // Get all users for fallback stats if OKTA counts fail
  const { data: allUsersData } = useQuery({
    queryKey: ["/api/users/all"],
    queryFn: async () => {
      const response = await fetch(`/api/users?limit=1000`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch all users');
      }
      
      return response.json();
    },
    enabled: !employeeTypeCounts, // Only fetch if OKTA counts aren't available
  });

  const { data: usersData, isLoading, refetch } = useQuery({
    queryKey: ["/api/users", currentPage, usersPerPage, searchQuery, sortBy, sortOrder, employeeTypeFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: usersPerPage.toString(),
        sortBy: sortBy,
        sortOrder: sortOrder,
        ...(searchQuery && { search: searchQuery }),
        ...(employeeTypeFilter && { employeeType: employeeTypeFilter })
      });
      
      const response = await fetch(`/api/users?${params}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      
      return response.json();
    },
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
    setFilters([]);
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

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-background border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <nav className="flex text-sm text-muted-foreground mb-1">
              <span>Users</span>
              <span className="mx-2">/</span>
              <span className="text-foreground font-medium">All Users</span>
            </nav>
            <h2 className="text-2xl font-semibold text-foreground">User Management</h2>
            {dataSource && (
              <p className="text-sm text-muted-foreground">
                Data source: {dataSource === 'okta' ? 'OKTA API' : 'Local Storage'}
                {dataSource === 'local_storage' && (
                  <span className="text-yellow-600 dark:text-yellow-400 ml-2">
                    (OKTA connection unavailable - using fallback data)
                  </span>
                )}
              </p>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <ThemeToggle />
            <Button
              variant="outline"
              onClick={() => oktaSyncMutation.mutate()}
              disabled={oktaSyncMutation.isPending}
              className="border-orange-300 text-orange-700 hover:bg-orange-50"
            >
              <RotateCcw className={`w-4 h-4 mr-2 ${oktaSyncMutation.isPending ? 'animate-spin' : ''}`} />
              Sync OKTA
            </Button>
            <Button onClick={() => setShowCreateModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
              <UserPlus className="w-4 h-4 mr-2" />
              Add User
            </Button>
            <div className="flex items-center space-x-2 px-3 py-2 bg-gray-50 rounded-lg border">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {currentUser?.firstName?.[0]}{currentUser?.lastName?.[0]}
                </span>
              </div>
              <div className="text-sm">
                <p className="font-medium text-gray-900">{currentUser?.firstName} {currentUser?.lastName}</p>
                <p className="text-gray-500">{currentUser?.email}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Search and Filters */}
      <div className="bg-background border-b border-border px-6 py-4">
        <form onSubmit={handleSearch} className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search users by name, email, or login..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          


          <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
            <Search className="w-4 h-4 mr-2" />
            Search
          </Button>
          
          <ColumnManager
            columns={columns}
            onColumnsChange={setColumns}
            filters={filters}
            onFiltersChange={setFilters}
          />
          
          {(searchQuery || employeeTypeFilter || filters.length > 0) && (
            <Button type="button" variant="outline" onClick={clearFilters}>
              Clear Filters
            </Button>
          )}
        </form>
      </div>

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

      {/* Users Table */}
      <div className="flex-1 overflow-auto">
        <UserTable
          users={users}
          total={total}
          currentPage={currentPage}
          totalPages={totalPages}
          usersPerPage={usersPerPage}
          isLoading={isLoading}
          onUserClick={handleUserClick}
          onPageChange={setCurrentPage}
          onPerPageChange={handlePerPageChange}
          onRefresh={handleRefresh}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
          visibleColumns={columns.filter(col => col.visible).map(col => col.id)}
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