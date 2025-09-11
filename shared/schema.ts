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
  role: text("role").default("partner"), // "partner", "admin", "photographer"
  partnerId: text("partner_id").notNull(), // Multi-tenant identifier
  profileImage: text("profile_image"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partnerId: text("partner_id").notNull(), // Multi-tenant identifier
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
  partnerId: text("partner_id").notNull(), // Multi-tenant identifier
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
  jobId: text("job_id").notNull().unique(), // NanoID for backend tracking
  partnerId: text("partner_id").notNull(), // Multi-tenant identifier
  customerId: varchar("customer_id").references(() => customers.id),
  address: text("address").notNull(),
  status: text("status").default("scheduled"), // "scheduled", "in_progress", "completed", "cancelled"
  assignedTo: varchar("assigned_to").references(() => users.id), // Photographer assigned
  dueDate: timestamp("due_date"),
  appointmentDate: timestamp("appointment_date"),
  totalValue: decimal("total_value", { precision: 10, scale: 2 }).default("0"),
  propertyImage: text("property_image"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partnerId: text("partner_id").notNull(), // Multi-tenant identifier
  orderNumber: text("order_number").notNull().unique(),
  jobId: varchar("job_id").references(() => jobs.id),
  customerId: varchar("customer_id").references(() => customers.id),
  status: text("status").default("pending"), // "pending", "processing", "in_revision", "completed", "cancelled"
  assignedTo: varchar("assigned_to").references(() => users.id),
  createdBy: varchar("created_by").references(() => users.id),
  estimatedTotal: decimal("estimated_total", { precision: 10, scale: 2 }).default("0"),
  dateAccepted: timestamp("date_accepted"),
  filesExpiryDate: timestamp("files_expiry_date"), // 14 days from upload
  createdAt: timestamp("created_at").defaultNow(),
});

// Order service items (tracks each service selected for an order)
export const orderServices = pgTable("order_services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").references(() => orders.id).notNull(),
  serviceId: varchar("service_id").references(() => editorServices.id).notNull(),
  quantity: integer("quantity").default(1),
  instructions: text("instructions"), // JSON array of instruction pairs
  exportTypes: text("export_types"), // JSON array of export type objects
  createdAt: timestamp("created_at").defaultNow(),
});

// Order files (tracks uploaded files for each order)
export const orderFiles = pgTable("order_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").references(() => orders.id).notNull(),
  serviceId: varchar("service_id").references(() => orderServices.id), // Optional - link to specific service
  fileName: text("file_name").notNull(),
  originalName: text("original_name").notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: text("mime_type").notNull(),
  firebaseUrl: text("firebase_url").notNull(),
  downloadUrl: text("download_url").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(), // 14 days from upload
});

// Editor service categories
export const serviceCategories = pgTable("service_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  editorId: text("editor_id").notNull(), // Firebase UID of editor
  name: text("name").notNull(),
  description: text("description"),
  displayOrder: integer("display_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Editor services
export const editorServices = pgTable("editor_services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  editorId: text("editor_id").notNull(), // Firebase UID of editor
  categoryId: varchar("category_id").references(() => serviceCategories.id),
  name: text("name").notNull(),
  description: text("description"),
  basePrice: decimal("base_price", { precision: 10, scale: 2 }).notNull(),
  pricePer: text("price_per").default("image"), // "image", "property", "hour", "fixed"
  estimatedTurnaround: text("estimated_turnaround"), // e.g., "24 hours", "2-3 days"
  isActive: boolean("is_active").default(true),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Editor uploads (tracks deliverable files uploaded by editors)
export const editorUploads = pgTable("editor_uploads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").references(() => orders.id).notNull(),
  jobId: varchar("job_id").references(() => jobs.id).notNull(),
  editorId: text("editor_id").notNull(), // Firebase UID of editor
  fileName: text("file_name").notNull(),
  originalName: text("original_name").notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: text("mime_type").notNull(),
  firebaseUrl: text("firebase_url").notNull(),
  downloadUrl: text("download_url").notNull(),
  status: text("status").default("uploaded"), // "uploaded", "processing", "delivered"
  notes: text("notes"), // Optional notes from editor about the deliverable
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(), // 30 days from upload
});

// Notifications system
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partnerId: text("partner_id").notNull(), // Multi-tenant identifier
  recipientId: text("recipient_id").notNull(), // Firebase UID of recipient (editor/user)
  type: text("type").notNull(), // "order_created", "order_assigned", "order_completed", "order_cancelled"
  title: text("title").notNull(),
  body: text("body").notNull(),
  orderId: varchar("order_id").references(() => orders.id),
  jobId: varchar("job_id").references(() => jobs.id),
  read: boolean("read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  readAt: timestamp("read_at"),
});

// Activity tracking system (comprehensive audit log)
export const activities = pgTable("activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partnerId: text("partner_id").notNull(), // Multi-tenant identifier
  jobId: varchar("job_id").references(() => jobs.id), // Optional - activity might not be job-specific
  orderId: varchar("order_id").references(() => orders.id), // Optional - activity might be order-specific
  customerId: varchar("customer_id").references(() => customers.id), // Optional - for customer-related activities
  userId: text("user_id").notNull(), // Firebase UID of user who performed the action
  userEmail: text("user_email").notNull(), // Email for display purposes
  userName: text("user_name").notNull(), // Full name for display purposes
  action: text("action").notNull(), // Type of action: "assignment", "download", "upload", "status_change", "comment", "creation", "update", "delete"
  category: text("category").notNull(), // Category: "job", "order", "customer", "assignment", "file", "system"
  title: text("title").notNull(), // Human-readable title for the activity
  description: text("description"), // Detailed description of what happened
  metadata: text("metadata"), // JSON string with action-specific data (file names, status changes, etc.)
  ipAddress: text("ip_address"), // IP address of the user (for security audit)
  userAgent: text("user_agent"), // Browser/client information
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
  partnerId: z.string(),
  jobId: z.string().optional(), // Will be auto-generated if not provided
  customerId: z.string().optional(),
  address: z.string(),
  status: z.string().optional(),
  assignedTo: z.string().optional(),
  dueDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  appointmentDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  totalValue: z.string().optional(),
  propertyImage: z.string().optional(),
  notes: z.string().optional(),
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
  orderNumber: true, // Auto-generated
  filesExpiryDate: true, // Auto-calculated
});

export const insertOrderServiceSchema = createInsertSchema(orderServices).omit({
  id: true,
  createdAt: true,
});

export const insertOrderFileSchema = createInsertSchema(orderFiles).omit({
  id: true,
  uploadedAt: true,
});

export const insertServiceCategorySchema = createInsertSchema(serviceCategories).omit({
  id: true,
  createdAt: true,
});

export const insertEditorServiceSchema = createInsertSchema(editorServices).omit({
  id: true,
  createdAt: true,
});

export const insertEditorUploadSchema = createInsertSchema(editorUploads).omit({
  id: true,
  uploadedAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
  readAt: true,
});

export const insertActivitySchema = createInsertSchema(activities).omit({
  id: true,
  createdAt: true,
}).extend({
  metadata: z.string().optional().refine((val) => {
    if (!val) return true;
    try {
      JSON.parse(val);
      return true;
    } catch {
      return false;
    }
  }, "Metadata must be valid JSON"),
  action: z.enum([
    "assignment", "download", "upload", "status_change", 
    "comment", "creation", "update", "delete", "appointment",
    "notification", "file_management", "system"
  ]),
  category: z.enum([
    "job", "order", "customer", "assignment", "file", 
    "system", "appointment", "notification", "user"
  ]),
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

export type OrderService = typeof orderServices.$inferSelect;
export type InsertOrderService = z.infer<typeof insertOrderServiceSchema>;

export type OrderFile = typeof orderFiles.$inferSelect;
export type InsertOrderFile = z.infer<typeof insertOrderFileSchema>;

export type ServiceCategory = typeof serviceCategories.$inferSelect;
export type InsertServiceCategory = z.infer<typeof insertServiceCategorySchema>;

export type EditorService = typeof editorServices.$inferSelect;
export type InsertEditorService = z.infer<typeof insertEditorServiceSchema>;

export type EditorUpload = typeof editorUploads.$inferSelect;
export type InsertEditorUpload = z.infer<typeof insertEditorUploadSchema>;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
