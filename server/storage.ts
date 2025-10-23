import {
  type User,
  type InsertUser,
  type Customer,
  type InsertCustomer,
  type Product,
  type InsertProduct,
  type Job,
  type InsertJob,
  type Order,
  type InsertOrder,
  type OrderService,
  type InsertOrderService,
  type OrderFile,
  type InsertOrderFile,
  type ServiceCategory,
  type InsertServiceCategory,
  type EditorService,
  type InsertEditorService,
  type EditorUpload,
  type InsertEditorUpload,
  type Notification,
  type InsertNotification,
  type Activity,
  type InsertActivity,
  type EditingOption,
  type InsertEditingOption,
  type CustomerEditingPreference,
  type InsertCustomerEditingPreference,
  type PartnerSettings,
  type InsertPartnerSettings,
  type FileComment,
  type InsertFileComment,
  type JobReview,
  type InsertJobReview,
  type DeliveryEmail,
  type InsertDeliveryEmail,
  type Conversation,
  type InsertConversation,
  type Message,
  type InsertMessage
} from "@shared/schema";
import { randomUUID } from "crypto";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { nanoid } from "nanoid";

// Order reservation system
export interface OrderReservation {
  orderNumber: string;
  userId: string;
  jobId: string;
  reservedAt: Date;
  expiresAt: Date;
  status: 'reserved' | 'confirmed' | 'expired';
}

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsers(partnerId?: string): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;

  // Customers
  getCustomer(id: string): Promise<Customer | undefined>;
  getCustomers(partnerId?: string): Promise<Customer[]>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: string, customer: Partial<Customer>): Promise<Customer | undefined>;

  // Products
  getProduct(id: string): Promise<Product | undefined>;
  getProducts(partnerId?: string): Promise<Product[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: Partial<Product>): Promise<Product | undefined>;

  // Jobs
  getJob(id: string): Promise<Job | undefined>;
  getJobByJobId(jobId: string): Promise<Job | undefined>;
  getJobByDeliveryToken(token: string): Promise<Job | undefined>;
  generateDeliveryToken(jobId: string): Promise<string>;
  getJobs(partnerId?: string): Promise<Job[]>;
  createJob(job: InsertJob): Promise<Job>;
  updateJob(id: string, job: Partial<Job>): Promise<Job | undefined>;

  // Orders
  getOrder(id: string): Promise<Order | undefined>;
  getOrders(partnerId?: string): Promise<Order[]>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: string, order: Partial<Order>): Promise<Order | undefined>;
  generateOrderNumber(): Promise<string>;
  
  // Order Reservations
  reserveOrderNumber(userId: string, jobId: string): Promise<OrderReservation>;
  confirmReservation(orderNumber: string): Promise<boolean>;
  getReservation(orderNumber: string): Promise<OrderReservation | undefined>;
  cleanupExpiredReservations(): Promise<void>;
  
  // Order Services
  getOrderServices(orderId: string): Promise<OrderService[]>;
  createOrderService(orderService: InsertOrderService): Promise<OrderService>;
  
  // Order Files
  getOrderFiles(orderId: string): Promise<OrderFile[]>;
  createOrderFile(orderFile: InsertOrderFile): Promise<OrderFile>;

  // Editor Job Management
  getEditorJobs(editorId: string): Promise<any[]>;
  updateOrderStatus(orderId: string, status: string, editorId: string): Promise<Order | undefined>;

  // Service Categories
  getServiceCategories(editorId: string): Promise<ServiceCategory[]>;
  createServiceCategory(category: InsertServiceCategory): Promise<ServiceCategory>;
  updateServiceCategory(id: string, updates: Partial<ServiceCategory>, editorId: string): Promise<ServiceCategory | undefined>;
  deleteServiceCategory(id: string, editorId: string): Promise<void>;

  // Editor Services
  getEditorServices(editorId: string): Promise<EditorService[]>;
  createEditorService(service: InsertEditorService): Promise<EditorService>;
  updateEditorService(id: string, updates: Partial<EditorService>, editorId: string): Promise<EditorService | undefined>;
  deleteEditorService(id: string, editorId: string): Promise<void>;
  
  // Customer Profile
  getCustomerJobs(customerId: string): Promise<Job[]>;
  
  // Editor Uploads
  getJobsReadyForUpload(editorId: string): Promise<any[]>; // Jobs assigned to editor that are ready for upload
  getEditorUploads(jobId: string): Promise<EditorUpload[]>;
  createEditorUpload(editorUpload: InsertEditorUpload): Promise<EditorUpload>;
  updateJobStatusAfterUpload(jobId: string, status: string): Promise<Job | undefined>;
  
  // Folder Management
  getUploadFolders(jobId: string): Promise<{folderPath: string; editorFolderName: string; partnerFolderName?: string; orderNumber?: string; fileCount: number; files: any[]}[]>;
  createFolder(jobId: string, partnerFolderName: string, parentFolderPath?: string): Promise<{folderPath: string; partnerFolderName: string}>;
  updateFolderName(jobId: string, folderPath: string, newPartnerFolderName: string): Promise<void>;

  // Team Assignment System
  getPendingOrders(partnerId: string): Promise<Order[]>; // Get unassigned orders for partner
  assignOrderToEditor(orderId: string, editorId: string): Promise<Order | undefined>; // Atomic assignment operation
  
  // Notifications
  createNotification(notification: InsertNotification): Promise<Notification>;
  createNotifications(notifications: InsertNotification[]): Promise<Notification[]>; // Bulk creation
  getNotifications(): Promise<Notification[]>; // Get all notifications
  getNotificationsForUser(recipientId: string, partnerId: string): Promise<Notification[]>;
  markNotificationRead(id: string, recipientId: string): Promise<Notification | undefined>;
  markAllNotificationsRead(recipientId: string, partnerId: string): Promise<void>;
  deleteNotification(id: string, recipientId: string): Promise<void>;

  // Activity Tracking (Audit Log)
  createActivity(activity: InsertActivity): Promise<Activity>;
  createActivities(activities: InsertActivity[]): Promise<Activity[]>; // Bulk creation for batch operations
  getActivities(filters?: {
    partnerId?: string;
    jobId?: string;
    orderId?: string;
    userId?: string;
    action?: string;
    category?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<Activity[]>;
  getJobActivities(jobId: string, partnerId: string): Promise<Activity[]>; // Get all activities for a specific job
  getOrderActivities(orderId: string, partnerId: string): Promise<Activity[]>; // Get all activities for a specific order
  getUserActivities(userId: string, partnerId: string, limit?: number): Promise<Activity[]>; // Get activities by specific user
  getActivityCountByType(partnerId: string, timeRange?: { start: Date; end: Date }): Promise<{ [key: string]: number }>; // Analytics

  // Job Connection Validation System
  validateJobIntegrity(jobId: string): Promise<{ isValid: boolean; issues: string[]; connections: any }>;
  validateOrderIntegrity(orderId: string): Promise<{ isValid: boolean; issues: string[]; connections: any }>;
  validateEditorWorkflowAccess(editorId: string, jobId: string): Promise<{ canAccess: boolean; reason: string; orderInfo?: any }>;
  performHealthCheck(partnerId?: string): Promise<{ isHealthy: boolean; issues: string[]; statistics: any; orphanedRecords: any }>;
  repairOrphanedOrder(orderId: string, correctJobId: string): Promise<{ success: boolean; message: string }>;
  validateJobCreation(insertJob: InsertJob): Promise<{ valid: boolean; errors: string[] }>;
  validateOrderCreation(insertOrder: InsertOrder): Promise<{ valid: boolean; errors: string[] }>;
  validateEditorUpload(insertUpload: InsertEditorUpload): Promise<{ valid: boolean; errors: string[] }>;

  // Editing Options (master list for partners)
  getEditingOptions(partnerId: string): Promise<EditingOption[]>;
  createEditingOption(option: InsertEditingOption): Promise<EditingOption>;
  updateEditingOption(id: string, option: Partial<EditingOption>, partnerId: string): Promise<EditingOption | undefined>;
  deleteEditingOption(id: string, partnerId: string): Promise<void>;

  // Customer Editing Preferences
  getCustomerEditingPreferences(customerId: string): Promise<CustomerEditingPreference[]>;
  setCustomerEditingPreference(preference: InsertCustomerEditingPreference): Promise<CustomerEditingPreference>;
  updateCustomerEditingPreference(id: string, updates: Partial<CustomerEditingPreference>): Promise<CustomerEditingPreference | undefined>;
  deleteCustomerEditingPreference(id: string): Promise<void>;
  saveCustomerPreferences(customerId: string, preferences: { editingOptionId: string; isEnabled: boolean; notes?: string }[]): Promise<void>;

  // Partner Settings
  getPartnerSettings(partnerId: string): Promise<PartnerSettings | undefined>;
  savePartnerSettings(partnerId: string, settings: InsertPartnerSettings): Promise<PartnerSettings>;

  // File Comments
  getFileComments(fileId: string): Promise<FileComment[]>;
  getJobFileComments(jobId: string): Promise<FileComment[]>;
  createFileComment(comment: InsertFileComment): Promise<FileComment>;
  updateFileCommentStatus(id: string, status: string): Promise<FileComment | undefined>;

  // Job Reviews
  getJobReview(jobId: string): Promise<JobReview | undefined>;
  createJobReview(review: InsertJobReview): Promise<JobReview>;

  // Delivery Emails
  getDeliveryEmails(jobId: string): Promise<DeliveryEmail[]>;
  createDeliveryEmail(email: InsertDeliveryEmail): Promise<DeliveryEmail>;

  // Revision Management
  incrementRevisionRound(orderId: string): Promise<Order | undefined>;
  getOrderRevisionStatus(orderId: string): Promise<{ maxRounds: number; usedRounds: number; remainingRounds: number } | undefined>;

  // Messaging
  getUserConversations(userId: string, partnerId?: string): Promise<Conversation[]>;
  getConversation(id: string): Promise<Conversation | undefined>;
  getConversationByParticipants(partnerId: string, editorId: string, orderId?: string): Promise<Conversation | undefined>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversationLastMessage(conversationId: string, lastMessageText: string, isPartnerSender: boolean): Promise<void>;
  markConversationAsRead(conversationId: string, isPartnerReading: boolean): Promise<void>;
  getUnreadMessageCount(userId: string, partnerId?: string): Promise<number>;
  getConversationMessages(conversationId: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private customers: Map<string, Customer>;
  private products: Map<string, Product>;
  private jobs: Map<string, Job>;
  private orders: Map<string, Order>;
  private orderServices: Map<string, OrderService>;
  private orderFiles: Map<string, OrderFile>;
  private serviceCategories: Map<string, ServiceCategory>;
  private editorServices: Map<string, EditorService>;
  private editorUploads: Map<string, EditorUpload>;
  private notifications: Map<string, Notification>;
  private activities: Map<string, Activity>;
  private editingOptions: Map<string, EditingOption>;
  private customerEditingPreferences: Map<string, CustomerEditingPreference>;
  private partnerSettings: Map<string, PartnerSettings>;
  private fileComments: Map<string, FileComment>;
  private jobReviews: Map<string, JobReview>;
  private deliveryEmails: Map<string, DeliveryEmail>;
  private conversations: Map<string, Conversation>;
  private messages: Map<string, Message>;
  private orderCounter = 1; // Sequential order numbering starting at 1
  private orderReservations: Map<string, OrderReservation>;
  private dataFile = join(process.cwd(), 'storage-data.json');

  constructor() {
    this.users = new Map();
    this.customers = new Map();
    this.products = new Map();
    this.jobs = new Map();
    this.orders = new Map();
    this.orderServices = new Map();
    this.orderFiles = new Map();
    this.serviceCategories = new Map();
    this.editorServices = new Map();
    this.editorUploads = new Map();
    this.notifications = new Map();
    this.activities = new Map();
    this.editingOptions = new Map();
    this.customerEditingPreferences = new Map();
    this.partnerSettings = new Map();
    this.fileComments = new Map();
    this.jobReviews = new Map();
    this.deliveryEmails = new Map();
    this.conversations = new Map();
    this.messages = new Map();
    this.orderReservations = new Map();
    this.loadFromFile();
  }

  private loadFromFile() {
    try {
      if (existsSync(this.dataFile)) {
        const data = JSON.parse(readFileSync(this.dataFile, 'utf8'));
        
        // Restore users
        if (data.users) {
          Object.entries(data.users).forEach(([id, user]: [string, any]) => {
            this.users.set(id, { ...user, createdAt: new Date(user.createdAt) });
          });
        }
        
        // Restore customers
        if (data.customers) {
          Object.entries(data.customers).forEach(([id, customer]: [string, any]) => {
            this.customers.set(id, { ...customer, createdAt: new Date(customer.createdAt) });
          });
        }
        
        // Restore products
        if (data.products) {
          Object.entries(data.products).forEach(([id, product]: [string, any]) => {
            this.products.set(id, { ...product, createdAt: new Date(product.createdAt) });
          });
        }
        
        // Restore jobs
        if (data.jobs) {
          Object.entries(data.jobs).forEach(([id, job]: [string, any]) => {
            this.jobs.set(id, { 
              ...job, 
              createdAt: new Date(job.createdAt),
              appointmentDate: job.appointmentDate ? new Date(job.appointmentDate) : null,
              dueDate: job.dueDate ? new Date(job.dueDate) : null
            });
          });
        }
        
        // Restore orders
        if (data.orders) {
          Object.entries(data.orders).forEach(([id, order]: [string, any]) => {
            this.orders.set(id, { 
              ...order, 
              createdAt: new Date(order.createdAt),
              dateAccepted: order.dateAccepted ? new Date(order.dateAccepted) : null,
              filesExpiryDate: order.filesExpiryDate ? new Date(order.filesExpiryDate) : null
            });
          });
        }
        
        // Restore order services
        if (data.orderServices) {
          Object.entries(data.orderServices).forEach(([id, orderService]: [string, any]) => {
            this.orderServices.set(id, { 
              ...orderService, 
              createdAt: new Date(orderService.createdAt)
            });
          });
        }
        
        // Restore order files
        if (data.orderFiles) {
          Object.entries(data.orderFiles).forEach(([id, orderFile]: [string, any]) => {
            this.orderFiles.set(id, { 
              ...orderFile, 
              uploadedAt: new Date(orderFile.uploadedAt),
              expiresAt: new Date(orderFile.expiresAt)
            });
          });
        }
        
        // Restore order reservations FIRST before calculating counter
        if (data.orderReservations) {
          Object.entries(data.orderReservations).forEach(([orderNumber, reservation]: [string, any]) => {
            this.orderReservations.set(orderNumber, { 
              ...reservation, 
              reservedAt: new Date(reservation.reservedAt),
              expiresAt: new Date(reservation.expiresAt)
            });
          });
        }
        
        // Calculate proper order counter for sequential numbering
        // Always use the next number after the highest existing order
        let maxOrderNumber = 0;
        
        // Find the highest existing order number
        for (const order of this.orders.values()) {
          if (order.orderNumber && order.orderNumber.startsWith('#')) {
            const num = parseInt(order.orderNumber.replace('#', ''));
            if (!isNaN(num) && num > maxOrderNumber) {
              maxOrderNumber = num;
            }
          }
        }
        
        // Check reservation numbers too
        for (const reservation of this.orderReservations.values()) {
          if (reservation.orderNumber && reservation.orderNumber.startsWith('#')) {
            const num = parseInt(reservation.orderNumber.replace('#', ''));
            if (!isNaN(num) && num > maxOrderNumber) {
              maxOrderNumber = num;
            }
          }
        }
        
        // Set counter to the next number after the highest
        this.orderCounter = maxOrderNumber + 1;
        console.log(`Order counter set to ${this.orderCounter} (highest existing order: #${maxOrderNumber.toString().padStart(5, '0')})`);
        
        // Restore service categories
        if (data.serviceCategories) {
          Object.entries(data.serviceCategories).forEach(([id, category]: [string, any]) => {
            this.serviceCategories.set(id, { ...category, createdAt: new Date(category.createdAt) });
          });
        }
        
        // Restore editor services
        if (data.editorServices) {
          Object.entries(data.editorServices).forEach(([id, service]: [string, any]) => {
            this.editorServices.set(id, { ...service, createdAt: new Date(service.createdAt) });
          });
        }
        
        // Restore editor uploads
        if (data.editorUploads) {
          Object.entries(data.editorUploads).forEach(([id, editorUpload]: [string, any]) => {
            this.editorUploads.set(id, { 
              ...editorUpload, 
              uploadedAt: new Date(editorUpload.uploadedAt),
              expiresAt: new Date(editorUpload.expiresAt)
            });
          });
        }
        
        // Restore notifications
        if (data.notifications) {
          Object.entries(data.notifications).forEach(([id, notification]: [string, any]) => {
            this.notifications.set(id, { 
              ...notification, 
              createdAt: new Date(notification.createdAt),
              readAt: notification.readAt ? new Date(notification.readAt) : null
            });
          });
        }
        
        // Restore activities
        if (data.activities) {
          Object.entries(data.activities).forEach(([id, activity]: [string, any]) => {
            this.activities.set(id, { 
              ...activity, 
              createdAt: new Date(activity.createdAt)
            });
          });
        }
        
        // Restore editing options
        if (data.editingOptions) {
          Object.entries(data.editingOptions).forEach(([id, option]: [string, any]) => {
            this.editingOptions.set(id, {
              ...option,
              createdAt: new Date(option.createdAt)
            });
          });
        }
        
        // Restore customer editing preferences
        if (data.customerEditingPreferences) {
          Object.entries(data.customerEditingPreferences).forEach(([id, pref]: [string, any]) => {
            this.customerEditingPreferences.set(id, {
              ...pref,
              createdAt: new Date(pref.createdAt),
              updatedAt: new Date(pref.updatedAt)
            });
          });
        }
        
        // Restore partner settings
        if (data.partnerSettings) {
          Object.entries(data.partnerSettings).forEach(([partnerId, settings]: [string, any]) => {
            this.partnerSettings.set(partnerId, {
              ...settings,
              createdAt: new Date(settings.createdAt),
              updatedAt: new Date(settings.updatedAt)
            });
          });
        }

        // Restore conversations
        if (data.conversations) {
          Object.entries(data.conversations).forEach(([id, conversation]: [string, any]) => {
            this.conversations.set(id, {
              ...conversation,
              createdAt: new Date(conversation.createdAt),
              lastMessageAt: conversation.lastMessageAt ? new Date(conversation.lastMessageAt) : new Date(conversation.createdAt)
            });
          });
        }

        // Restore messages
        if (data.messages) {
          Object.entries(data.messages).forEach(([id, message]: [string, any]) => {
            this.messages.set(id, {
              ...message,
              createdAt: new Date(message.createdAt),
              readAt: message.readAt ? new Date(message.readAt) : null
            });
          });
        }

        console.log(`Loaded data from storage: ${this.customers.size} customers, ${this.jobs.size} jobs, ${this.products.size} products, ${this.orders.size} orders, ${this.serviceCategories.size} categories, ${this.editorServices.size} services, ${this.editorUploads.size} uploads, ${this.notifications.size} notifications, ${this.activities.size} activities, ${this.editingOptions.size} editing options, ${this.customerEditingPreferences.size} customer preferences, ${this.partnerSettings.size} partner settings, ${this.conversations.size} conversations, ${this.messages.size} messages`);
      }
    } catch (error) {
      console.error('Failed to load storage data:', error);
    }
  }

  private saveToFile() {
    try {
      const data = {
        users: Object.fromEntries(this.users.entries()),
        customers: Object.fromEntries(this.customers.entries()),
        products: Object.fromEntries(this.products.entries()),
        jobs: Object.fromEntries(this.jobs.entries()),
        orders: Object.fromEntries(this.orders.entries()),
        orderServices: Object.fromEntries(this.orderServices.entries()),
        orderFiles: Object.fromEntries(this.orderFiles.entries()),
        serviceCategories: Object.fromEntries(this.serviceCategories.entries()),
        editorServices: Object.fromEntries(this.editorServices.entries()),
        editorUploads: Object.fromEntries(this.editorUploads.entries()),
        notifications: Object.fromEntries(this.notifications.entries()),
        activities: Object.fromEntries(this.activities.entries()),
        editingOptions: Object.fromEntries(this.editingOptions.entries()),
        customerEditingPreferences: Object.fromEntries(this.customerEditingPreferences.entries()),
        partnerSettings: Object.fromEntries(this.partnerSettings.entries()),
        conversations: Object.fromEntries(this.conversations.entries()),
        messages: Object.fromEntries(this.messages.entries()),
        orderCounter: this.orderCounter,
        orderReservations: Object.fromEntries(this.orderReservations.entries())
      };
      writeFileSync(this.dataFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to save storage data:', error);
    }
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser,
      role: insertUser.role || null,
      company: insertUser.company || null,
      profileImage: insertUser.profileImage || null,
      id, 
      createdAt: new Date()
    };
    this.users.set(id, user);
    this.saveToFile();
    return user;
  }

  // Customers
  async getCustomer(id: string): Promise<Customer | undefined> {
    return this.customers.get(id);
  }

  async getCustomers(partnerId?: string): Promise<Customer[]> {
    const allCustomers = Array.from(this.customers.values());
    return partnerId ? allCustomers.filter(customer => customer.partnerId === partnerId) : allCustomers;
  }

  async createCustomer(insertCustomer: InsertCustomer): Promise<Customer> {
    const id = randomUUID();
    const customer: Customer = {
      ...insertCustomer,
      phone: insertCustomer.phone || null,
      company: insertCustomer.company || null,
      category: insertCustomer.category || null,
      profileImage: insertCustomer.profileImage || null,
      id,
      totalValue: "0",
      averageJobValue: "0",
      jobsCompleted: 0,
      createdAt: new Date()
    };
    this.customers.set(id, customer);
    this.saveToFile();
    return customer;
  }

  async updateCustomer(id: string, updates: Partial<Customer>): Promise<Customer | undefined> {
    const customer = this.customers.get(id);
    if (!customer) return undefined;
    
    const updated = { ...customer, ...updates };
    this.customers.set(id, updated);
    this.saveToFile();
    return updated;
  }

  // Products
  async getProduct(id: string): Promise<Product | undefined> {
    return this.products.get(id);
  }

  async getProducts(partnerId?: string): Promise<Product[]> {
    const allProducts = Array.from(this.products.values());
    return partnerId ? allProducts.filter(product => product.partnerId === partnerId) : allProducts;
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const id = randomUUID();
    const product: Product = {
      ...insertProduct,
      image: insertProduct.image || null,
      category: insertProduct.category || null,
      description: insertProduct.description || null,
      taxRate: insertProduct.taxRate || null,
      hasVariations: insertProduct.hasVariations || null,
      variants: insertProduct.variants || null,
      isActive: insertProduct.isActive || null,
      isLive: insertProduct.isLive || null,
      id,
      createdAt: new Date()
    };
    this.products.set(id, product);
    this.saveToFile();
    return product;
  }

  async updateProduct(id: string, updates: Partial<Product>): Promise<Product | undefined> {
    const product = this.products.get(id);
    if (!product) return undefined;
    
    const updated = { ...product, ...updates };
    this.products.set(id, updated);
    this.saveToFile();
    return updated;
  }

  // Jobs
  async getJob(id: string): Promise<Job | undefined> {
    return this.jobs.get(id);
  }

  async getJobByJobId(jobId: string): Promise<Job | undefined> {
    // Handle both NanoID (job.jobId) and UUID (job.id) for flexibility
    return Array.from(this.jobs.values()).find(job => 
      job.jobId === jobId || job.id === jobId
    );
  }

  async getJobByDeliveryToken(token: string): Promise<Job | undefined> {
    return Array.from(this.jobs.values()).find(job => job.deliveryToken === token);
  }

  async generateDeliveryToken(jobId: string): Promise<string> {
    const job = await this.getJobByJobId(jobId);
    if (!job) {
      throw new Error('Job not found');
    }
    
    // If token already exists, return it
    if (job.deliveryToken) {
      return job.deliveryToken;
    }
    
    // Generate a new unguessable token
    const token = nanoid(32); // 32-character unguessable token
    
    // Update job with token
    await this.updateJob(job.id, { deliveryToken: token });
    
    return token;
  }

  async getJobs(partnerId?: string): Promise<Job[]> {
    const allJobs = Array.from(this.jobs.values());
    return partnerId ? allJobs.filter(job => job.partnerId === partnerId) : allJobs;
  }

  async createJob(insertJob: InsertJob): Promise<Job> {
    const id = randomUUID();
    const jobId = insertJob.jobId || nanoid(); // Generate NanoID if not provided
    const job: Job = {
      ...insertJob,
      jobId,
      totalValue: insertJob.totalValue || null,
      status: insertJob.status || null,
      customerId: insertJob.customerId || null,
      assignedTo: null,
      dueDate: insertJob.dueDate || null,
      appointmentDate: insertJob.appointmentDate || null,
      propertyImage: insertJob.propertyImage || null,
      notes: insertJob.notes || null,
      id,
      createdAt: new Date()
    };
    this.jobs.set(id, job);
    this.saveToFile();
    return job;
  }

  async updateJob(id: string, updates: Partial<Job>): Promise<Job | undefined> {
    const job = this.jobs.get(id);
    if (!job) return undefined;
    
    const updated = { ...job, ...updates };
    this.jobs.set(id, updated);
    this.saveToFile();
    return updated;
  }

  // Orders
  async getOrder(id: string): Promise<Order | undefined> {
    return this.orders.get(id);
  }

  async getOrders(partnerId?: string): Promise<Order[]> {
    const allOrders = Array.from(this.orders.values());
    return partnerId ? allOrders.filter(order => order.partnerId === partnerId) : allOrders;
  }

  async createOrder(insertOrder: InsertOrder, confirmedOrderNumber?: string): Promise<Order> {
    const id = randomUUID();
    
    // Use confirmed order number or auto-generate new one
    const orderNumber = confirmedOrderNumber || await this.generateOrderNumber();
    const filesExpiryDate = new Date();
    filesExpiryDate.setDate(filesExpiryDate.getDate() + 14);
    
    const order: Order = {
      ...insertOrder,
      status: insertOrder.status || null,
      customerId: insertOrder.customerId || null,
      jobId: insertOrder.jobId || null,
      assignedTo: insertOrder.assignedTo || null,
      createdBy: insertOrder.createdBy || null,
      estimatedTotal: insertOrder.estimatedTotal || null,
      dateAccepted: insertOrder.dateAccepted || null,
      orderNumber,
      filesExpiryDate,
      id,
      createdAt: new Date()
    };
    this.orders.set(id, order);
    this.saveToFile();
    return order;
  }

  async updateOrder(id: string, updates: Partial<Order>): Promise<Order | undefined> {
    const order = this.orders.get(id);
    if (!order) return undefined;
    
    const updated = { ...order, ...updates };
    this.orders.set(id, updated);
    this.saveToFile();
    return updated;
  }

  async generateOrderNumber(): Promise<string> {
    // Clean up expired reservations first
    await this.cleanupExpiredReservations();
    
    const orderNumber = `#${this.orderCounter.toString().padStart(5, '0')}`;
    this.orderCounter++;
    this.saveToFile();
    return orderNumber;
  }

  // Order Reservation Methods
  async reserveOrderNumber(userId: string, jobId: string): Promise<OrderReservation> {
    // Clean up expired reservations first
    await this.cleanupExpiredReservations();
    
    const orderNumber = `#${this.orderCounter.toString().padStart(5, '0')}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (2 * 60 * 60 * 1000)); // 2 hours from now
    
    const reservation: OrderReservation = {
      orderNumber,
      userId,
      jobId,
      reservedAt: now,
      expiresAt,
      status: 'reserved'
    };
    
    this.orderReservations.set(orderNumber, reservation);
    this.orderCounter++;
    this.saveToFile();
    
    return reservation;
  }

  async confirmReservation(orderNumber: string): Promise<boolean> {
    const reservation = this.orderReservations.get(orderNumber);
    if (!reservation || reservation.status !== 'reserved') {
      return false;
    }
    
    // Check if reservation has expired
    if (new Date() > reservation.expiresAt) {
      reservation.status = 'expired';
      this.saveToFile();
      return false;
    }
    
    reservation.status = 'confirmed';
    this.saveToFile();
    return true;
  }

  async getReservation(orderNumber: string): Promise<OrderReservation | undefined> {
    return this.orderReservations.get(orderNumber);
  }

  async cleanupExpiredReservations(): Promise<void> {
    const now = new Date();
    let cleaned = false;
    
    for (const [orderNumber, reservation] of Array.from(this.orderReservations.entries())) {
      if (now > reservation.expiresAt && reservation.status === 'reserved') {
        reservation.status = 'expired';
        // Remove expired reservations completely
        this.orderReservations.delete(orderNumber);
        cleaned = true;
      }
    }
    
    // Never roll back the counter - once a number is assigned, it's assigned forever
    // This prevents duplicate order numbers which break billing and tracking
    if (cleaned) {
      this.saveToFile();
    }
  }

  // Order Services
  async getOrderServices(orderId: string): Promise<OrderService[]> {
    const allServices = Array.from(this.orderServices.values());
    return allServices.filter(service => service.orderId === orderId);
  }

  async createOrderService(insertOrderService: InsertOrderService): Promise<OrderService> {
    const id = randomUUID();
    const orderService: OrderService = {
      ...insertOrderService,
      quantity: insertOrderService.quantity ?? 1,
      instructions: insertOrderService.instructions || null,
      exportTypes: insertOrderService.exportTypes || null,
      id,
      createdAt: new Date()
    };
    this.orderServices.set(id, orderService);
    this.saveToFile();
    return orderService;
  }

  // Order Files
  async getOrderFiles(orderId: string): Promise<OrderFile[]> {
    const allFiles = Array.from(this.orderFiles.values());
    return allFiles.filter(file => file.orderId === orderId);
  }

  async createOrderFile(insertOrderFile: InsertOrderFile): Promise<OrderFile> {
    const id = randomUUID();
    const orderFile: OrderFile = {
      ...insertOrderFile,
      serviceId: insertOrderFile.serviceId || null,
      id,
      uploadedAt: new Date()
    };
    this.orderFiles.set(id, orderFile);
    this.saveToFile();
    return orderFile;
  }

  async getCustomerJobs(customerId: string): Promise<Job[]> {
    const allJobs = Array.from(this.jobs.values());
    return allJobs.filter(job => job.customerId === customerId);
  }

  // Status Validation and Transition Rules
  private validateOrderStatusTransition(currentStatus: string, newStatus: string): { valid: boolean; error?: string } {
    const validTransitions: Record<string, string[]> = {
      'pending': ['processing', 'cancelled'],
      'processing': ['in_progress', 'cancelled', 'in_revision'],
      'in_progress': ['completed', 'in_revision', 'cancelled'],
      'in_revision': ['in_progress', 'cancelled'],
      'completed': ['in_revision'], // Allow reopening completed orders if needed
      'cancelled': [] // No transitions from cancelled
    };

    if (!validTransitions[currentStatus]) {
      return { valid: false, error: `Invalid current status: ${currentStatus}` };
    }

    if (!validTransitions[currentStatus].includes(newStatus)) {
      return { valid: false, error: `Invalid status transition: ${currentStatus} → ${newStatus}` };
    }

    return { valid: true };
  }

  private validateJobStatusTransition(currentStatus: string, newStatus: string): { valid: boolean; error?: string } {
    const validTransitions: Record<string, string[]> = {
      'scheduled': ['in_progress', 'cancelled'],
      'in_progress': ['completed', 'cancelled'],
      'completed': ['in_progress'], // Allow reopening if needed
      'cancelled': [] // No transitions from cancelled
    };

    if (!validTransitions[currentStatus]) {
      return { valid: false, error: `Invalid current job status: ${currentStatus}` };
    }

    if (!validTransitions[currentStatus].includes(newStatus)) {
      return { valid: false, error: `Invalid job status transition: ${currentStatus} → ${newStatus}` };
    }

    return { valid: true };
  }

  // Comprehensive Status Update Methods
  async updateOrderStatus(orderId: string, status: string, editorId?: string): Promise<Order | undefined> {
    const order = this.orders.get(orderId);
    if (!order) return undefined;
    
    // Validate editor assignment if editorId provided
    if (editorId && order.assignedTo !== editorId) {
      return undefined;
    }
    
    // Validate status transition
    const validation = this.validateOrderStatusTransition(order.status || 'pending', status);
    if (!validation.valid) {
      console.error(`Order ${order.orderNumber} status update failed: ${validation.error}`);
      throw new Error(validation.error);
    }
    
    const updatedOrder = { ...order, status };
    this.orders.set(orderId, updatedOrder);
    this.saveToFile();
    return updatedOrder;
  }

  async updateOrderStatusWithTracking(orderId: string, status: string, actionType: string, editorId?: string): Promise<Order | undefined> {
    const order = this.orders.get(orderId);
    if (!order) return undefined;
    
    // Validate editor assignment if editorId provided
    if (editorId && order.assignedTo !== editorId) {
      return undefined;
    }
    
    // Validate status transition
    const validation = this.validateOrderStatusTransition(order.status || 'pending', status);
    if (!validation.valid) {
      console.error(`Order ${order.orderNumber} status update failed: ${validation.error} (${actionType})`);
      throw new Error(validation.error);
    }
    
    // Update order status
    const updatedOrder = { ...order, status };
    this.orders.set(orderId, updatedOrder);
    
    // Log status change for audit trail
    console.log(`Order ${order.orderNumber} status updated: ${order.status} → ${status} (${actionType})`);
    
    this.saveToFile();
    return updatedOrder;
  }

  async markOrderDownloaded(orderId: string, editorId: string): Promise<Order | undefined> {
    const order = this.orders.get(orderId);
    if (!order || order.assignedTo !== editorId) return undefined;
    
    // Only update if currently processing
    if (order.status === 'processing') {
      return this.updateOrderStatusWithTracking(orderId, 'in_progress', 'files_downloaded', editorId);
    }
    
    return order;
  }

  async markOrderUploaded(orderId: string, editorId: string): Promise<Order | undefined> {
    const order = this.orders.get(orderId);
    if (!order || order.assignedTo !== editorId) return undefined;
    
    // Update to completed if currently in progress
    if (order.status === 'in_progress') {
      return this.updateOrderStatusWithTracking(orderId, 'completed', 'deliverables_uploaded', editorId);
    }
    
    return order;
  }

  // Editor Upload Methods
  async getJobsReadyForUpload(editorId: string): Promise<any[]> {
    console.log(`[DEBUG] getJobsReadyForUpload called for editor: ${editorId}`);
    const allOrders = Array.from(this.orders.values());
    console.log(`[DEBUG] Total orders in system: ${allOrders.length}`);
    
    const assignedOrders = allOrders.filter(order => order.assignedTo === editorId);
    console.log(`[DEBUG] Orders assigned to editor ${editorId}: ${assignedOrders.length}`);
    assignedOrders.forEach(order => {
      console.log(`[DEBUG] Assigned order: ${order.orderNumber}, status: ${order.status}, assignedTo: ${order.assignedTo}`);
    });
    
    const editorOrders = allOrders.filter(order => 
      order.assignedTo === editorId && 
      (order.status === 'pending' || order.status === 'processing')
    );
    console.log(`[DEBUG] Orders ready for upload (assigned + pending/processing): ${editorOrders.length}`);

    const jobsData = [];
    for (const order of editorOrders) {
      if (!order.jobId) {
        continue;
      }
      
      const job = await this.getJobByJobId(order.jobId!);
      const customer = order.customerId ? await this.getCustomer(order.customerId) : null;
      const orderServices = await this.getOrderServices(order.id);
      const orderFiles = await this.getOrderFiles(order.id);
      const existingUploads = await this.getEditorUploads(order.jobId!);

      if (job) {
        jobsData.push({
          id: job.id,
          jobId: job.jobId,
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerName: customer ? `${customer.firstName} ${customer.lastName}` : order.orderNumber,
          address: job.address,
          services: orderServices.map(os => {
            const service = Array.from(this.editorServices.values()).find(s => s.id === os.serviceId);
            return {
              id: os.serviceId,
              name: service?.name || 'Unknown Service',
              quantity: os.quantity,
              instructions: os.instructions
            };
          }),
          originalFiles: orderFiles,
          existingUploads: existingUploads,
          status: order.status,
          dueDate: job.dueDate?.toISOString(),
          createdAt: order.createdAt?.toISOString()
        });
      }
    }

    return jobsData.sort((a, b) => {
      const dateA = new Date(a.dueDate || a.createdAt || 0);
      const dateB = new Date(b.dueDate || b.createdAt || 0);
      return dateA.getTime() - dateB.getTime();
    });
  }

  async getEditorUploads(jobId: string): Promise<EditorUpload[]> {
    const allUploads = Array.from(this.editorUploads.values());
    return allUploads.filter(upload => upload.jobId === jobId);
  }

  async createEditorUpload(editorUpload: InsertEditorUpload): Promise<EditorUpload> {
    const id = randomUUID();
    const now = new Date();
    const expiryDate = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days from now

    const newUpload: EditorUpload = {
      id,
      ...editorUpload,
      status: editorUpload.status || null,
      notes: editorUpload.notes || null,
      uploadedAt: now,
      expiresAt: editorUpload.expiresAt || expiryDate,
    };

    this.editorUploads.set(id, newUpload);
    this.saveToFile();
    return newUpload;
  }

  async updateJobStatusAfterUpload(jobId: string, status: string): Promise<Job | undefined> {
    const job = await this.getJobByJobId(jobId);
    if (!job) return undefined;

    // Treat null status as 'scheduled' (default initial state)
    let currentStatus = job.status || 'scheduled';
    let finalJob = job;

    // Handle transition from scheduled to completed by going through in_progress first
    if (currentStatus === 'scheduled' && status === 'completed') {
      console.log(`Job ${job.jobId} transitioning from scheduled → in_progress → completed`);
      
      // First transition to in_progress
      const progressValidation = this.validateJobStatusTransition(currentStatus, 'in_progress');
      if (!progressValidation.valid) {
        console.error(`Job ${job.jobId} intermediate status update failed: ${progressValidation.error}`);
        throw new Error(progressValidation.error);
      }
      
      finalJob = { ...finalJob, status: 'in_progress' };
      this.jobs.set(job.id, finalJob);
      currentStatus = 'in_progress';
      console.log(`Job ${job.jobId} status updated to in_progress`);
    }

    // Now validate the final transition
    const validation = this.validateJobStatusTransition(currentStatus, status);
    if (!validation.valid) {
      console.error(`Job ${job.jobId} status update failed: ${validation.error}`);
      throw new Error(validation.error);
    }

    const updatedJob = { ...finalJob, status };
    this.jobs.set(job.id, updatedJob);

    // Note: Order status updates are now handled separately via markOrderUploaded()
    // This method only updates job status to avoid redundancy and conflicts
    console.log(`Job ${job.jobId} status updated to ${status}`);

    this.saveToFile();
    return updatedJob;
  }

  // Folder Management
  async getUploadFolders(jobId: string): Promise<{folderPath: string; editorFolderName: string; partnerFolderName?: string; orderNumber?: string; folderToken?: string; fileCount: number; files: any[]}[]> {
    const allUploads = Array.from(this.editorUploads.values());
    const jobUploads = allUploads.filter(upload => upload.jobId === jobId);
    
    // Group uploads by folder path and get unique folders with order information
    const foldersMap = new Map<string, {folderPath: string; editorFolderName: string; partnerFolderName?: string; orderNumber?: string; folderToken?: string; fileCount: number; files: any[]}>();
    
    for (const upload of jobUploads) {
      if (upload.folderPath && upload.editorFolderName) {
        const key = upload.folderPath;
        let folderData = foldersMap.get(key);
        
        if (!folderData) {
          // Get order information (if orderId exists)
          const order = upload.orderId ? this.orders.get(upload.orderId) : undefined;
          
          // Use the folderToken from upload record (new field added for standalone folders)
          const folderToken = upload.folderToken || (upload.fileName === '.folder_placeholder' ? upload.firebaseUrl : undefined);
          
          folderData = {
            folderPath: upload.folderPath,
            editorFolderName: upload.editorFolderName,
            partnerFolderName: upload.partnerFolderName || undefined,
            orderNumber: order?.orderNumber || undefined,
            folderToken: folderToken || undefined,
            fileCount: 0,
            files: []
          };
          foldersMap.set(key, folderData);
        }
        
        // Add file to folder data
        folderData.fileCount++;
        folderData.files.push({
          id: upload.id,
          fileName: upload.fileName,
          originalName: upload.originalName,
          fileSize: upload.fileSize,
          mimeType: upload.mimeType,
          downloadUrl: upload.downloadUrl,
          uploadedAt: upload.uploadedAt,
          notes: upload.notes,
          folderPath: upload.folderPath,
          editorFolderName: upload.editorFolderName,
          partnerFolderName: upload.partnerFolderName
        });
      }
    }
    
    return Array.from(foldersMap.values());
  }

  async updateFolderName(jobId: string, folderPath: string, newPartnerFolderName: string): Promise<void> {
    const allUploads = Array.from(this.editorUploads.values());
    const uploadsToUpdate = allUploads.filter(upload => 
      upload.jobId === jobId && upload.folderPath === folderPath
    );
    
    // Update all uploads in this folder with the new partner folder name
    for (const upload of uploadsToUpdate) {
      const updatedUpload = { ...upload, partnerFolderName: newPartnerFolderName };
      this.editorUploads.set(upload.id, updatedUpload);
    }
    
    this.saveToFile();
  }

  async createFolder(jobId: string, partnerFolderName: string, parentFolderPath?: string, orderId?: string, folderToken?: string): Promise<{folderPath: string; partnerFolderName: string; folderToken?: string}> {
    // Generate folder path
    const folderPath = parentFolderPath 
      ? `${parentFolderPath}/${partnerFolderName}`
      : partnerFolderName;
    
    // Check if folder already exists
    const existingUploads = Array.from(this.editorUploads.values());
    const folderExists = existingUploads.some(upload => 
      upload.jobId === jobId && upload.folderPath === folderPath
    );
    
    if (!folderExists) {
      // Create a placeholder upload to represent the folder
      const folderId = randomUUID();
      // Store folderToken in firebaseUrl field for retrieval (hack but works with current schema)
      const folderPlaceholder: EditorUpload = {
        id: folderId,
        jobId,
        orderId: orderId || null, // Use provided orderId or null
        fileName: '.folder_placeholder',
        originalName: '.folder_placeholder',
        fileSize: 0,
        mimeType: 'application/x-folder-placeholder',
        downloadUrl: '',
        firebaseUrl: folderToken || '', // Store token here for retrieval
        uploadedAt: new Date(),
        folderPath,
        editorFolderName: partnerFolderName, // Use partner name as base
        partnerFolderName,
        notes: folderToken ? `Folder: ${partnerFolderName} (Token: ${folderToken})` : `Folder: ${partnerFolderName}`
      };
      
      this.editorUploads.set(folderId, folderPlaceholder);
      this.saveToFile();
    }
    
    return { folderPath, partnerFolderName, folderToken };
  }

  async getUsers(partnerId?: string): Promise<User[]> {
    const allUsers = Array.from(this.users.values());
    return partnerId ? allUsers.filter(user => user.partnerId === partnerId) : allUsers;
  }

  // Service Categories
  async getServiceCategories(editorId: string): Promise<ServiceCategory[]> {
    const allCategories = Array.from(this.serviceCategories.values());
    return allCategories.filter(category => category.editorId === editorId);
  }

  async createServiceCategory(insertCategory: InsertServiceCategory): Promise<ServiceCategory> {
    const id = randomUUID();
    const category: ServiceCategory = {
      ...insertCategory,
      description: insertCategory.description || null,
      displayOrder: insertCategory.displayOrder || null,
      isActive: insertCategory.isActive || null,
      id,
      createdAt: new Date()
    };
    this.serviceCategories.set(id, category);
    this.saveToFile();
    return category;
  }

  async updateServiceCategory(id: string, updates: Partial<ServiceCategory>, editorId: string): Promise<ServiceCategory | undefined> {
    const category = this.serviceCategories.get(id);
    if (!category || category.editorId !== editorId) return undefined;
    
    const updated = { ...category, ...updates };
    this.serviceCategories.set(id, updated);
    this.saveToFile();
    return updated;
  }

  async deleteServiceCategory(id: string, editorId: string): Promise<void> {
    const category = this.serviceCategories.get(id);
    if (!category || category.editorId !== editorId) return;
    
    this.serviceCategories.delete(id);
    this.saveToFile();
  }

  // Editor Services
  async getEditorServices(editorId: string): Promise<EditorService[]> {
    const allServices = Array.from(this.editorServices.values());
    return allServices.filter(service => service.editorId === editorId);
  }

  async createEditorService(insertService: InsertEditorService): Promise<EditorService> {
    const id = randomUUID();
    const service: EditorService = {
      ...insertService,
      categoryId: insertService.categoryId || null,
      description: insertService.description || null,
      pricePer: insertService.pricePer || null,
      estimatedTurnaround: insertService.estimatedTurnaround || null,
      isActive: insertService.isActive || null,
      displayOrder: insertService.displayOrder || null,
      id,
      createdAt: new Date()
    };
    this.editorServices.set(id, service);
    this.saveToFile();
    return service;
  }

  async updateEditorService(id: string, updates: Partial<EditorService>, editorId: string): Promise<EditorService | undefined> {
    const service = this.editorServices.get(id);
    if (!service || service.editorId !== editorId) return undefined;
    
    const updated = { ...service, ...updates };
    this.editorServices.set(id, updated);
    this.saveToFile();
    return updated;
  }

  async deleteEditorService(id: string, editorId: string): Promise<void> {
    const service = this.editorServices.get(id);
    if (!service || service.editorId !== editorId) return;
    
    this.editorServices.delete(id);
    this.saveToFile();
  }

  // Editor Job Management
  async getEditorJobs(editorId: string): Promise<any[]> {
    // Get all orders assigned to this editor
    const editorOrders = Array.from(this.orders.values()).filter(order => 
      order.assignedTo === editorId
    );

    const jobs = [];
    
    for (const order of editorOrders) {
      // Get the job details
      let job = null;
      if (order.jobId) {
        job = this.jobs.get(order.jobId);
      }

      // Get customer details
      let customer = null;
      if (order.customerId) {
        customer = this.customers.get(order.customerId);
      }

      // Get order services (which contain the editor services and instructions)
      const orderServices = Array.from(this.orderServices.values()).filter(
        service => service.orderId === order.id
      );

      // Get editor service details and combine
      let serviceName = 'General Editing';
      let instructions = null;
      let quantity = 1;

      if (orderServices.length > 0) {
        const firstService = orderServices[0];
        quantity = firstService.quantity || 1;
        instructions = firstService.instructions;

        // Get the editor service name
        if (firstService.serviceId) {
          const editorService = this.editorServices.get(firstService.serviceId);
          if (editorService) {
            serviceName = editorService.name;
          }
        }
      }

      // Get order files
      const orderFiles = Array.from(this.orderFiles.values()).filter(
        file => file.orderId === order.id
      );

      const files = orderFiles.map(file => ({
        name: file.originalName,
        type: file.mimeType.includes('image') ? 'image' : 'other',
        size: file.fileSize,
        url: file.downloadUrl
      }));

      // Build the editor job object
      const editorJob = {
        id: order.id,
        jobId: job?.jobId || order.orderNumber,
        orderNumber: order.orderNumber,
        customerName: customer ? `${customer.firstName} ${customer.lastName}` : 'Unknown Customer',
        address: job?.address || 'No address provided',
        service: serviceName,
        quantity,
        status: order.status || 'pending',
        uploadDate: order.createdAt?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
        dueDate: order.filesExpiryDate?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
        priority: 'medium', // Default priority - could be added to schema later
        instructions: instructions ? JSON.parse(instructions) : null,
        files
      };

      jobs.push(editorJob);
    }

    return jobs;
  }


  // Team Assignment System Implementation
  async getPendingOrders(partnerId: string): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(order => 
      order.partnerId === partnerId && 
      order.status === 'pending' && 
      !order.assignedTo
    );
  }

  async assignOrderToEditor(orderId: string, editorId: string): Promise<Order | undefined> {
    const order = this.orders.get(orderId);
    if (!order) return undefined;
    
    // Ensure order is still pending and unassigned (conflict prevention)
    if (order.status !== 'pending' || order.assignedTo) {
      return undefined;
    }
    
    // Atomic update: assign editor and change status to processing
    const updated = { 
      ...order, 
      assignedTo: editorId, 
      status: 'processing',
      dateAccepted: new Date()
    };
    
    this.orders.set(orderId, updated);
    this.saveToFile();
    return updated;
  }

  // Notifications
  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    const id = randomUUID();
    const notification: Notification = {
      ...insertNotification,
      id,
      createdAt: new Date(),
      readAt: null
    };
    this.notifications.set(id, notification);
    this.saveToFile();
    return notification;
  }

  async createNotifications(insertNotifications: InsertNotification[]): Promise<Notification[]> {
    const notifications: Notification[] = [];
    for (const insertNotification of insertNotifications) {
      const id = randomUUID();
      const notification: Notification = {
        ...insertNotification,
        id,
        createdAt: new Date(),
        readAt: null
      };
      this.notifications.set(id, notification);
      notifications.push(notification);
    }
    this.saveToFile();
    return notifications;
  }

  async getNotifications(): Promise<Notification[]> {
    return Array.from(this.notifications.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); // Latest first
  }

  async getNotificationsForUser(recipientId: string, partnerId: string): Promise<Notification[]> {
    return Array.from(this.notifications.values())
      .filter(notification => 
        notification.recipientId === recipientId && 
        notification.partnerId === partnerId
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); // Latest first
  }

  async markNotificationRead(id: string, recipientId: string): Promise<Notification | undefined> {
    const notification = this.notifications.get(id);
    if (!notification || notification.recipientId !== recipientId) {
      return undefined;
    }

    const updated = {
      ...notification,
      read: true,
      readAt: new Date()
    };
    this.notifications.set(id, updated);
    this.saveToFile();
    return updated;
  }

  async markAllNotificationsRead(recipientId: string, partnerId: string): Promise<void> {
    let hasChanges = false;
    
    for (const [id, notification] of this.notifications.entries()) {
      if (notification.recipientId === recipientId && 
          notification.partnerId === partnerId && 
          !notification.read) {
        const updated = {
          ...notification,
          read: true,
          readAt: new Date()
        };
        this.notifications.set(id, updated);
        hasChanges = true;
      }
    }
    
    if (hasChanges) {
      this.saveToFile();
    }
  }

  async deleteNotification(id: string, recipientId: string): Promise<void> {
    const notification = this.notifications.get(id);
    if (notification && notification.recipientId === recipientId) {
      this.notifications.delete(id);
      this.saveToFile();
    }
  }

  // Activity Tracking Methods
  async createActivity(insertActivity: InsertActivity): Promise<Activity> {
    const id = randomUUID();
    const activity: Activity = {
      ...insertActivity,
      id,
      createdAt: new Date()
    };
    this.activities.set(id, activity);
    this.saveToFile();
    return activity;
  }

  async createActivities(insertActivities: InsertActivity[]): Promise<Activity[]> {
    const activities: Activity[] = [];
    for (const insertActivity of insertActivities) {
      const id = randomUUID();
      const activity: Activity = {
        ...insertActivity,
        id,
        createdAt: new Date()
      };
      this.activities.set(id, activity);
      activities.push(activity);
    }
    this.saveToFile();
    return activities;
  }

  async getActivities(filters?: {
    partnerId?: string;
    jobId?: string;
    orderId?: string;
    userId?: string;
    action?: string;
    category?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<Activity[]> {
    let activities = Array.from(this.activities.values());

    // Apply filters
    if (filters?.partnerId) {
      activities = activities.filter(activity => activity.partnerId === filters.partnerId);
    }
    if (filters?.jobId) {
      activities = activities.filter(activity => activity.jobId === filters.jobId);
    }
    if (filters?.orderId) {
      activities = activities.filter(activity => activity.orderId === filters.orderId);
    }
    if (filters?.userId) {
      activities = activities.filter(activity => activity.userId === filters.userId);
    }
    if (filters?.action) {
      activities = activities.filter(activity => activity.action === filters.action);
    }
    if (filters?.category) {
      activities = activities.filter(activity => activity.category === filters.category);
    }
    if (filters?.startDate) {
      activities = activities.filter(activity => activity.createdAt >= filters.startDate!);
    }
    if (filters?.endDate) {
      activities = activities.filter(activity => activity.createdAt <= filters.endDate!);
    }

    // Sort by creation date (latest first)
    activities.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Apply pagination
    if (filters?.offset || filters?.limit) {
      const offset = filters?.offset || 0;
      const limit = filters?.limit || activities.length;
      activities = activities.slice(offset, offset + limit);
    }

    return activities;
  }

  async getJobActivities(jobId: string, partnerId: string): Promise<Activity[]> {
    return this.getActivities({
      jobId,
      partnerId
    });
  }

  async getOrderActivities(orderId: string, partnerId: string): Promise<Activity[]> {
    return this.getActivities({
      orderId,
      partnerId
    });
  }

  async getUserActivities(userId: string, partnerId: string, limit?: number): Promise<Activity[]> {
    return this.getActivities({
      userId,
      partnerId,
      limit
    });
  }

  async getActivityCountByType(partnerId: string, timeRange?: { start: Date; end: Date }): Promise<{ [key: string]: number }> {
    const filters: any = { partnerId };
    if (timeRange) {
      filters.startDate = timeRange.start;
      filters.endDate = timeRange.end;
    }

    const activities = await this.getActivities(filters);
    const counts: { [key: string]: number } = {};

    for (const activity of activities) {
      const key = `${activity.category}:${activity.action}`;
      counts[key] = (counts[key] || 0) + 1;
    }

    return counts;
  }

  // ===== JOB CONNECTION VALIDATION SYSTEM =====

  // Data Integrity Validation
  async validateJobIntegrity(jobId: string): Promise<{ isValid: boolean; issues: string[]; connections: any }> {
    const issues: string[] = [];
    const connections: any = {};

    // Get job by ID (UUID)
    const job = await this.getJob(jobId);
    if (!job) {
      return { isValid: false, issues: ['Job not found'], connections: {} };
    }

    connections.job = job;

    // Verify jobId (NanoID) exists and is unique
    if (!job.jobId) {
      issues.push('Job missing jobId (NanoID)');
    } else {
      const jobByJobId = await this.getJobByJobId(job.jobId);
      if (!jobByJobId || jobByJobId.id !== job.id) {
        issues.push('JobId (NanoID) reference inconsistency');
      }
    }

    // Check customer relationship
    if (job.customerId) {
      const customer = await this.getCustomer(job.customerId);
      if (!customer) {
        issues.push('Job references non-existent customer');
      } else {
        connections.customer = customer;
      }
    }

    // Check orders that reference this job
    const relatedOrders = Array.from(this.orders.values()).filter(order => order.jobId === job.id);
    connections.orders = relatedOrders;

    if (relatedOrders.length === 0) {
      issues.push('Job has no associated orders');
    }

    // Verify each order relationship
    for (const order of relatedOrders) {
      if (order.partnerId !== job.partnerId) {
        issues.push(`Order ${order.orderNumber} partnerId mismatch with job`);
      }
      if (order.customerId && order.customerId !== job.customerId) {
        issues.push(`Order ${order.orderNumber} customer mismatch with job`);
      }
    }

    // Check editor uploads
    const editorUploads = Array.from(this.editorUploads.values()).filter(upload => upload.jobId === job.id);
    connections.uploads = editorUploads;

    // Verify upload relationships
    for (const upload of editorUploads) {
      const relatedOrder = relatedOrders.find(order => order.id === upload.orderId);
      if (!relatedOrder) {
        issues.push(`Upload ${upload.fileName} references invalid order`);
      }
    }

    return { isValid: issues.length === 0, issues, connections };
  }

  async validateOrderIntegrity(orderId: string): Promise<{ isValid: boolean; issues: string[]; connections: any }> {
    const issues: string[] = [];
    const connections: any = {};

    const order = await this.getOrder(orderId);
    if (!order) {
      return { isValid: false, issues: ['Order not found'], connections: {} };
    }

    connections.order = order;

    // Check job relationship
    if (order.jobId) {
      const job = await this.getJob(order.jobId);
      if (!job) {
        issues.push('Order references non-existent job');
      } else {
        connections.job = job;
        
        // Check consistency
        if (job.partnerId !== order.partnerId) {
          issues.push('Order/Job partnerId mismatch');
        }
        if (job.customerId !== order.customerId) {
          issues.push('Order/Job customer mismatch');
        }
      }
    } else {
      issues.push('Order missing job reference');
    }

    // Check customer relationship
    if (order.customerId) {
      const customer = await this.getCustomer(order.customerId);
      if (!customer) {
        issues.push('Order references non-existent customer');
      } else {
        connections.customer = customer;
      }
    }

    // Check order services
    const orderServices = await this.getOrderServices(order.id);
    connections.services = orderServices;

    for (const service of orderServices) {
      const editorService = await this.editorServices.get(service.serviceId);
      if (!editorService) {
        issues.push(`Order service references non-existent editor service ${service.serviceId}`);
      }
    }

    // Check order files
    const orderFiles = await this.getOrderFiles(order.id);
    connections.files = orderFiles;

    // Check editor uploads
    const editorUploads = Array.from(this.editorUploads.values()).filter(upload => upload.orderId === order.id);
    connections.uploads = editorUploads;

    return { isValid: issues.length === 0, issues, connections };
  }

  async validateEditorWorkflowAccess(editorId: string, jobId: string): Promise<{ canAccess: boolean; reason: string; orderInfo?: any }> {
    const job = await this.getJobByJobId(jobId);
    if (!job) {
      return { canAccess: false, reason: 'Job not found' };
    }

    // Find the order associated with this job
    const order = Array.from(this.orders.values()).find(o => o.jobId === job.id);
    if (!order) {
      return { canAccess: false, reason: 'No order associated with job' };
    }

    // Check if editor is assigned to this order
    if (order.assignedTo !== editorId) {
      return { canAccess: false, reason: 'Editor not assigned to this order' };
    }

    // Check order status - editor can only work on processing/in_progress orders
    if (!['processing', 'in_progress'].includes(order.status || 'pending')) {
      return { canAccess: false, reason: `Order status (${order.status}) does not allow editor access` };
    }

    return { 
      canAccess: true, 
      reason: 'Access granted',
      orderInfo: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        partnerId: order.partnerId
      }
    };
  }

  // Connection Health Check
  async performHealthCheck(partnerId?: string): Promise<{ 
    isHealthy: boolean; 
    issues: string[]; 
    statistics: any;
    orphanedRecords: any;
  }> {
    const issues: string[] = [];
    const statistics = {
      totalJobs: 0,
      totalOrders: 0,
      totalUploads: 0,
      connectedJobs: 0,
      orphanedJobs: 0,
      orphanedOrders: 0,
      orphanedUploads: 0
    };
    const orphanedRecords = {
      jobs: [] as any[],
      orders: [] as any[],
      uploads: [] as any[]
    };

    const allJobs = partnerId ? await this.getJobs(partnerId) : Array.from(this.jobs.values());
    const allOrders = partnerId ? await this.getOrders(partnerId) : Array.from(this.orders.values());
    const allUploads = Array.from(this.editorUploads.values());

    statistics.totalJobs = allJobs.length;
    statistics.totalOrders = allOrders.length;
    statistics.totalUploads = allUploads.length;

    // Check job connections
    for (const job of allJobs) {
      const relatedOrders = allOrders.filter(order => order.jobId === job.id);
      
      if (relatedOrders.length === 0) {
        statistics.orphanedJobs++;
        orphanedRecords.jobs.push({
          id: job.id,
          jobId: job.jobId,
          address: job.address,
          issue: 'No associated orders'
        });
      } else {
        statistics.connectedJobs++;
      }
    }

    // Check order connections  
    for (const order of allOrders) {
      let hasIssues = false;

      if (order.jobId) {
        const job = await this.getJob(order.jobId);
        if (!job) {
          hasIssues = true;
          issues.push(`Order ${order.orderNumber} references non-existent job ${order.jobId}`);
        }
      } else {
        hasIssues = true;
      }

      if (order.customerId) {
        const customer = await this.getCustomer(order.customerId);
        if (!customer) {
          hasIssues = true;
          issues.push(`Order ${order.orderNumber} references non-existent customer ${order.customerId}`);
        }
      }

      if (hasIssues) {
        statistics.orphanedOrders++;
        orphanedRecords.orders.push({
          id: order.id,
          orderNumber: order.orderNumber,
          jobId: order.jobId,
          customerId: order.customerId
        });
      }
    }

    // Check upload connections
    for (const upload of allUploads) {
      let hasIssues = false;

      const order = await this.getOrder(upload.orderId);
      if (!order) {
        hasIssues = true;
        issues.push(`Upload ${upload.fileName} references non-existent order ${upload.orderId}`);
      }

      const job = await this.getJob(upload.jobId);
      if (!job) {
        hasIssues = true;
        issues.push(`Upload ${upload.fileName} references non-existent job ${upload.jobId}`);
      }

      if (hasIssues) {
        statistics.orphanedUploads++;
        orphanedRecords.uploads.push({
          id: upload.id,
          fileName: upload.fileName,
          jobId: upload.jobId,
          orderId: upload.orderId
        });
      }
    }

    return { 
      isHealthy: issues.length === 0, 
      issues, 
      statistics,
      orphanedRecords
    };
  }

  // Repair Functions
  async repairOrphanedOrder(orderId: string, correctJobId: string): Promise<{ success: boolean; message: string }> {
    const order = await this.getOrder(orderId);
    if (!order) {
      return { success: false, message: 'Order not found' };
    }

    const job = await this.getJob(correctJobId);
    if (!job) {
      return { success: false, message: 'Target job not found' };
    }

    // Update the order to reference the correct job
    const updatedOrder = { 
      ...order, 
      jobId: job.id,
      customerId: job.customerId, // Ensure customer consistency
      partnerId: job.partnerId    // Ensure partner consistency
    };
    
    this.orders.set(orderId, updatedOrder);
    this.saveToFile();

    // Log the repair activity
    await this.createActivity({
      partnerId: job.partnerId,
      jobId: job.id,
      orderId: order.id,
      userId: 'system',
      userEmail: 'system@repair',
      userName: 'System Repair',
      action: 'update',
      category: 'system',
      title: 'Order Repaired',
      description: `Order ${order.orderNumber} linked to job ${job.jobId}`,
      metadata: JSON.stringify({
        repairType: 'orphaned_order',
        previousJobId: order.jobId,
        newJobId: job.id
      })
    });

    return { success: true, message: `Order ${order.orderNumber} successfully linked to job ${job.jobId}` };
  }

  // Preventive Validation
  async validateJobCreation(insertJob: InsertJob): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Ensure partnerId exists
    if (!insertJob.partnerId) {
      errors.push('partnerId is required');
    }

    // Validate customer if provided
    if (insertJob.customerId) {
      const customer = await this.getCustomer(insertJob.customerId);
      if (!customer) {
        errors.push('Referenced customer does not exist');
      } else if (customer.partnerId !== insertJob.partnerId) {
        errors.push('Customer belongs to different partner');
      }
    }

    // Ensure address is provided
    if (!insertJob.address || insertJob.address.trim().length === 0) {
      errors.push('Job address is required');
    }

    // Validate jobId uniqueness if provided
    if (insertJob.jobId) {
      const existingJob = await this.getJobByJobId(insertJob.jobId);
      if (existingJob) {
        errors.push('JobId already exists');
      }
    }

    return { valid: errors.length === 0, errors };
  }

  async validateOrderCreation(insertOrder: InsertOrder): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Ensure partnerId exists
    if (!insertOrder.partnerId) {
      errors.push('partnerId is required');
    }

    // Validate job reference if provided
    if (insertOrder.jobId) {
      const job = await this.getJob(insertOrder.jobId);
      if (!job) {
        errors.push('Referenced job does not exist');
      } else if (job.partnerId !== insertOrder.partnerId) {
        errors.push('Job belongs to different partner');
      }
    }

    // Validate customer if provided
    if (insertOrder.customerId) {
      const customer = await this.getCustomer(insertOrder.customerId);
      if (!customer) {
        errors.push('Referenced customer does not exist');
      } else if (customer.partnerId !== insertOrder.partnerId) {
        errors.push('Customer belongs to different partner');
      }
    }

    // Ensure job and customer consistency
    if (insertOrder.jobId && insertOrder.customerId) {
      const job = await this.getJob(insertOrder.jobId);
      if (job && job.customerId !== insertOrder.customerId) {
        errors.push('Job and order customer mismatch');
      }
    }

    return { valid: errors.length === 0, errors };
  }

  async validateEditorUpload(insertUpload: InsertEditorUpload): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Skip order validation for new orders (temp IDs)
    let order = null;
    if (insertUpload.orderId !== 'temp-new-order') {
      // Validate order exists
      order = await this.getOrder(insertUpload.orderId);
      if (!order) {
        errors.push('Referenced order does not exist');
      }

      // Validate editor assignment (only for editors, not partners)
      // Note: Partners can upload to any order in their organization
      // This check is skipped for partner uploads
    }

    // Validate job exists (always required)
    const job = await this.getJob(insertUpload.jobId);
    if (!job) {
      errors.push('Referenced job does not exist');
    }

    // Ensure order and job are connected (only if order exists)
    // Orders can reference jobs by either UUID (job.id) or NanoID (job.jobId)
    if (order && job && order.jobId !== job.id && order.jobId !== job.jobId) {
      errors.push('Order and job are not connected');
    }

    // Validate file data
    if (!insertUpload.fileName || insertUpload.fileName.trim().length === 0) {
      errors.push('File name is required');
    }

    // Firebase URL is set after upload, so it's empty during initial validation
    // Skip this check for initial uploads

    return { valid: errors.length === 0, errors };
  }

  // Editing Options Implementation
  async getEditingOptions(partnerId: string): Promise<EditingOption[]> {
    return Array.from(this.editingOptions.values())
      .filter(option => option.partnerId === partnerId && (option.isActive ?? true))
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  }

  async createEditingOption(option: InsertEditingOption): Promise<EditingOption> {
    const id = randomUUID();
    const newOption: EditingOption = {
      ...option,
      id,
      isActive: option.isActive ?? true,
      displayOrder: option.displayOrder ?? 0,
      createdAt: new Date(),
    };
    this.editingOptions.set(id, newOption);
    this.saveToFile();
    return newOption;
  }

  async updateEditingOption(id: string, updates: Partial<EditingOption>, partnerId: string): Promise<EditingOption | undefined> {
    const option = this.editingOptions.get(id);
    if (!option || option.partnerId !== partnerId) {
      return undefined;
    }
    const updatedOption = { ...option, ...updates };
    this.editingOptions.set(id, updatedOption);
    this.saveToFile();
    return updatedOption;
  }

  async deleteEditingOption(id: string, partnerId: string): Promise<void> {
    const option = this.editingOptions.get(id);
    if (option && option.partnerId === partnerId) {
      this.editingOptions.delete(id);
      // Also delete all customer preferences for this option
      Array.from(this.customerEditingPreferences.values())
        .filter(pref => pref.editingOptionId === id)
        .forEach(pref => this.customerEditingPreferences.delete(pref.id));
      this.saveToFile();
    }
  }

  // Customer Editing Preferences Implementation
  async getCustomerEditingPreferences(customerId: string): Promise<CustomerEditingPreference[]> {
    return Array.from(this.customerEditingPreferences.values())
      .filter(pref => pref.customerId === customerId);
  }

  async setCustomerEditingPreference(preference: InsertCustomerEditingPreference): Promise<CustomerEditingPreference> {
    const id = randomUUID();
    const newPreference: CustomerEditingPreference = {
      ...preference,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.customerEditingPreferences.set(id, newPreference);
    this.saveToFile();
    return newPreference;
  }

  async updateCustomerEditingPreference(id: string, updates: Partial<CustomerEditingPreference>): Promise<CustomerEditingPreference | undefined> {
    const preference = this.customerEditingPreferences.get(id);
    if (!preference) {
      return undefined;
    }
    const updatedPreference = { ...preference, ...updates, updatedAt: new Date() };
    this.customerEditingPreferences.set(id, updatedPreference);
    this.saveToFile();
    return updatedPreference;
  }

  async deleteCustomerEditingPreference(id: string): Promise<void> {
    this.customerEditingPreferences.delete(id);
    this.saveToFile();
  }

  async saveCustomerPreferences(customerId: string, preferences: { editingOptionId: string; isEnabled: boolean; notes?: string }[]): Promise<void> {
    // Get all existing preferences for this customer
    const existingPrefs = await this.getCustomerEditingPreferences(customerId);
    
    // Delete all existing preferences
    for (const pref of existingPrefs) {
      this.customerEditingPreferences.delete(pref.id);
    }
    
    // Create new preferences
    for (const pref of preferences) {
      const id = randomUUID();
      const newPreference: CustomerEditingPreference = {
        id,
        customerId,
        editingOptionId: pref.editingOptionId,
        isEnabled: pref.isEnabled,
        notes: pref.notes || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.customerEditingPreferences.set(id, newPreference);
    }
    
    this.saveToFile();
  }

  // Partner Settings Implementation
  async getPartnerSettings(partnerId: string): Promise<PartnerSettings | undefined> {
    return this.partnerSettings.get(partnerId);
  }

  async savePartnerSettings(partnerId: string, settings: InsertPartnerSettings): Promise<PartnerSettings> {
    const existing = this.partnerSettings.get(partnerId);
    
    const partnerSettingsData: PartnerSettings = {
      id: existing?.id || randomUUID(),
      partnerId,
      businessProfile: settings.businessProfile || null,
      personalProfile: settings.personalProfile || null,
      businessHours: settings.businessHours || null,
      defaultMaxRevisionRounds: settings.defaultMaxRevisionRounds ?? 2,
      createdAt: existing?.createdAt || new Date(),
      updatedAt: new Date(),
    };
    
    this.partnerSettings.set(partnerId, partnerSettingsData);
    this.saveToFile();
    return partnerSettingsData;
  }

  // File Comments Implementation
  async getFileComments(fileId: string): Promise<FileComment[]> {
    return Array.from(this.fileComments.values())
      .filter(comment => comment.fileId === fileId)
      .sort((a, b) => (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0));
  }

  async getJobFileComments(jobId: string): Promise<FileComment[]> {
    return Array.from(this.fileComments.values())
      .filter(comment => comment.jobId === jobId)
      .sort((a, b) => (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0));
  }

  async createFileComment(comment: InsertFileComment): Promise<FileComment> {
    const id = randomUUID();
    const newComment: FileComment = {
      ...comment,
      id,
      status: comment.status || 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.fileComments.set(id, newComment);
    this.saveToFile();
    return newComment;
  }

  async updateFileCommentStatus(id: string, status: string): Promise<FileComment | undefined> {
    const comment = this.fileComments.get(id);
    if (!comment) {
      return undefined;
    }
    const updatedComment = { ...comment, status, updatedAt: new Date() };
    this.fileComments.set(id, updatedComment);
    this.saveToFile();
    return updatedComment;
  }

  // Job Reviews Implementation
  async getJobReview(jobId: string): Promise<JobReview | undefined> {
    return Array.from(this.jobReviews.values())
      .find(review => review.jobId === jobId);
  }

  async createJobReview(review: InsertJobReview): Promise<JobReview> {
    const id = randomUUID();
    const newReview: JobReview = {
      ...review,
      id,
      createdAt: new Date(),
    };
    this.jobReviews.set(id, newReview);
    this.saveToFile();
    return newReview;
  }

  // Delivery Emails Implementation
  async getDeliveryEmails(jobId: string): Promise<DeliveryEmail[]> {
    return Array.from(this.deliveryEmails.values())
      .filter(email => email.jobId === jobId)
      .sort((a, b) => (b.sentAt?.getTime() || 0) - (a.sentAt?.getTime() || 0));
  }

  async createDeliveryEmail(email: InsertDeliveryEmail): Promise<DeliveryEmail> {
    const id = randomUUID();
    const newEmail: DeliveryEmail = {
      ...email,
      id,
      sentAt: new Date(),
    };
    this.deliveryEmails.set(id, newEmail);
    this.saveToFile();
    return newEmail;
  }

  // Revision Management Implementation
  async incrementRevisionRound(orderId: string): Promise<Order | undefined> {
    const order = this.orders.get(orderId);
    if (!order) {
      return undefined;
    }
    const updatedOrder = {
      ...order,
      usedRevisionRounds: (order.usedRevisionRounds || 0) + 1,
      status: 'in_revision' as const,
    };
    this.orders.set(orderId, updatedOrder);
    this.saveToFile();
    return updatedOrder;
  }

  async getOrderRevisionStatus(orderId: string): Promise<{ maxRounds: number; usedRounds: number; remainingRounds: number } | undefined> {
    const order = this.orders.get(orderId);
    if (!order) {
      return undefined;
    }
    const maxRounds = order.maxRevisionRounds || 2;
    const usedRounds = order.usedRevisionRounds || 0;
    return {
      maxRounds,
      usedRounds,
      remainingRounds: Math.max(0, maxRounds - usedRounds),
    };
  }

  // Messaging Implementation
  async getUserConversations(userId: string, partnerId?: string): Promise<Conversation[]> {
    return Array.from(this.conversations.values())
      .filter(conv => {
        // User can see conversations where they are either the partner or the editor
        const isParticipant = conv.editorId === userId || (partnerId && conv.partnerId === partnerId);
        return isParticipant;
      })
      .sort((a, b) => (b.lastMessageAt?.getTime() || 0) - (a.lastMessageAt?.getTime() || 0));
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    return this.conversations.get(id);
  }

  async getConversationByParticipants(partnerId: string, editorId: string, orderId?: string): Promise<Conversation | undefined> {
    return Array.from(this.conversations.values())
      .find(conv => {
        const matchesParticipants = conv.partnerId === partnerId && conv.editorId === editorId;
        if (orderId) {
          // If orderId is provided, match conversations for that specific order
          return matchesParticipants && conv.orderId === orderId;
        }
        // If no orderId, only match general conversations (conversations without an orderId)
        return matchesParticipants && !conv.orderId;
      });
  }

  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    const id = randomUUID();
    const newConversation: Conversation = {
      ...conversation,
      id,
      lastMessageAt: new Date(),
      lastMessageText: null,
      partnerUnreadCount: 0,
      editorUnreadCount: 0,
      createdAt: new Date(),
    };
    this.conversations.set(id, newConversation);
    this.saveToFile();
    return newConversation;
  }

  async updateConversationLastMessage(conversationId: string, lastMessageText: string, isPartnerSender: boolean): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      return;
    }

    // Update last message info and increment unread count for the recipient
    const updatedConversation: Conversation = {
      ...conversation,
      lastMessageAt: new Date(),
      lastMessageText: lastMessageText.substring(0, 100), // Limit preview length
      partnerUnreadCount: isPartnerSender ? conversation.partnerUnreadCount : (conversation.partnerUnreadCount || 0) + 1,
      editorUnreadCount: isPartnerSender ? (conversation.editorUnreadCount || 0) + 1 : conversation.editorUnreadCount,
    };

    this.conversations.set(conversationId, updatedConversation);
    this.saveToFile();
  }

  async markConversationAsRead(conversationId: string, isPartnerReading: boolean): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      return;
    }

    // Mark all unread messages as read
    const messages = Array.from(this.messages.values())
      .filter(msg => msg.conversationId === conversationId && !msg.readAt);

    const now = new Date();
    messages.forEach(msg => {
      // Only mark messages that were sent by the other party
      const shouldMark = isPartnerReading
        ? msg.senderRole === 'editor'
        : msg.senderRole === 'partner';

      if (shouldMark) {
        this.messages.set(msg.id, { ...msg, readAt: now });
      }
    });

    // Reset unread count for the reader
    const updatedConversation: Conversation = {
      ...conversation,
      partnerUnreadCount: isPartnerReading ? 0 : conversation.partnerUnreadCount,
      editorUnreadCount: isPartnerReading ? conversation.editorUnreadCount : 0,
    };

    this.conversations.set(conversationId, updatedConversation);
    this.saveToFile();
  }

  async getUnreadMessageCount(userId: string, partnerId?: string): Promise<number> {
    const conversations = await this.getUserConversations(userId, partnerId);

    return conversations.reduce((total, conv) => {
      // If user is the partner, count partner's unread messages
      if (partnerId && conv.partnerId === partnerId) {
        return total + (conv.partnerUnreadCount || 0);
      }
      // If user is the editor, count editor's unread messages
      if (conv.editorId === userId) {
        return total + (conv.editorUnreadCount || 0);
      }
      return total;
    }, 0);
  }

  async getConversationMessages(conversationId: string): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(msg => msg.conversationId === conversationId)
      .sort((a, b) => (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0));
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const id = randomUUID();
    const newMessage: Message = {
      ...message,
      id,
      readAt: null,
      createdAt: new Date(),
    };
    this.messages.set(id, newMessage);
    this.saveToFile();
    return newMessage;
  }
}

export const storage = new MemStorage();
