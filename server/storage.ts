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
  type InsertEditorUpload
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
        
        console.log(`Loaded data from storage: ${this.customers.size} customers, ${this.jobs.size} jobs, ${this.products.size} products, ${this.orders.size} orders, ${this.serviceCategories.size} categories, ${this.editorServices.size} services, ${this.editorUploads.size} uploads`);
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

    const updatedJob = { ...job, status };
    this.jobs.set(job.id, updatedJob);

    // Also update the order status if needed
    const allOrders = Array.from(this.orders.values());
    const relatedOrder = allOrders.find(order => order.jobId === job.id);
    if (relatedOrder && status === 'completed') {
      const updatedOrder = { ...relatedOrder, status: 'completed' };
      this.orders.set(relatedOrder.id, updatedOrder);
    }

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
}

export const storage = new MemStorage();
