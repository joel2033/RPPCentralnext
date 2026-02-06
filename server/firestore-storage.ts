import {
  type User,
  type InsertUser,
  type Customer,
  type InsertCustomer,
  type Product,
  type InsertProduct,
  type Job,
  type InsertJob,
  type Appointment,
  type InsertAppointment,
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
  type InsertMessage,
  type ServiceArea,
  type InsertServiceArea
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

  private getFolderVisibilityKey(jobId: string, options: { uniqueKey?: string | null; folderToken?: string | null; orderId?: string | null; folderPath?: string | null }) {
    if (options.uniqueKey) {
      return options.uniqueKey;
    }
    if (options.folderToken) {
      return `${jobId}::token::${options.folderToken}`;
    }
    if (options.orderId && options.folderPath) {
      return `${jobId}::order::${options.orderId}::${options.folderPath}`;
    }
    if (options.folderPath) {
      return `${jobId}::path::${options.folderPath}`;
    }
    return `${jobId}::legacy`;
  }

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

  async updateUser(id: string, data: Partial<User>): Promise<void> {
    await this.db.collection("users").doc(id).update(prepareForFirestore(data));
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
      availableAddons: product.availableAddons || null,
      noCharge: product.noCharge ?? null,
      productType: product.productType || null,
      exclusivityType: product.exclusivityType || null,
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
    // First get the job to find the document ID (jobId might be NanoID, not document ID)
    const job = await this.getJobByJobId(jobId);
    if (!job) {
      throw new Error('Job not found');
    }
    
    // If token already exists, return it
    if (job.deliveryToken) {
      return job.deliveryToken;
    }
    
    // Generate a new unguessable token
    const token = nanoid(32);
    
    // Update using the document ID (job.id), not the NanoID (job.jobId)
    await this.db.collection("jobs").doc(job.id).update({ deliveryToken: token });
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
      billingItems: job.billingItems || null,
      invoiceStatus: job.invoiceStatus || "draft",
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

  // Appointments
  async getAppointments(jobId: string, partnerId: string): Promise<Appointment[]> {
    try {
      console.log(`[FirestoreStorage] getAppointments called with jobId: ${jobId}, partnerId: ${partnerId}`);
      
      // Try without orderBy first to avoid index requirement
      const snapshot = await this.db.collection("appointments")
        .where("jobId", "==", jobId)
        .where("partnerId", "==", partnerId)
        .get();
      
      console.log(`[FirestoreStorage] Found ${snapshot.docs.length} appointment documents`);
      
      const appointments = snapshot.docs.map(doc => {
        try {
          const appointment = docToObject<Appointment>(doc);
          // Log products field for debugging
          console.log(`[FirestoreStorage] Appointment ${doc.id} products:`, {
            hasProducts: !!appointment.products,
            productsType: typeof appointment.products,
            productsValue: appointment.products ? (typeof appointment.products === 'string' ? appointment.products.substring(0, 100) : 'not a string') : 'null/undefined'
          });
          return appointment;
        } catch (docError: any) {
          console.error(`[FirestoreStorage] Error converting document ${doc.id}:`, docError);
          throw docError;
        }
      });
      
      // Sort in memory by appointmentDate
      const sorted = appointments.sort((a, b) => {
        try {
          const dateA = a.appointmentDate instanceof Date 
            ? a.appointmentDate 
            : (a.appointmentDate?.toDate ? a.appointmentDate.toDate() : new Date(a.appointmentDate));
          const dateB = b.appointmentDate instanceof Date 
            ? b.appointmentDate 
            : (b.appointmentDate?.toDate ? b.appointmentDate.toDate() : new Date(b.appointmentDate));
          return dateA.getTime() - dateB.getTime();
        } catch (sortError) {
          console.error('[FirestoreStorage] Error sorting appointments:', sortError);
          return 0;
        }
      });
      
      console.log(`[FirestoreStorage] Returning ${sorted.length} sorted appointments`);
      return sorted;
    } catch (error: any) {
      console.error(`[FirestoreStorage] Error in getAppointments:`, error);
      console.error(`[FirestoreStorage] Error code: ${error.code}, message: ${error.message}`);
      console.error(`[FirestoreStorage] Error stack:`, error.stack);
      throw error;
    }
  }

  async getAppointment(id: string): Promise<Appointment | undefined> {
    const docSnap = await this.db.collection("appointments").doc(id).get();
    return docSnap.exists ? docToObject<Appointment>(docSnap) : undefined;
  }

  async getAppointmentByAppointmentId(appointmentId: string): Promise<Appointment | undefined> {
    const snapshot = await this.db.collection("appointments")
      .where("appointmentId", "==", appointmentId)
      .limit(1)
      .get();
    return snapshot.empty ? undefined : docToObject<Appointment>(snapshot.docs[0]);
  }

  async createAppointment(insertAppointment: InsertAppointment): Promise<Appointment> {
    const id = nanoid();
    const appointmentId = nanoid();
    const appointment: Appointment = {
      id,
      appointmentId,
      ...insertAppointment,
      status: insertAppointment.status || 'scheduled',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await this.db.collection("appointments").doc(id).set(prepareForFirestore(appointment));
    return appointment;
  }

  async updateAppointment(id: string, updates: Partial<Appointment>): Promise<Appointment | undefined> {
    await this.db.collection("appointments").doc(id).update(prepareForFirestore({
      ...updates,
      updatedAt: new Date(),
    }));
    return this.getAppointment(id);
  }

  async deleteAppointment(id: string): Promise<boolean> {
    await this.db.collection("appointments").doc(id).delete();
    return true;
  }

  // Orders
  async getOrder(id: string): Promise<Order | undefined> {
    const docSnap = await this.db.collection("orders").doc(id).get();
    return docSnap.exists ? docToObject<Order>(docSnap) : undefined;
  }

  async getOrderByNumber(orderNumber: string, partnerId: string): Promise<Order | undefined> {
    const snapshot = await this.db.collection("orders")
      .where("orderNumber", "==", orderNumber)
      .where("partnerId", "==", partnerId)
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return undefined;
    }
    
    return docToObject<Order>(snapshot.docs[0]);
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
      // order.jobId may be the job document id (from CreateOrderModal) or the human-readable jobId
      let job = null;
      if (order.jobId) {
        job = await this.getJob(order.jobId).catch(() => undefined) ?? undefined;
        if (!job) {
          job = await this.getJobByJobId(order.jobId).catch(() => undefined) ?? undefined;
        }
      }
      
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
      
      // Get file comments for orders in revision status
      let fileComments: any[] = [];
      if (order.status === 'in_revision') {
        fileComments = await this.getFileCommentsForOrder(order.id);
      }

      // Resolve customer editing preferences for editors (from customer profile in partner dashboard)
      let editingPreferences: any[] = [];
      const customerId = order.customerId || job?.customerId;
      if (customerId && order.partnerId) {
        try {
          const [options, preferences] = await Promise.all([
            this.getEditingOptions(order.partnerId),
            this.getCustomerEditingPreferences(customerId)
          ]);
          editingPreferences = options.map((option: any) => {
            const pref = preferences.find((p: any) => p.editingOptionId === option.id);
            return {
              id: option.id,
              name: option.name,
              description: option.description ?? undefined,
              isEnabled: pref?.isEnabled ?? false,
              notes: pref?.notes ?? undefined
            };
          });
        } catch (prefErr) {
          console.error("Error fetching customer editing preferences for order:", order.id, prefErr);
        }
      }
      
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
        partnerId: order.partnerId, // Include partnerId for security checks
        revisionNotes: (order as any).revisionNotes || null,
        revisionCount: (order as any).usedRevisionRounds || 0,
        fileComments: fileComments,
        editingPreferences
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

  async markOrderUploaded(orderId: string, editorId: string): Promise<Order | undefined> {
    const order = await this.getOrder(orderId);
    if (!order || order.assignedTo !== editorId) {
      throw new Error("Order not found or access denied");
    }

    const updates: Partial<Order> = { 
      status: "completed",
      dateCompleted: new Date()
    };

    const updatedOrder = await this.updateOrder(orderId, updates);
    console.log(`Order ${updatedOrder?.orderNumber} marked as completed`);
    return updatedOrder;
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

  async getEditorService(serviceId: string): Promise<EditorService | undefined> {
    const docSnap = await this.db.collection("editorServices").doc(serviceId).get();
    return docSnap.exists ? docToObject<EditorService>(docSnap) : undefined;
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
    // Include all statuses that should appear in the kanban board
    const filtered = orders.filter((order: any) => 
      order.status === "pending" || 
      order.status === "processing" || 
      order.status === "in_revision" ||
      order.status === "human_check" ||
      order.status === "completed" ||
      order.status === "uploaded"
    );
    return filtered;
  }

  async getEditorUploads(jobId: string): Promise<EditorUpload[]> {
    const snapshot = await this.db.collection("editorUploads").where("jobId", "==", jobId).get();
    return snapshot.docs.map(doc => docToObject<EditorUpload>(doc));
  }

  async getEditorUploadsForOrder(orderId: string): Promise<EditorUpload[]> {
    const snapshot = await this.db.collection("editorUploads").where("orderId", "==", orderId).get();
    return snapshot.docs.map(doc => docToObject<EditorUpload>(doc));
  }

  async getEditorUpload(fileId: string): Promise<EditorUpload | undefined> {
    const doc = await this.db.collection("editorUploads").doc(fileId).get();
    if (!doc.exists) return undefined;
    return docToObject<EditorUpload>(doc);
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

  async deleteEditorUpload(fileId: string): Promise<void> {
    const docRef = this.db.collection("editorUploads").doc(fileId);
    const doc = await docRef.get();
    if (!doc.exists) {
      throw new Error('File not found');
    }
    await docRef.delete();
  }

  async getAllEditorUploads(): Promise<EditorUpload[]> {
    const snapshot = await this.db.collection("editorUploads").get();
    return snapshot.docs.map(doc => docToObject<EditorUpload>(doc));
  }

  async updateEditorUpload(id: string, data: Partial<EditorUpload>): Promise<void> {
    await this.db.collection("editorUploads").doc(id).update(prepareForFirestore(data));
  }

  async getExpiredOrderFiles(): Promise<EditorUpload[]> {
    const now = Timestamp.now();
    const snapshot = await this.db.collection("editorUploads")
      .where("status", "==", "for_editing")
      .where("expiresAt", "<=", now) // Compare Timestamp to Timestamp for consistency
      .get();

    // Filter out any files with null/undefined expiresAt as a safety check
    return snapshot.docs
      .map(doc => docToObject<EditorUpload>(doc))
      .filter(file => file.expiresAt != null);
  }

  async deleteExpiredOrderFile(fileId: string, firebaseUrl: string): Promise<void> {
    // Delete from Firebase Storage
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.replace(/['"]/g, '').trim();
    if (bucketName && firebaseUrl) {
      try {
        const bucket = getStorage().bucket(bucketName);
        const file = bucket.file(firebaseUrl);
        const [exists] = await file.exists();
        if (exists) {
          await file.delete();
          console.log(`Deleted expired file from storage: ${firebaseUrl}`);
        }
      } catch (error) {
        console.error(`Failed to delete file from storage: ${firebaseUrl}`, error);
        // Continue to delete from Firestore even if storage deletion fails
      }
    }

    // Delete from Firestore
    await this.deleteEditorUpload(fileId);
  }

  async updateJobStatusAfterUpload(jobId: string, status: string): Promise<Job | undefined> {
    // jobId is the NanoID field, not the document ID - we need to fetch the job first
    const job = await this.getJobByJobId(jobId);
    if (!job) {
      return undefined;
    }
    // If marking as delivered, also set deliveredAt timestamp for monthly revenue tracking
    const updateData: any = { status };
    if (status === 'delivered' && !job.deliveredAt) {
      updateData.deliveredAt = new Date();
    }
    // Now use the actual document ID to update
    return this.updateJob(job.id, updateData);
  }

  // Helper function to normalize folder paths (extract relative portion)
  private normalizeFolderPath(folderPath: string): string {
    if (!folderPath || !folderPath.includes('/')) {
      return folderPath;
    }

    const completedMatch = folderPath.match(/^completed\/[^\/]+\/(.+)$/);
    const ordersMatch = folderPath.match(/^orders\/[^\/]+\/(.+)$/);

    if (completedMatch) {
      return completedMatch[1]; // Extract path after "completed/jobId/"
    } else if (ordersMatch) {
      return ordersMatch[1]; // Extract path after "orders/jobId/"
    }

    return folderPath; // Return as-is if no match
  }

  // Folder Management
  async getUploadFolders(jobId: string): Promise<{uniqueKey: string; folderPath: string; editorFolderName: string; partnerFolderName?: string; orderId?: string | null; orderNumber?: string; fileCount: number; files: any[]; folderToken?: string; isVisible: boolean; displayOrder?: number}[]> {
    const snapshot = await this.db.collection("editorUploads").where("jobId", "==", jobId).get();
    const uploads = snapshot.docs.map(doc => docToObject<EditorUpload>(doc));

    const buildFolderUniqueKey = (
      rawPath: string | null | undefined,
      normalizedPath: string | null | undefined,
      orderId?: string | null,
      folderToken?: string | null,
      uploadId?: string | null,
      editorFolderName?: string | null
    ): string => {
      const basePath = rawPath || normalizedPath || 'root';
      const parts = [basePath];
      if (orderId) {
        parts.push(`order:${orderId}`);
      }
      if (folderToken) {
        parts.push(`token:${folderToken}`);
      }
      if (parts.length === 1) {
        // For folders without token/orderId, use upload ID to create unique instances
        // Group by folderPath + editorFolderName, use first upload's ID
        if (uploadId && editorFolderName) {
          parts.push(`instance:${uploadId}`);
        } else {
          parts.push('default');
        }
      }
      return parts.join('::');
    };

    type FolderAccumulator = {
      uniqueKey: string;
      rawFolderPath: string;
      folderPath: string;
      editorFolderName: string;
      partnerFolderName?: string;
      folderToken?: string;
      orderId?: string | null;
      orderNumber?: string;
      isVisible: boolean;
      displayOrder?: number;
      fileCount: number;
      files: any[];
    };

    const folderMap = new Map<string, FolderAccumulator>();
    const pathIndex = new Map<string, FolderAccumulator[]>();

    const registerInPathIndex = (key: string | undefined | null, folder: FolderAccumulator) => {
      if (!key) return;
      const existing = pathIndex.get(key) || [];
      existing.push(folder);
      pathIndex.set(key, existing);
    };
    const orderIds = new Set<string>();
    const folderInstanceMap = new Map<string, string>(); // Maps folderPath+editorFolderName to first upload ID

    // FIRST, add all folders from the 'folders' collection (including empty standalone folders)
    // This ensures folders created via "Add Content" are present with their correct names
    const foldersSnapshot = await this.db.collection("folders").where("jobId", "==", jobId).get();
    foldersSnapshot.docs.forEach(doc => {
      const folderData = doc.data();
      const rawPath = folderData.folderPath;
      const normalizedPath = this.normalizeFolderPath(rawPath);
      const pathKey = rawPath || normalizedPath;

      if (!pathKey) {
        return;
      }

      // Build the uniqueKey for this folder document
      let instanceId: string | null = null;
      if (folderData.instanceId) {
        instanceId = folderData.instanceId;
      }
      
      const uniqueKey = buildFolderUniqueKey(rawPath, normalizedPath, folderData.orderId, folderData.folderToken, instanceId, folderData.editorFolderName || null);
      
      // Create folder entry from folders collection (these have the correct partnerFolderName)
      if (!folderMap.has(uniqueKey)) {
        const accumulator: FolderAccumulator = {
          uniqueKey,
          rawFolderPath: rawPath,
          folderPath: normalizedPath || rawPath,
          // Use editorFolderName from the folder document, fallback to partnerFolderName
          editorFolderName: folderData.editorFolderName || folderData.partnerFolderName || "",
          partnerFolderName: folderData.partnerFolderName || undefined,
          folderToken: folderData.folderToken,
          orderId: folderData.orderId || undefined,
          orderNumber: undefined,
          isVisible: typeof folderData.isVisible === 'boolean' ? folderData.isVisible : true,
          displayOrder: typeof folderData.displayOrder === 'number' ? folderData.displayOrder : undefined,
          fileCount: 0,
          files: []
        };
        folderMap.set(uniqueKey, accumulator);
        registerInPathIndex(rawPath, accumulator);
        if (normalizedPath && normalizedPath !== rawPath) {
          registerInPathIndex(normalizedPath, accumulator);
        }
        console.log('[getUploadFolders] Added folder from folders collection:', {
          uniqueKey,
          folderPath: normalizedPath || rawPath,
          editorFolderName: folderData.editorFolderName,
          partnerFolderName: folderData.partnerFolderName,
          folderToken: folderData.folderToken
        });
      }
      if (folderData.orderId) {
        orderIds.add(folderData.orderId);
      }
    });

    // THEN, add all folders from editorUploads (folders with files)
    // Files will be added to existing folders or create new ones
    uploads.forEach(upload => {
      if (!upload.folderPath) return;

      const rawPath = upload.folderPath;
      const normalizedPath = this.normalizeFolderPath(rawPath);
      
      // For folders without token/orderId, group by folderPath + editorFolderName
      // Use the first upload's ID in each group to create a unique instance identifier
      let instanceId: string | null = null;
      if (!upload.folderToken && !upload.orderId && upload.editorFolderName) {
        const folderSignature = `${rawPath}::${upload.editorFolderName}`;
        instanceId = folderInstanceMap.get(folderSignature) || null;
        if (!instanceId) {
          instanceId = upload.id;
          folderInstanceMap.set(folderSignature, instanceId);
        }
      }
      
      const uniqueKey = buildFolderUniqueKey(rawPath, normalizedPath, upload.orderId, upload.folderToken, instanceId, upload.editorFolderName || null);

      if (!uniqueKey) {
        return;
      }

      let folder: FolderAccumulator | undefined;
      
      if (!folderMap.has(uniqueKey)) {
        // Check if a folder with the same path already exists in pathIndex
        // This handles cases where uploads have different folderTokens than the folder document
        const existingByPath = pathIndex.get(normalizedPath || rawPath)?.[0] || pathIndex.get(rawPath)?.[0];
        
        if (existingByPath) {
          // Use the existing folder instead of creating a new one
          folder = existingByPath;
          if (upload.orderId) {
            orderIds.add(upload.orderId);
          }
        } else {
          // Folder doesn't exist yet - create it from upload
          // This happens for folders that don't exist in the folders collection
          if (upload.orderId) {
            orderIds.add(upload.orderId);
          }

          const accumulator: FolderAccumulator = {
            uniqueKey,
            rawFolderPath: rawPath,
            folderPath: normalizedPath || rawPath,
            editorFolderName: upload.editorFolderName || "",
            partnerFolderName: upload.partnerFolderName || undefined,
            folderToken: upload.folderToken || undefined,
            orderId: upload.orderId || null,
            orderNumber: undefined,
            isVisible: true,
            displayOrder: undefined,
            fileCount: 0,
            files: []
          };

          folderMap.set(uniqueKey, accumulator);
          registerInPathIndex(rawPath, accumulator);
          if (normalizedPath && normalizedPath !== rawPath) {
            registerInPathIndex(normalizedPath, accumulator);
          }
          folder = accumulator;
        }
      } else {
        if (upload.orderId) {
          // Track orderIds for existing folders
          orderIds.add(upload.orderId);
        }
        folder = folderMap.get(uniqueKey);
      }
      if (!folder) return;

      // Ensure we retain whichever orderId is set first for this folder
      if (!folder.orderId && upload.orderId) {
        folder.orderId = upload.orderId;
      }

      // Prefer a populated editorFolderName if we previously had an empty string
      if (!folder.editorFolderName && upload.editorFolderName) {
        folder.editorFolderName = upload.editorFolderName;
      }

      // Only update partnerFolderName from upload if folder doesn't already have one
      // Folders from folders collection (created via "Add Content") should keep their names
      if (!folder.partnerFolderName && upload.partnerFolderName) {
        folder.partnerFolderName = upload.partnerFolderName;
      }

      if (!folder.folderToken && upload.folderToken) {
        folder.folderToken = upload.folderToken;
      }

      folder.fileCount++;
      folder.files.push(upload);
    });


    // Lookup order numbers and statuses for folders associated with orders
    let orderNumberMap: Map<string, string> | undefined;
    let orderStatusMap: Map<string, string> | undefined;
    if (orderIds.size > 0) {
      const orderFetches = Array.from(orderIds).map(async (orderId) => {
        const docSnap = await this.db.collection("orders").doc(orderId).get();
        if (!docSnap.exists) {
          return null;
        }
        const order = docToObject<Order>(docSnap);
        return order ? { orderId, orderNumber: order.orderNumber, status: order.status } : null;
      });

      const orderResults = await Promise.all(orderFetches);
      orderNumberMap = new Map<string, string>();
      orderStatusMap = new Map<string, string>();
      orderResults.forEach(result => {
        if (result) {
          if (result.orderNumber) {
            orderNumberMap!.set(result.orderId, result.orderNumber);
          }
          if (result.status) {
            orderStatusMap!.set(result.orderId, result.status);
          }
        }
      });
    }

    const folders = Array.from(folderMap.values()).map(folder => {
      if (folder.orderId && orderNumberMap?.has(folder.orderId)) {
        folder.orderNumber = orderNumberMap.get(folder.orderId);
      }

      // Filter files to only include those where the order status is 'completed' (QC passed)
      // Files without an orderId are also filtered out (they need to be associated with an order)
      // This ensures files don't appear in delivery until human check passes
      const filteredFiles = folder.files.filter(file => {
        if (!file.orderId) {
          return false; // No order association - don't show
        }
        const orderStatus = orderStatusMap?.get(file.orderId);
        return orderStatus === 'completed'; // Only show if order passed QC
      });

      const visibilityKey = this.getFolderVisibilityKey(jobId, {
        uniqueKey: folder.uniqueKey,
        folderToken: folder.folderToken || null,
        orderId: folder.orderId || null,
        folderPath: folder.folderPath
      });

      return {
        uniqueKey: visibilityKey,
        folderPath: folder.folderPath,
        editorFolderName: folder.editorFolderName,
        // Preserve partnerFolderName (user-provided name for folders created via "Add Content")
        // Don't overwrite with editorFolderName - let the frontend handle the fallback
        partnerFolderName: folder.partnerFolderName,
        orderId: folder.orderId || null,
        orderNumber: folder.orderNumber,
        fileCount: filteredFiles.length, // Use filtered file count
        files: filteredFiles, // Use filtered files
        folderToken: folder.folderToken,
        isVisible: typeof folder.isVisible === 'boolean' ? folder.isVisible : true,
        displayOrder: folder.displayOrder
      };
    });

    // Sort folders by displayOrder (ascending), with folders without displayOrder sorted last
    folders.sort((a, b) => {
      const aOrder = a.displayOrder ?? Number.MAX_SAFE_INTEGER;
      const bOrder = b.displayOrder ?? Number.MAX_SAFE_INTEGER;
      return aOrder - bOrder;
    });

    return folders;
  }

  async createFolder(jobId: string, partnerFolderName: string, parentFolderPath?: string, orderId?: string, providedFolderToken?: string): Promise<{folderPath: string; partnerFolderName: string; folderToken: string}> {
    const folderToken = providedFolderToken || nanoid(16);
    // Use relative paths without completed/ or orders/ prefix for consistency
    const folderPath = parentFolderPath
      ? `${parentFolderPath}/${folderToken}`
      : `folders/${folderToken}`;

    // Get max displayOrder for this job to set new folder at the end
    const existingFolders = await this.db.collection("folders")
      .where("jobId", "==", jobId)
      .get();
    
    let maxDisplayOrder = 0;
    existingFolders.docs.forEach(doc => {
      const data = doc.data();
      if (typeof data.displayOrder === 'number' && data.displayOrder > maxDisplayOrder) {
        maxDisplayOrder = data.displayOrder;
      }
    });

    const folderId = nanoid();
    const folderDoc = {
      jobId,
      folderPath,
      partnerFolderName,
      // Store editorFolderName same as partnerFolderName for editor-created folders
      editorFolderName: partnerFolderName,
      folderToken,
      // Store orderId to associate folder with specific order
      orderId: orderId || null,
      isVisible: true,
      displayOrder: maxDisplayOrder + 1,
      createdAt: Timestamp.now()
    };
    
    console.log(`[FirestoreStorage.createFolder] Creating folder with doc:`, JSON.stringify({
      folderId,
      jobId,
      folderPath,
      partnerFolderName,
      folderToken,
      orderId: orderId || null
    }));
    
    await this.db.collection("folders").doc(folderId).set(folderDoc);

    return { folderPath, partnerFolderName, folderToken };
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

  async updateFolderVisibility(jobId: string, folderPath: string, isVisible: boolean, options?: { uniqueKey?: string | null; folderToken?: string | null; orderId?: string | null }): Promise<void> {
    const folderCollection = this.db.collection("folders");
    let queryRef: FirebaseFirestore.Query = folderCollection.where("jobId", "==", jobId);
    
    // If uniqueKey is provided, try to use it to find the folder
    // uniqueKey format: "path::instance:uploadId" or "path::token:token" or "path::order:orderId"
    if (options?.uniqueKey) {
      // Check if uniqueKey contains instance ID (format: path::instance:uploadId)
      const instanceMatch = options.uniqueKey.match(/::instance::([^:]+)$/);
      if (instanceMatch) {
        const instanceId = instanceMatch[1];
        // Query folders by instanceId field (we'll store this when creating folders)
        queryRef = folderCollection.where("jobId", "==", jobId)
          .where("instanceId", "==", instanceId);
      } else {
        // For other uniqueKey formats, try to parse and use them
        // This handles tokens and orderIds embedded in uniqueKey
        const tokenMatch = options.uniqueKey.match(/::token::([^:]+)/);
        const orderMatch = options.uniqueKey.match(/::order::([^:]+)/);
        
        if (tokenMatch) {
          queryRef = queryRef.where("folderToken", "==", tokenMatch[1]);
        } else if (orderMatch) {
          queryRef = queryRef.where("orderId", "==", orderMatch[1])
            .where("folderPath", "==", folderPath);
        } else {
          // Fallback to folderPath
          queryRef = queryRef.where("folderPath", "==", folderPath);
        }
      }
    } else if (options?.folderToken) {
      queryRef = queryRef.where("folderToken", "==", options.folderToken);
    } else {
      queryRef = queryRef.where("folderPath", "==", folderPath);
      if (options?.orderId) {
        queryRef = queryRef.where("orderId", "==", options.orderId);
      }
    }

    const snapshot = await queryRef.limit(1).get();

    if (!snapshot.empty) {
      const updateData: any = { isVisible };
      if (options?.uniqueKey) {
        updateData.uniqueKey = options.uniqueKey;
        // Extract and store instanceId if uniqueKey contains it
        const instanceMatch = options.uniqueKey.match(/::instance::([^:]+)$/);
        if (instanceMatch) {
          updateData.instanceId = instanceMatch[1];
        }
      }
      await snapshot.docs[0].ref.update(updateData);
      return;
    }

    // If folder document doesn't exist, create one with minimal data so visibility persists
    const folderId = nanoid();
    const folderData: any = {
      jobId,
      folderPath,
      partnerFolderName: null,
      folderToken: options?.folderToken || null,
      orderId: options?.orderId || null,
      uniqueKey: options?.uniqueKey || null,
      isVisible,
      createdAt: Timestamp.now()
    };
    
    // Extract and store instanceId if uniqueKey contains it
    if (options?.uniqueKey) {
      const instanceMatch = options.uniqueKey.match(/::instance::([^:]+)$/);
      if (instanceMatch) {
        folderData.instanceId = instanceMatch[1];
      }
    }
    
    await folderCollection.doc(folderId).set(folderData);
  }

  async updateFolderOrder(jobId: string, folders: Array<{ uniqueKey: string; displayOrder: number }>): Promise<void> {
    console.log(`[updateFolderOrder] Updating order for job ${jobId}, ${folders.length} folders`);

    const folderCollection = this.db.collection("folders");
    const foldersSnapshot = await folderCollection.where("jobId", "==", jobId).get();
    console.log(`[updateFolderOrder] Found ${foldersSnapshot.docs.length} folder documents in Firestore`);

    const batch = this.db.batch();
    let hasUpdates = false;

    for (const { uniqueKey, displayOrder } of folders) {
      console.log(`[updateFolderOrder] Processing folder: ${uniqueKey}, displayOrder: ${displayOrder}`);

      // buildFolderUniqueKey format:
      //   basePath
      //   basePath::order:orderId
      //   basePath::token:folderToken
      //   basePath::instance:uploadId
      //   basePath::default
      const [basePath, qualifier] = uniqueKey.split("::");
      let folderPath = basePath;
      let orderId: string | null = null;
      let folderToken: string | null = null;

      if (qualifier?.startsWith("order:")) {
        orderId = qualifier.substring("order:".length);
      } else if (qualifier?.startsWith("token:")) {
        folderToken = qualifier.substring("token:".length);
      }

      // Try to find an existing folder doc for this path/token/order
      let query: FirebaseFirestore.Query = folderCollection.where("jobId", "==", jobId);
      if (folderPath) {
        query = query.where("folderPath", "==", folderPath);
      }
      if (folderToken) {
        query = query.where("folderToken", "==", folderToken);
      }
      if (orderId) {
        query = query.where("orderId", "==", orderId);
      }

      const existing = await query.get();

      if (!existing.empty) {
        existing.docs.forEach(doc => {
          batch.update(doc.ref, { displayOrder, uniqueKey });
          hasUpdates = true;
          console.log(`[updateFolderOrder] Updated doc ${doc.id} for path ${folderPath} with displayOrder ${displayOrder}`);
        });
      } else {
        // Create a minimal folder document so order can be persisted
        const folderId = nanoid();
        const folderData: any = {
          jobId,
          folderPath,
          folderToken: folderToken || null,
          orderId: orderId || null,
          uniqueKey,
          displayOrder,
          isVisible: true,
          createdAt: Timestamp.now()
        };
        batch.set(folderCollection.doc(folderId), folderData);
        hasUpdates = true;
        console.log(`[updateFolderOrder] Created new folder doc ${folderId} for path ${folderPath} with displayOrder ${displayOrder}`);
      }
    }

    if (hasUpdates) {
      await batch.commit();
      console.log(`[updateFolderOrder] Successfully updated folder orders for job ${jobId}`);
    } else {
      console.warn(`[updateFolderOrder] No folder order updates to apply for job ${jobId}`);
    }
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

  async deleteAllNotifications(recipientId: string, partnerId: string): Promise<void> {
    const notificationsSnapshot = await this.db
      .collection("notifications")
      .where("recipientId", "==", recipientId)
      .where("partnerId", "==", partnerId)
      .get();

    if (notificationsSnapshot.empty) {
      return;
    }

    const batch = this.db.batch();
    notificationsSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
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
      metadata: activity.metadata ?? null,
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
      await this.db.collection("partnerSettings").doc(existing.id).update(
        prepareForFirestore({ ...settings, updatedAt: now })
      );
      const docSnap = await this.db.collection("partnerSettings").doc(existing.id).get();
      return docToObject<PartnerSettings>(docSnap);
    } else {
      const id = nanoid();
      const newSettings: PartnerSettings = {
        ...settings,
        businessProfile: settings.businessProfile || null,
        personalProfile: settings.personalProfile || null,
        businessHours: settings.businessHours || null,
        enableClientRevisionLimit: settings.enableClientRevisionLimit !== undefined ? settings.enableClientRevisionLimit : false,
        clientRevisionRoundLimit: settings.clientRevisionRoundLimit !== undefined ? settings.clientRevisionRoundLimit : 2,
        editorDisplayNames: settings.editorDisplayNames || null,
        teamMemberColors: settings.teamMemberColors || null,
        bookingSettings: (settings as any).bookingSettings || null,
        emailSettings: (settings as any).emailSettings ?? null,
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

  async getFileCommentsForOrder(orderId: string): Promise<FileComment[]> {
    const snapshot = await this.db.collection("fileComments").where("orderId", "==", orderId).get();
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
    console.log('[getJobReview] Looking for review with jobId:', jobId);
    
    // First, try to find the job to determine which ID format we're using
    let job: Job | undefined = null;
    
    // Try as UUID (document ID) first
    job = await this.getJob(jobId);
    if (job) {
      console.log('[getJobReview] Found job by UUID id:', { id: job.id, jobId: job.jobId });
    } else {
      // Try as NanoID (jobId field)
      job = await this.getJobByJobId(jobId);
      if (job) {
        console.log('[getJobReview] Found job by NanoID jobId:', { id: job.id, jobId: job.jobId });
      }
    }
    
    if (!job) {
      console.log('[getJobReview] Job not found for jobId:', jobId);
      return undefined;
    }
    
    // Try querying reviews by job.id (UUID) - this is what reviews are stored with
    let snapshot = await this.db.collection("jobReviews").where("jobId", "==", job.id).get();
    console.log('[getJobReview] Found', snapshot.docs.length, 'reviews by UUID id:', job.id);
    
    // If not found, try by job.jobId (NanoID) as fallback
    if (snapshot.empty && job.jobId) {
      snapshot = await this.db.collection("jobReviews").where("jobId", "==", job.jobId).get();
      console.log('[getJobReview] Found', snapshot.docs.length, 'reviews by NanoID jobId:', job.jobId);
    }
    
    if (snapshot.empty) {
      console.log('[getJobReview] No reviews found for job:', { id: job.id, jobId: job.jobId });
      return undefined;
    }
    
    // If multiple reviews exist, return the most recent one
    const reviews = snapshot.docs.map(doc => docToObject<JobReview>(doc));
    const sortedReviews = reviews.sort((a, b) => {
      const aDate = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
      const bDate = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
      return bDate.getTime() - aDate.getTime();
    });
    
    console.log('[getJobReview] Returning most recent review:', sortedReviews[0].id);
    return sortedReviews[0];
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

  async updateDeliveryEmail(id: string, data: { sendgridMessageId?: string }): Promise<DeliveryEmail | undefined> {
    const ref = this.db.collection("deliveryEmails").doc(id);
    const doc = await ref.get();
    if (!doc.exists) return undefined;
    const updates: Record<string, unknown> = {};
    if (data.sendgridMessageId !== undefined) updates.sendgridMessageId = data.sendgridMessageId;
    if (Object.keys(updates).length === 0) return docToObject<DeliveryEmail>(doc);
    await ref.update(prepareForFirestore(updates));
    const updated = await ref.get();
    return updated.exists ? docToObject<DeliveryEmail>(updated) : undefined;
  }

  async getDeliveryEmailBySendgridMessageId(sendgridMessageId: string): Promise<DeliveryEmail | undefined> {
    const snapshot = await this.db.collection("deliveryEmails")
      .where("sendgridMessageId", "==", sendgridMessageId)
      .limit(1)
      .get();
    if (snapshot.empty) return undefined;
    return docToObject<DeliveryEmail>(snapshot.docs[0]);
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
  async getUserConversations(userId: string, partnerId: string, userRole?: string): Promise<Conversation[]> {
    // For photographers, filter by participantId to only show their own conversations
    if (userRole === 'photographer') {
      const snap = await this.db.collection("conversations")
        .where("partnerId", "==", partnerId)
        .where("participantId", "==", userId)
        .get();
      
      const conversations = snap.docs.map(doc => docToObject<Conversation>(doc));
      
      return conversations.sort((a, b) => {
        const aTime = a.lastMessageAt?.getTime() || 0;
        const bTime = b.lastMessageAt?.getTime() || 0;
        return bTime - aTime;
      });
    }
    
    // For partners/admins/editors, use existing logic
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

  async getConversationByParticipants(partnerId: string, editorId: string, orderId?: string, participantId?: string): Promise<Conversation | undefined> {
    let ref: FirebaseFirestore.Query = this.db.collection("conversations")
      .where("partnerId", "==", partnerId)
      .where("editorId", "==", editorId);

    if (orderId) {
      ref = ref.where("orderId", "==", orderId);
    } else {
      ref = ref.where("orderId", "==", null);
    }

    // For photographers, also filter by participantId
    if (participantId) {
      ref = ref.where("participantId", "==", participantId);
    }

    const snapshot = await ref.get();
    return snapshot.empty ? undefined : docToObject<Conversation>(snapshot.docs[0]);
  }

  async createConversation(conversation: InsertConversation & { participantId?: string }): Promise<Conversation> {
    const id = nanoid();
    const newConversation: Conversation & { participantId?: string } = {
      ...conversation,
      orderId: conversation.orderId || null,
      id,
      lastMessageAt: new Date(),
      lastMessageText: null,
      partnerUnreadCount: 0,
      editorUnreadCount: 0,
      createdAt: new Date()
    };
    
    // Include participantId if provided (for photographers)
    if ((conversation as any).participantId) {
      newConversation.participantId = (conversation as any).participantId;
    }
    
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

  // Service Areas Implementation
  async getServiceAreas(partnerId: string): Promise<ServiceArea[]> {
    // Simple query without compound index requirement - filter in memory
    const snapshot = await this.db.collection("service_areas")
      .where("partnerId", "==", partnerId)
      .get();
    const areas = snapshot.docs.map(doc => docToObject<ServiceArea>(doc));
    // Sort by createdAt in memory
    return areas.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateA - dateB;
    });
  }

  async getServiceArea(id: string): Promise<ServiceArea | undefined> {
    const doc = await this.db.collection("service_areas").doc(id).get();
    return doc.exists ? docToObject<ServiceArea>(doc) : undefined;
  }

  async createServiceArea(serviceArea: InsertServiceArea): Promise<ServiceArea> {
    const id = nanoid();
    const newServiceArea: ServiceArea = {
      ...serviceArea,
      id,
      color: serviceArea.color || '#3B82F6',
      assignedOperatorIds: serviceArea.assignedOperatorIds || null,
      isActive: serviceArea.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await this.db.collection("service_areas").doc(id).set(prepareForFirestore(newServiceArea));
    return newServiceArea;
  }

  async updateServiceArea(id: string, updates: Partial<ServiceArea>): Promise<ServiceArea | undefined> {
    const existing = await this.getServiceArea(id);
    if (!existing) return undefined;
    
    const updateData = {
      ...updates,
      updatedAt: new Date()
    };
    await this.db.collection("service_areas").doc(id).update(prepareForFirestore(updateData));
    return { ...existing, ...updateData } as ServiceArea;
  }

  async deleteServiceArea(id: string): Promise<void> {
    await this.db.collection("service_areas").doc(id).delete();
  }
}

export const firestoreStorage = new FirestoreStorage();
