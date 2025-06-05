import { users, type User, type InsertUser, type UpdateUser } from "@shared/schema";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByOktaId(oktaId: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByLogin(login: string): Promise<User | undefined>;
  getAllUsers(options?: {
    search?: string;
    status?: string;
    department?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ users: User[]; total: number }>;
  createUser(user: InsertUser & { oktaId?: string }): Promise<User>;
  updateUser(id: number, updates: UpdateUser): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private currentId: number;

  constructor() {
    this.users = new Map();
    this.currentId = 1;
    this.seedData();
  }

  private seedData() {
    // Add some initial users for demonstration
    const sampleUsers = [
      {
        oktaId: "00u1abc2def3ghi4jkl5",
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@company.com",
        login: "john.doe",
        mobilePhone: "+1 (555) 123-4567",
        department: "Engineering",
        title: "Senior Software Engineer",
        status: "ACTIVE",
        groups: ["Engineering Team", "All Employees"],
        applications: ["Microsoft 365", "Slack"],
        lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        passwordChanged: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
      },
      {
        oktaId: "00u2def3ghi4jkl5mno6",
        firstName: "Jane",
        lastName: "Smith",
        email: "jane.smith@company.com",
        login: "jane.smith",
        mobilePhone: "+1 (555) 234-5678",
        department: "Marketing",
        title: "Marketing Manager",
        status: "SUSPENDED",
        groups: ["Marketing Team", "All Employees"],
        applications: ["Microsoft 365"],
        lastLogin: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        passwordChanged: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      },
      {
        oktaId: "00u3ghi4jkl5mno6pqr7",
        firstName: "Mike",
        lastName: "Brown",
        email: "mike.brown@company.com",
        login: "mike.brown",
        mobilePhone: "+1 (555) 345-6789",
        department: "Engineering",
        title: "DevOps Engineer",
        status: "ACTIVE",
        groups: ["Engineering Team", "All Employees"],
        applications: ["Microsoft 365", "Slack", "GitHub"],
        lastLogin: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        passwordChanged: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      },
    ];

    sampleUsers.forEach((userData) => {
      const user: User = {
        id: this.currentId++,
        ...userData,
        created: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        lastUpdated: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      };
      this.users.set(user.id, user);
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByOktaId(oktaId: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.oktaId === oktaId);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async getUserByLogin(login: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.login === login);
  }

  async getAllUsers(options?: {
    search?: string;
    status?: string;
    department?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ users: User[]; total: number }> {
    let filteredUsers = Array.from(this.users.values());

    // Apply filters
    if (options?.search) {
      const search = options.search.toLowerCase();
      filteredUsers = filteredUsers.filter(user =>
        user.firstName.toLowerCase().includes(search) ||
        user.lastName.toLowerCase().includes(search) ||
        user.email.toLowerCase().includes(search) ||
        user.login.toLowerCase().includes(search)
      );
    }

    if (options?.status) {
      filteredUsers = filteredUsers.filter(user => user.status === options.status);
    }

    if (options?.department) {
      filteredUsers = filteredUsers.filter(user => user.department === options.department);
    }

    const total = filteredUsers.length;

    // Apply pagination
    if (options?.offset) {
      filteredUsers = filteredUsers.slice(options.offset);
    }
    if (options?.limit) {
      filteredUsers = filteredUsers.slice(0, options.limit);
    }

    return { users: filteredUsers, total };
  }

  async createUser(insertUser: InsertUser & { oktaId?: string }): Promise<User> {
    const id = this.currentId++;
    const user: User = {
      id,
      oktaId: insertUser.oktaId || `okta_${id}`,
      firstName: insertUser.firstName,
      lastName: insertUser.lastName,
      email: insertUser.email,
      login: insertUser.login,
      mobilePhone: insertUser.mobilePhone || null,
      department: insertUser.department || null,
      title: insertUser.title || null,
      status: insertUser.status || "ACTIVE",
      groups: insertUser.groups || [],
      applications: insertUser.applications || [],
      created: new Date(),
      lastUpdated: new Date(),
      lastLogin: null,
      passwordChanged: null,
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: number, updates: UpdateUser): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;

    const updatedUser: User = {
      ...user,
      ...updates,
      lastUpdated: new Date(),
    };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async deleteUser(id: number): Promise<boolean> {
    return this.users.delete(id);
  }
}

export const storage = new MemStorage();
