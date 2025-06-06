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
  managerId: integer("manager_id").references(() => users.id),
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
  sendActivationEmail: z.boolean().optional(),
});

export const updateUserSchema = insertUserSchema.partial().omit({
  sendActivationEmail: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;
export type User = typeof users.$inferSelect;
