import { pgTable, serial, varchar, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// MSP Database Schema - Contains only MSP-level data, no client-specific data

// MSP Users - Users who can access the MSP dashboard
export const mspUsers = pgTable('msp_users', {
  id: serial('id').primaryKey(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  login: varchar('login', { length: 100 }).unique().notNull(),
  role: varchar('role', { length: 50 }).notNull().default('msp_user'), // 'msp_admin', 'msp_user'
  isActive: boolean('is_active').notNull().default(true),
  lastLogin: timestamp('last_login'),
  created: timestamp('created').defaultNow().notNull(),
  lastUpdated: timestamp('last_updated').defaultNow().notNull(),
});

// Client Organizations - Master list of all client organizations
export const clients = pgTable('clients', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  domain: varchar('domain', { length: 255 }), // Client's primary domain
  status: varchar('status', { length: 20 }).notNull().default('ACTIVE'), // ACTIVE, SUSPENDED, ARCHIVED
  
  // Database connection info for this client
  databaseUrl: text('database_url').notNull(), // Connection string to client's isolated database
  databaseName: varchar('database_name', { length: 100 }).notNull().unique(),
  
  // Contact information
  primaryContact: varchar('primary_contact', { length: 255 }),
  contactEmail: varchar('contact_email', { length: 255 }),
  contactPhone: varchar('contact_phone', { length: 50 }),
  
  // Metadata
  logoUrl: text('logo_url'),
  timezone: varchar('timezone', { length: 100 }).default('UTC'),
  
  created: timestamp('created').defaultNow().notNull(),
  lastUpdated: timestamp('last_updated').defaultNow().notNull(),
});

// Client Access - Which MSP users can access which clients
export const clientAccess = pgTable('client_access', {
  id: serial('id').primaryKey(),
  mspUserId: integer('msp_user_id').references(() => mspUsers.id).notNull(),
  clientId: integer('client_id').references(() => clients.id).notNull(),
  accessLevel: varchar('access_level', { length: 50 }).notNull().default('standard'), // 'admin', 'standard', 'read_only'
  created: timestamp('created').defaultNow().notNull(),
});

// MSP-level audit logs (client management actions, etc.)
export const mspAuditLogs = pgTable('msp_audit_logs', {
  id: serial('id').primaryKey(),
  mspUserId: integer('msp_user_id').references(() => mspUsers.id),
  mspUserEmail: varchar('msp_user_email', { length: 255 }).notNull(),
  action: varchar('action', { length: 50 }).notNull(), // CREATE, UPDATE, DELETE, LOGIN, ACCESS
  resourceType: varchar('resource_type', { length: 50 }).notNull(), // CLIENT, MSP_USER, CLIENT_ACCESS
  resourceId: varchar('resource_id', { length: 100 }),
  resourceName: text('resource_name'),
  details: text('details'), // JSON string with additional details
  clientId: integer('client_id').references(() => clients.id), // null for MSP-level actions
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

// Schema validation
export const insertMspUserSchema = createInsertSchema(mspUsers).omit({
  id: true,
  created: true,
  lastUpdated: true,
}).extend({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  login: z.string().min(1, "Login is required"),
  role: z.enum(["msp_admin", "msp_user"], { required_error: "Role is required" }).default("msp_user"),
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  created: true,
  lastUpdated: true,
}).extend({
  name: z.string().min(1, "Client name is required"),
  databaseName: z.string().min(1, "Database name is required"),
  databaseUrl: z.string().min(1, "Database URL is required"),
  status: z.enum(["ACTIVE", "SUSPENDED", "ARCHIVED"], { required_error: "Status is required" }).default("ACTIVE"),
});

export const insertClientAccessSchema = createInsertSchema(clientAccess).omit({
  id: true,
  created: true,
}).extend({
  mspUserId: z.number().positive("MSP User ID is required"),
  clientId: z.number().positive("Client ID is required"),
  accessLevel: z.enum(["admin", "standard", "read_only"], { required_error: "Access level is required" }).default("standard"),
});

export const insertMspAuditLogSchema = createInsertSchema(mspAuditLogs).omit({
  id: true,
  timestamp: true,
}).extend({
  action: z.string().min(1, "Action is required"),
  resourceType: z.string().min(1, "Resource type is required"),
  mspUserEmail: z.string().email("Invalid email address"),
});

// Type exports
export type MspUser = typeof mspUsers.$inferSelect;
export type InsertMspUser = z.infer<typeof insertMspUserSchema>;
export type UpdateMspUser = Partial<InsertMspUser>;

export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type UpdateClient = Partial<InsertClient>;

export type ClientAccess = typeof clientAccess.$inferSelect;
export type InsertClientAccess = z.infer<typeof insertClientAccessSchema>;

export type MspAuditLog = typeof mspAuditLogs.$inferSelect;
export type InsertMspAuditLog = z.infer<typeof insertMspAuditLogSchema>;