import { apiRequest } from "./queryClient";
import type { User, InsertUser, UpdateUser } from "@shared/schema";

export const userApi = {
  // Get all users with optional filtering - CLIENT-AWARE
  getUsers: async (clientId: number, params?: {
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

    const response = await fetch(`/api/client/${clientId}/users?${searchParams.toString()}`);
    if (!response.ok) throw new Error("Failed to fetch users");
    return response.json();
  },

  // Get single user by ID - CLIENT-AWARE
  getUser: async (clientId: number, id: number): Promise<User> => {
    const response = await fetch(`/api/client/${clientId}/users/${id}`);
    if (!response.ok) throw new Error("Failed to fetch user");
    return response.json();
  },

  // Create new user - CLIENT-AWARE
  createUser: async (clientId: number, userData: InsertUser): Promise<User> => {
    const response = await apiRequest("POST", `/api/client/${clientId}/users`, userData);
    return response.json();
  },

  // Update user - CLIENT-AWARE
  updateUser: async (clientId: number, id: number, updates: UpdateUser): Promise<User> => {
    const response = await apiRequest("PATCH", `/api/client/${clientId}/users/${id}`, updates);
    return response.json();
  },

  // Update user status - CLIENT-AWARE
  updateUserStatus: async (clientId: number, id: number, status: string): Promise<User> => {
    const response = await apiRequest("PATCH", `/api/client/${clientId}/users/${id}/status`, { status });
    return response.json();
  },

  // Delete user - CLIENT-AWARE
  deleteUser: async (clientId: number, id: number): Promise<void> => {
    await apiRequest("DELETE", `/api/client/${clientId}/users/${id}`, undefined);
  },
};
