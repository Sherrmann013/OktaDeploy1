import { users, companyLogos, clients, clientAccess, type User, type InsertUser, type UpdateUser, type CompanyLogo, type InsertCompanyLogo, type Client, type InsertClient, type UpdateClient, type ClientAccess } from "@shared/schema";
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
    clientId?: number;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ users: User[]; total: number }>;
  createUser(user: InsertUser & { oktaId?: string }): Promise<User>;
  updateUser(id: number, updates: UpdateUser): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  
  // Client methods
  getAllClients(): Promise<Client[]>;
  getClient(id: number): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: number, updates: UpdateClient): Promise<Client | undefined>;
  deleteClient(id: number): Promise<boolean>;
  
  // Client access methods
  getClientAccess(userId: number): Promise<ClientAccess[]>;
  getUserClientsAccess(userId: number): Promise<Client[]>;
  grantClientAccess(userId: number, clientId: number, accessLevel: string): Promise<ClientAccess>;
  revokeClientAccess(userId: number, clientId: number): Promise<boolean>;
  updateClientAccess(userId: number, clientId: number, accessLevel: string): Promise<ClientAccess | undefined>;
  
  // Company logo methods
  getAllLogos(clientId?: number): Promise<CompanyLogo[]>;
  getActiveLogo(clientId?: number): Promise<CompanyLogo | undefined>;
  createLogo(logo: InsertCompanyLogo): Promise<CompanyLogo>;
  setActiveLogo(id: number): Promise<boolean>;
  deleteLogo(id: number): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private clients: Map<number, Client>;
  private clientAccess: Map<string, ClientAccess>;
  private currentId: number;
  private currentClientId: number;

  constructor() {
    this.users = new Map();
    this.clients = new Map();
    this.clientAccess = new Map();
    this.currentId = 1;
    this.currentClientId = 1;
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
        employeeType: userData.title?.includes('Engineer') ? 'EMPLOYEE' : 'EMPLOYEE',
        profileImageUrl: null,
        managerId: null,
        manager: null,
        userType: 'CLIENT',
        clientId: 1, // Default client for existing users
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

  // Client methods
  async getAllClients(): Promise<Client[]> {
    return Array.from(this.clients.values());
  }

  async getClient(id: number): Promise<Client | undefined> {
    return this.clients.get(id);
  }

  async createClient(client: InsertClient): Promise<Client> {
    const newClient: Client = {
      id: this.currentClientId++,
      ...client,
      domain: client.domain || null,
      status: client.status || 'ACTIVE',
      logoUrl: client.logoUrl || null,
      primaryContact: client.primaryContact || null,
      contactEmail: client.contactEmail || null,
      description: client.description || null,
      displayName: client.displayName || null,
      companyName: client.companyName || null,
      companyInitials: client.companyInitials || null,
      identityProvider: client.identityProvider || null,
      notes: client.notes || null,
      created: new Date(),
      lastUpdated: new Date(),
    };
    this.clients.set(newClient.id, newClient);
    return newClient;
  }

  async updateClient(id: number, updates: UpdateClient): Promise<Client | undefined> {
    const client = this.clients.get(id);
    if (!client) return undefined;
    
    const updatedClient: Client = {
      ...client,
      ...updates,
      lastUpdated: new Date(),
    };
    this.clients.set(id, updatedClient);
    return updatedClient;
  }

  async deleteClient(id: number): Promise<boolean> {
    return this.clients.delete(id);
  }

  // Client access methods
  async getClientAccess(userId: number): Promise<ClientAccess[]> {
    return Array.from(this.clientAccess.values()).filter(access => access.userId === userId);
  }

  async getUserClientsAccess(userId: number): Promise<Client[]> {
    const accessList = await this.getClientAccess(userId);
    const clientIds = accessList.map(access => access.clientId);
    return Array.from(this.clients.values()).filter(client => clientIds.includes(client.id));
  }

  async grantClientAccess(userId: number, clientId: number, accessLevel: string): Promise<ClientAccess> {
    const access: ClientAccess = {
      id: Date.now(), // Simple ID for MemStorage
      userId,
      clientId,
      accessLevel,
      created: new Date(),
    };
    this.clientAccess.set(`${userId}-${clientId}`, access);
    return access;
  }

  async revokeClientAccess(userId: number, clientId: number): Promise<boolean> {
    return this.clientAccess.delete(`${userId}-${clientId}`);
  }

  async updateClientAccess(userId: number, clientId: number, accessLevel: string): Promise<ClientAccess | undefined> {
    const key = `${userId}-${clientId}`;
    const access = this.clientAccess.get(key);
    if (!access) return undefined;
    
    const updatedAccess: ClientAccess = {
      ...access,
      accessLevel,
    };
    this.clientAccess.set(key, updatedAccess);
    return updatedAccess;
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
      employeeType: insertUser.employeeType || null,
      profileImageUrl: insertUser.profileImageUrl || null,
      managerId: insertUser.managerId || null,
      manager: insertUser.manager || null,
      status: insertUser.status || "ACTIVE",
      groups: insertUser.groups || [],
      applications: insertUser.applications || [],
      userType: insertUser.userType || 'CLIENT',
      clientId: insertUser.clientId || null,
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

  // Company logo methods - Not implemented for MemStorage
  async getAllLogos(): Promise<CompanyLogo[]> {
    return [];
  }

  async getActiveLogo(): Promise<CompanyLogo | undefined> {
    return undefined;
  }

  async createLogo(logo: InsertCompanyLogo): Promise<CompanyLogo> {
    throw new Error("Logo management not implemented in MemStorage");
  }

  async setActiveLogo(id: number): Promise<boolean> {
    return false;
  }

  async deleteLogo(id: number): Promise<boolean> {
    return false;
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
    clientId?: number;
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

    // Build query with sorting, pagination
    let orderByClause;
    if (options?.sortBy && options?.sortOrder) {
      const isDesc = options.sortOrder === 'desc';
      switch (options.sortBy) {
        case 'firstName':
          orderByClause = isDesc ? desc(users.firstName) : users.firstName;
          break;
        case 'lastName':
          orderByClause = isDesc ? desc(users.lastName) : users.lastName;
          break;
        case 'email':
          orderByClause = isDesc ? desc(users.email) : users.email;
          break;
        case 'title':
          orderByClause = isDesc ? desc(users.title) : users.title;
          break;
        case 'department':
          orderByClause = isDesc ? desc(users.department) : users.department;
          break;
        case 'employeeType':
          orderByClause = isDesc ? desc(users.employeeType) : users.employeeType;
          break;
        case 'status':
          orderByClause = isDesc ? desc(users.status) : users.status;
          break;
        case 'lastLogin':
          orderByClause = isDesc ? desc(users.lastLogin) : users.lastLogin;
          break;
        case 'lastUpdated':
          orderByClause = isDesc ? desc(users.lastUpdated) : users.lastUpdated;
          break;
        default:
          orderByClause = desc(users.created);
      }
    } else {
      // Default sorting
      orderByClause = desc(users.created);
    }

    // Build the final query
    const baseQuery = db.select().from(users);
    const withWhere = whereClause ? baseQuery.where(whereClause) : baseQuery;
    const withOrder = withWhere.orderBy(orderByClause);
    const withLimit = options?.limit ? withOrder.limit(options.limit) : withOrder;
    const finalQuery = options?.offset ? withLimit.offset(options.offset) : withLimit;

    const userResults = await finalQuery;

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

  // Company logo methods
  async getAllLogos(clientId?: number): Promise<CompanyLogo[]> {
    const baseQuery = db.select().from(companyLogos);
    const withFilter = clientId !== undefined 
      ? baseQuery.where(eq(companyLogos.clientId, clientId))
      : baseQuery;
    
    const logos = await withFilter.orderBy(desc(companyLogos.uploadedAt));
    return logos;
  }

  async getActiveLogo(clientId?: number): Promise<CompanyLogo | undefined> {
    let whereConditions = [eq(companyLogos.isActive, true)];
    
    if (clientId !== undefined) {
      // Filter by specific clientId (0 for MSP, specific number for clients)
      whereConditions.push(eq(companyLogos.clientId, clientId));
    }
    
    const [logo] = await db.select().from(companyLogos).where(and(...whereConditions));
    return logo || undefined;
  }

  async createLogo(logo: InsertCompanyLogo): Promise<CompanyLogo> {
    // Get existing logos for this specific client context (0 for MSP, specific clientId for clients)
    const existingLogos = await this.getAllLogos(logo.clientId);
    const isFirstLogo = existingLogos.length === 0;

    // If we already have 3 logos for this client context, delete the oldest one
    if (existingLogos.length >= 3) {
      const oldestLogo = existingLogos[existingLogos.length - 1];
      await db.delete(companyLogos).where(eq(companyLogos.id, oldestLogo.id));
    }

    // If this is set to be active, deactivate all others for this client context only
    if (logo.isActive || isFirstLogo) {
      await db.update(companyLogos)
        .set({ isActive: false })
        .where(eq(companyLogos.clientId, logo.clientId));
    }

    const [newLogo] = await db
      .insert(companyLogos)
      .values({
        ...logo,
        isActive: logo.isActive || isFirstLogo,
      })
      .returning();
    
    return newLogo;
  }

  async setActiveLogo(id: number): Promise<boolean> {
    // First, get the logo to find its clientId context
    const [targetLogo] = await db.select().from(companyLogos).where(eq(companyLogos.id, id));
    if (!targetLogo) {
      return false;
    }

    // Deactivate all logos for this specific client context only
    await db.update(companyLogos)
      .set({ isActive: false })
      .where(eq(companyLogos.clientId, targetLogo.clientId));
    
    // Activate the selected logo
    const result = await db
      .update(companyLogos)
      .set({ isActive: true })
      .where(eq(companyLogos.id, id));
    
    return (result.rowCount || 0) > 0;
  }

  async deleteLogo(id: number): Promise<boolean> {
    const result = await db.delete(companyLogos).where(eq(companyLogos.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Client methods
  async getAllClients(): Promise<Client[]> {
    const clientList = await db.select().from(clients).orderBy(desc(clients.created));
    return clientList;
  }

  async getClient(id: number): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client || undefined;
  }

  async createClient(client: InsertClient): Promise<Client> {
    const [newClient] = await db
      .insert(clients)
      .values({
        ...client,
        created: new Date(),
        lastUpdated: new Date(),
      })
      .returning();
    return newClient;
  }

  async updateClient(id: number, updates: UpdateClient): Promise<Client | undefined> {
    const [updatedClient] = await db
      .update(clients)
      .set({
        ...updates,
        lastUpdated: new Date(),
      })
      .where(eq(clients.id, id))
      .returning();
    return updatedClient || undefined;
  }

  async deleteClient(id: number): Promise<boolean> {
    const result = await db.delete(clients).where(eq(clients.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Client access methods
  async getClientAccess(userId: number): Promise<ClientAccess[]> {
    const accessList = await db.select().from(clientAccess).where(eq(clientAccess.userId, userId));
    return accessList;
  }

  async getUserClientsAccess(userId: number): Promise<Client[]> {
    const accessList = await this.getClientAccess(userId);
    const clientIds = accessList.map(access => access.clientId);
    
    if (clientIds.length === 0) {
      return [];
    }
    
    const clientList = await db.select().from(clients).where(
      or(...clientIds.map(id => eq(clients.id, id)))
    );
    return clientList;
  }

  async grantClientAccess(userId: number, clientId: number, accessLevel: string): Promise<ClientAccess> {
    const [access] = await db
      .insert(clientAccess)
      .values({
        userId,
        clientId,
        accessLevel,
        created: new Date(),
      })
      .returning();
    return access;
  }

  async revokeClientAccess(userId: number, clientId: number): Promise<boolean> {
    const result = await db.delete(clientAccess)
      .where(and(eq(clientAccess.userId, userId), eq(clientAccess.clientId, clientId)));
    return (result.rowCount || 0) > 0;
  }

  async updateClientAccess(userId: number, clientId: number, accessLevel: string): Promise<ClientAccess | undefined> {
    const [updatedAccess] = await db
      .update(clientAccess)
      .set({ accessLevel })
      .where(and(eq(clientAccess.userId, userId), eq(clientAccess.clientId, clientId)))
      .returning();
    return updatedAccess || undefined;
  }
}

export const storage = new DatabaseStorage();
