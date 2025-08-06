import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { ThemeToggle } from "@/components/theme-toggle";

export default function Users() {
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

  // Column management with safety checks
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    // Clear any cached column settings
    localStorage.removeItem('user-table-columns');
    
    // Safety check for AVAILABLE_COLUMNS
    if (!AVAILABLE_COLUMNS || !Array.isArray(AVAILABLE_COLUMNS)) {
      return [];
    }
    
    return AVAILABLE_COLUMNS.map((col, index) => ({
      id: col.id,
      visible: ['name', 'login', 'title', 'department', 'manager', 'employeeType', 'status'].includes(col.id),
      order: index
    }));
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="flex flex-col h-screen">
        {/* Header */}
        <header className="bg-background border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <UsersIcon className="w-6 h-6" />
              <h1 className="text-2xl font-semibold">Users</h1>
            </div>
            <div className="flex items-center space-x-2">
              <ThemeToggle />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 p-6 space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-3">
                <div className="flex flex-col items-center text-center">
                  <Building className="w-6 h-6 mb-1 text-green-600" />
                  <p className="text-xs font-medium text-muted-foreground">Employees</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    0
                  </p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-3">
                <div className="flex flex-col items-center text-center">
                  <Phone className="w-6 h-6 mb-1 text-yellow-600" />
                  <p className="text-xs font-medium text-muted-foreground">Contractors</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    0
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
                    0
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
                    0
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              
              <Button variant="outline" size="sm">
                <Filter className="w-4 h-4 mr-2" />
                Filter
              </Button>
              
              <Button variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Sync OKTA
              </Button>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              
              <Button size="sm" onClick={() => setShowCreateModal(true)}>
                <UserPlus className="w-4 h-4 mr-2" />
                New User
              </Button>
            </div>
          </div>

          {/* User Table */}
          <Card>
            <CardContent className="p-0">
              <div className="p-4 text-center text-muted-foreground">
                No users found. Click "Sync OKTA" to import users or "New User" to create one manually.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateUserModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            // Refresh users data when available
          }}
        />
      )}
    </div>
  );
}