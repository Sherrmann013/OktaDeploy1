import { pgTable, serial, varchar, text, timestamp, integer, boolean, jsonb, unique, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Client Database Schema - Each client gets their own database with this schema
// NO client_id columns needed since each database is isolated per client

// Users table for this specific client
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  oktaId: varchar('okta_id', { length: 255 }).unique(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  login: varchar('login', { length: 100 }).unique().notNull(),
  mobilePhone: varchar('mobile_phone', { length: 50 }),
  department: varchar('department', { length: 100 }),
  title: varchar('title', { length: 200 }),
  employeeType: varchar('employee_type', { length: 50 }), // EMPLOYEE, CONTRACTOR, INTERN, PART_TIME
  status: varchar('status', { length: 20 }).notNull().default('ACTIVE'),
  groups: text('groups').array().default([]),
  applications: text('applications').array().default([]),
  profileImageUrl: text('profile_image_url'),
  managerId: integer('manager_id'),
  manager: varchar('manager', { length: 200 }),
  created: timestamp('created').defaultNow().notNull(),
  lastUpdated: timestamp('last_updated').defaultNow().notNull(),
  lastLogin: timestamp('last_login'),
  passwordChanged: timestamp('password_changed'),
});

// Site access users - Admin users for this client
export const siteAccessUsers = pgTable('site_access_users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  role: varchar('role', { length: 50 }).notNull().default('admin'),
  isActive: boolean('is_active').notNull().default(true),
  lastLogin: timestamp('last_login'),
  created: timestamp('created').defaultNow().notNull(),
});

// Integrations for this client
export const integrations = pgTable('integrations', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  displayName: varchar('display_name', { length: 100 }),
  description: text('description'),
  status: varchar('status', { length: 20 }).notNull().default('disconnected'),
  apiKeys: jsonb('api_keys').default('{}'),
  config: jsonb('config').default('{}'),
  created: timestamp('created').defaultNow().notNull(),
  lastUpdated: timestamp('last_updated').defaultNow().notNull(),
});

// Layout settings for this client
export const layoutSettings = pgTable('layout_settings', {
  id: serial('id').primaryKey(),
  settingKey: varchar('setting_key', { length: 100 }).notNull().unique(),
  settingValue: text('setting_value'),
  settingType: varchar('setting_type', { length: 50 }).notNull(),
  metadata: jsonb('metadata').default('{}'),
  updatedBy: integer('updated_by').references(() => siteAccessUsers.id),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Dashboard cards for this client
export const dashboardCards = pgTable('dashboard_cards', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  enabled: boolean('enabled').notNull().default(true),
  position: integer('position').notNull().default(0),
  created: timestamp('created').defaultNow().notNull(),
  updated: timestamp('updated').defaultNow().notNull(),
});

// Monitoring cards for this client
export const monitoringCards = pgTable('monitoring_cards', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  enabled: boolean('enabled').notNull().default(true),
  position: integer('position').notNull().default(0),
  created: timestamp('created').defaultNow().notNull(),
  updated: timestamp('updated').defaultNow().notNull(),
});

// Company logos for this client
export const companyLogos = pgTable('company_logos', {
  id: serial('id').primaryKey(),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  fileSize: integer('file_size').notNull(),
  logoData: text('logo_data').notNull(),
  isActive: boolean('is_active').notNull().default(false),
  uploadedBy: integer('uploaded_by').references(() => siteAccessUsers.id),
  uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
});

// Audit logs for this client
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => siteAccessUsers.id),
  userEmail: varchar('user_email', { length: 255 }).notNull(),
  action: varchar('action', { length: 50 }).notNull(),
  resourceType: varchar('resource_type', { length: 50 }).notNull(),
  resourceId: varchar('resource_id', { length: 100 }),
  resourceName: text('resource_name'),
  details: jsonb('details').notNull().default('{}'),
  oldValues: jsonb('old_values').default('{}'),
  newValues: jsonb('new_values').default('{}'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

// App mappings for this client
export const appMappings = pgTable('app_mappings', {
  id: serial('id').primaryKey(),
  appName: varchar('app_name', { length: 100 }).notNull(),
  oktaGroupName: varchar('okta_group_name', { length: 200 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  created: timestamp('created').defaultNow().notNull(),
  lastUpdated: timestamp('last_updated').defaultNow().notNull(),
}, (table) => [
  index('app_group_unique').on(table.appName, table.oktaGroupName)
]);

// Schema validation
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  created: true,
  lastUpdated: true,
}).extend({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  login: z.string().min(1, "Login is required"),
  status: z.enum(["ACTIVE", "SUSPENDED", "DEPROVISIONED"], { required_error: "Status is required" }).default("ACTIVE"),
});

export const insertSiteAccessUserSchema = createInsertSchema(siteAccessUsers).omit({
  id: true,
  created: true,
}).extend({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  role: z.enum(["admin", "user"], { required_error: "Role is required" }).default("admin"),
});

export const insertIntegrationSchema = createInsertSchema(integrations).omit({
  id: true,
  created: true,
  lastUpdated: true,
}).extend({
  name: z.string().min(1, "Integration name is required"),
  status: z.enum(["connected", "pending", "disconnected"], { required_error: "Status is required" }).default("disconnected"),
});

export const insertLayoutSettingSchema = createInsertSchema(layoutSettings).omit({
  id: true,
  updatedAt: true,
}).extend({
  settingKey: z.string().min(1, "Setting key is required"),
  settingType: z.string().min(1, "Setting type is required"),
});

export const insertDashboardCardSchema = createInsertSchema(dashboardCards).omit({
  id: true,
  created: true,
  updated: true,
}).extend({
  name: z.string().min(1, "Card name is required"),
  type: z.string().min(1, "Card type is required"),
});

export const insertCompanyLogoSchema = createInsertSchema(companyLogos).omit({
  id: true,
  uploadedAt: true,
}).extend({
  fileName: z.string().min(1, "File name is required"),
  mimeType: z.string().min(1, "MIME type is required"),
  logoData: z.string().min(1, "Logo data is required"),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  timestamp: true,
}).extend({
  action: z.string().min(1, "Action is required"),
  resourceType: z.string().min(1, "Resource type is required"),
  userEmail: z.string().email("Invalid email address"),
});

// Type exports
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateUser = Partial<InsertUser>;

export type SiteAccessUser = typeof siteAccessUsers.$inferSelect;
export type InsertSiteAccessUser = z.infer<typeof insertSiteAccessUserSchema>;

export type Integration = typeof integrations.$inferSelect;
export type InsertIntegration = z.infer<typeof insertIntegrationSchema>;
export type UpdateIntegration = Partial<InsertIntegration>;

export type LayoutSetting = typeof layoutSettings.$inferSelect;
export type InsertLayoutSetting = z.infer<typeof insertLayoutSettingSchema>;

export type DashboardCard = typeof dashboardCards.$inferSelect;
export type InsertDashboardCard = z.infer<typeof insertDashboardCardSchema>;
export type UpdateDashboardCard = Partial<InsertDashboardCard>;

export type CompanyLogo = typeof companyLogos.$inferSelect;
export type InsertCompanyLogo = z.infer<typeof insertCompanyLogoSchema>;

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

export type AppMapping = typeof appMappings.$inferSelect;