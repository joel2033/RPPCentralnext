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
  type InsertActivity
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
        
        // Reset order counter to start from 1 (ignore saved value)
        this.orderCounter = 1;
        
        // Restore order reservations
        if (data.orderReservations) {
          Object.entries(data.orderReservations).forEach(([orderNumber, reservation]: [string, any]) => {
            this.orderReservations.set(orderNumber, { 
              ...reservation, 
              reservedAt: new Date(reservation.reservedAt),
              expiresAt: new Date(reservation.expiresAt)
            });
          });
        }
        
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
        
        console.log(`Loaded data from storage: ${this.customers.size} customers, ${this.jobs.size} jobs, ${this.products.size} products, ${this.orders.size} orders, ${this.serviceCategories.size} categories, ${this.editorServices.size} services, ${this.editorUploads.size} uploads, ${this.notifications.size} notifications, ${this.activities.size} activities`);
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
    return Array.from(this.jobs.values()).find(job => job.jobId === jobId);
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

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    const id = randomUUID();
    
    // Auto-generate order number and files expiry date
    const orderNumber = await this.generateOrderNumber();
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
    const expiredReservations: string[] = [];
    
    for (const [orderNumber, reservation] of Array.from(this.orderReservations.entries())) {
      if (now > reservation.expiresAt && reservation.status === 'reserved') {
        reservation.status = 'expired';
        expiredReservations.push(orderNumber);
      }
    }
    
    // Reclaim expired order numbers by adjusting the counter
    if (expiredReservations.length > 0) {
      // Find the lowest expired order number to potentially reclaim
      const expiredNumbers = expiredReservations.map(num => 
        parseInt(num.replace('#', ''))
      ).sort((a, b) => a - b);
      
      // If the lowest expired number is right before our current counter, we can reclaim it
      const lowestExpired = expiredNumbers[0];
      if (lowestExpired === this.orderCounter - expiredReservations.length) {
        this.orderCounter = lowestExpired;
        // Remove expired reservations from the map
        expiredReservations.forEach(num => this.orderReservations.delete(num));
      }
      
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
    const validation = this.validateOrderStatusTransition(order.status, status);
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
    const validation = this.validateOrderStatusTransition(order.status, status);
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
    const allOrders = Array.from(this.orders.values());
    const editorOrders = allOrders.filter(order => 
      order.assignedTo === editorId && 
      order.status === 'processing'
    );

    const jobsData = [];
    for (const order of editorOrders) {
      const job = await this.getJob(order.jobId!);
      const customer = await this.getCustomer(order.customerId!);
      const orderServices = await this.getOrderServices(order.id);
      const orderFiles = await this.getOrderFiles(order.id);
      const existingUploads = await this.getEditorUploads(order.jobId!);

      if (job && customer) {
        jobsData.push({
          id: job.id,
          jobId: job.jobId,
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerName: `${customer.firstName} ${customer.lastName}`,
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

    // Validate job status transition
    const validation = this.validateJobStatusTransition(job.status, status);
    if (!validation.valid) {
      console.error(`Job ${job.jobId} status update failed: ${validation.error}`);
      throw new Error(validation.error);
    }

    const updatedJob = { ...job, status };
    this.jobs.set(job.id, updatedJob);

    // Note: Order status updates are now handled separately via markOrderUploaded()
    // This method only updates job status to avoid redundancy and conflicts
    console.log(`Job ${job.jobId} status updated to ${status}`);

    this.saveToFile();
    return updatedJob;
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

  async updateOrderStatus(orderId: string, status: string, editorId: string): Promise<Order | undefined> {
    const order = this.orders.get(orderId);
    if (!order || order.assignedTo !== editorId) return undefined;
    
    const updated = { ...order, status };
    this.orders.set(orderId, updated);
    this.saveToFile();
    return updated;
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

    // Validate order exists
    const order = await this.getOrder(insertUpload.orderId);
    if (!order) {
      errors.push('Referenced order does not exist');
    }

    // Validate job exists
    const job = await this.getJob(insertUpload.jobId);
    if (!job) {
      errors.push('Referenced job does not exist');
    }

    // Ensure order and job are connected
    if (order && job && order.jobId !== job.id) {
      errors.push('Order and job are not connected');
    }

    // Validate editor assignment
    if (order && order.assignedTo !== insertUpload.editorId) {
      errors.push('Editor not assigned to this order');
    }

    // Validate file data
    if (!insertUpload.fileName || insertUpload.fileName.trim().length === 0) {
      errors.push('File name is required');
    }

    if (!insertUpload.firebaseUrl || insertUpload.firebaseUrl.trim().length === 0) {
      errors.push('Firebase URL is required');
    }

    return { valid: errors.length === 0, errors };
  }
}

export const storage = new MemStorage();
