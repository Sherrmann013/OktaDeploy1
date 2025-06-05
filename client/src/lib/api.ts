import { apiRequest } from "./queryClient";
import type { User, InsertUser, UpdateUser } from "@shared/schema";

export const userApi = {
  // Get all users with optional filtering
  getUsers: async (params?: {
    search?: string;
    status?: string;
    department?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ users: User[]; total: number }> => {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.append("search", params.search);
    if (params?.status) searchParams.append("status", params.status);
    if (params?.department) searchParams.append("department", params.department);
    if (params?.limit) searchParams.append("limit", params.limit.toString());
    if (params?.offset) searchParams.append("offset", params.offset.toString());

    const response = await fetch(`/api/users?${searchParams.toString()}`);
    if (!response.ok) throw new Error("Failed to fetch users");
    return response.json();
  },

  // Get single user by ID
  getUser: async (id: number): Promise<User> => {
    const response = await fetch(`/api/users/${id}`);
    if (!response.ok) throw new Error("Failed to fetch user");
    return response.json();
  },

  // Create new user
  createUser: async (userData: InsertUser): Promise<User> => {
    const response = await apiRequest("POST", "/api/users", userData);
    return response.json();
  },

  // Update user
  updateUser: async (id: number, updates: UpdateUser): Promise<User> => {
    const response = await apiRequest("PATCH", `/api/users/${id}`, updates);
    return response.json();
  },

  // Update user status
  updateUserStatus: async (id: number, status: string): Promise<User> => {
    const response = await apiRequest("PATCH", `/api/users/${id}/status`, { status });
    return response.json();
  },

  // Delete user
  deleteUser: async (id: number): Promise<void> => {
    await apiRequest("DELETE", `/api/users/${id}`, undefined);
  },
};
