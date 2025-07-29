import { users, type User, type InsertUser, type UpdateUser } from "@shared/schema";
import { db } from "./db";
import { eq, and, or, ilike, desc } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByOktaId(oktaId: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByLogin(login: string): Promise<User | undefined>;
  getAllUsers(options?: {
    search?: string;
    status?: string;
    department?: string;
    employeeType?: string;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
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
        firstName: "Sherrmann",
        lastName: "User",
        email: "sherrmann@mazetx.com",
        login: "sherrmann",
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
    employeeType?: string;
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

    if (options?.employeeType) {
      filteredUsers = filteredUsers.filter(user => user.employeeType === options.employeeType);
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

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByOktaId(oktaId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.oktaId, oktaId));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getUserByLogin(login: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.login, login));
    return user || undefined;
  }

  async getAllUsers(options?: {
    search?: string;
    status?: string;
    department?: string;
    employeeType?: string;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ users: User[]; total: number }> {
    let whereConditions: any[] = [];

    // Apply filters
    if (options?.search) {
      const searchTerm = `%${options.search}%`;
      whereConditions.push(
        or(
          ilike(users.firstName, searchTerm),
          ilike(users.lastName, searchTerm),
          ilike(users.email, searchTerm),
          ilike(users.login, searchTerm)
        )
      );
    }

    if (options?.status) {
      whereConditions.push(eq(users.status, options.status));
    }

    if (options?.department) {
      whereConditions.push(eq(users.department, options.department));
    }

    if (options?.employeeType) {
      whereConditions.push(eq(users.employeeType, options.employeeType));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    // Get total count
    const totalResult = await db
      .select({ count: users.id })
      .from(users)
      .where(whereClause);
    const total = totalResult.length;

    // Get paginated results with dynamic sorting
    let query = db.select().from(users).where(whereClause);
    
    // Apply sorting
    if (options?.sortBy && options?.sortOrder) {
      const isDesc = options.sortOrder === 'desc';
      switch (options.sortBy) {
        case 'firstName':
          query = isDesc ? query.orderBy(desc(users.firstName)) : query.orderBy(users.firstName);
          break;
        case 'lastName':
          query = isDesc ? query.orderBy(desc(users.lastName)) : query.orderBy(users.lastName);
          break;
        case 'email':
          query = isDesc ? query.orderBy(desc(users.email)) : query.orderBy(users.email);
          break;
        case 'title':
          query = isDesc ? query.orderBy(desc(users.title)) : query.orderBy(users.title);
          break;
        case 'department':
          query = isDesc ? query.orderBy(desc(users.department)) : query.orderBy(users.department);
          break;
        case 'employeeType':
          query = isDesc ? query.orderBy(desc(users.employeeType)) : query.orderBy(users.employeeType);
          break;
        case 'status':
          query = isDesc ? query.orderBy(desc(users.status)) : query.orderBy(users.status);
          break;
        case 'lastLogin':
          query = isDesc ? query.orderBy(desc(users.lastLogin)) : query.orderBy(users.lastLogin);
          break;
        case 'lastUpdated':
          query = isDesc ? query.orderBy(desc(users.lastUpdated)) : query.orderBy(users.lastUpdated);
          break;
        default:
          query = query.orderBy(desc(users.created));
      }
    } else {
      // Default sorting
      query = query.orderBy(desc(users.created));
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.offset(options.offset);
    }

    const userResults = await query;

    return { users: userResults, total };
  }

  async createUser(insertUser: InsertUser & { oktaId?: string }): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        oktaId: insertUser.oktaId || `okta_${Date.now()}`,
        firstName: insertUser.firstName,
        lastName: insertUser.lastName,
        email: insertUser.email,
        login: insertUser.login,
        mobilePhone: insertUser.mobilePhone || null,
        department: insertUser.department || null,
        title: insertUser.title || null,
        manager: insertUser.manager || null,
        employeeType: insertUser.employeeType || null,
        managerId: insertUser.managerId || null,
        status: insertUser.status || "ACTIVE",
        groups: insertUser.groups || [],
        applications: insertUser.applications || [],
        created: new Date(),
        lastUpdated: new Date(),
        lastLogin: null,
        passwordChanged: null,
      })
      .returning();
    return user;
  }

  async updateUser(id: number, updates: UpdateUser): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set({
        ...updates,
        lastUpdated: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    return updatedUser || undefined;
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return (result.rowCount || 0) > 0;
  }
}

export const storage = new DatabaseStorage();
