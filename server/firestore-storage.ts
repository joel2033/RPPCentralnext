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
import { adminDb } from "./firebase-admin";
import { type IStorage, type OrderReservation } from "./storage";
import { nanoid } from "nanoid";
import { Timestamp, FieldValue } from "firebase-admin/firestore";

// Helper to convert Firestore timestamp to Date
function timestampToDate(timestamp: any): Date | null {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return timestamp;
  if (timestamp?.toDate) return timestamp.toDate();
  if (timestamp?._seconds) return new Date(timestamp._seconds * 1000);
  return new Date(timestamp);
}

// Helper to prepare data for Firestore (convert Date to Timestamp)
function prepareForFirestore(data: any): any {
  const result: any = {};
  for (const [key, value] of Object.entries(data)) {
    if (value instanceof Date) {
      result[key] = Timestamp.fromDate(value);
    } else if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

// Helper to convert Firestore document to typed object with proper null handling
function docToObject<T>(docSnap: FirebaseFirestore.DocumentSnapshot): T & { id: string } {
  const data = docSnap.data();
  if (!data) throw new Error("Document has no data");
  
  const result: any = { id: docSnap.id };
  
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object' && 'toDate' in value) {
      result[key] = value.toDate();
    } else if (value === undefined) {
      result[key] = null;
    } else {
      result[key] = value;
    }
  }
  
  return result as T & { id: string };
}

export class FirestoreStorage implements IStorage {
  private db = adminDb;

  // Users
  async getUser(id: string): Promise<User | undefined> {
    const docRef = this.db.collection("users").doc(id);
    const docSnap = await docRef.get();
    return docSnap.exists ? docToObject<User>(docSnap) : undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const snapshot = await this.db.collection("users").where("email", "==", email).get();
    return snapshot.empty ? undefined : docToObject<User>(snapshot.docs[0]);
  }

  async getUsers(partnerId: string): Promise<User[]> {
    console.log(`[DEBUG] getUsers called with partnerId: ${partnerId}`);
    const ref = this.db.collection("users");
    const snapshot = await ref.where("partnerId", "==", partnerId).get();
    console.log(`[DEBUG] Found ${snapshot.docs.length} users for partnerId ${partnerId}`);
    
    if (snapshot.docs.length === 0) {
      // Debug: Let's see all users in the collection
      const allSnapshot = await ref.limit(10).get();
      console.log(`[DEBUG] Total users in collection (first 10):`, allSnapshot.docs.map(d => ({
        id: d.id,
        email: d.data().email,
        partnerId: d.data().partnerId,
        role: d.data().role
      })));
    }
    
    return snapshot.docs.map(doc => docToObject<User>(doc));
  }

  async createUser(user: InsertUser): Promise<User> {
    const id = nanoid();
    const newUser: User = {
      ...user,
      company: user.company || null,
      role: user.role || null,
      profileImage: user.profileImage || null,
      id,
      createdAt: new Date()
    };
    await this.db.collection("users").doc(id).set(prepareForFirestore(newUser));
    return newUser;
  }

  // Customers
  async getCustomer(id: string): Promise<Customer | undefined> {
    const docSnap = await this.db.collection("customers").doc(id).get();
    return docSnap.exists ? docToObject<Customer>(docSnap) : undefined;
  }

  async getCustomers(partnerId: string): Promise<Customer[]> {
    const ref = this.db.collection("customers");
    const snapshot = await ref.where("partnerId", "==", partnerId).get();
    return snapshot.docs.map(doc => docToObject<Customer>(doc));
  }

  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    const id = nanoid();
    const newCustomer: Customer = {
      ...customer,
      company: customer.company || null,
      phone: customer.phone || null,
      category: customer.category || null,
      profileImage: customer.profileImage || null,
      notes: customer.notes || null,
      billingEmail: customer.billingEmail || null,
      billingAddress: customer.billingAddress || null,
      city: customer.city || null,
      state: customer.state || null,
      postcode: customer.postcode || null,
      paymentTerms: customer.paymentTerms || null,
      taxId: customer.taxId || null,
      teamMembers: customer.teamMembers || null,
      accountingIntegration: customer.accountingIntegration || null,
      accountingContactId: customer.accountingContactId || null,
      id,
      totalValue: "0",
      averageJobValue: "0",
      jobsCompleted: 0,
      createdAt: new Date()
    };
    await this.db.collection("customers").doc(id).set(prepareForFirestore(newCustomer));
    return newCustomer;
  }

  async updateCustomer(id: string, customer: Partial<Customer>): Promise<Customer | undefined> {
    await this.db.collection("customers").doc(id).update(prepareForFirestore(customer));
    return this.getCustomer(id);
  }

  // Products
  async getProduct(id: string): Promise<Product | undefined> {
    const docSnap = await this.db.collection("products").doc(id).get();
    return docSnap.exists ? docToObject<Product>(docSnap) : undefined;
  }

  async getProducts(partnerId: string): Promise<Product[]> {
    const ref = this.db.collection("products");
    const snapshot = await ref.where("partnerId", "==", partnerId).get();
    return snapshot.docs.map(doc => docToObject<Product>(doc));
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const id = nanoid();
    const newProduct: Product = {
      ...product,
      category: product.category || null,
      description: product.description || null,
      taxRate: product.taxRate || null,
      hasVariations: product.hasVariations || null,
      variants: product.variants || null,
      isActive: product.isActive || null,
      isLive: product.isLive || null,
      image: product.image || null,
      variations: product.variations || null,
      exclusiveCustomerIds: product.exclusiveCustomerIds || null,
      includedProducts: product.includedProducts || null,
      noCharge: product.noCharge ?? null,
      id,
      createdAt: new Date()
    };
    await this.db.collection("products").doc(id).set(prepareForFirestore(newProduct));
    return newProduct;
  }

  async updateProduct(id: string, product: Partial<Product>): Promise<Product | undefined> {
    await this.db.collection("products").doc(id).update(prepareForFirestore(product));
    return this.getProduct(id);
  }

  // Jobs
  async getJob(id: string): Promise<Job | undefined> {
    const docSnap = await this.db.collection("jobs").doc(id).get();
    return docSnap.exists ? docToObject<Job>(docSnap) : undefined;
  }

  async getJobByJobId(jobId: string): Promise<Job | undefined> {
    const snapshot = await this.db.collection("jobs").where("jobId", "==", jobId).get();
    return snapshot.empty ? undefined : docToObject<Job>(snapshot.docs[0]);
  }

  async getJobByDeliveryToken(token: string): Promise<Job | undefined> {
    const snapshot = await this.db.collection("jobs").where("deliveryToken", "==", token).get();
    return snapshot.empty ? undefined : docToObject<Job>(snapshot.docs[0]);
  }

  async generateDeliveryToken(jobId: string): Promise<string> {
    const token = nanoid(32);
    await this.db.collection("jobs").doc(jobId).update({ deliveryToken: token });
    return token;
  }

  async getJobs(partnerId: string): Promise<Job[]> {
    const ref = this.db.collection("jobs");
    const snapshot = await ref.where("partnerId", "==", partnerId).get();
    return snapshot.docs.map(doc => docToObject<Job>(doc));
  }

  async createJob(job: InsertJob): Promise<Job> {
    const id = nanoid();
    const jobId = job.jobId || nanoid(8);
    const newJob: Job = {
      ...job,
      customerId: job.customerId || null,
      status: job.status || null,
      assignedTo: job.assignedTo || null,
      totalValue: job.totalValue || null,
      propertyImage: job.propertyImage || null,
      propertyImageThumbnail: job.propertyImageThumbnail || null,
      notes: job.notes || null,
      id,
      jobId,
      createdAt: new Date(),
      dueDate: job.dueDate || null,
      appointmentDate: job.appointmentDate || null,
      deliveryToken: null
    };
    await this.db.collection("jobs").doc(id).set(prepareForFirestore(newJob));
    return newJob;
  }

  async updateJob(id: string, job: Partial<Job>): Promise<Job | undefined> {
    await this.db.collection("jobs").doc(id).update(prepareForFirestore(job));
    return this.getJob(id);
  }

  // Orders
  async getOrder(id: string): Promise<Order | undefined> {
    const docSnap = await this.db.collection("orders").doc(id).get();
    return docSnap.exists ? docToObject<Order>(docSnap) : undefined;
  }

  async getOrders(partnerId: string): Promise<Order[]> {
    const ref = this.db.collection("orders");
    const snapshot = await ref.where("partnerId", "==", partnerId).get();
    return snapshot.docs.map(doc => docToObject<Order>(doc));
  }

  async getOrdersForEditor(editorId: string): Promise<Order[]> {
    // Editor-specific: Filter by assignedTo field to only return orders assigned to this editor
    const ref = this.db.collection("orders");
    const snapshot = await ref.where("assignedTo", "==", editorId).get();
    return snapshot.docs.map(doc => docToObject<Order>(doc));
  }

  async createOrder(order: InsertOrder, reservedOrderNumber?: string): Promise<Order> {
    const id = nanoid();
    const orderNumber = reservedOrderNumber || await this.generateOrderNumber();
    
    // Calculate files expiry date (30 days from now)
    const filesExpiryDate = new Date();
    filesExpiryDate.setDate(filesExpiryDate.getDate() + 30);

    const newOrder: Order = {
      ...order,
      jobId: order.jobId || null,
      customerId: order.customerId || null,
      status: order.status || null,
      assignedTo: order.assignedTo || null,
      createdBy: order.createdBy || null,
      estimatedTotal: order.estimatedTotal || null,
      maxRevisionRounds: order.maxRevisionRounds || null,
      usedRevisionRounds: order.usedRevisionRounds || null,
      id,
      orderNumber,
      filesExpiryDate,
      createdAt: new Date(),
      dateAccepted: null
    };
    await this.db.collection("orders").doc(id).set(prepareForFirestore(newOrder));
    return newOrder;
  }

  async updateOrder(id: string, order: Partial<Order>): Promise<Order | undefined> {
    await this.db.collection("orders").doc(id).update(prepareForFirestore(order));
    return this.getOrder(id);
  }

  async generateOrderNumber(): Promise<string> {
    const counterRef = this.db.collection("counters").doc("orderCounter");
    const result = await this.db.runTransaction(async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      let nextNumber = 1;
      
      if (counterDoc.exists) {
        nextNumber = (counterDoc.data()?.value || 0) + 1;
        transaction.update(counterRef, { value: nextNumber });
      } else {
        transaction.set(counterRef, { value: 1 });
      }
      
      return String(nextNumber).padStart(5, '0');
    });
    
    return result;
  }

  // Order Reservations
  async reserveOrderNumber(userId: string, jobId: string): Promise<OrderReservation> {
    const orderNumber = await this.generateOrderNumber();
    const reservedAt = new Date();
    const expiresAt = new Date(reservedAt.getTime() + 15 * 60 * 1000); // 15 minutes

    const reservation: OrderReservation = {
      orderNumber,
      userId,
      jobId,
      reservedAt,
      expiresAt,
      status: 'reserved'
    };

    await this.db.collection("orderReservations").doc(orderNumber).set(prepareForFirestore(reservation));
    return reservation;
  }

  async confirmReservation(orderNumber: string): Promise<boolean> {
    const docSnap = await this.db.collection("orderReservations").doc(orderNumber).get();
    
    if (!docSnap.exists) return false;
    
    const reservation = docToObject<OrderReservation>(docSnap);
    if (reservation.status !== 'reserved' || new Date() > reservation.expiresAt) {
      return false;
    }

    await this.db.collection("orderReservations").doc(orderNumber).update({ status: 'confirmed' });
    return true;
  }

  async getReservation(orderNumber: string): Promise<OrderReservation | undefined> {
    const docSnap = await this.db.collection("orderReservations").doc(orderNumber).get();
    return docSnap.exists ? docToObject<OrderReservation>(docSnap) : undefined;
  }

  async cleanupExpiredReservations(): Promise<void> {
    const snapshot = await this.db.collection("orderReservations")
      .where("status", "==", "reserved")
      .get();
    
    const now = new Date();
    const batch = this.db.batch();
    
    snapshot.docs.forEach(doc => {
      const reservation = docToObject<OrderReservation>(doc);
      if (now > reservation.expiresAt) {
        batch.update(doc.ref, { status: 'expired' });
      }
    });
    
    await batch.commit();
  }

  // Order Services
  async getOrderServices(orderId: string, partnerId: string): Promise<OrderService[]> {
    // Get the order first to verify it belongs to this tenant
    const order = await this.getOrder(orderId);
    if (!order || order.partnerId !== partnerId) {
      return []; // Prevent cross-tenant data access
    }
    const snapshot = await this.db.collection("orderServices").where("orderId", "==", orderId).get();
    return snapshot.docs.map(doc => docToObject<OrderService>(doc));
  }

  async createOrderService(orderService: InsertOrderService): Promise<OrderService> {
    const id = nanoid();
    const newOrderService: OrderService = {
      ...orderService,
      quantity: orderService.quantity || null,
      instructions: orderService.instructions || null,
      exportTypes: orderService.exportTypes || null,
      id,
      createdAt: new Date()
    };
    await this.db.collection("orderServices").doc(id).set(prepareForFirestore(newOrderService));
    return newOrderService;
  }

  // Order Files
  async getOrderFiles(orderId: string, partnerId: string): Promise<OrderFile[]> {
    // Get the order first to verify it belongs to this tenant
    const order = await this.getOrder(orderId);
    if (!order || order.partnerId !== partnerId) {
      return []; // Prevent cross-tenant data access
    }
    const snapshot = await this.db.collection("orderFiles").where("orderId", "==", orderId).get();
    return snapshot.docs.map(doc => docToObject<OrderFile>(doc));
  }

  async createOrderFile(orderFile: InsertOrderFile): Promise<OrderFile> {
    const id = nanoid();
    const newOrderFile: OrderFile = {
      ...orderFile,
      serviceId: orderFile.serviceId || null,
      id,
      uploadedAt: new Date()
    };
    await this.db.collection("orderFiles").doc(id).set(prepareForFirestore(newOrderFile));
    return newOrderFile;
  }

  // Editor Job Management
  async getEditorJobs(editorId: string): Promise<any[]> {
    const snapshot = await this.db.collection("orders").where("assignedTo", "==", editorId).get();
    const orders = snapshot.docs.map(doc => docToObject<Order>(doc));
    
    // Get job details, services, customer info, and files for each order
    const jobPromises = orders.map(async (order) => {
      const job = order.jobId ? await this.getJobByJobId(order.jobId) : null;
      
      // Get partner's business name from partnerSettings
      let businessName = "Business Name Missing";
      if (order.partnerId) {
        try {
          const partnerSettings = await this.getPartnerSettings(order.partnerId);
          if (partnerSettings && partnerSettings.businessProfile) {
            try {
              const businessProfile = JSON.parse(partnerSettings.businessProfile);
              businessName = businessProfile.businessName || "Business Name Missing";
            } catch (parseError) {
              console.error("Error parsing business profile JSON:", parseError);
            }
          }
        } catch (error) {
          console.error("Error fetching partner settings:", error);
        }
      }
      
      // Get order services
      const servicesSnapshot = await this.db.collection("orderServices")
        .where("orderId", "==", order.id)
        .get();
      const services = servicesSnapshot.docs.map(doc => docToObject<OrderService>(doc));
      
      // Get original files uploaded to this order
      const filesSnapshot = await this.db.collection("orderFiles")
        .where("orderId", "==", order.id)
        .get();
      const originalFiles = filesSnapshot.docs.map(doc => docToObject<OrderFile>(doc));
      
      // Get existing uploads (deliverables) for this job
      const uploadsSnapshot = await this.db.collection("editorUploads")
        .where("jobId", "==", order.jobId || "")
        .get();
      const existingUploads = uploadsSnapshot.docs.map(doc => docToObject<EditorUpload>(doc));
      
      return {
        id: order.id,
        jobId: order.jobId || "",
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: businessName, // Now shows partner's business name
        address: job?.address || "Unknown Address",
        services: services || [],
        status: order.status,
        dueDate: order.createdAt ? new Date(new Date(order.createdAt).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : "",
        createdAt: order.createdAt,
        originalFiles: originalFiles || [],
        existingUploads: existingUploads || [],
        jobAddress: job?.address || "Unknown Address",
        partnerId: order.partnerId // Include partnerId for security checks
      };
    });

    return Promise.all(jobPromises);
  }

  async updateOrderStatus(orderId: string, status: string, editorId: string): Promise<Order | undefined> {
    const order = await this.getOrder(orderId);
    if (!order || order.assignedTo !== editorId) {
      throw new Error("Order not found or access denied");
    }

    const updates: Partial<Order> = { status };
    if (status === "processing") {
      updates.dateAccepted = new Date();
    }

    return this.updateOrder(orderId, updates);
  }

  // Service Categories
  async getServiceCategories(editorId: string): Promise<ServiceCategory[]> {
    const snapshot = await this.db.collection("serviceCategories").where("editorId", "==", editorId).get();
    return snapshot.docs.map(doc => docToObject<ServiceCategory>(doc));
  }

  async createServiceCategory(category: InsertServiceCategory): Promise<ServiceCategory> {
    const id = nanoid();
    const newCategory: ServiceCategory = {
      ...category,
      description: category.description || null,
      isActive: category.isActive !== undefined ? category.isActive : true,
      displayOrder: category.displayOrder !== undefined ? category.displayOrder : 0,
      id,
      createdAt: new Date()
    };
    await this.db.collection("serviceCategories").doc(id).set(prepareForFirestore(newCategory));
    return newCategory;
  }

  async updateServiceCategory(id: string, updates: Partial<ServiceCategory>, editorId: string): Promise<ServiceCategory | undefined> {
    const categories = await this.getServiceCategories(editorId);
    if (!categories.find(c => c.id === id)) {
      throw new Error("Category not found or access denied");
    }
    
    await this.db.collection("serviceCategories").doc(id).update(prepareForFirestore(updates));
    const docSnap = await this.db.collection("serviceCategories").doc(id).get();
    return docSnap.exists ? docToObject<ServiceCategory>(docSnap) : undefined;
  }

  async deleteServiceCategory(id: string, editorId: string): Promise<void> {
    const categories = await this.getServiceCategories(editorId);
    if (!categories.find(c => c.id === id)) {
      throw new Error("Category not found or access denied");
    }
    
    await this.db.collection("serviceCategories").doc(id).delete();
  }

  // Editor Services
  async getEditorServices(editorId: string): Promise<EditorService[]> {
    const snapshot = await this.db.collection("editorServices").where("editorId", "==", editorId).get();
    return snapshot.docs.map(doc => docToObject<EditorService>(doc));
  }

  async createEditorService(service: InsertEditorService): Promise<EditorService> {
    const id = nanoid();
    const newService: EditorService = {
      ...service,
      description: service.description || null,
      categoryId: service.categoryId || null,
      pricePer: service.pricePer || null,
      estimatedTurnaround: service.estimatedTurnaround || null,
      isActive: service.isActive !== undefined ? service.isActive : true,
      displayOrder: service.displayOrder !== undefined ? service.displayOrder : 0,
      id,
      createdAt: new Date()
    };
    await this.db.collection("editorServices").doc(id).set(prepareForFirestore(newService));
    return newService;
  }

  async updateEditorService(id: string, updates: Partial<EditorService>, editorId: string): Promise<EditorService | undefined> {
    const services = await this.getEditorServices(editorId);
    if (!services.find(s => s.id === id)) {
      throw new Error("Service not found or access denied");
    }
    
    await this.db.collection("editorServices").doc(id).update(prepareForFirestore(updates));
    const docSnap = await this.db.collection("editorServices").doc(id).get();
    return docSnap.exists ? docToObject<EditorService>(docSnap) : undefined;
  }

  async deleteEditorService(id: string, editorId: string): Promise<void> {
    const services = await this.getEditorServices(editorId);
    if (!services.find(s => s.id === id)) {
      throw new Error("Service not found or access denied");
    }
    
    await this.db.collection("editorServices").doc(id).delete();
  }

  // Customer Profile
  async getCustomerJobs(customerId: string, partnerId: string): Promise<Job[]> {
    // Filter by both customerId AND partnerId for tenant isolation
    const snapshot = await this.db.collection("jobs")
      .where("customerId", "==", customerId)
      .where("partnerId", "==", partnerId)
      .get();
    return snapshot.docs.map(doc => docToObject<Job>(doc));
  }

  // Editor Uploads
  async getJobsReadyForUpload(editorId: string): Promise<any[]> {
    const orders = await this.getEditorJobs(editorId);
    return orders.filter((order: any) => 
      order.status === "pending" || order.status === "processing" || order.status === "uploaded"
    );
  }

  async getEditorUploads(jobId: string): Promise<EditorUpload[]> {
    const snapshot = await this.db.collection("editorUploads").where("jobId", "==", jobId).get();
    return snapshot.docs.map(doc => docToObject<EditorUpload>(doc));
  }

  async createEditorUpload(editorUpload: InsertEditorUpload): Promise<EditorUpload> {
    const id = nanoid();
    const newUpload: EditorUpload = {
      ...editorUpload,
      orderId: editorUpload.orderId || null,
      folderPath: editorUpload.folderPath || null,
      editorFolderName: editorUpload.editorFolderName || null,
      partnerFolderName: editorUpload.partnerFolderName || null,
      folderToken: editorUpload.folderToken || null,
      status: editorUpload.status || null,
      notes: editorUpload.notes || null,
      id,
      uploadedAt: new Date()
    };
    await this.db.collection("editorUploads").doc(id).set(prepareForFirestore(newUpload));
    return newUpload;
  }

  async getAllEditorUploads(): Promise<EditorUpload[]> {
    const snapshot = await this.db.collection("editorUploads").get();
    return snapshot.docs.map(doc => docToObject<EditorUpload>(doc));
  }

  async updateEditorUpload(id: string, data: Partial<EditorUpload>): Promise<void> {
    await this.db.collection("editorUploads").doc(id).update(prepareForFirestore(data));
  }

  async updateJobStatusAfterUpload(jobId: string, status: string): Promise<Job | undefined> {
    return this.updateJob(jobId, { status });
  }

  // Folder Management
  async getUploadFolders(jobId: string): Promise<{folderPath: string; editorFolderName: string; partnerFolderName?: string; orderNumber?: string; fileCount: number; files: any[]}[]> {
    const snapshot = await this.db.collection("editorUploads").where("jobId", "==", jobId).get();
    const uploads = snapshot.docs.map(doc => docToObject<EditorUpload>(doc));

    const folderMap = new Map<string, any>();
    
    uploads.forEach(upload => {
      if (!upload.folderPath) return;
      
      if (!folderMap.has(upload.folderPath)) {
        folderMap.set(upload.folderPath, {
          folderPath: upload.folderPath,
          editorFolderName: upload.editorFolderName || "",
          partnerFolderName: upload.partnerFolderName,
          orderNumber: undefined, // EditorUploads don't have orderNumber - would need to lookup from orderId
          fileCount: 0,
          files: []
        });
      }
      
      const folder = folderMap.get(upload.folderPath);
      folder.fileCount++;
      folder.files.push(upload);
    });

    return Array.from(folderMap.values());
  }

  async createFolder(jobId: string, partnerFolderName: string, parentFolderPath?: string): Promise<{folderPath: string; partnerFolderName: string}> {
    const folderToken = nanoid(16);
    const folderPath = parentFolderPath 
      ? `${parentFolderPath}/${folderToken}`
      : `completed/${jobId}/folders/${folderToken}`;

    const folderId = nanoid();
    await this.db.collection("folders").doc(folderId).set({
      jobId,
      folderPath,
      partnerFolderName,
      folderToken,
      createdAt: Timestamp.now()
    });

    return { folderPath, partnerFolderName };
  }

  async updateFolderName(jobId: string, folderPath: string, newPartnerFolderName: string): Promise<void> {
    const snapshot = await this.db.collection("folders")
      .where("jobId", "==", jobId)
      .where("folderPath", "==", folderPath)
      .get();
    
    if (!snapshot.empty) {
      await snapshot.docs[0].ref.update({ partnerFolderName: newPartnerFolderName });
    }

    // Also update all uploads in this folder
    const uploadsSnapshot = await this.db.collection("editorUploads")
      .where("jobId", "==", jobId)
      .where("folderPath", "==", folderPath)
      .get();
    
    const batch = this.db.batch();
    uploadsSnapshot.docs.forEach(doc => {
      batch.update(doc.ref, { partnerFolderName: newPartnerFolderName });
    });
    await batch.commit();
  }

  // Team Assignment System
  async getPendingOrders(partnerId: string): Promise<Order[]> {
    const snapshot = await this.db.collection("orders")
      .where("partnerId", "==", partnerId)
      .where("status", "==", "pending")
      .get();
    return snapshot.docs.map(doc => docToObject<Order>(doc));
  }

  async assignOrderToEditor(orderId: string, editorId: string): Promise<Order | undefined> {
    return this.updateOrder(orderId, { assignedTo: editorId });
  }

  // Notifications
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const id = nanoid();
    const newNotification: Notification = {
      ...notification,
      jobId: notification.jobId || null,
      orderId: notification.orderId || null,
      read: notification.read !== undefined ? notification.read : false,
      id,
      createdAt: new Date(),
      readAt: null
    };
    await this.db.collection("notifications").doc(id).set(prepareForFirestore(newNotification));
    return newNotification;
  }

  async createNotifications(notifications: InsertNotification[]): Promise<Notification[]> {
    const batch = this.db.batch();
    const newNotifications: Notification[] = [];

    notifications.forEach(notification => {
      const id = nanoid();
      const newNotification: Notification = {
        ...notification,
        jobId: notification.jobId || null,
        orderId: notification.orderId || null,
        read: notification.read !== undefined ? notification.read : false,
        id,
        createdAt: new Date(),
        readAt: null
      };
      batch.set(this.db.collection("notifications").doc(id), prepareForFirestore(newNotification));
      newNotifications.push(newNotification);
    });

    await batch.commit();
    return newNotifications;
  }

  async getNotifications(): Promise<Notification[]> {
    const snapshot = await this.db.collection("notifications").get();
    return snapshot.docs.map(doc => docToObject<Notification>(doc));
  }

  async getNotificationsForUser(recipientId: string, partnerId: string): Promise<Notification[]> {
    const snapshot = await this.db.collection("notifications")
      .where("recipientId", "==", recipientId)
      .orderBy("createdAt", "desc")
      .get();
    return snapshot.docs.map(doc => docToObject<Notification>(doc));
  }

  async markNotificationRead(id: string, recipientId: string): Promise<Notification | undefined> {
    const docSnap = await this.db.collection("notifications").doc(id).get();
    
    if (!docSnap.exists) return undefined;
    
    const notification = docToObject<Notification>(docSnap);
    if (notification.recipientId !== recipientId) {
      throw new Error("Access denied");
    }

    await this.db.collection("notifications").doc(id).update({ 
      read: true,
      readAt: Timestamp.now() 
    });
    return this.getNotifications().then(notifications => notifications.find(n => n.id === id));
  }

  async markAllNotificationsRead(recipientId: string, partnerId: string): Promise<void> {
    const snapshot = await this.db.collection("notifications")
      .where("recipientId", "==", recipientId)
      .where("read", "==", false)
      .get();
    
    const batch = this.db.batch();
    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, { 
        read: true,
        readAt: Timestamp.now() 
      });
    });
    
    await batch.commit();
  }

  async deleteNotification(id: string, recipientId: string): Promise<void> {
    const docSnap = await this.db.collection("notifications").doc(id).get();
    if (!docSnap.exists) return;
    
    const notification = docToObject<Notification>(docSnap);
    if (notification.recipientId !== recipientId) {
      throw new Error("Access denied");
    }

    await this.db.collection("notifications").doc(id).delete();
  }

  // Activity Tracking (Audit Log)
  async createActivity(activity: InsertActivity): Promise<Activity> {
    const id = nanoid();
    const newActivity: Activity = {
      ...activity,
      jobId: activity.jobId || null,
      customerId: activity.customerId || null,
      orderId: activity.orderId || null,
      description: activity.description || null,
      metadata: activity.metadata || null,
      ipAddress: activity.ipAddress || null,
      userAgent: activity.userAgent || null,
      id,
      createdAt: new Date()
    };
    await this.db.collection("activities").doc(id).set(prepareForFirestore(newActivity));
    return newActivity;
  }

  async createActivities(activities: InsertActivity[]): Promise<Activity[]> {
    const batch = this.db.batch();
    const newActivities: Activity[] = [];

    activities.forEach(activity => {
      const id = nanoid();
      const newActivity: Activity = {
        ...activity,
        jobId: activity.jobId || null,
        customerId: activity.customerId || null,
        orderId: activity.orderId || null,
        description: activity.description || null,
        metadata: activity.metadata || null,
        ipAddress: activity.ipAddress || null,
        userAgent: activity.userAgent || null,
        id,
        createdAt: new Date()
      };
      batch.set(this.db.collection("activities").doc(id), prepareForFirestore(newActivity));
      newActivities.push(newActivity);
    });

    await batch.commit();
    return newActivities;
  }

  async getActivities(filters?: any): Promise<Activity[]> {
    try {
      let ref: FirebaseFirestore.Query = this.db.collection("activities");

      if (filters?.partnerId) {
        ref = ref.where("partnerId", "==", filters.partnerId);
      }
      if (filters?.jobId) {
        ref = ref.where("jobId", "==", filters.jobId);
      }
      if (filters?.orderId) {
        ref = ref.where("orderId", "==", filters.orderId);
      }
      if (filters?.userId) {
        ref = ref.where("userId", "==", filters.userId);
      }
      
      ref = ref.orderBy("createdAt", "desc");
      
      if (filters?.limit) {
        ref = ref.limit(filters.limit);
      }

      const snapshot = await ref.get();
      return snapshot.docs.map(doc => docToObject<Activity>(doc));
    } catch (error: any) {
      // If Firestore index is missing, return empty array gracefully
      if (error.code === 9 || error.message?.includes('index')) {
        console.log('[INFO] Firestore index not available for activities query, returning empty results');
        return [];
      }
      throw error;
    }
  }

  async getJobActivities(jobId: string, partnerId: string): Promise<Activity[]> {
    return this.getActivities({ jobId, partnerId });
  }

  async getOrderActivities(orderId: string, partnerId: string): Promise<Activity[]> {
    return this.getActivities({ orderId, partnerId });
  }

  async getUserActivities(userId: string, partnerId: string, limit?: number): Promise<Activity[]> {
    return this.getActivities({ userId, partnerId, limit });
  }

  async getActivityCountByType(partnerId: string, timeRange?: { start: Date; end: Date }): Promise<{ [key: string]: number }> {
    const activities = await this.getActivities({ partnerId });
    const filtered = timeRange 
      ? activities.filter(a => a.createdAt && a.createdAt >= timeRange.start && a.createdAt <= timeRange.end)
      : activities;

    const counts: { [key: string]: number } = {};
    filtered.forEach(activity => {
      counts[activity.action] = (counts[activity.action] || 0) + 1;
    });

    return counts;
  }

  // Job Connection Validation System
  async validateJobIntegrity(jobId: string): Promise<{ isValid: boolean; issues: string[]; connections: any }> {
    const job = await this.getJob(jobId);
    const issues: string[] = [];
    
    if (!job) {
      return { isValid: false, issues: ["Job not found"], connections: {} };
    }

    const ordersSnapshot = await this.db.collection("orders").where("jobId", "==", jobId).get();
    const uploadsSnapshot = await this.db.collection("editorUploads").where("jobId", "==", jobId).get();

    return {
      isValid: issues.length === 0,
      issues,
      connections: {
        ordersCount: ordersSnapshot.size,
        uploadsCount: uploadsSnapshot.size
      }
    };
  }

  async validateOrderIntegrity(orderId: string): Promise<{ isValid: boolean; issues: string[]; connections: any }> {
    const order = await this.getOrder(orderId);
    const issues: string[] = [];
    
    if (!order) {
      return { isValid: false, issues: ["Order not found"], connections: {} };
    }

    if (order.jobId) {
      const job = await this.getJob(order.jobId);
      if (!job) {
        issues.push("Referenced job not found");
      }
    }

    // Use order's partnerId for tenant-scoped queries
    const services = await this.getOrderServices(orderId, order.partnerId);
    const files = await this.getOrderFiles(orderId, order.partnerId);

    return {
      isValid: issues.length === 0,
      issues,
      connections: {
        servicesCount: services.length,
        filesCount: files.length
      }
    };
  }

  async validateEditorWorkflowAccess(editorId: string, jobId: string): Promise<{ canAccess: boolean; reason: string; orderInfo?: any }> {
    const ordersSnapshot = await this.db.collection("orders")
      .where("jobId", "==", jobId)
      .where("editorId", "==", editorId)
      .get();

    if (ordersSnapshot.empty) {
      return { canAccess: false, reason: "No order assigned to this editor for this job" };
    }

    const order = docToObject<Order>(ordersSnapshot.docs[0]);
    return { 
      canAccess: true, 
      reason: "Editor has access", 
      orderInfo: { orderNumber: order.orderNumber, status: order.status }
    };
  }

  async performHealthCheck(partnerId?: string): Promise<{ isHealthy: boolean; issues: string[]; statistics: any; orphanedRecords: any }> {
    const issues: string[] = [];
    const orphanedRecords: any = {};

    const ref = this.db.collection("orders");
    const ordersSnapshot = partnerId 
      ? await ref.where("partnerId", "==", partnerId).get()
      : await ref.get();
    
    let orphanedOrders = 0;
    for (const orderDoc of ordersSnapshot.docs) {
      const order = docToObject<Order>(orderDoc);
      if (order.jobId) {
        const job = await this.getJob(order.jobId);
        if (!job) {
          orphanedOrders++;
        }
      }
    }

    if (orphanedOrders > 0) {
      issues.push(`Found ${orphanedOrders} orphaned orders`);
      orphanedRecords.orders = orphanedOrders;
    }

    return {
      isHealthy: issues.length === 0,
      issues,
      statistics: {
        totalOrders: ordersSnapshot.size
      },
      orphanedRecords
    };
  }

  async repairOrphanedOrder(orderId: string, correctJobId: string): Promise<{ success: boolean; message: string }> {
    const job = await this.getJob(correctJobId);
    if (!job) {
      return { success: false, message: "Target job not found" };
    }

    await this.updateOrder(orderId, { jobId: correctJobId });
    return { success: true, message: "Order repaired successfully" };
  }

  async validateJobCreation(insertJob: InsertJob): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    if (!insertJob.partnerId) errors.push("partnerId is required");
    if (!insertJob.address) errors.push("address is required");

    if (insertJob.customerId) {
      const customer = await this.getCustomer(insertJob.customerId);
      if (!customer) errors.push("Customer not found");
    }

    return { valid: errors.length === 0, errors };
  }

  async validateOrderCreation(insertOrder: InsertOrder): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    if (!insertOrder.partnerId) errors.push("partnerId is required");
    
    if (insertOrder.jobId) {
      const job = await this.getJob(insertOrder.jobId);
      if (!job) errors.push("Job not found");
    }

    return { valid: errors.length === 0, errors };
  }

  async validateEditorUpload(insertUpload: InsertEditorUpload): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    if (!insertUpload.jobId) errors.push("jobId is required");
    if (!insertUpload.editorId) errors.push("editorId is required");

    if (insertUpload.jobId) {
      const job = await this.getJob(insertUpload.jobId);
      if (!job) errors.push("Job not found");
    }

    return { valid: errors.length === 0, errors };
  }

  // Editing Options (master list for partners)
  async getEditingOptions(partnerId: string): Promise<EditingOption[]> {
    const snapshot = await this.db.collection("editingOptions").where("partnerId", "==", partnerId).get();
    return snapshot.docs.map(doc => docToObject<EditingOption>(doc));
  }

  async createEditingOption(option: InsertEditingOption): Promise<EditingOption> {
    const id = nanoid();
    const newOption: EditingOption = {
      ...option,
      description: option.description || null,
      icon: option.icon || null,
      iconColor: option.iconColor || null,
      isActive: option.isActive !== undefined ? option.isActive : true,
      displayOrder: option.displayOrder !== undefined ? option.displayOrder : 0,
      id,
      createdAt: new Date()
    };
    await this.db.collection("editingOptions").doc(id).set(prepareForFirestore(newOption));
    return newOption;
  }

  async updateEditingOption(id: string, option: Partial<EditingOption>, partnerId: string): Promise<EditingOption | undefined> {
    const options = await this.getEditingOptions(partnerId);
    if (!options.find(o => o.id === id)) {
      throw new Error("Option not found or access denied");
    }
    
    await this.db.collection("editingOptions").doc(id).update(prepareForFirestore(option));
    const docSnap = await this.db.collection("editingOptions").doc(id).get();
    return docSnap.exists ? docToObject<EditingOption>(docSnap) : undefined;
  }

  async deleteEditingOption(id: string, partnerId: string): Promise<void> {
    const options = await this.getEditingOptions(partnerId);
    if (!options.find(o => o.id === id)) {
      throw new Error("Option not found or access denied");
    }
    
    await this.db.collection("editingOptions").doc(id).delete();
  }

  // Customer Editing Preferences
  async getCustomerEditingPreferences(customerId: string): Promise<CustomerEditingPreference[]> {
    const snapshot = await this.db.collection("customerEditingPreferences").where("customerId", "==", customerId).get();
    return snapshot.docs.map(doc => docToObject<CustomerEditingPreference>(doc));
  }

  async setCustomerEditingPreference(preference: InsertCustomerEditingPreference): Promise<CustomerEditingPreference> {
    const id = nanoid();
    const now = new Date();
    const newPreference: CustomerEditingPreference = {
      ...preference,
      isEnabled: preference.isEnabled !== undefined ? preference.isEnabled : true,
      notes: preference.notes || null,
      id,
      createdAt: now,
      updatedAt: now
    };
    await this.db.collection("customerEditingPreferences").doc(id).set(prepareForFirestore(newPreference));
    return newPreference;
  }

  async updateCustomerEditingPreference(id: string, updates: Partial<CustomerEditingPreference>): Promise<CustomerEditingPreference | undefined> {
    await this.db.collection("customerEditingPreferences").doc(id).update(prepareForFirestore(updates));
    const docSnap = await this.db.collection("customerEditingPreferences").doc(id).get();
    return docSnap.exists ? docToObject<CustomerEditingPreference>(docSnap) : undefined;
  }

  async deleteCustomerEditingPreference(id: string): Promise<void> {
    await this.db.collection("customerEditingPreferences").doc(id).delete();
  }

  async saveCustomerPreferences(customerId: string, preferences: { editingOptionId: string; isEnabled: boolean; notes?: string }[]): Promise<void> {
    const existing = await this.getCustomerEditingPreferences(customerId);
    const batch = this.db.batch();
    const now = Timestamp.now();
    
    for (const pref of preferences) {
      const existingPref = existing.find(p => p.editingOptionId === pref.editingOptionId);
      
      if (existingPref) {
        batch.update(this.db.collection("customerEditingPreferences").doc(existingPref.id), prepareForFirestore({ ...pref, updatedAt: now.toDate() }));
      } else {
        const id = nanoid();
        batch.set(this.db.collection("customerEditingPreferences").doc(id), prepareForFirestore({ 
          ...pref, 
          customerId, 
          id, 
          notes: pref.notes || null,
          createdAt: now.toDate(),
          updatedAt: now.toDate()
        }));
      }
    }
    
    await batch.commit();
  }

  // Partner Settings
  async getPartnerSettings(partnerId: string): Promise<PartnerSettings | undefined> {
    const snapshot = await this.db.collection("partnerSettings").where("partnerId", "==", partnerId).get();
    return snapshot.empty ? undefined : docToObject<PartnerSettings>(snapshot.docs[0]);
  }

  async savePartnerSettings(partnerId: string, settings: InsertPartnerSettings): Promise<PartnerSettings> {
    const existing = await this.getPartnerSettings(partnerId);
    const now = new Date();
    
    if (existing) {
      await this.db.collection("partnerSettings").doc(existing.id).update(prepareForFirestore({ ...settings, updatedAt: now }));
      const docSnap = await this.db.collection("partnerSettings").doc(existing.id).get();
      return docToObject<PartnerSettings>(docSnap);
    } else {
      const id = nanoid();
      const newSettings: PartnerSettings = {
        ...settings,
        businessProfile: settings.businessProfile || null,
        personalProfile: settings.personalProfile || null,
        businessHours: settings.businessHours || null,
        defaultMaxRevisionRounds: settings.defaultMaxRevisionRounds !== undefined ? settings.defaultMaxRevisionRounds : 2,
        id,
        partnerId,
        createdAt: now,
        updatedAt: now
      };
      await this.db.collection("partnerSettings").doc(id).set(prepareForFirestore(newSettings));
      return newSettings;
    }
  }

  // File Comments
  async getFileComments(fileId: string): Promise<FileComment[]> {
    const snapshot = await this.db.collection("fileComments").where("fileId", "==", fileId).get();
    return snapshot.docs.map(doc => docToObject<FileComment>(doc));
  }

  async getJobFileComments(jobId: string): Promise<FileComment[]> {
    const snapshot = await this.db.collection("fileComments").where("jobId", "==", jobId).get();
    return snapshot.docs.map(doc => docToObject<FileComment>(doc));
  }

  async createFileComment(comment: InsertFileComment): Promise<FileComment> {
    const id = nanoid();
    const now = new Date();
    const newComment: FileComment = {
      ...comment,
      orderId: comment.orderId || null,
      status: comment.status || null,
      id,
      createdAt: now,
      updatedAt: now
    };
    await this.db.collection("fileComments").doc(id).set(prepareForFirestore(newComment));
    return newComment;
  }

  async updateFileCommentStatus(id: string, status: string): Promise<FileComment | undefined> {
    await this.db.collection("fileComments").doc(id).update({ status });
    const docSnap = await this.db.collection("fileComments").doc(id).get();
    return docSnap.exists ? docToObject<FileComment>(docSnap) : undefined;
  }

  // Job Reviews
  async getJobReview(jobId: string): Promise<JobReview | undefined> {
    const snapshot = await this.db.collection("jobReviews").where("jobId", "==", jobId).get();
    return snapshot.empty ? undefined : docToObject<JobReview>(snapshot.docs[0]);
  }

  async createJobReview(review: InsertJobReview): Promise<JobReview> {
    const id = nanoid();
    const newReview: JobReview = {
      ...review,
      review: review.review || null,
      submittedBy: review.submittedBy || null,
      submittedByEmail: review.submittedByEmail || null,
      id,
      createdAt: new Date()
    };
    await this.db.collection("jobReviews").doc(id).set(prepareForFirestore(newReview));
    return newReview;
  }

  // Delivery Emails
  async getDeliveryEmails(jobId: string): Promise<DeliveryEmail[]> {
    const snapshot = await this.db.collection("deliveryEmails").where("jobId", "==", jobId).get();
    return snapshot.docs.map(doc => docToObject<DeliveryEmail>(doc));
  }

  async createDeliveryEmail(email: InsertDeliveryEmail): Promise<DeliveryEmail> {
    const id = nanoid();
    const newEmail: DeliveryEmail = {
      ...email,
      id,
      sentAt: new Date()
    };
    await this.db.collection("deliveryEmails").doc(id).set(prepareForFirestore(newEmail));
    return newEmail;
  }

  // Revision Management
  async incrementRevisionRound(orderId: string): Promise<Order | undefined> {
    const order = await this.getOrder(orderId);
    if (!order) return undefined;

    const usedRounds = order.usedRevisionRounds || 0;
    const maxRounds = order.maxRevisionRounds || 2;

    if (usedRounds >= maxRounds) {
      throw new Error("Maximum revision rounds reached");
    }

    return this.updateOrder(orderId, { usedRevisionRounds: usedRounds + 1 });
  }

  async getOrderRevisionStatus(orderId: string): Promise<{ maxRounds: number; usedRounds: number; remainingRounds: number } | undefined> {
    const order = await this.getOrder(orderId);
    if (!order) return undefined;

    const maxRounds = order.maxRevisionRounds || 2;
    const usedRounds = order.usedRevisionRounds || 0;
    const remainingRounds = maxRounds - usedRounds;

    return { maxRounds, usedRounds, remainingRounds };
  }

  // Messaging
  async getUserConversations(userId: string, partnerId: string): Promise<Conversation[]> {
    const [snap1, snap2] = await Promise.all([
      this.db.collection("conversations").where("partnerId", "==", partnerId).get(),
      this.db.collection("conversations").where("editorId", "==", userId).get()
    ]);
    
    const conversations = new Map<string, Conversation>();
    
    snap1.docs.forEach(doc => {
      const conv = docToObject<Conversation>(doc);
      conversations.set(conv.id, conv);
    });
    
    snap2.docs.forEach(doc => {
      const conv = docToObject<Conversation>(doc);
      conversations.set(conv.id, conv);
    });

    return Array.from(conversations.values()).sort((a, b) => {
      const aTime = a.lastMessageAt?.getTime() || 0;
      const bTime = b.lastMessageAt?.getTime() || 0;
      return bTime - aTime;
    });
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    const docSnap = await this.db.collection("conversations").doc(id).get();
    return docSnap.exists ? docToObject<Conversation>(docSnap) : undefined;
  }

  async getConversationByParticipants(partnerId: string, editorId: string, orderId?: string): Promise<Conversation | undefined> {
    let ref: FirebaseFirestore.Query = this.db.collection("conversations")
      .where("partnerId", "==", partnerId)
      .where("editorId", "==", editorId);

    if (orderId) {
      ref = ref.where("orderId", "==", orderId);
    } else {
      ref = ref.where("orderId", "==", null);
    }

    const snapshot = await ref.get();
    return snapshot.empty ? undefined : docToObject<Conversation>(snapshot.docs[0]);
  }

  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    const id = nanoid();
    const newConversation: Conversation = {
      ...conversation,
      orderId: conversation.orderId || null,
      id,
      lastMessageAt: new Date(),
      lastMessageText: null,
      partnerUnreadCount: 0,
      editorUnreadCount: 0,
      createdAt: new Date()
    };
    await this.db.collection("conversations").doc(id).set(prepareForFirestore(newConversation));
    return newConversation;
  }

  async updateConversationLastMessage(conversationId: string, lastMessageText: string, isPartnerSender: boolean): Promise<void> {
    const updates: any = {
      lastMessageAt: Timestamp.now(),
      lastMessageText
    };

    if (isPartnerSender) {
      updates.editorUnreadCount = FieldValue.increment(1);
    } else {
      updates.partnerUnreadCount = FieldValue.increment(1);
    }

    await this.db.collection("conversations").doc(conversationId).update(updates);
  }

  async markConversationAsRead(conversationId: string, isPartnerReading: boolean): Promise<void> {
    const field = isPartnerReading ? "partnerUnreadCount" : "editorUnreadCount";
    await this.db.collection("conversations").doc(conversationId).update({ [field]: 0 });
  }

  async getConversationMessages(conversationId: string): Promise<Message[]> {
    const snapshot = await this.db.collection("messages")
      .where("conversationId", "==", conversationId)
      .orderBy("createdAt", "asc")
      .get();
    return snapshot.docs.map(doc => docToObject<Message>(doc));
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const id = nanoid();
    const newMessage: Message = {
      ...message,
      id,
      readAt: null,
      createdAt: new Date()
    };
    await this.db.collection("messages").doc(id).set(prepareForFirestore(newMessage));
    return newMessage;
  }
}

export const firestoreStorage = new FirestoreStorage();
