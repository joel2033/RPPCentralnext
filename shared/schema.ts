import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  company: text("company"),
  role: text("role").default("user"),
  profileImage: text("profile_image"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  company: text("company"),
  category: text("category"),
  profileImage: text("profile_image"),
  totalValue: decimal("total_value", { precision: 10, scale: 2 }).default("0"),
  averageJobValue: decimal("average_job_value", { precision: 10, scale: 2 }).default("0"),
  jobsCompleted: integer("jobs_completed").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull(), // "product", "package", "addon"
  category: text("category"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).default("10"),
  hasVariations: boolean("has_variations").default(false),
  variants: integer("variants").default(0),
  isActive: boolean("is_active").default(true),
  isLive: boolean("is_live").default(true),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const jobs = pgTable("jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").references(() => customers.id),
  address: text("address").notNull(),
  status: text("status").default("scheduled"), // "scheduled", "in_progress", "completed", "cancelled"
  dueDate: timestamp("due_date"),
  appointmentDate: timestamp("appointment_date"),
  totalValue: decimal("total_value", { precision: 10, scale: 2 }).default("0"),
  propertyImage: text("property_image"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderNumber: text("order_number").notNull().unique(),
  jobId: varchar("job_id").references(() => jobs.id),
  customerId: varchar("customer_id").references(() => customers.id),
  status: text("status").default("pending"), // "pending", "shared", "in_review", "completed", "cancelled"
  assignedTo: text("assigned_to"),
  createdBy: varchar("created_by").references(() => users.id),
  estimatedTotal: decimal("estimated_total", { precision: 10, scale: 2 }).default("0"),
  dateAccepted: timestamp("date_accepted"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  createdAt: true,
  totalValue: true,
  averageJobValue: true,
  jobsCompleted: true,
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
});

export const insertJobSchema = z.object({
  customerId: z.string().optional(),
  address: z.string(),
  status: z.string().optional(),
  dueDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  appointmentDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  totalValue: z.string().optional(),
  propertyImage: z.string().optional(),
  notes: z.string().optional(),
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;

export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

export type Job = typeof jobs.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;

export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
