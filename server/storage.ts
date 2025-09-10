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
  type InsertEditorService
} from "@shared/schema";
import { randomUUID } from "crypto";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { nanoid } from "nanoid";

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
  
  // Order Services
  getOrderServices(orderId: string): Promise<OrderService[]>;
  createOrderService(orderService: InsertOrderService): Promise<OrderService>;
  
  // Order Files
  getOrderFiles(orderId: string): Promise<OrderFile[]>;
  createOrderFile(orderFile: InsertOrderFile): Promise<OrderFile>;

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
  private orderCounter = 12345; // Sequential order numbering
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
        
        // Restore order counter
        if (data.orderCounter) {
          this.orderCounter = data.orderCounter;
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
        
        console.log(`Loaded data from storage: ${this.customers.size} customers, ${this.jobs.size} jobs, ${this.products.size} products, ${this.orders.size} orders, ${this.serviceCategories.size} categories, ${this.editorServices.size} services`);
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
        orderCounter: this.orderCounter
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
    const orderNumber = `#${this.orderCounter}`;
    this.orderCounter++;
    this.saveToFile();
    return orderNumber;
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
}

export const storage = new MemStorage();
