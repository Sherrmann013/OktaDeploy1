import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";

import UserTable from "@/components/user-table";
import CreateUserModal from "@/components/create-user-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Search, Plus, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import type { User } from "@shared/schema";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [usersPerPage, setUsersPerPage] = useState(10);
  const { user: currentUser } = useAuth();

  const { data, isLoading, refetch } = useQuery<{ users: User[]; total: number }>({
    queryKey: ["/api/users", searchQuery, statusFilter, departmentFilter, currentPage, usersPerPage],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
      if (departmentFilter && departmentFilter !== "all") params.append("department", departmentFilter);
      params.append("limit", usersPerPage.toString());
      params.append("offset", ((currentPage - 1) * usersPerPage).toString());

      const response = await fetch(`/api/users?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch users");
      return response.json();
    },
  });

  const handleUserClick = (userId: number) => {
    setLocation(`/users/${userId}`);
  };

  const handleRefresh = () => {
    refetch();
  };

  const totalPages = Math.ceil((data?.total || 0) / usersPerPage);

  return (
    <>
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
            <div>
              <nav className="flex text-sm text-gray-500 mb-1">
                <span>Directory</span>
                <span className="mx-2">/</span>
                <span className="text-gray-900 font-medium">Users</span>
              </nav>
              <h2 className="text-2xl font-semibold text-gray-900">User Management</h2>
            </div>
            <div className="flex items-center space-x-3">
              <Button 
                onClick={() => setIsCreateModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
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

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Search and Filters */}
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  type="text"
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-3">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="SUSPENDED">Suspended</SelectItem>
                    <SelectItem value="DEPROVISIONED">Deprovisioned</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    <SelectItem value="Engineering">Engineering</SelectItem>
                    <SelectItem value="Marketing">Marketing</SelectItem>
                    <SelectItem value="Sales">Sales</SelectItem>
                    <SelectItem value="HR">Human Resources</SelectItem>
                    <SelectItem value="Finance">Finance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Users Table */}
          <UserTable
            users={data?.users || []}
            total={data?.total || 0}
            currentPage={currentPage}
            totalPages={totalPages}
            usersPerPage={usersPerPage}
            isLoading={isLoading}
            onUserClick={handleUserClick}
            onPageChange={setCurrentPage}
            onPerPageChange={setUsersPerPage}
          />
        </div>

      <CreateUserModal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          setIsCreateModalOpen(false);
          refetch();
        }}
      />
    </>
  );
}
