import { z } from "zod";

// Demo User Schema
export const demoUserSchema = z.object({
  id: z.number(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
  login: z.string(),
  mobilePhone: z.string().nullable(),
  department: z.string().nullable(),
  title: z.string().nullable(),
  employeeType: z.enum(['EMPLOYEE', 'CONTRACTOR', 'INTERN', 'PART_TIME']).nullable(),
  manager: z.string().nullable(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DEPROVISIONED']).default('ACTIVE'),
  groups: z.array(z.string()).default([]),
  applications: z.array(z.string()).default([]),
  created: z.date(),
  lastUpdated: z.date(),
  lastLogin: z.date().nullable(),
  passwordChanged: z.date().nullable(),
});

export const insertDemoUserSchema = demoUserSchema.omit({ id: true, created: true, lastUpdated: true });

export type DemoUser = z.infer<typeof demoUserSchema>;
export type InsertDemoUser = z.infer<typeof insertDemoUserSchema>;

export interface IDemoStorage {
  getUser(id: number): Promise<DemoUser | undefined>;
  getUserByEmail(email: string): Promise<DemoUser | undefined>;
  getUserByLogin(login: string): Promise<DemoUser | undefined>;
  getAllUsers(options?: {
    search?: string;
    status?: string;
    department?: string;
    employeeType?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ users: DemoUser[]; total: number }>;
  createUser(user: InsertDemoUser): Promise<DemoUser>;
  updateUser(id: number, updates: Partial<InsertDemoUser>): Promise<DemoUser | undefined>;
  deleteUser(id: number): Promise<boolean>;
  authenticateAdmin(username: string, password: string): Promise<boolean>;
}

export class DemoStorage implements IDemoStorage {
  private users: Map<number, DemoUser>;
  private currentId: number;

  constructor() {
    this.users = new Map();
    this.currentId = 1;
    this.seedDemoData();
  }

  private seedDemoData() {
    const demoUsers = [
      {
        firstName: "Christopher", lastName: "Walker", email: "christopher.walker@company.com", login: "christopher.walker",
        mobilePhone: "+1 (555) 123-4567", department: "IT Security", title: "CISO", employeeType: "EMPLOYEE" as const,
        manager: "Sarah Johnson", status: "ACTIVE" as const, groups: ["IT Security", "Executive"], applications: ["Microsoft 365", "Okta"],
        lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000), passwordChanged: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
      },
      {
        firstName: "Sarah", lastName: "Johnson", email: "sarah.johnson@company.com", login: "sarah.johnson",
        mobilePhone: "+1 (555) 234-5678", department: "Executive", title: "CEO", employeeType: "EMPLOYEE" as const,
        manager: null, status: "ACTIVE" as const, groups: ["Executive", "All Staff"], applications: ["Microsoft 365", "Salesforce"],
        lastLogin: new Date(Date.now() - 4 * 60 * 60 * 1000), passwordChanged: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000)
      },
      {
        firstName: "Michael", lastName: "Chen", email: "michael.chen@company.com", login: "michael.chen",
        mobilePhone: "+1 (555) 345-6789", department: "IT Security", title: "Security Engineer", employeeType: "EMPLOYEE" as const,
        manager: "Christopher Walker", status: "ACTIVE" as const, groups: ["IT Security", "Engineering"], applications: ["Microsoft 365", "Splunk"],
        lastLogin: new Date(Date.now() - 1 * 60 * 60 * 1000), passwordChanged: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      },
      {
        firstName: "Emily", lastName: "Rodriguez", email: "emily.rodriguez@company.com", login: "emily.rodriguez",
        mobilePhone: "+1 (555) 456-7890", department: "HR", title: "HR Director", employeeType: "EMPLOYEE" as const,
        manager: "Sarah Johnson", status: "ACTIVE" as const, groups: ["HR", "Management"], applications: ["Microsoft 365", "BambooHR"],
        lastLogin: new Date(Date.now() - 3 * 60 * 60 * 1000), passwordChanged: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
      },
      {
        firstName: "David", lastName: "Thompson", email: "david.thompson@company.com", login: "david.thompson",
        mobilePhone: "+1 (555) 567-8901", department: "IT", title: "IT Manager", employeeType: "EMPLOYEE" as const,
        manager: "Christopher Walker", status: "ACTIVE" as const, groups: ["IT", "Management"], applications: ["Microsoft 365", "ServiceNow"],
        lastLogin: new Date(Date.now() - 6 * 60 * 60 * 1000), passwordChanged: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000)
      },
      {
        firstName: "Lisa", lastName: "Anderson", email: "lisa.anderson@company.com", login: "lisa.anderson",
        mobilePhone: "+1 (555) 678-9012", department: "IT Security", title: "Security Analyst", employeeType: "CONTRACTOR" as const,
        manager: "Christopher Walker", status: "ACTIVE" as const, groups: ["IT Security", "Contractors"], applications: ["Microsoft 365", "CrowdStrike"],
        lastLogin: new Date(Date.now() - 5 * 60 * 60 * 1000), passwordChanged: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      },
      {
        firstName: "James", lastName: "Wilson", email: "james.wilson@company.com", login: "james.wilson",
        mobilePhone: "+1 (555) 789-0123", department: "Legal", title: "Legal Counsel", employeeType: "EMPLOYEE" as const,
        manager: "Sarah Johnson", status: "ACTIVE" as const, groups: ["Legal", "Management"], applications: ["Microsoft 365", "DocuSign"],
        lastLogin: new Date(Date.now() - 8 * 60 * 60 * 1000), passwordChanged: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000)
      },
      {
        firstName: "Maria", lastName: "Garcia", email: "maria.garcia@company.com", login: "maria.garcia",
        mobilePhone: "+1 (555) 890-1234", department: "IT", title: "System Administrator", employeeType: "EMPLOYEE" as const,
        manager: "David Thompson", status: "ACTIVE" as const, groups: ["IT", "Operations"], applications: ["Microsoft 365", "VMware"],
        lastLogin: new Date(Date.now() - 12 * 60 * 60 * 1000), passwordChanged: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
      },
      {
        firstName: "Robert", lastName: "Davis", email: "robert.davis@company.com", login: "robert.davis",
        mobilePhone: "+1 (555) 901-2345", department: "IT Security", title: "Penetration Tester", employeeType: "CONTRACTOR" as const,
        manager: "Christopher Walker", status: "SUSPENDED" as const, groups: ["IT Security", "Contractors"], applications: ["Microsoft 365", "Kali Linux"],
        lastLogin: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), passwordChanged: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000)
      },
      {
        firstName: "Jennifer", lastName: "Miller", email: "jennifer.miller@company.com", login: "jennifer.miller",
        mobilePhone: "+1 (555) 012-3456", department: "HR", title: "HR Specialist", employeeType: "EMPLOYEE" as const,
        manager: "Emily Rodriguez", status: "ACTIVE" as const, groups: ["HR", "Staff"], applications: ["Microsoft 365", "BambooHR"],
        lastLogin: new Date(Date.now() - 24 * 60 * 60 * 1000), passwordChanged: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000)
      },
      {
        firstName: "Alex", lastName: "Kim", email: "alex.kim@company.com", login: "alex.kim",
        mobilePhone: "+1 (555) 123-4567", department: "IT Security", title: "Security Intern", employeeType: "INTERN" as const,
        manager: "Michael Chen", status: "ACTIVE" as const, groups: ["IT Security", "Interns"], applications: ["Microsoft 365", "Learning Portal"],
        lastLogin: new Date(Date.now() - 4 * 60 * 60 * 1000), passwordChanged: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      },
      {
        firstName: "Rachel", lastName: "Brown", email: "rachel.brown@company.com", login: "rachel.brown",
        mobilePhone: "+1 (555) 234-5678", department: "IT", title: "Network Engineer", employeeType: "EMPLOYEE" as const,
        manager: "David Thompson", status: "ACTIVE" as const, groups: ["IT", "Engineering"], applications: ["Microsoft 365", "Cisco"],
        lastLogin: new Date(Date.now() - 1 * 60 * 60 * 1000), passwordChanged: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000)
      },
      {
        firstName: "Kevin", lastName: "Lee", email: "kevin.lee@company.com", login: "kevin.lee",
        mobilePhone: "+1 (555) 345-6789", department: "IT Security", title: "Compliance Officer", employeeType: "EMPLOYEE" as const,
        manager: "Christopher Walker", status: "ACTIVE" as const, groups: ["IT Security", "Compliance"], applications: ["Microsoft 365", "GRC Platform"],
        lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000), passwordChanged: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000)
      },
      {
        firstName: "Amanda", lastName: "Taylor", email: "amanda.taylor@company.com", login: "amanda.taylor",
        mobilePhone: "+1 (555) 456-7890", department: "Legal", title: "Privacy Officer", employeeType: "PART_TIME" as const,
        manager: "James Wilson", status: "ACTIVE" as const, groups: ["Legal", "Privacy"], applications: ["Microsoft 365", "OneTrust"],
        lastLogin: new Date(Date.now() - 48 * 60 * 60 * 1000), passwordChanged: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      },
      {
        firstName: "Daniel", lastName: "White", email: "daniel.white@company.com", login: "daniel.white",
        mobilePhone: "+1 (555) 567-8901", department: "IT", title: "Database Administrator", employeeType: "EMPLOYEE" as const,
        manager: "David Thompson", status: "ACTIVE" as const, groups: ["IT", "Database"], applications: ["Microsoft 365", "SQL Server"],
        lastLogin: new Date(Date.now() - 3 * 60 * 60 * 1000), passwordChanged: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
      },
      {
        firstName: "Jessica", lastName: "Moore", email: "jessica.moore@company.com", login: "jessica.moore",
        mobilePhone: "+1 (555) 678-9012", department: "IT Security", title: "Security Awareness Trainer", employeeType: "CONTRACTOR" as const,
        manager: "Christopher Walker", status: "ACTIVE" as const, groups: ["IT Security", "Training"], applications: ["Microsoft 365", "KnowBe4"],
        lastLogin: new Date(Date.now() - 6 * 60 * 60 * 1000), passwordChanged: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)
      },
      {
        firstName: "Ryan", lastName: "Johnson", email: "ryan.johnson@company.com", login: "ryan.johnson",
        mobilePhone: "+1 (555) 789-0123", department: "IT", title: "Help Desk Technician", employeeType: "EMPLOYEE" as const,
        manager: "David Thompson", status: "ACTIVE" as const, groups: ["IT", "Support"], applications: ["Microsoft 365", "ServiceNow"],
        lastLogin: new Date(Date.now() - 30 * 60 * 1000), passwordChanged: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)
      },
      {
        firstName: "Laura", lastName: "Martinez", email: "laura.martinez@company.com", login: "laura.martinez",
        mobilePhone: "+1 (555) 890-1234", department: "HR", title: "Recruiter", employeeType: "PART_TIME" as const,
        manager: "Emily Rodriguez", status: "ACTIVE" as const, groups: ["HR", "Recruiting"], applications: ["Microsoft 365", "LinkedIn"],
        lastLogin: new Date(Date.now() - 72 * 60 * 60 * 1000), passwordChanged: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000)
      },
      {
        firstName: "Thomas", lastName: "Anderson", email: "thomas.anderson@company.com", login: "thomas.anderson",
        mobilePhone: "+1 (555) 901-2345", department: "IT Security", title: "SOC Analyst", employeeType: "EMPLOYEE" as const,
        manager: "Michael Chen", status: "ACTIVE" as const, groups: ["IT Security", "SOC"], applications: ["Microsoft 365", "SIEM"],
        lastLogin: new Date(Date.now() - 45 * 60 * 1000), passwordChanged: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
      },
      {
        firstName: "Nicole", lastName: "Clark", email: "nicole.clark@company.com", login: "nicole.clark",
        mobilePhone: "+1 (555) 012-3456", department: "IT", title: "Cloud Engineer", employeeType: "CONTRACTOR" as const,
        manager: "David Thompson", status: "ACTIVE" as const, groups: ["IT", "Cloud"], applications: ["Microsoft 365", "AWS"],
        lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000), passwordChanged: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000)
      }
    ];

    demoUsers.forEach((userData) => {
      const user: DemoUser = {
        id: this.currentId++,
        ...userData,
        created: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000), // Random date in last 90 days
        lastUpdated: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Random date in last 7 days
      };
      this.users.set(user.id, user);
    });
  }

  async authenticateAdmin(username: string, password: string): Promise<boolean> {
    return username === "demo-admin" && password === "demo123";
  }

  async getUser(id: number): Promise<DemoUser | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<DemoUser | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async getUserByLogin(login: string): Promise<DemoUser | undefined> {
    return Array.from(this.users.values()).find(user => user.login === login);
  }

  async getAllUsers(options?: {
    search?: string;
    status?: string;
    department?: string;
    employeeType?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ users: DemoUser[]; total: number }> {
    let filteredUsers = Array.from(this.users.values());

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

    if (options?.offset) {
      filteredUsers = filteredUsers.slice(options.offset);
    }
    if (options?.limit) {
      filteredUsers = filteredUsers.slice(0, options.limit);
    }

    return { users: filteredUsers, total };
  }

  async createUser(insertUser: InsertDemoUser): Promise<DemoUser> {
    const id = this.currentId++;
    const user: DemoUser = {
      id,
      firstName: insertUser.firstName,
      lastName: insertUser.lastName,
      email: insertUser.email,
      login: insertUser.login,
      mobilePhone: insertUser.mobilePhone || null,
      department: insertUser.department || null,
      title: insertUser.title || null,
      employeeType: insertUser.employeeType || null,
      manager: insertUser.manager || null,
      status: insertUser.status || "ACTIVE",
      groups: insertUser.groups || [],
      applications: insertUser.applications || [],
      created: new Date(),
      lastUpdated: new Date(),
      lastLogin: insertUser.lastLogin || null,
      passwordChanged: insertUser.passwordChanged || null,
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: number, updates: Partial<InsertDemoUser>): Promise<DemoUser | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;

    const updatedUser: DemoUser = {
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

export const demoStorage = new DemoStorage();