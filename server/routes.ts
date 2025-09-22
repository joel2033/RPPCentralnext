import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertCustomerSchema, 
  insertProductSchema,
  insertJobSchema,
  insertOrderSchema,
  insertOrderServiceSchema,
  insertOrderFileSchema,
  insertServiceCategorySchema,
  insertEditorServiceSchema,
  insertNotificationSchema,
  insertActivitySchema
} from "@shared/schema";
import { 
  createUserDocument, 
  createPendingInvite, 
  getPendingInvite, 
  updateInviteStatus,
  getUserDocument,
  createPartnershipInvite,
  getPartnershipInvite,
  updatePartnershipInviteStatus,
  createPartnership,
  getPartnerPartnerships,
  getEditorPartnerships,
  getEditorPendingInvites,
  adminDb,
  adminAuth,
  UserRole 
} from "./firebase-admin";
import { z } from "zod";
import multer from "multer";
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import fs from 'fs';
import JSZip from 'jszip';

// Initialize Firebase Admin if not already done
if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
}

// Firebase authentication middleware
interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    partnerId?: string;
    role: string;
    email: string;
  };
}

const requireAuth = async (req: any, res: any, next: any) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Authorization header required" });
    }

    const idToken = authHeader.replace('Bearer ', '');
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;
    const userDoc = await getUserDocument(uid);
    
    if (!userDoc) {
      return res.status(401).json({ error: "User not found" });
    }

    // Attach user context to request
    req.user = {
      uid: userDoc.uid,
      partnerId: userDoc.partnerId,
      role: userDoc.role,
      email: userDoc.email
    };
    
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Customers
  app.get("/api/customers", async (req, res) => {
    try {
      const customers = await storage.getCustomers();
      res.json(customers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  app.post("/api/customers", async (req, res) => {
    try {
      const validatedData = insertCustomerSchema.parse(req.body);
      const customer = await storage.createCustomer(validatedData);
      res.status(201).json(customer);
    } catch (error) {
      res.status(400).json({ error: "Invalid customer data" });
    }
  });

  app.get("/api/customers/:id", async (req, res) => {
    try {
      const customer = await storage.getCustomer(req.params.id);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customer" });
    }
  });

  app.get("/api/customers/:id/profile", async (req, res) => {
    try {
      const customer = await storage.getCustomer(req.params.id);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      
      const jobs = await storage.getCustomerJobs(req.params.id);
      
      res.json({
        customer,
        jobs
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customer profile" });
    }
  });

  // Users
  app.get("/api/users", async (req, res) => {
    try {
      const users = await storage.getUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Products
  app.get("/api/products", async (req, res) => {
    try {
      const products = await storage.getProducts();
      res.json(products);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.post("/api/products", async (req, res) => {
    try {
      const validatedData = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(validatedData);
      res.status(201).json(product);
    } catch (error) {
      res.status(400).json({ error: "Invalid product data" });
    }
  });

  app.patch("/api/products/:id", async (req, res) => {
    try {
      const product = await storage.updateProduct(req.params.id, req.body);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      res.status(500).json({ error: "Failed to update product" });
    }
  });

  // Jobs
  app.get("/api/jobs", async (req, res) => {
    try {
      const jobs = await storage.getJobs();
      res.json(jobs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch jobs" });
    }
  });

  app.post("/api/jobs", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.partnerId) {
        return res.status(400).json({ error: "User must have a partnerId" });
      }

      // For now, bypass schema validation and handle dates manually
      const data = { 
        ...req.body, 
        partnerId: req.user.partnerId // Ensure partnerId is set
      };
      if (data.appointmentDate && typeof data.appointmentDate === 'string') {
        data.appointmentDate = new Date(data.appointmentDate);
      }
      if (data.dueDate && typeof data.dueDate === 'string') {
        data.dueDate = new Date(data.dueDate);
      }

      // Validate job data before creation
      const validation = await storage.validateJobCreation(data);
      if (!validation.valid) {
        return res.status(400).json({ 
          error: "Job validation failed", 
          details: validation.errors 
        });
      }
      
      const job = await storage.createJob(data);

      // Log activity: Job Creation
      try {
        await storage.createActivity({
          partnerId: req.user.partnerId,
          jobId: job.id,
          userId: req.user.uid,
          userEmail: req.user.email,
          userName: req.user.email, // Use email as userName since firstName/lastName aren't in user context
          action: "creation",
          category: "job",
          title: "Job Created",
          description: `New job created at ${job.address}`,
          metadata: JSON.stringify({
            jobId: job.jobId,
            address: job.address,
            status: job.status,
            customerId: job.customerId,
            totalValue: job.totalValue
          }),
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });
      } catch (activityError) {
        console.error("Failed to log job creation activity:", activityError);
        // Don't fail the job creation if activity logging fails
      }

      res.status(201).json(job);
    } catch (error) {
      console.error("Job creation error:", error);
      res.status(400).json({ error: "Invalid job data", details: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.get("/api/jobs/:id", async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.json(job);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch job" });
    }
  });

  // Orders
  app.get("/api/orders", async (req, res) => {
    try {
      const orders = await storage.getOrders();
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  });

  app.post("/api/orders", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.partnerId) {
        return res.status(400).json({ error: "User must have a partnerId" });
      }

      const orderData = {
        ...req.body,
        partnerId: req.user.partnerId
      };
      
      const validatedData = insertOrderSchema.parse(orderData);

      // Validate order data before creation
      const validation = await storage.validateOrderCreation(validatedData);
      if (!validation.valid) {
        return res.status(400).json({ 
          error: "Order validation failed", 
          details: validation.errors 
        });
      }
      
      const order = await storage.createOrder(validatedData);

      // Log activity: Order Creation
      try {
        await storage.createActivity({
          partnerId: req.user.partnerId,
          orderId: order.id,
          jobId: order.jobId,
          userId: req.user.uid,
          userEmail: req.user.email,
          userName: req.user.email, // Use email as userName since firstName/lastName aren't in user context
          action: "creation",
          category: "order",
          title: "Order Created",
          description: `New order #${order.orderNumber} created`,
          metadata: JSON.stringify({
            orderNumber: order.orderNumber,
            status: order.status,
            estimatedTotal: order.estimatedTotal,
            jobId: order.jobId,
            customerId: order.customerId
          }),
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });
      } catch (activityError) {
        console.error("Failed to log order creation activity:", activityError);
      }

      res.status(201).json(order);
    } catch (error) {
      res.status(400).json({ error: "Invalid order data" });
    }
  });

  app.patch("/api/orders/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.partnerId) {
        return res.status(400).json({ error: "User must have a partnerId" });
      }

      const { id } = req.params;
      
      // Verify order exists and belongs to user's partner (security check)
      const existingOrder = await storage.getOrder(id);
      if (!existingOrder) {
        return res.status(404).json({ error: "Order not found" });
      }
      
      if (existingOrder.partnerId !== req.user.partnerId) {
        return res.status(403).json({ error: "Access denied to this order" });
      }

      // Store original values for change tracking
      const originalStatus = existingOrder.status;
      
      const order = await storage.updateOrder(id, req.body);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      // Log activity for status changes (critical for audit trail)
      if (req.body.status && req.body.status !== originalStatus) {
        try {
          await storage.createActivity({
            partnerId: req.user.partnerId,
            orderId: order.id,
            jobId: order.jobId,
            userId: req.user.uid,
            userEmail: req.user.email,
            userName: req.user.email,
            action: "status_change",
            category: "order",
            title: "Order Status Updated",
            description: `Order #${order.orderNumber} status changed from ${originalStatus} to ${req.body.status}`,
            metadata: JSON.stringify({
              orderNumber: order.orderNumber,
              previousStatus: originalStatus,
              newStatus: req.body.status,
              changedBy: req.user.email,
              changedAt: new Date().toISOString(),
              updatedFields: Object.keys(req.body)
            }),
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
          });
        } catch (activityError) {
          console.error("Failed to log order update activity:", activityError);
          // Don't fail the update if activity logging fails
        }
      }

      res.json(order);
    } catch (error: any) {
      console.error("Error updating order:", error);
      res.status(500).json({ 
        error: "Failed to update order", 
        details: error.message 
      });
    }
  });

  // Submit order with services and files
  app.post("/api/orders/submit", async (req, res) => {
    try {
      const { partnerId, jobId, customerId, services, createdBy } = req.body;
      
      if (!partnerId || !services || !Array.isArray(services) || services.length === 0) {
        return res.status(400).json({ error: "Missing required fields: partnerId, services" });
      }

      // Use existing order reservation or generate new order number
      let orderNumber: string;
      if (req.body.orderNumber) {
        // If orderNumber provided, confirm the reservation
        const confirmed = await storage.confirmReservation(req.body.orderNumber);
        if (!confirmed) {
          return res.status(400).json({ error: "Invalid or expired order reservation" });
        }
        orderNumber = req.body.orderNumber;
      } else {
        // Fallback to old behavior if no reservation provided
        orderNumber = await storage.generateOrderNumber();
      }
      
      // Calculate 14 days from now for file expiry
      const filesExpiryDate = new Date();
      filesExpiryDate.setDate(filesExpiryDate.getDate() + 14);

      // Create the main order (orderNumber and filesExpiryDate are auto-generated)
      const order = await storage.createOrder({
        partnerId,
        jobId: jobId || null,
        customerId: customerId || null,
        status: "pending",
        createdBy: createdBy || null,
        estimatedTotal: "0"
      });

      // Create order services and files
      for (const service of services) {
        const { serviceId, quantity, instructions, exportTypes, files } = service;
        
        // Create order service record
        const orderService = await storage.createOrderService({
          orderId: order.id,
          serviceId,
          quantity: quantity || 1,
          instructions: JSON.stringify(instructions || []),
          exportTypes: JSON.stringify(exportTypes || [])
        });

        // Create order file records
        if (files && Array.isArray(files)) {
          for (const file of files) {
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 14);
            
            await storage.createOrderFile({
              orderId: order.id,
              serviceId: orderService.id,
              fileName: file.fileName,
              originalName: file.originalName,
              fileSize: file.fileSize,
              mimeType: file.mimeType,
              firebaseUrl: file.firebaseUrl,
              downloadUrl: file.downloadUrl,
              expiresAt
            });
          }
        }
      }

      // Create notifications for eligible editors
      try {
        // Extract unique serviceIds from the order
        const serviceIds = services.map((service: any) => service.serviceId).filter((id: any) => id);
        
        // Get all partnerships for this partner
        const partnerships = await getPartnerPartnerships(partnerId);
        const eligibleEditorIds = new Set<string>();
        
        // Find editors who can handle the requested services
        if (serviceIds.length > 0) {
          for (const partnership of partnerships) {
            if (partnership.status === 'active') {
              // Get editor's services to check if they can handle any of the requested serviceIds
              const editorServices = await storage.getEditorServices(partnership.editorId);
              const hasMatchingService = editorServices.some(editorService => 
                serviceIds.includes(editorService.id) && editorService.isActive
              );
              
              if (hasMatchingService) {
                eligibleEditorIds.add(partnership.editorId);
              }
            }
          }
        }
        
        // Fallback: if no exact service match, notify all active partnership editors
        if (eligibleEditorIds.size === 0) {
          for (const partnership of partnerships) {
            if (partnership.status === 'active') {
              eligibleEditorIds.add(partnership.editorId);
            }
          }
        }
        
        // Create notifications for all eligible editors
        if (eligibleEditorIds.size > 0) {
          const notifications = Array.from(eligibleEditorIds).map(editorId => ({
            partnerId,
            recipientId: editorId,
            type: 'order_created',
            title: 'New Order Available',
            body: `Order #${order.orderNumber} has been submitted and is available for assignment.`,
            orderId: order.id,
            jobId: order.jobId,
            read: false
          }));
          
          await storage.createNotifications(notifications);
          console.log(`Created ${notifications.length} notifications for order ${order.orderNumber}`);
        }
      } catch (notificationError) {
        // Log error but don't fail the order creation
        console.error("Failed to create order notifications:", notificationError);
      }

      // Return the complete order details
      const orderServices = await storage.getOrderServices(order.id);
      const orderFiles = await storage.getOrderFiles(order.id);

      res.status(201).json({
        order,
        services: orderServices,
        files: orderFiles
      });
    } catch (error) {
      console.error("Error submitting order:", error);
      res.status(500).json({ error: "Failed to submit order" });
    }
  });

  // Dashboard stats
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const jobs = await storage.getJobs();
      const orders = await storage.getOrders();
      const customers = await storage.getCustomers();
      
      const totalJobs = jobs.length;
      const totalOrders = orders.length;
      const totalSales = jobs.reduce((sum, job) => sum + parseFloat(job.totalValue || "0"), 0);
      
      res.json({
        jobs: totalJobs,
        orders: totalOrders,
        sales: totalSales.toFixed(2),
        customers: customers.length
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  // Firebase Auth - Public Signup endpoint (always creates partner)
  const publicSignupSchema = z.object({
    uid: z.string(),
    email: z.string().email()
  });

  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { uid, email } = publicSignupSchema.parse(req.body);
      
      // Public signups always create partner accounts
      const docId = await createUserDocument(uid, email, "partner");
      
      res.status(201).json({ 
        success: true, 
        docId, 
        role: "partner",
        message: "Partner account created successfully in Firestore" 
      });
    } catch (error: any) {
      console.error("Error creating partner account:", error);
      res.status(500).json({ 
        error: "Failed to create partner account", 
        details: error.message 
      });
    }
  });

  // Firebase Auth - Team Member Signup with invite token
  const teamSignupSchema = z.object({
    uid: z.string(),
    email: z.string().email(),
    inviteToken: z.string()
  });

  app.post("/api/auth/team-signup", async (req, res) => {
    try {
      const { uid, email, inviteToken } = teamSignupSchema.parse(req.body);
      
      // Get pending invite
      const invite = await getPendingInvite(inviteToken);
      if (!invite) {
        return res.status(400).json({ error: "Invalid or expired invite token" });
      }
      
      if (invite.email.toLowerCase() !== email.toLowerCase()) {
        return res.status(400).json({ 
          error: "Email doesn't match invite", 
          expected: invite.email,
          received: email 
        });
      }
      
      // Create user document with invite details
      const docId = await createUserDocument(uid, email, invite.role, invite.partnerId);
      
      // Update invite status
      await updateInviteStatus(inviteToken, "accepted");
      
      res.status(201).json({ 
        success: true, 
        docId,
        role: invite.role,
        partnerId: invite.partnerId,
        message: "Team member account created successfully" 
      });
    } catch (error: any) {
      console.error("Error creating team member account:", error);
      res.status(500).json({ 
        error: "Failed to create team member account", 
        details: error.message 
      });
    }
  });

  // Firebase Auth - Complete Invite Signup (team members use this)
  const completeInviteSchema = z.object({
    uid: z.string(),
    email: z.string().email(),
    token: z.string()
  });

  app.post("/api/auth/complete-invite", async (req, res) => {
    try {
      const { uid, email, token } = completeInviteSchema.parse(req.body);
      
      // 1. Validate invite token
      const invite = await getPendingInvite(token);
      if (!invite) {
        return res.status(400).json({ error: "Invalid or expired invite token" });
      }
      
      if (invite.email.toLowerCase() !== email.toLowerCase()) {
        return res.status(400).json({ 
          error: "Email doesn't match invite", 
          expected: invite.email,
          received: email 
        });
      }
      
      // 2. Create user document with invite role and partnerId
      const docId = await createUserDocument(uid, email, invite.role, invite.partnerId);
      
      // 3. Update invite status to accepted
      await updateInviteStatus(token, "accepted");
      
      console.log(`Team member ${email} completed invite signup with role ${invite.role} for partnerId ${invite.partnerId}`);
      
      res.status(201).json({ 
        success: true,
        message: "Team member account created",
        role: invite.role,
        partnerId: invite.partnerId
      });
    } catch (error: any) {
      console.error("Error completing invite signup:", error);
      res.status(500).json({ 
        error: "Failed to complete invite signup", 
        details: error.message 
      });
    }
  });

  // Firebase Auth - Editor Signup endpoint (completely separate from partners)
  const editorSignupSchema = z.object({
    uid: z.string(),
    email: z.string().email(),
    businessName: z.string(),
    specialties: z.string(),
    experience: z.string(),
    portfolio: z.string().optional()
  });

  app.post("/api/auth/editor-signup", async (req, res) => {
    try {
      const { uid, email, businessName, specialties, experience, portfolio } = editorSignupSchema.parse(req.body);
      
      // Create editor account (no partnerId needed)
      const docId = await createUserDocument(uid, email, "editor");
      
      // Add additional editor profile data
      await adminDb.collection('editors').doc(uid).set({
        uid,
        businessName,
        specialties,
        experience,
        portfolio: portfolio || '',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      res.status(201).json({ 
        success: true, 
        docId, 
        role: "editor",
        message: "Editor account created successfully. Your application is under review." 
      });
    } catch (error: any) {
      console.error("Error creating editor account:", error);
      res.status(500).json({ 
        error: "Failed to create editor account", 
        details: error.message 
      });
    }
  });

  // Firebase Auth - Get User Data endpoint
  app.get("/api/auth/user/:uid", async (req, res) => {
    try {
      const { uid } = req.params;
      
      const userData = await getUserDocument(uid);
      if (!userData) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json(userData);
    } catch (error: any) {
      console.error("Error getting user data:", error);
      res.status(500).json({ 
        error: "Failed to get user data", 
        details: error.message 
      });
    }
  });

  // Team Management - Invite team member
  const inviteSchema = z.object({
    name: z.string(),
    email: z.string().email(),
    role: z.enum(["admin", "photographer"])
  });

  app.post("/api/team/invite", async (req, res) => {
    try {
      const { name, email, role } = inviteSchema.parse(req.body);
      
      // Get current user (should be partner)
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: "Authorization header required" });
      }
      
      // For now, we'll extract uid from a simple bearer token
      // In production, you'd verify the Firebase ID token
      const uid = authHeader.replace('Bearer ', '');
      
      const currentUser = await getUserDocument(uid);
      if (!currentUser || currentUser.role !== 'partner') {
        return res.status(403).json({ error: "Only partners can invite team members" });
      }
      
      // Create pending invite
      const inviteToken = await createPendingInvite(email, role as UserRole, currentUser.partnerId!, uid);
      
      // In a real implementation, you'd send an email here
      const inviteLink = `${req.protocol}://${req.get('host')}/signup?invite=${inviteToken}`;
      
      res.status(201).json({ 
        success: true, 
        inviteToken,
        inviteLink,
        message: `Team member invite created for ${email}` 
      });
    } catch (error: any) {
      console.error("Error creating team invite:", error);
      res.status(500).json({ 
        error: "Failed to create team invite", 
        details: error.message 
      });
    }
  });

  // Get invite information for signup page (public endpoint)
  app.get("/api/team/invite-info/:token", async (req, res) => {
    try {
      const { token } = req.params;
      
      const invite = await getPendingInvite(token);
      if (!invite || invite.status !== 'pending') {
        return res.status(404).json({ error: "Invalid or expired invite" });
      }
      
      // Return only public info needed for signup page
      res.json({
        email: invite.email,
        role: invite.role,
        isValid: true
      });
    } catch (error: any) {
      console.error("Error getting invite info:", error);
      res.status(500).json({ 
        error: "Failed to get invite info", 
        details: error.message 
      });
    }
  });

  // Get pending invites for a partner
  app.get("/api/team/invites/:partnerId", async (req, res) => {
    try {
      const { partnerId } = req.params;
      
      // Get pending invites for this partner
      const invitesSnapshot = await adminDb.collection('pendingInvites')
        .where('partnerId', '==', partnerId)
        .get();
      
      const invites = invitesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      res.json(invites);
    } catch (error: any) {
      console.error("Error getting team invites:", error);
      res.status(500).json({ 
        error: "Failed to get team invites", 
        details: error.message 
      });
    }
  });

  // Jobs endpoints
  app.get("/api/jobs/card/:jobId", async (req, res) => {
    try {
      const job = await storage.getJobByJobId(req.params.jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      // Get customer information if customerId exists
      let customer = null;
      if (job.customerId) {
        customer = await storage.getCustomer(job.customerId);
      }
      
      // Return job with customer data
      res.json({
        ...job,
        customer
      });
    } catch (error: any) {
      console.error("Error fetching job card:", error);
      res.status(500).json({ error: "Failed to fetch job card" });
    }
  });

  app.get("/api/jobs", async (req, res) => {
    try {
      // Get all jobs (with optional partner filtering)
      const jobs = await storage.getJobs();
      res.json(jobs);
    } catch (error: any) {
      console.error("Error getting jobs:", error);
      res.status(500).json({ 
        error: "Failed to get jobs", 
        details: error.message 
      });
    }
  });

  app.post("/api/jobs", async (req, res) => {
    try {
      const jobData = insertJobSchema.parse(req.body);
      const job = await storage.createJob(jobData);
      res.status(201).json(job);
    } catch (error: any) {
      console.error("Error creating job:", error);
      res.status(500).json({ 
        error: "Failed to create job", 
        details: error.message 
      });
    }
  });

  // New endpoint for jobs that have associated orders (for upload page)
  app.get("/api/jobs-with-orders", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const jobs = await storage.getJobs(req.user?.partnerId);
      const orders = await storage.getOrders(req.user?.partnerId);
      
      // Filter jobs to only include those with associated orders
      const jobsWithOrders = jobs.filter(job => {
        return orders.some(order => 
          order.jobId === job.id || // Match by UUID
          order.jobId === job.jobId // Match by NanoID
        );
      });
      
      console.log(`[JOBS-WITH-ORDERS] Found ${jobsWithOrders.length} jobs with orders out of ${jobs.length} total jobs`);
      res.json(jobsWithOrders);
    } catch (error: any) {
      console.error("Error fetching jobs with orders:", error);
      res.status(500).json({ error: "Failed to fetch jobs with orders" });
    }
  });

  // Customers endpoints
  app.get("/api/customers", async (req, res) => {
    try {
      const customers = await storage.getCustomers();
      res.json(customers);
    } catch (error: any) {
      console.error("Error getting customers:", error);
      res.status(500).json({ 
        error: "Failed to get customers", 
        details: error.message 
      });
    }
  });

  app.post("/api/customers", async (req, res) => {
    try {
      const customerData = insertCustomerSchema.parse(req.body);
      const customer = await storage.createCustomer(customerData);
      res.status(201).json(customer);
    } catch (error: any) {
      console.error("Error creating customer:", error);
      res.status(500).json({ 
        error: "Failed to create customer", 
        details: error.message 
      });
    }
  });

  // Products endpoints
  app.get("/api/products", async (req, res) => {
    try {
      const products = await storage.getProducts();
      res.json(products);
    } catch (error: any) {
      console.error("Error getting products:", error);
      res.status(500).json({ 
        error: "Failed to get products", 
        details: error.message 
      });
    }
  });

  app.post("/api/products", async (req, res) => {
    try {
      const productData = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(productData);
      res.status(201).json(product);
    } catch (error: any) {
      console.error("Error creating product:", error);
      if (error.name === 'ZodError') {
        res.status(400).json({ 
          error: "Invalid product data", 
          details: error.errors 
        });
      } else {
        res.status(500).json({ 
          error: "Failed to create product", 
          details: error.message 
        });
      }
    }
  });

  // Orders endpoints
  app.get("/api/orders", async (req, res) => {
    try {
      const orders = await storage.getOrders();
      res.json(orders);
    } catch (error: any) {
      console.error("Error getting orders:", error);
      res.status(500).json({ 
        error: "Failed to get orders", 
        details: error.message 
      });
    }
  });

  app.post("/api/orders", async (req, res) => {
    try {
      const orderData = insertOrderSchema.parse(req.body);
      const order = await storage.createOrder(orderData);
      res.status(201).json(order);
    } catch (error: any) {
      console.error("Error creating order:", error);
      if (error.name === 'ZodError') {
        res.status(400).json({ 
          error: "Invalid order data", 
          details: error.errors 
        });
      } else {
        res.status(500).json({ 
          error: "Failed to create order", 
          details: error.message 
        });
      }
    }
  });

  // Notifications - All endpoints require authentication
  app.get("/api/notifications", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Only return notifications for the authenticated user with proper tenant filtering
      const notifications = await storage.getNotificationsForUser(
        req.user.uid, 
        req.user.partnerId || ''
      );
      
      res.json(notifications);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  // Validation schema for marking notification as read (empty body is valid)
  const markReadSchema = z.object({}).strict();

  app.patch("/api/notifications/:id/read", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Validate notification ID parameter
      if (!req.params.id || typeof req.params.id !== 'string') {
        return res.status(400).json({ error: "Invalid notification ID" });
      }

      // Validate empty request body
      try {
        markReadSchema.parse(req.body);
      } catch (validationError) {
        return res.status(400).json({ error: "Invalid request body" });
      }

      // Verify ownership before allowing the update
      const notification = await storage.markNotificationRead(req.params.id, req.user.uid);
      
      if (!notification) {
        return res.status(404).json({ error: "Notification not found or access denied" });
      }
      
      res.json(notification);
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  // Validation schema for mark-all-read request (empty body is valid)
  const markAllReadSchema = z.object({}).strict();

  app.post("/api/notifications/mark-all-read", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Validate empty request body
      try {
        markAllReadSchema.parse(req.body);
      } catch (validationError) {
        return res.status(400).json({ error: "Invalid request body" });
      }

      // Only mark notifications for the authenticated user with proper tenant scoping
      await storage.markAllNotificationsRead(req.user.uid, req.user.partnerId || '');
      
      res.json({ message: "All notifications marked as read" });
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
      res.status(500).json({ error: "Failed to mark all notifications as read" });
    }
  });
  
  // Partnership Management Routes

  // Partner invites editor to partnership
  const partnershipInviteSchema = z.object({
    editorEmail: z.string().email(),
    editorStudioName: z.string()
  });

  app.post("/api/partnerships/invite", async (req, res) => {
    try {
      const { editorEmail, editorStudioName } = partnershipInviteSchema.parse(req.body);
      
      // Get current user (should be partner)
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: "Authorization header required" });
      }
      
      const idToken = authHeader.replace('Bearer ', '');
      // Verify the Firebase ID token and extract the UID
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      const uid = decodedToken.uid;
      const currentUser = await getUserDocument(uid);
      if (!currentUser || currentUser.role !== 'partner') {
        return res.status(403).json({ error: "Only partners can invite editors" });
      }
      
      // Check if partnership already exists
      const existingPartnerships = await getPartnerPartnerships(currentUser.partnerId!);
      const partnershipExists = existingPartnerships.some(p => p.editorEmail === editorEmail);
      
      if (partnershipExists) {
        return res.status(400).json({ error: "Partnership already exists with this editor" });
      }
      
      // Create partnership invite
      const inviteToken = await createPartnershipInvite(
        editorEmail,
        editorStudioName,
        currentUser.partnerId!,
        `${currentUser.email}`, // Using email as partner name for now
        currentUser.email
      );
      
      res.status(201).json({ 
        success: true, 
        inviteToken,
        message: `Partnership invite sent to ${editorEmail}` 
      });
    } catch (error: any) {
      console.error("Error creating partnership invite:", error);
      res.status(500).json({ 
        error: "Failed to create partnership invite", 
        details: error.message 
      });
    }
  });

  // Editor accepts partnership invite
  app.post("/api/partnerships/accept/:token", async (req, res) => {
    try {
      const { token } = req.params;
      
      // Get current user (should be editor)
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: "Authorization header required" });
      }
      
      const idToken = authHeader.replace('Bearer ', '');
      // Verify the Firebase ID token and extract the UID
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      const uid = decodedToken.uid;
      const currentUser = await getUserDocument(uid);
      if (!currentUser || currentUser.role !== 'editor') {
        return res.status(403).json({ error: "Only editors can accept partnership invites" });
      }
      
      // Get and validate invite
      const invite = await getPartnershipInvite(token);
      if (!invite) {
        return res.status(400).json({ error: "Invalid or expired invite token" });
      }
      
      if (invite.editorEmail.toLowerCase() !== currentUser.email?.toLowerCase()) {
        return res.status(400).json({ error: "This invite is not for your email address" });
      }
      
      // Create active partnership
      const partnershipId = await createPartnership(
        currentUser.uid,
        currentUser.email,
        invite.editorStudioName,
        invite.partnerId,
        invite.partnerName,
        invite.partnerEmail
      );
      
      // Update invite status
      await updatePartnershipInviteStatus(token, "accepted");
      
      res.status(201).json({ 
        success: true,
        partnershipId,
        message: "Partnership accepted successfully" 
      });
    } catch (error: any) {
      console.error("Error accepting partnership:", error);
      res.status(500).json({ 
        error: "Failed to accept partnership", 
        details: error.message 
      });
    }
  });

  // Get editor's pending partnership invites
  app.get("/api/partnerships/pending", async (req, res) => {
    try {
      // Get current user (should be editor)
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: "Authorization header required" });
      }
      
      const idToken = authHeader.replace('Bearer ', '');
      // Verify the Firebase ID token and extract the UID
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      const uid = decodedToken.uid;
      const currentUser = await getUserDocument(uid);
      if (!currentUser || currentUser.role !== 'editor') {
        return res.status(403).json({ error: "Only editors can view their pending invites" });
      }
      
      const pendingInvites = await getEditorPendingInvites(currentUser.email);
      res.json(pendingInvites);
    } catch (error: any) {
      console.error("Error getting pending invites:", error);
      res.status(500).json({ 
        error: "Failed to get pending invites", 
        details: error.message 
      });
    }
  });

  // Get partner's partnerships (for partnerships display)
  app.get("/api/partnerships", async (req, res) => {
    try {
      // Get current user (should be partner)
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: "Authorization header required" });
      }
      
      const idToken = authHeader.replace('Bearer ', '');
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      const uid = decodedToken.uid;
      const currentUser = await getUserDocument(uid);
      if (!currentUser || currentUser.role !== 'partner') {
        return res.status(403).json({ error: "Only partners can view their partnerships" });
      }
      
      const partnerships = await getPartnerPartnerships(currentUser.partnerId!);
      res.json(partnerships);
    } catch (error: any) {
      console.error("Error getting partner partnerships:", error);
      res.status(500).json({ 
        error: "Failed to get partnerships", 
        details: error.message 
      });
    }
  });

  // Get editor's partnerships 
  app.get("/api/editor/partnerships", async (req, res) => {
    try {
      // Get current user (should be editor)
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: "Authorization header required" });
      }
      
      const idToken = authHeader.replace('Bearer ', '');
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      const uid = decodedToken.uid;
      const currentUser = await getUserDocument(uid);
      if (!currentUser || currentUser.role !== 'editor') {
        return res.status(403).json({ error: "Only editors can view their partnerships" });
      }
      
      const partnerships = await getEditorPartnerships(currentUser.uid);
      res.json(partnerships);
    } catch (error: any) {
      console.error("Error getting editor partnerships:", error);
      res.status(500).json({ 
        error: "Failed to get partnerships", 
        details: error.message 
      });
    }
  });

  // Get partner's partnerships (for suppliers dropdown)
  app.get("/api/partnerships/suppliers", async (req, res) => {
    try {
      // Get current user (should be partner)
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: "Authorization header required" });
      }
      
      const idToken = authHeader.replace('Bearer ', '');
      // Verify the Firebase ID token and extract the UID
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      const uid = decodedToken.uid;
      const currentUser = await getUserDocument(uid);
      if (!currentUser || currentUser.role !== 'partner') {
        return res.status(403).json({ error: "Only partners can view their suppliers" });
      }
      
      const partnerships = await getPartnerPartnerships(currentUser.partnerId!);
      
      // Format for suppliers dropdown
      const suppliers = partnerships.map(partnership => ({
        id: partnership.editorId,
        firstName: partnership.editorStudioName.split(' ')[0] || partnership.editorStudioName,
        lastName: partnership.editorStudioName.split(' ').slice(1).join(' ') || '',
        email: partnership.editorEmail,
        role: 'editor',
        studioName: partnership.editorStudioName
      }));
      
      res.json(suppliers);
    } catch (error: any) {
      console.error("Error getting partner suppliers:", error);
      res.status(500).json({ 
        error: "Failed to get suppliers", 
        details: error.message 
      });
    }
  });

  // Team Assignment System Routes
  
  // Get pending orders for team assignment
  app.get("/api/team/pending-orders", async (req, res) => {
    try {
      // Get current user (should be partner/admin)
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: "Authorization header required" });
      }
      
      const idToken = authHeader.replace('Bearer ', '');
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      const uid = decodedToken.uid;
      const currentUser = await getUserDocument(uid);
      
      if (!currentUser || !['partner', 'admin'].includes(currentUser.role)) {
        return res.status(403).json({ error: "Only partners and admins can view pending orders" });
      }
      
      if (!currentUser.partnerId) {
        return res.status(400).json({ error: "User must have a partnerId" });
      }
      
      // Get pending orders for this partner
      const pendingOrders = await storage.getPendingOrders(currentUser.partnerId);
      
      // Enrich orders with customer and job details
      const enrichedOrders = await Promise.all(
        pendingOrders.map(async (order) => {
          const customer = order.customerId ? await storage.getCustomer(order.customerId) : null;
          const job = order.jobId ? await storage.getJob(order.jobId) : null;
          const orderServices = await storage.getOrderServices(order.id);
          
          return {
            ...order,
            customerName: customer ? `${customer.firstName} ${customer.lastName}` : 'Unknown Customer',
            customerEmail: customer?.email || '',
            address: job?.address || 'No address provided',
            serviceCount: orderServices.length,
            services: orderServices
          };
        })
      );
      
      res.json(enrichedOrders);
    } catch (error: any) {
      console.error("Error getting pending orders:", error);
      res.status(500).json({ 
        error: "Failed to get pending orders", 
        details: error.message 
      });
    }
  });
  
  // Get team editors for assignment
  app.get("/api/team/editors", async (req, res) => {
    try {
      // Get current user (should be partner/admin)
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: "Authorization header required" });
      }
      
      const idToken = authHeader.replace('Bearer ', '');
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      const uid = decodedToken.uid;
      const currentUser = await getUserDocument(uid);
      
      if (!currentUser || !['partner', 'admin'].includes(currentUser.role)) {
        return res.status(403).json({ error: "Only partners and admins can view team editors" });
      }
      
      if (!currentUser.partnerId) {
        return res.status(400).json({ error: "User must have a partnerId" });
      }
      
      // Get active partnerships to find team editors
      const partnerships = await getPartnerPartnerships(currentUser.partnerId);
      
      // Format for team assignment dropdown
      const teamEditors = partnerships.map(partnership => ({
        id: partnership.editorId,
        email: partnership.editorEmail,
        studioName: partnership.editorStudioName,
        name: partnership.editorStudioName,
        isActive: partnership.isActive
      }));
      
      res.json(teamEditors);
    } catch (error: any) {
      console.error("Error getting team editors:", error);
      res.status(500).json({ 
        error: "Failed to get team editors", 
        details: error.message 
      });
    }
  });
  
  // Assign order to editor
  const assignOrderSchema = z.object({
    orderId: z.string(),
    editorId: z.string()
  });
  
  app.post("/api/team/assign-order", async (req, res) => {
    try {
      const { orderId, editorId } = assignOrderSchema.parse(req.body);
      
      // Get current user (should be partner/admin)
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: "Authorization header required" });
      }
      
      const idToken = authHeader.replace('Bearer ', '');
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      const uid = decodedToken.uid;
      const currentUser = await getUserDocument(uid);
      
      if (!currentUser || !['partner', 'admin'].includes(currentUser.role)) {
        return res.status(403).json({ error: "Only partners and admins can assign orders" });
      }
      
      if (!currentUser.partnerId) {
        return res.status(400).json({ error: "User must have a partnerId" });
      }
      
      // Verify order exists and belongs to this partner
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      
      if (order.partnerId !== currentUser.partnerId) {
        return res.status(403).json({ error: "Order does not belong to your organization" });
      }
      
      // Verify editor is part of the team (critical security validation)
      const partnerships = await getPartnerPartnerships(currentUser.partnerId);
      const editorPartnership = partnerships.find(p => p.editorId === editorId && p.isActive);
      
      if (!editorPartnership) {
        return res.status(403).json({ 
          error: "Editor not in your team", 
          message: "The selected editor is not an active member of your team" 
        });
      }
      
      // Attempt atomic assignment
      const assignedOrder = await storage.assignOrderToEditor(orderId, editorId);
      
      if (!assignedOrder) {
        return res.status(409).json({ error: "Order is no longer available for assignment" });
      }

      // Log activity: Order Assignment
      try {
        await storage.createActivity({
          partnerId: currentUser.partnerId,
          orderId: order.id,
          jobId: order.jobId,
          userId: currentUser.uid,
          userEmail: currentUser.email,
          userName: `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.email,
          action: "assignment",
          category: "order",
          title: "Order Assigned",
          description: `Order #${order.orderNumber} assigned to editor`,
          metadata: JSON.stringify({
            orderNumber: order.orderNumber,
            editorId: editorId,
            editorEmail: editorPartnership.editorEmail,
            editorStudioName: editorPartnership.editorStudioName,
            assignedBy: currentUser.email,
            assignedAt: new Date().toISOString()
          }),
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });
      } catch (activityError) {
        console.error("Failed to log order assignment activity:", activityError);
      }
      
      // Create notification for the assigned editor
      try {
        await storage.createNotification({
          partnerId: currentUser.partnerId,
          recipientId: editorId,
          type: 'order_assigned',
          title: 'Order Assigned to You',
          body: `Order #${order.orderNumber} has been assigned to you. Please review and begin processing.`,
          orderId: order.id,
          jobId: order.jobId,
          read: false
        });
        console.log(`Created assignment notification for editor ${editorId} on order ${order.orderNumber}`);
      } catch (notificationError) {
        // Log error but don't fail the assignment
        console.error("Failed to create assignment notification:", notificationError);
      }
      
      res.json({
        success: true,
        message: `Order ${order.orderNumber} assigned to ${editorPartnership.editorStudioName}`,
        order: assignedOrder
      });
    } catch (error: any) {
      console.error("Error assigning order:", error);
      if (error.name === 'ZodError') {
        res.status(400).json({ 
          error: "Invalid assignment data", 
          details: error.errors 
        });
      } else {
        res.status(500).json({ 
          error: "Failed to assign order", 
          details: error.message 
        });
      }
    }
  });

  // ===== EDITOR SERVICE MANAGEMENT ENDPOINTS =====

  // Get all jobs assigned to an editor
  app.get("/api/editor/jobs", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: "Authorization header required" });
      }
      
      const idToken = authHeader.replace('Bearer ', '');
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      const uid = decodedToken.uid;
      const currentUser = await getUserDocument(uid);
      if (!currentUser || currentUser.role !== 'editor') {
        return res.status(403).json({ error: "Only editors can view their jobs" });
      }
      
      const jobs = await storage.getEditorJobs(uid);
      res.json(jobs);
    } catch (error: any) {
      console.error("Error getting editor jobs:", error);
      res.status(500).json({ 
        error: "Failed to get editor jobs", 
        details: error.message 
      });
    }
  });

  // Update job status (for editor workflow actions)
  app.patch("/api/editor/jobs/:jobId/status", async (req, res) => {
    try {
      const { jobId } = req.params;
      const { status } = req.body;
      
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: "Authorization header required" });
      }
      
      const idToken = authHeader.replace('Bearer ', '');
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      const uid = decodedToken.uid;
      const currentUser = await getUserDocument(uid);
      if (!currentUser || currentUser.role !== 'editor') {
        return res.status(403).json({ error: "Only editors can update job status" });
      }
      
      const updatedOrder = await storage.updateOrderStatus(jobId, status, uid);
      if (!updatedOrder) {
        return res.status(404).json({ error: "Job not found or not assigned to you" });
      }

      // Log activity: Status Change
      try {
        await storage.createActivity({
          partnerId: currentUser.partnerId || '',
          orderId: updatedOrder.id,
          jobId: updatedOrder.jobId,
          userId: currentUser.uid,
          userEmail: currentUser.email,
          userName: `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.email,
          action: "status_change",
          category: "order",
          title: "Status Updated",
          description: `Order status changed to ${status}`,
          metadata: JSON.stringify({
            orderNumber: updatedOrder.orderNumber,
            previousStatus: "processing", // Could be improved by tracking previous status
            newStatus: status,
            editorId: uid,
            changedAt: new Date().toISOString()
          }),
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });
      } catch (activityError) {
        console.error("Failed to log status change activity:", activityError);
      }
      
      res.json({ success: true, status: updatedOrder.status });
    } catch (error: any) {
      console.error("Error updating job status:", error);
      res.status(500).json({ 
        error: "Failed to update job status", 
        details: error.message 
      });
    }
  });

  // Download job files as zip
  app.get("/api/editor/jobs/:jobId/download", async (req, res) => {
    try {
      const { jobId } = req.params;
      
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: "Authorization header required" });
      }
      
      const idToken = authHeader.replace('Bearer ', '');
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      const uid = decodedToken.uid;
      const currentUser = await getUserDocument(uid);
      if (!currentUser || currentUser.role !== 'editor') {
        return res.status(403).json({ error: "Only editors can download job files" });
      }
      
      // Find the job first, then get associated order
      const job = await storage.getJobByJobId(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      // Get associated order using jobId
      const allOrders = await storage.getOrders();
      const order = allOrders.find(o => o.jobId === job.jobId);
      if (!order || order.assignedTo !== uid) {
        return res.status(404).json({ error: "Job not found or not assigned to you" });
      }
      
      // Get order files and services (for instructions)
      const orderFiles = await storage.getOrderFiles(order.id);
      const orderServices = await storage.getOrderServices(order.id);
      
      if (orderFiles.length === 0) {
        return res.status(404).json({ error: "No files found for this job" });
      }
      
      // Create zip file
      const zip = new JSZip();
      let zipGenerationFailed = false;
      
      // Add instructions file if any
      if (orderServices.length > 0) {
        let instructionsContent = `Job: ${order.orderNumber}\nInstructions:\n\n`;
        orderServices.forEach((service, index) => {
          instructionsContent += `Service ${index + 1}:\n`;
          if (service.instructions) {
            try {
              const instructions = typeof service.instructions === 'string' 
                ? JSON.parse(service.instructions) 
                : service.instructions;
              if (Array.isArray(instructions)) {
                instructions.forEach(inst => {
                  instructionsContent += `- File: ${inst.fileName || 'N/A'}\n`;
                  instructionsContent += `  Details: ${inst.detail || 'N/A'}\n`;
                });
              } else {
                instructionsContent += `- ${JSON.stringify(instructions)}\n`;
              }
            } catch (e) {
              instructionsContent += `- ${service.instructions}\n`;
            }
          }
          if (service.exportTypes) {
            try {
              const exportTypes = typeof service.exportTypes === 'string' 
                ? JSON.parse(service.exportTypes) 
                : service.exportTypes;
              instructionsContent += `Export Types:\n`;
              if (Array.isArray(exportTypes)) {
                exportTypes.forEach(exp => {
                  instructionsContent += `  - ${exp.type || 'N/A'}: ${exp.description || 'N/A'}\n`;
                });
              } else {
                instructionsContent += `  - ${JSON.stringify(exportTypes)}\n`;
              }
            } catch (e) {
              instructionsContent += `Export Types: ${service.exportTypes}\n`;
            }
          }
          instructionsContent += '\n';
        });
        
        zip.file('instructions.txt', instructionsContent);
      }
      
      // Download each file and add to zip
      for (const file of orderFiles) {
        try {
          // Validate URL is from Firebase Storage to prevent SSRF
          if (!file.downloadUrl.includes('googleapis.com') && !file.downloadUrl.includes('firebasestorage.app')) {
            console.error(`Skipping potentially unsafe URL: ${file.downloadUrl}`);
            continue;
          }
          
          const response = await fetch(file.downloadUrl);
          if (response.ok) {
            const buffer = await response.arrayBuffer();
            zip.file(file.originalName, buffer);
          }
        } catch (error) {
          console.error(`Failed to download file ${file.originalName}:`, error);
          // Continue with other files
        }
      }
      
      // Generate zip buffer
      let zipBuffer;
      try {
        zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
      } catch (error) {
        zipGenerationFailed = true;
        console.error('Failed to generate zip file:', error);
        return res.status(500).json({ error: 'Failed to generate download archive' });
      }
      
      // Only mark as downloaded after successful zip generation
      try {
        await storage.markOrderDownloaded(order.id, uid);
      } catch (error) {
        console.error('Failed to update download status:', error);
        // Continue with download even if status update fails
      }
      
      // Set response headers for file download
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="job_${order.orderNumber}_files.zip"`);
      res.setHeader('Content-Length', zipBuffer.length);
      
      res.send(zipBuffer);
    } catch (error: any) {
      console.error("Error downloading job files:", error);
      res.status(500).json({ 
        error: "Failed to download job files", 
        details: error.message 
      });
    }
  });

  // Get all service categories for an editor
  app.get("/api/editor/service-categories", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: "Authorization header required" });
      }
      
      const idToken = authHeader.replace('Bearer ', '');
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      const uid = decodedToken.uid;
      const currentUser = await getUserDocument(uid);
      if (!currentUser || currentUser.role !== 'editor') {
        return res.status(403).json({ error: "Only editors can view their service categories" });
      }
      
      const categories = await storage.getServiceCategories(uid);
      res.json(categories);
    } catch (error: any) {
      console.error("Error getting service categories:", error);
      res.status(500).json({ 
        error: "Failed to get service categories", 
        details: error.message 
      });
    }
  });

  // Get service categories for a specific editor (for upload process)
  app.get("/api/editor/:editorId/service-categories", async (req, res) => {
    try {
      const { editorId } = req.params;
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: "Authorization header required" });
      }
      
      const idToken = authHeader.replace('Bearer ', '');
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      const uid = decodedToken.uid;
      const currentUser = await getUserDocument(uid);
      if (!currentUser || (currentUser.role !== 'partner' && currentUser.role !== 'photographer')) {
        return res.status(403).json({ error: "Only partners and photographers can view editor service categories" });
      }
      
      const categories = await storage.getServiceCategories(editorId);
      res.json(categories);
    } catch (error: any) {
      console.error("Error getting editor service categories:", error);
      res.status(500).json({ 
        error: "Failed to get editor service categories", 
        details: error.message 
      });
    }
  });

  // Create a new service category
  app.post("/api/editor/service-categories", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: "Authorization header required" });
      }
      
      const idToken = authHeader.replace('Bearer ', '');
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      const uid = decodedToken.uid;
      const currentUser = await getUserDocument(uid);
      if (!currentUser || currentUser.role !== 'editor') {
        return res.status(403).json({ error: "Only editors can create service categories" });
      }
      
      const categoryData = insertServiceCategorySchema.parse({
        ...req.body,
        editorId: uid
      });
      
      const category = await storage.createServiceCategory(categoryData);
      res.status(201).json(category);
    } catch (error: any) {
      console.error("Error creating service category:", error);
      res.status(500).json({ 
        error: "Failed to create service category", 
        details: error.message 
      });
    }
  });

  // Update a service category
  app.patch("/api/editor/service-categories/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: "Authorization header required" });
      }
      
      const idToken = authHeader.replace('Bearer ', '');
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      const uid = decodedToken.uid;
      const currentUser = await getUserDocument(uid);
      if (!currentUser || currentUser.role !== 'editor') {
        return res.status(403).json({ error: "Only editors can update their service categories" });
      }
      
      const category = await storage.updateServiceCategory(id, req.body, uid);
      res.json(category);
    } catch (error: any) {
      console.error("Error updating service category:", error);
      res.status(500).json({ 
        error: "Failed to update service category", 
        details: error.message 
      });
    }
  });

  // Delete a service category
  app.delete("/api/editor/service-categories/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: "Authorization header required" });
      }
      
      const idToken = authHeader.replace('Bearer ', '');
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      const uid = decodedToken.uid;
      const currentUser = await getUserDocument(uid);
      if (!currentUser || currentUser.role !== 'editor') {
        return res.status(403).json({ error: "Only editors can delete their service categories" });
      }
      
      await storage.deleteServiceCategory(id, uid);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting service category:", error);
      res.status(500).json({ 
        error: "Failed to delete service category", 
        details: error.message 
      });
    }
  });

  // Get all services for an editor
  app.get("/api/editor/services", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: "Authorization header required" });
      }
      
      const idToken = authHeader.replace('Bearer ', '');
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      const uid = decodedToken.uid;
      const currentUser = await getUserDocument(uid);
      if (!currentUser || currentUser.role !== 'editor') {
        return res.status(403).json({ error: "Only editors can view their services" });
      }
      
      const services = await storage.getEditorServices(uid);
      res.json(services);
    } catch (error: any) {
      console.error("Error getting editor services:", error);
      res.status(500).json({ 
        error: "Failed to get editor services", 
        details: error.message 
      });
    }
  });

  // Get services for a specific editor (for upload process)
  app.get("/api/editor/:editorId/services", async (req, res) => {
    try {
      const { editorId } = req.params;
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: "Authorization header required" });
      }
      
      const idToken = authHeader.replace('Bearer ', '');
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      const uid = decodedToken.uid;
      const currentUser = await getUserDocument(uid);
      if (!currentUser || (currentUser.role !== 'partner' && currentUser.role !== 'photographer')) {
        return res.status(403).json({ error: "Only partners and photographers can view editor services" });
      }
      
      const services = await storage.getEditorServices(editorId);
      res.json(services);
    } catch (error: any) {
      console.error("Error getting editor services:", error);
      res.status(500).json({ 
        error: "Failed to get editor services", 
        details: error.message 
      });
    }
  });

  // Create a new service
  app.post("/api/editor/services", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: "Authorization header required" });
      }
      
      const idToken = authHeader.replace('Bearer ', '');
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      const uid = decodedToken.uid;
      const currentUser = await getUserDocument(uid);
      if (!currentUser || currentUser.role !== 'editor') {
        return res.status(403).json({ error: "Only editors can create services" });
      }
      
      const serviceData = insertEditorServiceSchema.parse({
        ...req.body,
        editorId: uid
      });
      
      const service = await storage.createEditorService(serviceData);
      res.status(201).json(service);
    } catch (error: any) {
      console.error("Error creating editor service:", error);
      res.status(500).json({ 
        error: "Failed to create editor service", 
        details: error.message 
      });
    }
  });

  // Update a service
  app.patch("/api/editor/services/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: "Authorization header required" });
      }
      
      const idToken = authHeader.replace('Bearer ', '');
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      const uid = decodedToken.uid;
      const currentUser = await getUserDocument(uid);
      if (!currentUser || currentUser.role !== 'editor') {
        return res.status(403).json({ error: "Only editors can update their services" });
      }
      
      const service = await storage.updateEditorService(id, req.body, uid);
      res.json(service);
    } catch (error: any) {
      console.error("Error updating editor service:", error);
      res.status(500).json({ 
        error: "Failed to update editor service", 
        details: error.message 
      });
    }
  });

  // Delete a service
  app.delete("/api/editor/services/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: "Authorization header required" });
      }
      
      const idToken = authHeader.replace('Bearer ', '');
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      const uid = decodedToken.uid;
      const currentUser = await getUserDocument(uid);
      if (!currentUser || currentUser.role !== 'editor') {
        return res.status(403).json({ error: "Only editors can delete their services" });
      }
      
      await storage.deleteEditorService(id, uid);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting editor service:", error);
      res.status(500).json({ 
        error: "Failed to delete editor service", 
        details: error.message 
      });
    }
  });

  // Editor Upload System Endpoints
  
  // Get jobs ready for upload (completed processing, assigned to this editor)
  app.get("/api/editor/jobs-ready-for-upload", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: "Authorization header required" });
      }
      
      const idToken = authHeader.replace('Bearer ', '');
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      const uid = decodedToken.uid;
      const currentUser = await getUserDocument(uid);
      if (!currentUser || currentUser.role !== 'editor') {
        return res.status(403).json({ error: "Only editors can view jobs ready for upload" });
      }
      
      const jobs = await storage.getJobsReadyForUpload(uid);
      res.json(jobs);
    } catch (error: any) {
      console.error("Error getting jobs ready for upload:", error);
      res.status(500).json({ 
        error: "Failed to get jobs ready for upload", 
        details: error.message 
      });
    }
  });

  // Record uploaded deliverable files for a job
  app.post("/api/editor/jobs/:jobId/uploads", async (req, res) => {
    try {
      const { jobId } = req.params;
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: "Authorization header required" });
      }
      
      const idToken = authHeader.replace('Bearer ', '');
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      const uid = decodedToken.uid;
      const currentUser = await getUserDocument(uid);
      if (!currentUser || currentUser.role !== 'editor') {
        return res.status(403).json({ error: "Only editors can upload deliverables" });
      }

      // Validate request body with Zod
      const validationResult = editorUploadsSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid request data",
          details: validationResult.error.issues 
        });
      }
      
      const { uploads, notes } = validationResult.data;

      // Get job to verify editor assignment and get order info
      const job = await storage.getJobByJobId(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Get associated order to verify assignment and tenant isolation
      const allOrders = await storage.getOrders();
      const order = allOrders.find(o => o.jobId === job.id);
      if (!order || order.assignedTo !== uid) {
        return res.status(403).json({ error: "You are not assigned to this job" });
      }

      // Verify partnerId for tenant isolation
      if (job.partnerId !== currentUser.partnerId) {
        return res.status(403).json({ error: "Access denied: job belongs to different partner" });
      }

      // Create upload records for each file
      const uploadPromises = uploads.map((upload: any) => {
        const uploadData = {
          orderId: order.id,
          jobId: job.id,
          editorId: uid,
          fileName: upload.fileName,
          originalName: upload.originalName,
          fileSize: upload.fileSize,
          mimeType: upload.mimeType,
          firebaseUrl: upload.firebaseUrl,
          downloadUrl: upload.downloadUrl,
          notes: notes || null,
          expiresAt: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)) // 30 days from now
        };
        return storage.createEditorUpload(uploadData);
      });

      const createdUploads = await Promise.all(uploadPromises);
      
      // Mark order as uploaded (status: in_progress → completed)
      try {
        await storage.markOrderUploaded(order.id, uid);
        console.log(`Order ${order.orderNumber} marked as completed after upload`);
      } catch (error) {
        console.error('Failed to update upload status:', error);
        // Continue with success response even if status update fails
      }
      
      res.status(201).json({
        success: true,
        uploads: createdUploads,
        message: `${createdUploads.length} deliverable(s) uploaded successfully`
      });
    } catch (error: any) {
      console.error("Error uploading deliverables:", error);
      res.status(500).json({ 
        error: "Failed to upload deliverables", 
        details: error.message 
      });
    }
  });

  // Update job status after upload completion
  app.patch("/api/editor/jobs/:jobId/status", async (req, res) => {
    try {
      const { jobId } = req.params;
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: "Authorization header required" });
      }
      
      const idToken = authHeader.replace('Bearer ', '');
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      const uid = decodedToken.uid;
      const currentUser = await getUserDocument(uid);
      if (!currentUser || currentUser.role !== 'editor') {
        return res.status(403).json({ error: "Only editors can update job status" });
      }

      // Validate request body with Zod
      const validationResult = editorStatusUpdateSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid request data",
          details: validationResult.error.issues 
        });
      }
      
      const { status } = validationResult.data;

      // Get job to verify editor assignment
      const job = await storage.getJobByJobId(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Verify assignment through order and tenant isolation
      const allOrders = await storage.getOrders();
      const order = allOrders.find(o => o.jobId === job.id);
      if (!order || order.assignedTo !== uid) {
        return res.status(403).json({ error: "You are not assigned to this job" });
      }

      // Verify partnerId for tenant isolation
      if (job.partnerId !== currentUser.partnerId) {
        return res.status(403).json({ error: "Access denied: job belongs to different partner" });
      }

      // Update job status first
      const updatedJob = await storage.updateJobStatusAfterUpload(jobId, status);
      if (!updatedJob) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Also update order status using the new tracking method if completing upload
      let updatedOrder = order;
      if (status === 'completed') {
        updatedOrder = await storage.markOrderUploaded(order.id, uid) || order;
      }

      res.json({
        success: true,
        job: updatedJob,
        order: updatedOrder,
        message: `Job status updated to ${status}`
      });
    } catch (error: any) {
      console.error("Error updating job status:", error);
      res.status(500).json({ 
        error: "Failed to update job status", 
        details: error.message 
      });
    }
  });

  // Security helpers
  const validateFirebaseStorageUrl = (url: string): boolean => {
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
    if (!bucketName) return false;
    
    // Check if URL matches Firebase Storage pattern
    const firebaseStoragePattern = new RegExp(
      `^https://storage\.googleapis\.com/${bucketName.replace('.', '\\.')}/.+`
    );
    const firebaseDownloadPattern = new RegExp(
      `^https://firebasestorage\.googleapis\.com/v0/b/${bucketName.replace('.', '\\.')}/o/.+`
    );
    
    return firebaseStoragePattern.test(url) || firebaseDownloadPattern.test(url);
  };

  // Editor Upload Schemas
  const editorUploadFileSchema = z.object({
    fileName: z.string().min(1, "File name is required"),
    originalName: z.string().min(1, "Original name is required"),
    fileSize: z.number().positive("File size must be positive"),
    mimeType: z.string().min(1, "MIME type is required"),
    firebaseUrl: z.string().url("Invalid Firebase URL").refine(
      validateFirebaseStorageUrl,
      "Firebase URL must belong to the configured storage bucket"
    ),
    downloadUrl: z.string().url("Invalid download URL").refine(
      validateFirebaseStorageUrl, 
      "Download URL must belong to the configured storage bucket"
    )
  });

  const editorUploadsSchema = z.object({
    uploads: z.array(editorUploadFileSchema).min(1, "At least one upload is required"),
    notes: z.string().optional()
  });

  const editorStatusUpdateSchema = z.object({
    status: z.enum(['completed', 'submitted', 'in_revision'], {
      errorMap: () => ({ message: "Status must be one of: completed, submitted, in_revision" })
    })
  });

  // Order Reservation System
  const reserveOrderSchema = z.object({
    userId: z.string(),
    jobId: z.string()
  });

  app.post("/api/orders/reserve", async (req, res) => {
    try {
      const { userId, jobId } = reserveOrderSchema.parse(req.body);
      
      const reservation = await storage.reserveOrderNumber(userId, jobId);
      
      res.status(201).json({
        orderNumber: reservation.orderNumber,
        expiresAt: reservation.expiresAt,
        userId: reservation.userId,
        jobId: reservation.jobId
      });
    } catch (error: any) {
      console.error("Error reserving order number:", error);
      res.status(500).json({ 
        error: "Failed to reserve order number", 
        details: error.message 
      });
    }
  });

  app.get("/api/orders/reservation/:orderNumber", async (req, res) => {
    try {
      const { orderNumber } = req.params;
      
      const reservation = await storage.getReservation(orderNumber);
      if (!reservation) {
        return res.status(404).json({ error: "Reservation not found" });
      }
      
      res.json({
        orderNumber: reservation.orderNumber,
        expiresAt: reservation.expiresAt,
        userId: reservation.userId,
        jobId: reservation.jobId,
        status: reservation.status
      });
    } catch (error: any) {
      console.error("Error getting reservation:", error);
      res.status(500).json({ 
        error: "Failed to get reservation", 
        details: error.message 
      });
    }
  });

  const confirmReservationSchema = z.object({
    orderNumber: z.string()
  });

  app.post("/api/orders/confirm-reservation", async (req, res) => {
    try {
      const { orderNumber } = confirmReservationSchema.parse(req.body);
      
      const confirmed = await storage.confirmReservation(orderNumber);
      if (!confirmed) {
        return res.status(400).json({ error: "Failed to confirm reservation or reservation expired" });
      }
      
      res.json({ success: true, orderNumber });
    } catch (error: any) {
      console.error("Error confirming reservation:", error);
      res.status(500).json({ 
        error: "Failed to confirm reservation", 
        details: error.message 
      });
    }
  });

  // Configure multer for file uploads
  const upload = multer({
    dest: '/tmp/uploads',
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB limit
    },
  });

  // Server-side Firebase upload endpoint with reservation system
  app.post("/api/upload-firebase", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { userId, jobId, orderNumber } = req.body;
      
      if (!userId || !jobId || !orderNumber) {
        return res.status(400).json({ 
          error: "Missing required parameters: userId, jobId, and orderNumber are required" 
        });
      }

      // ENHANCED SECURITY: Comprehensive validation before processing upload
      
      // Step 1: Verify the reservation exists and is valid
      const reservation = await storage.getReservation(orderNumber);
      if (!reservation || reservation.status !== 'reserved') {
        return res.status(400).json({ error: "Invalid or expired order reservation" });
      }

      if (reservation.userId !== userId || reservation.jobId !== jobId) {
        return res.status(400).json({ error: "Order reservation does not match provided userId and jobId" });
      }

      // Check if reservation has expired
      if (new Date() > reservation.expiresAt) {
        return res.status(400).json({ error: "Order reservation has expired" });
      }

      // Step 2: Get user information and validate access based on role
      const user = await getUserDocument(userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      // Get job and order information for validation
      const job = await storage.getJobByJobId(jobId);
      if (!job) {
        console.log(`[UPLOAD DEBUG] Job not found for jobId: ${jobId}`);
        return res.status(404).json({ error: "Job not found" });
      }

      console.log(`[UPLOAD DEBUG] Found job: ${job.id} (nanoId: ${job.jobId}) for request jobId: ${jobId}`);

      // Find the order associated with this job
      // Orders may reference jobs by either UUID (job.id) or NanoID (job.jobId)
      const allOrders = await storage.getOrders();
      const orderEntity = allOrders.find(o => 
        o.jobId === job.id || // Match by UUID
        o.jobId === job.jobId || // Match by NanoID
        (job.jobId && o.jobId === job.jobId) // Explicit NanoID match
      );
      
      console.log(`[UPLOAD DEBUG] Available orders: ${allOrders.length}`);
      console.log(`[UPLOAD DEBUG] Job UUID matches: ${allOrders.filter(o => o.jobId === job.id).map(o => o.orderNumber)}`);
      console.log(`[UPLOAD DEBUG] Job NanoID matches: ${allOrders.filter(o => o.jobId === job.jobId).map(o => o.orderNumber)}`);
      
      if (!orderEntity) {
        console.log(`[UPLOAD DEBUG] No order found for job ${job.id} (nanoId: ${job.jobId})`);
        return res.status(404).json({ 
          error: "No order associated with job",
          debug: {
            jobId: job.id,
            jobNanoId: job.jobId,
            requestJobId: jobId,
            availableOrders: allOrders.map(o => ({ orderNumber: o.orderNumber, jobId: o.jobId }))
          }
        });
      }

      // Step 3: Role-based access validation
      let hasUploadAccess = false;
      let accessReason = "";

      if (user.role === 'partner' || user.role === 'admin') {
        // Partners and admins can upload to their own organization's orders
        if (orderEntity.partnerId === user.partnerId) {
          hasUploadAccess = true;
          accessReason = "Partner/admin access to own organization's order";
        } else {
          accessReason = "Order does not belong to your organization";
        }
      } else if (user.role === 'editor') {
        // Editors can only upload to orders they're assigned to
        if (orderEntity.assignedTo === userId && ['processing', 'in_progress'].includes(orderEntity.status || 'pending')) {
          hasUploadAccess = true;
          accessReason = "Editor access to assigned order";
        } else if (orderEntity.assignedTo !== userId) {
          accessReason = "Editor not assigned to this order";
        } else {
          accessReason = `Order status (${orderEntity.status}) does not allow editor uploads`;
        }
      } else {
        accessReason = "Insufficient role permissions for file upload";
      }

      if (!hasUploadAccess) {
        return res.status(403).json({ 
          error: "Upload access denied", 
          details: accessReason 
        });
      }

      // Step 4: Validate upload data integrity with correct IDs
      const uploadValidation = await storage.validateEditorUpload({
        jobId: job.id, // Correct job DB ID
        orderId: orderEntity.id, // Correct order DB ID
        editorId: userId,
        fileName: req.file.originalname,
        originalName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        firebaseUrl: '', // Will be set after upload
        downloadUrl: '', // Will be set after upload
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
      });

      if (!uploadValidation.valid) {
        return res.status(400).json({ 
          error: "Upload validation failed", 
          details: uploadValidation.errors 
        });
      }

      const timestamp = Date.now();
      const sanitizedFileName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      const sanitizedUserId = userId.replace(/[^a-zA-Z0-9-]/g, '');
      const sanitizedJobId = jobId.replace(/[^a-zA-Z0-9-]/g, '');
      const sanitizedOrderNumber = orderNumber.replace(/[^a-zA-Z0-9-]/g, '');
      
      // New organized file path: orders/userID/jobID/orderNumber/timestamp_filename
      const filePath = `orders/${sanitizedUserId}/${sanitizedJobId}/${sanitizedOrderNumber}/${timestamp}_${sanitizedFileName}`;

      // Get Firebase Admin Storage with explicit bucket name
      const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
      if (!bucketName) {
        throw new Error('FIREBASE_STORAGE_BUCKET environment variable not set');
      }
      
      const bucket = getStorage().bucket(bucketName);
      const file = bucket.file(filePath);

      // Read the uploaded file and upload to Firebase
      const fileBuffer = fs.readFileSync(req.file.path);
      
      await file.save(fileBuffer, {
        metadata: {
          contentType: req.file.mimetype,
        },
      });

      // Make the file publicly accessible
      await file.makePublic();

      // Get the public URL
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

      // Clean up temporary file
      fs.unlinkSync(req.file.path);

      // ENHANCED LOGGING: Comprehensive activity tracking with validation results
      try {
        const authHeader = req.headers.authorization;
        if (authHeader) {
          const idToken = authHeader.replace('Bearer ', '');
          const decodedToken = await adminAuth.verifyIdToken(idToken);
          const userDoc = await getUserDocument(decodedToken.uid);
          
          if (userDoc?.partnerId) {
            // Get comprehensive job and order information
            const job = await storage.getJobByJobId(jobId);
            const orderEntity = orderNumber ? await storage.getOrders().then(orders => 
              orders.find(o => o.orderNumber === orderNumber)) : null;

            // Get validation information for logging
            const jobValidation = job ? await storage.validateJobIntegrity(job.id) : null;
            const orderValidation = orderEntity ? await storage.validateOrderIntegrity(orderEntity.id) : null;

            await storage.createActivity({
              partnerId: userDoc.partnerId,
              jobId: job?.id,
              orderId: orderEntity?.id,
              userId: userDoc.uid,
              userEmail: userDoc.email,
              userName: userDoc.email,
              action: "upload",
              category: "file",
              title: "Secure Editor Upload",
              description: `Editor uploaded ${req.file.originalname} with comprehensive validation`,
              metadata: JSON.stringify({
                // File information
                fileName: req.file.originalname,
                fileSize: req.file.size,
                mimeType: req.file.mimetype,
                filePath: filePath,
                publicUrl: publicUrl,
                
                // Job/Order context
                orderNumber: orderNumber,
                jobId: jobId,
                orderDbId: orderEntity?.id,
                jobDbId: job?.id,
                
                // Validation results
                accessValidation: {
                  hasAccess: hasUploadAccess,
                  reason: accessReason,
                  userRole: user.role
                },
                uploadValidation: {
                  valid: uploadValidation.valid,
                  errors: uploadValidation.errors
                },
                
                // Connection health
                jobIntegrityValid: jobValidation?.isValid || false,
                orderIntegrityValid: orderValidation?.isValid || false,
                connectionIssues: [
                  ...(jobValidation?.issues || []),
                  ...(orderValidation?.issues || [])
                ],
                
                // Security context
                reservationOrderNumber: reservation.orderNumber,
                uploadTimestamp: timestamp,
                securityLevel: 'enhanced_validation'
              }),
              ipAddress: req.ip,
              userAgent: req.get('User-Agent')
            });

            // Also create an editor upload record with complete validation context
            if (job && orderEntity) {
              await storage.createEditorUpload({
                jobId: job.id,
                orderId: orderEntity.id,
                editorId: userId,
                fileName: req.file.originalname,
                originalName: req.file.originalname,
                fileSize: req.file.size,
                mimeType: req.file.mimetype,
                firebaseUrl: publicUrl,
                downloadUrl: publicUrl,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                status: 'uploaded',
                notes: `Uploaded with role-based validation - Role: ${user.role}, Access: ${hasUploadAccess}, Upload Valid: ${uploadValidation.valid}`
              });
            }
          }
        }
      } catch (activityError) {
        console.error("Failed to log enhanced file upload activity:", activityError);
      }

      res.json({
        url: publicUrl,
        path: filePath,
        size: req.file.size,
        originalName: req.file.originalname
      });

    } catch (error: any) {
      console.error("Error uploading file to Firebase:", error);
      
      // Clean up temporary file on error
      if (req.file?.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          console.error("Error cleaning up temp file:", unlinkError);
        }
      }
      
      res.status(500).json({ 
        error: "Failed to upload file to Firebase", 
        details: error.message 
      });
    }
  });

  // Server-side Firebase delete endpoint
  app.delete("/api/delete-firebase", async (req, res) => {
    try {
      const { path: filePath } = req.body;
      
      if (!filePath) {
        return res.status(400).json({ error: "File path required" });
      }

      // Get Firebase Admin Storage with explicit bucket name
      const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
      if (!bucketName) {
        throw new Error('FIREBASE_STORAGE_BUCKET environment variable not set');
      }
      
      const bucket = getStorage().bucket(bucketName);
      const file = bucket.file(filePath);

      // Delete the file
      await file.delete();

      res.json({ success: true });

    } catch (error: any) {
      console.error("Error deleting file from Firebase:", error);
      res.status(500).json({ 
        error: "Failed to delete file from Firebase", 
        details: error.message 
      });
    }
  });

  // =============================================
  // ACTIVITY TRACKING API ENDPOINTS
  // =============================================

  // Activity filtering validation schema
  const activityFiltersSchema = z.object({
    jobId: z.string().optional(),
    orderId: z.string().optional(),
    userId: z.string().optional(),
    action: z.string().optional(),
    category: z.string().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    limit: z.number().int().min(1).max(100).optional(),
    offset: z.number().int().min(0).optional()
  });

  // Create a new activity (manual activity logging)
  app.post("/api/activities", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.partnerId) {
        return res.status(400).json({ error: "User must have a partnerId" });
      }

      // Parse and validate activity data
      const activityData = insertActivitySchema.parse({
        ...req.body,
        partnerId: req.user.partnerId,
        userId: req.user.uid,
        userEmail: req.user.email,
        userName: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      const activity = await storage.createActivity(activityData);
      res.status(201).json(activity);
    } catch (error: any) {
      console.error("Error creating activity:", error);
      if (error.name === 'ZodError') {
        res.status(400).json({ 
          error: "Invalid activity data", 
          details: error.errors 
        });
      } else {
        res.status(500).json({ 
          error: "Failed to create activity", 
          details: error.message 
        });
      }
    }
  });

  // Get activities with comprehensive filtering
  app.get("/api/activities", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.partnerId) {
        return res.status(400).json({ error: "User must have a partnerId" });
      }

      // Parse and validate query parameters
      const filters = activityFiltersSchema.parse(req.query);
      
      // Convert date strings to Date objects
      const searchFilters: any = {
        partnerId: req.user.partnerId,
        ...filters
      };
      
      if (filters.startDate) {
        searchFilters.startDate = new Date(filters.startDate);
      }
      if (filters.endDate) {
        searchFilters.endDate = new Date(filters.endDate);
      }

      const activities = await storage.getActivities(searchFilters);
      res.json(activities);
    } catch (error: any) {
      console.error("Error getting activities:", error);
      if (error.name === 'ZodError') {
        res.status(400).json({ 
          error: "Invalid filter parameters", 
          details: error.errors 
        });
      } else {
        res.status(500).json({ 
          error: "Failed to get activities", 
          details: error.message 
        });
      }
    }
  });

  // Get activities for a specific job
  app.get("/api/jobs/:jobId/activities", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.partnerId) {
        return res.status(400).json({ error: "User must have a partnerId" });
      }

      const { jobId } = req.params;
      
      // Verify job exists and belongs to user's partner
      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      if (job.partnerId !== req.user.partnerId) {
        return res.status(403).json({ error: "Access denied to this job" });
      }

      const activities = await storage.getJobActivities(jobId, req.user.partnerId);
      res.json(activities);
    } catch (error: any) {
      console.error("Error getting job activities:", error);
      res.status(500).json({ 
        error: "Failed to get job activities", 
        details: error.message 
      });
    }
  });

  // Get activities for a specific order
  app.get("/api/orders/:orderId/activities", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.partnerId) {
        return res.status(400).json({ error: "User must have a partnerId" });
      }

      const { orderId } = req.params;
      
      // Verify order exists and belongs to user's partner
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      
      if (order.partnerId !== req.user.partnerId) {
        return res.status(403).json({ error: "Access denied to this order" });
      }

      const activities = await storage.getOrderActivities(orderId, req.user.partnerId);
      res.json(activities);
    } catch (error: any) {
      console.error("Error getting order activities:", error);
      res.status(500).json({ 
        error: "Failed to get order activities", 
        details: error.message 
      });
    }
  });

  // Get activities for the current user
  app.get("/api/users/me/activities", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.partnerId) {
        return res.status(400).json({ error: "User must have a partnerId" });
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      
      const activities = await storage.getUserActivities(req.user.uid, req.user.partnerId, limit);
      res.json(activities);
    } catch (error: any) {
      console.error("Error getting user activities:", error);
      res.status(500).json({ 
        error: "Failed to get user activities", 
        details: error.message 
      });
    }
  });

  // Get activity analytics (counts by type)
  app.get("/api/activities/analytics", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.partnerId) {
        return res.status(400).json({ error: "User must have a partnerId" });
      }

      // Parse optional time range
      let timeRange: { start: Date; end: Date } | undefined;
      if (req.query.startDate && req.query.endDate) {
        timeRange = {
          start: new Date(req.query.startDate as string),
          end: new Date(req.query.endDate as string)
        };
      }

      const analytics = await storage.getActivityCountByType(req.user.partnerId, timeRange);
      res.json(analytics);
    } catch (error: any) {
      console.error("Error getting activity analytics:", error);
      res.status(500).json({ 
        error: "Failed to get activity analytics", 
        details: error.message 
      });
    }
  });

  // Endpoint specifically for JobCard page - get enriched job activities
  app.get("/api/jobs/card/:jobId", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.partnerId) {
        return res.status(400).json({ error: "User must have a partnerId" });
      }

      const { jobId } = req.params;
      
      // Get job by jobId (NanoID, not UUID)
      const job = await storage.getJobByJobId(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      if (job.partnerId !== req.user.partnerId) {
        return res.status(403).json({ error: "Access denied to this job" });
      }

      // Get customer info if available
      let customer = null;
      if (job.customerId) {
        customer = await storage.getCustomer(job.customerId);
      }

      // Get job activities
      const activities = await storage.getJobActivities(job.id, req.user.partnerId);

      res.json({
        ...job,
        customer,
        activities
      });
    } catch (error: any) {
      console.error("Error getting job card data:", error);
      res.status(500).json({ 
        error: "Failed to get job card data", 
        details: error.message 
      });
    }
  });

  // Activity Tracking Endpoints - CRITICAL SECURITY: All protected with requireAuth and partnerId filtering
  
  // GET /api/activities - Get activities with proper tenant isolation
  app.get("/api/activities", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.partnerId) {
        return res.status(400).json({ error: "User must have a partnerId" });
      }

      // Extract query parameters with defaults for security and performance
      const {
        jobId,
        orderId,
        userId,
        action,
        category,
        startDate,
        endDate,
        limit = 50, // Default limit to prevent large payloads
        offset = 0
      } = req.query;

      // Build filters with mandatory partnerId for security
      const filters: any = {
        partnerId: req.user.partnerId, // CRITICAL: Always filter by user's partnerId
        limit: Math.min(Number(limit) || 50, 100), // Max 100 for performance
        offset: Number(offset) || 0
      };

      // Add optional filters
      if (jobId && typeof jobId === 'string') filters.jobId = jobId;
      if (orderId && typeof orderId === 'string') filters.orderId = orderId;
      if (userId && typeof userId === 'string') filters.userId = userId;
      if (action && typeof action === 'string') filters.action = action;
      if (category && typeof category === 'string') filters.category = category;
      if (startDate && typeof startDate === 'string') filters.startDate = new Date(startDate);
      if (endDate && typeof endDate === 'string') filters.endDate = new Date(endDate);

      const activities = await storage.getActivities(filters);
      
      res.json({
        activities,
        pagination: {
          limit: filters.limit,
          offset: filters.offset,
          total: activities.length
        }
      });
    } catch (error: any) {
      console.error("Error fetching activities:", error);
      res.status(500).json({ 
        error: "Failed to fetch activities", 
        details: error.message 
      });
    }
  });

  // GET /api/jobs/:id/activities - Get activities for specific job with security
  app.get("/api/jobs/:id/activities", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.partnerId) {
        return res.status(400).json({ error: "User must have a partnerId" });
      }

      const { id } = req.params;
      
      // Verify job belongs to user's partner (security check)
      const job = await storage.getJob(id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      if (job.partnerId !== req.user.partnerId) {
        return res.status(403).json({ error: "Access denied to this job" });
      }

      const activities = await storage.getJobActivities(id, req.user.partnerId);
      res.json(activities);
    } catch (error: any) {
      console.error("Error fetching job activities:", error);
      res.status(500).json({ 
        error: "Failed to fetch job activities", 
        details: error.message 
      });
    }
  });

  // GET /api/orders/:id/activities - Get activities for specific order with security
  app.get("/api/orders/:id/activities", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.partnerId) {
        return res.status(400).json({ error: "User must have a partnerId" });
      }

      const { id } = req.params;
      
      // Verify order belongs to user's partner (security check)
      const order = await storage.getOrder(id);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      
      if (order.partnerId !== req.user.partnerId) {
        return res.status(403).json({ error: "Access denied to this order" });
      }

      const activities = await storage.getOrderActivities(id, req.user.partnerId);
      res.json(activities);
    } catch (error: any) {
      console.error("Error fetching order activities:", error);
      res.status(500).json({ 
        error: "Failed to fetch order activities", 
        details: error.message 
      });
    }
  });

  // GET /api/users/me/activities - Get current user's activities
  app.get("/api/users/me/activities", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.partnerId) {
        return res.status(400).json({ error: "User must have a partnerId" });
      }

      const limit = Math.min(Number(req.query.limit) || 50, 100);
      const activities = await storage.getUserActivities(req.user.uid, req.user.partnerId, limit);
      
      res.json(activities);
    } catch (error: any) {
      console.error("Error fetching user activities:", error);
      res.status(500).json({ 
        error: "Failed to fetch user activities", 
        details: error.message 
      });
    }
  });

  // GET /api/activities/analytics - Get activity analytics with security
  app.get("/api/activities/analytics", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.partnerId) {
        return res.status(400).json({ error: "User must have a partnerId" });
      }

      // Build time range filters if provided
      const filters: any = { partnerId: req.user.partnerId };
      
      if (req.query.startDate && typeof req.query.startDate === 'string') {
        filters.startDate = new Date(req.query.startDate);
      }
      if (req.query.endDate && typeof req.query.endDate === 'string') {
        filters.endDate = new Date(req.query.endDate);
      }

      const analytics = await storage.getActivityCountByType(req.user.partnerId, 
        (filters.startDate || filters.endDate) ? {
          start: filters.startDate,
          end: filters.endDate
        } : undefined
      );
      
      res.json(analytics);
    } catch (error: any) {
      console.error("Error fetching activity analytics:", error);
      res.status(500).json({ 
        error: "Failed to fetch activity analytics", 
        details: error.message 
      });
    }
  });

  // POST /api/activities - Create activity log (for manual logging)
  app.post("/api/activities", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.partnerId) {
        return res.status(400).json({ error: "User must have a partnerId" });
      }

      // Validate and enrich activity data with user context
      const validatedData = insertActivitySchema.parse({
        ...req.body,
        partnerId: req.user.partnerId, // Force partnerId from auth context
        userId: req.user.uid,
        userEmail: req.user.email,
        userName: req.user.email,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      const activity = await storage.createActivity(validatedData);
      res.status(201).json(activity);
    } catch (error: any) {
      console.error("Error creating activity:", error);
      res.status(400).json({ 
        error: "Invalid activity data", 
        details: error.message 
      });
    }
  });

  // ===== JOB CONNECTION VALIDATION & HEALTH CHECK ENDPOINTS =====

  // Health check endpoint - overall system health
  app.get("/api/health/connection-integrity", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const partnerId = req.user?.partnerId;
      const healthCheck = await storage.performHealthCheck(partnerId);
      
      res.json({
        timestamp: new Date().toISOString(),
        partnerId: partnerId || 'all',
        ...healthCheck
      });
    } catch (error: any) {
      console.error("Health check failed:", error);
      res.status(500).json({ 
        error: "Health check failed", 
        details: error.message 
      });
    }
  });

  // Validate specific job integrity
  app.get("/api/validate/job/:jobId", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.partnerId) {
        return res.status(400).json({ error: "User must have a partnerId" });
      }

      const { jobId } = req.params;
      
      // Verify job belongs to user's partner (tenant isolation)
      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      if (job.partnerId !== req.user.partnerId) {
        return res.status(403).json({ error: "Access denied: job belongs to different partner" });
      }

      const validation = await storage.validateJobIntegrity(jobId);
      
      res.json({
        jobId,
        partnerId: req.user.partnerId,
        timestamp: new Date().toISOString(),
        ...validation
      });
    } catch (error: any) {
      console.error("Job validation failed:", error);
      res.status(500).json({ 
        error: "Job validation failed", 
        details: error.message 
      });
    }
  });

  // Validate specific order integrity
  app.get("/api/validate/order/:orderId", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.partnerId) {
        return res.status(400).json({ error: "User must have a partnerId" });
      }

      const { orderId } = req.params;
      
      // Verify order belongs to user's partner (tenant isolation)
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      
      if (order.partnerId !== req.user.partnerId) {
        return res.status(403).json({ error: "Access denied: order belongs to different partner" });
      }

      const validation = await storage.validateOrderIntegrity(orderId);
      
      res.json({
        orderId,
        partnerId: req.user.partnerId,
        timestamp: new Date().toISOString(),
        ...validation
      });
    } catch (error: any) {
      console.error("Order validation failed:", error);
      res.status(500).json({ 
        error: "Order validation failed", 
        details: error.message 
      });
    }
  });

  // Validate editor workflow access
  app.get("/api/validate/editor-access/:jobId", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user || req.user.role !== 'editor') {
        return res.status(403).json({ error: "Only editors can check workflow access" });
      }

      const { jobId } = req.params;
      const validation = await storage.validateEditorWorkflowAccess(req.user.uid, jobId);
      
      res.json({
        editorId: req.user.uid,
        jobId,
        timestamp: new Date().toISOString(),
        ...validation
      });
    } catch (error: any) {
      console.error("Editor access validation failed:", error);
      res.status(500).json({ 
        error: "Editor access validation failed", 
        details: error.message 
      });
    }
  });

  // Repair orphaned order
  app.post("/api/repair/orphaned-order", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user || !['admin', 'partner'].includes(req.user.role)) {
        return res.status(403).json({ error: "Only admins and partners can repair data" });
      }

      const { orderId, correctJobId } = req.body;
      
      if (!orderId || !correctJobId) {
        return res.status(400).json({ error: "orderId and correctJobId are required" });
      }

      const result = await storage.repairOrphanedOrder(orderId, correctJobId);
      
      // Log the repair action
      if (result.success) {
        try {
          await storage.createActivity({
            partnerId: req.user.partnerId || '',
            orderId: orderId,
            userId: req.user.uid,
            userEmail: req.user.email,
            userName: req.user.email,
            action: "update",
            category: "system",
            title: "Data Repair",
            description: "Orphaned order repaired by admin",
            metadata: JSON.stringify({
              repairType: 'orphaned_order',
              orderId,
              correctJobId,
              performedBy: req.user.uid
            }),
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
          });
        } catch (activityError) {
          console.error("Failed to log repair activity:", activityError);
        }
      }

      res.json({
        timestamp: new Date().toISOString(),
        performedBy: req.user.uid,
        ...result
      });
    } catch (error: any) {
      console.error("Repair operation failed:", error);
      res.status(500).json({ 
        error: "Repair operation failed", 
        details: error.message 
      });
    }
  });

  // Enhanced editor upload validation
  app.post("/api/validate/editor-upload", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user || req.user.role !== 'editor') {
        return res.status(403).json({ error: "Only editors can validate uploads" });
      }

      // Add editorId to the upload data for validation
      const uploadData = {
        ...req.body,
        editorId: req.user.uid
      };

      const validation = await storage.validateEditorUpload(uploadData);
      
      res.json({
        timestamp: new Date().toISOString(),
        editorId: req.user.uid,
        ...validation
      });
    } catch (error: any) {
      console.error("Upload validation failed:", error);
      res.status(500).json({ 
        error: "Upload validation failed", 
        details: error.message 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
