import { pgTable, text, serial, timestamp, boolean, integer, varchar, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for authentication
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  oktaId: text("okta_id").unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  login: text("login").notNull().unique(),
  mobilePhone: text("mobile_phone"),
  department: text("department"),
  title: text("title"),
  employeeType: text("employee_type"),
  profileImageUrl: text("profile_image_url"),
  managerId: integer("manager_id"),
  manager: text("manager"), // Manager's name from OKTA
  status: text("status").notNull().default("ACTIVE"), // ACTIVE, SUSPENDED, DEPROVISIONED
  groups: text("groups").array().default([]),
  applications: text("applications").array().default([]),
  created: timestamp("created").defaultNow(),
  lastUpdated: timestamp("last_updated").defaultNow(),
  lastLogin: timestamp("last_login"),
  passwordChanged: timestamp("password_changed"),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  oktaId: true,
  created: true,
  lastUpdated: true,
  lastLogin: true,
  passwordChanged: true,
}).extend({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  login: z.string().min(1, "Login is required"),
  password: z.string().length(10, "Password must be exactly 10 characters").optional(),
  sendActivationEmail: z.boolean().optional(),
  selectedApps: z.array(z.string()).optional(),
  selectedGroups: z.array(z.string()).optional(),
});

export const updateUserSchema = createInsertSchema(users).partial().omit({
  id: true,
  oktaId: true,
  created: true,
  lastUpdated: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;
export type User = typeof users.$inferSelect;

// Site access users table
export const siteAccessUsers = pgTable("site_access_users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  accessLevel: text("access_level").notNull(), // 'standard' or 'admin'
  initials: text("initials").notNull(),
  color: text("color").notNull(),
  created: timestamp("created").defaultNow(),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const insertSiteAccessUserSchema = createInsertSchema(siteAccessUsers).omit({
  id: true,
  created: true,
  lastUpdated: true,
}).extend({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  accessLevel: z.enum(["standard", "admin"], { required_error: "Access level is required" }),
});

export type InsertSiteAccessUser = z.infer<typeof insertSiteAccessUserSchema>;
export type SiteAccessUser = typeof siteAccessUsers.$inferSelect;

// Integrations table for storing API configurations
export const integrations = pgTable('integrations', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 20 }).notNull().default('disconnected'), // connected, pending, disconnected
  apiKeys: jsonb('api_keys').notNull().default('{}'), // Store encrypted API keys as JSON
  config: jsonb('config').default('{}'), // Additional configuration
  created: timestamp('created').defaultNow().notNull(),
  lastUpdated: timestamp('last_updated').defaultNow().notNull(),
});

export const insertIntegrationSchema = createInsertSchema(integrations).omit({
  id: true,
  created: true,
  lastUpdated: true,
}).extend({
  name: z.string().min(1, "Integration name is required"),
  displayName: z.string().min(1, "Display name is required"),
  status: z.enum(["connected", "pending", "disconnected"], { required_error: "Status is required" }),
  apiKeys: z.record(z.string()).default({}),
  config: z.record(z.any()).default({})
});

export type InsertIntegration = z.infer<typeof insertIntegrationSchema>;
export type Integration = typeof integrations.$inferSelect;

// Audit logs table for tracking all system changes
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id'), // ID of the user who performed the action
  userEmail: text('user_email').notNull(), // Email of the user who performed the action
  action: varchar('action', { length: 100 }).notNull(), // CREATE, UPDATE, DELETE, LOGIN, etc.
  resourceType: varchar('resource_type', { length: 50 }).notNull(), // USER, INTEGRATION, SITE_ACCESS_USER, etc.
  resourceId: text('resource_id'), // ID of the affected resource
  resourceName: text('resource_name'), // Name/identifier of the affected resource
  details: jsonb('details').notNull().default('{}'), // Additional details about the change
  oldValues: jsonb('old_values').default('{}'), // Previous values (for updates)
  newValues: jsonb('new_values').default('{}'), // New values (for creates/updates)
  ipAddress: text('ip_address'), // IP address of the user
  userAgent: text('user_agent'), // User agent string
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  timestamp: true,
}).extend({
  action: z.string().min(1, "Action is required"),
  resourceType: z.string().min(1, "Resource type is required"),
  userEmail: z.string().email("Invalid email address"),
  details: z.record(z.any()).default({}),
  oldValues: z.record(z.any()).default({}),
  newValues: z.record(z.any()).default({})
});

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

// App mappings table for OKTA application-to-group relationships
export const appMappings = pgTable('app_mappings', {
  id: serial('id').primaryKey(),
  appName: varchar('app_name', { length: 100 }).notNull(),
  oktaGroupName: varchar('okta_group_name', { length: 200 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 20 }).notNull().default('active'), // active, inactive
  created: timestamp('created').defaultNow().notNull(),
  lastUpdated: timestamp('last_updated').defaultNow().notNull(),
}, (table) => [
  // Unique constraint on combination of appName and oktaGroupName
  index('app_group_unique').on(table.appName, table.oktaGroupName)
]);

export const insertAppMappingSchema = createInsertSchema(appMappings).omit({
  id: true,
  created: true,
  lastUpdated: true,
}).extend({
  appName: z.string().min(1, "App name is required"),
  oktaGroupName: z.string().min(1, "OKTA group name is required"),
  status: z.enum(["active", "inactive"], { required_error: "Status is required" }).default("active"),
});

export type InsertAppMapping = z.infer<typeof insertAppMappingSchema>;
export type AppMapping = typeof appMappings.$inferSelect;

// Department Application Assignments
export const departmentAppMappings = pgTable('department_app_mappings', {
  id: serial('id').primaryKey(),
  departmentName: varchar('department_name', { length: 100 }).notNull(),
  appName: varchar('app_name', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').defaultNow()
});

export const employeeTypeAppMappings = pgTable('employee_type_app_mappings', {
  id: serial('id').primaryKey(),
  employeeTypeName: varchar('employee_type_name', { length: 100 }).notNull(),
  appName: varchar('app_name', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').defaultNow()
});

export const insertDepartmentAppMappingSchema = createInsertSchema(departmentAppMappings).omit({
  id: true,
  createdAt: true,
});

export const insertEmployeeTypeAppMappingSchema = createInsertSchema(employeeTypeAppMappings).omit({
  id: true,
  createdAt: true,
});

export type InsertDepartmentAppMapping = z.infer<typeof insertDepartmentAppMappingSchema>;
export type DepartmentAppMapping = typeof departmentAppMappings.$inferSelect;
export type InsertEmployeeTypeAppMapping = z.infer<typeof insertEmployeeTypeAppMappingSchema>;
export type EmployeeTypeAppMapping = typeof employeeTypeAppMappings.$inferSelect;

// Layout customization schema
export const layoutSettings = pgTable('layout_settings', {
  id: serial('id').primaryKey(),
  settingKey: varchar('setting_key', { length: 100 }).notNull().unique(),
  settingValue: text('setting_value'),
  settingType: varchar('setting_type', { length: 50 }).notNull(), // 'logo', 'card_layout', 'app_config', 'user_config'
  metadata: jsonb('metadata').default('{}'), // Additional config as JSON
  updatedBy: integer('updated_by').references(() => siteAccessUsers.id),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const insertLayoutSettingSchema = createInsertSchema(layoutSettings).omit({
  id: true,
  updatedAt: true,
}).extend({
  settingKey: z.string().min(1, "Setting key is required"),
  settingType: z.enum(["logo", "card_layout", "app_config", "user_config"], { required_error: "Setting type is required" }),
  metadata: z.record(z.any()).default({})
});

export type InsertLayoutSetting = z.infer<typeof insertLayoutSettingSchema>;
export type LayoutSetting = typeof layoutSettings.$inferSelect;

// Dashboard cards table for layout management
export const dashboardCards = pgTable("dashboard_cards", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // knowbe4, sentinelone, device_management, jira
  position: integer("position").notNull(), // 0, 1, 2, 3 for 2x2 grid
  enabled: boolean("enabled").notNull().default(true),
  created: timestamp("created").defaultNow(),
  updated: timestamp("updated").defaultNow(),
});

export const insertDashboardCardSchema = createInsertSchema(dashboardCards).omit({
  id: true,
  created: true,
  updated: true,
});

export const updateDashboardCardSchema = createInsertSchema(dashboardCards).partial().omit({
  id: true,
  created: true,
});

export type InsertDashboardCard = z.infer<typeof insertDashboardCardSchema>;
export type UpdateDashboardCard = z.infer<typeof updateDashboardCardSchema>;
export type DashboardCard = typeof dashboardCards.$inferSelect;
