import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, boolean, integer, doublePrecision } from "drizzle-orm/pg-core";
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
  notes: text("notes"),
  // Billing preferences
  billingEmail: text("billing_email"),
  billingAddress: text("billing_address"),
  city: text("city"),
  state: text("state"),
  postcode: text("postcode"),
  paymentTerms: text("payment_terms"),
  taxId: text("tax_id"),
  // Team members stored as JSON array
  teamMembers: text("team_members"), // JSON array of {name, email, role}
  // Accounting integration (Xero, QuickBooks, etc.)
  accountingIntegration: text("accounting_integration"), // e.g., "xero", "quickbooks", "myob"
  accountingContactId: text("accounting_contact_id"), // Customer/Contact ID in the accounting software
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
  variations: text("variations"), // JSON array of {name, price, appointmentDuration, noCharge}
  noCharge: boolean("no_charge").default(false), // For non-variation products with no charge
  productType: text("product_type").default("onsite"), // "onsite", "digital"
  requiresAppointment: boolean("requires_appointment").default(true),
  appointmentDuration: integer("appointment_duration").default(60), // Default duration in minutes for base product
  exclusivityType: text("exclusivity_type").default("none"), // "none", "exclusive"
  exclusiveCustomerIds: text("exclusive_customer_ids"), // JSON array of customer IDs
  assignedTeamMemberIds: text("assigned_team_member_ids"), // JSON array of team member (photographer) IDs
  includedProducts: text("included_products"), // JSON array of {productId, quantity} for package inclusions
  isActive: boolean("is_active").default(true),
  isLive: boolean("is_live").default(true),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const jobs = pgTable("jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: text("job_id").notNull().unique(), // NanoID for backend tracking
  deliveryToken: text("delivery_token").unique(), // Unguessable token for secure delivery page access
  partnerId: text("partner_id").notNull(), // Multi-tenant identifier
  customerId: varchar("customer_id").references(() => customers.id),
  address: text("address").notNull(),
  latitude: doublePrecision("latitude"), // GPS coordinates for drive time calculations
  longitude: doublePrecision("longitude"), // GPS coordinates for drive time calculations
  jobName: text("job_name"), // Optional custom name for the job
  status: text("status").default("booked"), // "booked", "pending", "on_hold", "delivered", "cancelled"
  assignedTo: varchar("assigned_to").references(() => users.id), // Photographer assigned
  dueDate: timestamp("due_date"),
  appointmentDate: timestamp("appointment_date"), // DEPRECATED: Use appointments table instead
  estimatedDuration: integer("estimated_duration"), // Estimated duration in minutes (from selected products)
  totalValue: decimal("total_value", { precision: 10, scale: 2 }).default("0"),
  propertyImage: text("property_image"),
  propertyImageThumbnail: text("property_image_thumbnail"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const appointments = pgTable("appointments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  appointmentId: text("appointment_id").notNull().unique(), // NanoID for external reference
  jobId: varchar("job_id").references(() => jobs.id).notNull(),
  partnerId: text("partner_id").notNull(), // Multi-tenant identifier
  appointmentDate: timestamp("appointment_date").notNull(),
  estimatedDuration: integer("estimated_duration"), // Duration in minutes (from selected products)
  assignedTo: varchar("assigned_to").references(() => users.id), // Photographer assigned
  status: text("status").default("scheduled"), // "scheduled", "in_progress", "completed", "cancelled"
  products: text("products"), // JSON array of {id, name, quantity, variationName, price, duration}
  notes: text("notes"), // Appointment-specific notes
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
  maxRevisionRounds: integer("max_revision_rounds").default(2), // Max allowed revision rounds (configurable per order)
  usedRevisionRounds: integer("used_revision_rounds").default(0), // Number of revision rounds used
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
  orderId: varchar("order_id").references(() => orders.id), // Made optional for standalone folders with folderToken
  jobId: varchar("job_id").references(() => jobs.id).notNull(),
  editorId: text("editor_id").notNull(), // Firebase UID of editor
  fileName: text("file_name").notNull(),
  originalName: text("original_name").notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: text("mime_type").notNull(),
  firebaseUrl: text("firebase_url").notNull(),
  downloadUrl: text("download_url").notNull(),
  // Folder functionality
  folderPath: text("folder_path"), // Complete folder path (e.g., "Edited Photos/High Res")
  editorFolderName: text("editor_folder_name"), // Original name given by editor
  partnerFolderName: text("partner_folder_name"), // Optional renamed version by partner
  folderToken: text("folder_token"), // Token for standalone folders (when no order is associated)
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

// Editing options (master list of editing options that partners can define)
export const editingOptions = pgTable("editing_options", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partnerId: text("partner_id").notNull(), // Multi-tenant identifier
  name: text("name").notNull(), // e.g., "Grass Replacement", "Sky Replacement"
  description: text("description"), // e.g., "Replace brown or patchy grass with lush green lawn"
  icon: text("icon"), // Icon name from lucide-react or emoji
  iconColor: text("icon_color"), // Color for the icon background
  displayOrder: integer("display_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Customer editing preferences (which editing options are enabled for each customer)
export const customerEditingPreferences = pgTable("customer_editing_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").references(() => customers.id).notNull(),
  editingOptionId: varchar("editing_option_id").references(() => editingOptions.id).notNull(),
  isEnabled: boolean("is_enabled").default(true),
  notes: text("notes"), // Customer-specific notes/instructions for this editing option
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Partner settings (stores business profile, personal profile, and business hours)
export const partnerSettings = pgTable("partner_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partnerId: text("partner_id").notNull().unique(), // Multi-tenant identifier
  businessProfile: text("business_profile"), // JSON: businessName, tagline, email, phone, address, website, description
  personalProfile: text("personal_profile"), // JSON: firstName, lastName, email, phone, bio
  businessHours: text("business_hours"), // JSON: {monday: {isOpen, start, end}, tuesday: {...}, ...}
  defaultMaxRevisionRounds: integer("default_max_revision_rounds").default(2), // Default max revision rounds for new orders
  editorDisplayNames: text("editor_display_names"), // JSON: {editorId: customName} - Custom display names for editors shown to photographers
  teamMemberColors: text("team_member_colors"), // JSON: {userId: colorHex} - Custom colors for team members
  // Booking form settings
  bookingSettings: text("booking_settings"), // JSON: booking form configuration
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// File comments (conversation threads on deliverable files)
export const fileComments = pgTable("file_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fileId: varchar("file_id").references(() => editorUploads.id).notNull(),
  orderId: varchar("order_id").references(() => orders.id),
  jobId: varchar("job_id").references(() => jobs.id).notNull(),
  authorId: text("author_id").notNull(), // Firebase UID of author
  authorName: text("author_name").notNull(), // Display name
  authorRole: text("author_role").notNull(), // "client", "partner", "editor", "photographer"
  message: text("message").notNull(),
  status: text("status").default("pending"), // "pending", "in-progress", "resolved"
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Job reviews (ratings and feedback from clients)
export const jobReviews = pgTable("job_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").references(() => jobs.id).notNull(),
  partnerId: text("partner_id").notNull(), // Multi-tenant identifier
  rating: integer("rating").notNull(), // 1-5 stars
  review: text("review"), // Optional text review
  submittedBy: text("submitted_by"), // Name or identifier of reviewer
  submittedByEmail: text("submitted_by_email"), // Email of reviewer
  createdAt: timestamp("created_at").defaultNow(),
});

// Delivery emails (tracking sent delivery notifications)
export const deliveryEmails = pgTable("delivery_emails", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").references(() => jobs.id).notNull(),
  partnerId: text("partner_id").notNull(), // Multi-tenant identifier
  recipientEmail: text("recipient_email").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  deliveryLink: text("delivery_link").notNull(), // URL to delivery page
  sentBy: text("sent_by").notNull(), // Firebase UID of sender
  sentAt: timestamp("sent_at").defaultNow(),
});

// Conversations (message threads between partners and editors)
export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partnerId: text("partner_id").notNull(), // Multi-tenant identifier
  editorId: text("editor_id").notNull(), // Firebase UID of editor
  orderId: varchar("order_id").references(() => orders.id), // Optional - link conversation to specific order
  partnerName: text("partner_name").notNull(), // Display name of partner
  editorName: text("editor_name").notNull(), // Display name of editor
  partnerEmail: text("partner_email").notNull(),
  editorEmail: text("editor_email").notNull(),
  lastMessageAt: timestamp("last_message_at").defaultNow(),
  lastMessageText: text("last_message_text"), // Preview of last message
  partnerUnreadCount: integer("partner_unread_count").default(0), // Unread messages for partner
  editorUnreadCount: integer("editor_unread_count").default(0), // Unread messages for editor
  createdAt: timestamp("created_at").defaultNow(),
});

// Messages (individual messages within conversations)
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").references(() => conversations.id).notNull(),
  senderId: text("sender_id").notNull(), // Firebase UID of sender
  senderEmail: text("sender_email").notNull(),
  senderName: text("sender_name").notNull(),
  senderRole: text("sender_role").notNull(), // "partner", "editor"
  content: text("content").notNull(),
  readAt: timestamp("read_at"), // When the message was read by recipient
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
  propertyImageThumbnail: z.string().optional(),
  notes: z.string().optional(),
});

export const insertAppointmentSchema = z.object({
  jobId: z.string(),
  partnerId: z.string(),
  appointmentDate: z.string().transform(val => new Date(val)),
  estimatedDuration: z.number().optional(),
  assignedTo: z.string().optional(),
  status: z.string().optional(),
  products: z.string().optional(), // JSON string
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

export const insertEditingOptionSchema = createInsertSchema(editingOptions).omit({
  id: true,
  createdAt: true,
});

export const insertCustomerEditingPreferenceSchema = createInsertSchema(customerEditingPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPartnerSettingsSchema = createInsertSchema(partnerSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFileCommentSchema = createInsertSchema(fileComments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertJobReviewSchema = createInsertSchema(jobReviews).omit({
  id: true,
  createdAt: true,
});

export const insertDeliveryEmailSchema = createInsertSchema(deliveryEmails).omit({
  id: true,
  sentAt: true,
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
  lastMessageAt: true,
  partnerUnreadCount: true,
  editorUnreadCount: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
  readAt: true,
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

export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;

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

export type EditingOption = typeof editingOptions.$inferSelect;
export type InsertEditingOption = z.infer<typeof insertEditingOptionSchema>;

export type CustomerEditingPreference = typeof customerEditingPreferences.$inferSelect;
export type InsertCustomerEditingPreference = z.infer<typeof insertCustomerEditingPreferenceSchema>;

export type PartnerSettings = typeof partnerSettings.$inferSelect;
export type InsertPartnerSettings = z.infer<typeof insertPartnerSettingsSchema>;

export type FileComment = typeof fileComments.$inferSelect;
export type InsertFileComment = z.infer<typeof insertFileCommentSchema>;

export type JobReview = typeof jobReviews.$inferSelect;
export type InsertJobReview = z.infer<typeof insertJobReviewSchema>;

export type DeliveryEmail = typeof deliveryEmails.$inferSelect;
export type InsertDeliveryEmail = z.infer<typeof insertDeliveryEmailSchema>;

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
