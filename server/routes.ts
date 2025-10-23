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
  insertActivitySchema,
  insertEditingOptionSchema,
  insertCustomerEditingPreferenceSchema,
  insertFileCommentSchema,
  insertJobReviewSchema,
  insertDeliveryEmailSchema,
  insertConversationSchema,
  insertMessageSchema
} from "@shared/schema";
import { 
  createUserDocument, 
  createPendingInvite, 
  getPendingInvite, 
  updateInviteStatus,
  getUserDocument,
  updateUserPartnerId,
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
import { nanoid } from 'nanoid';

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

// Optional auth middleware - adds user if authenticated but allows unauthenticated requests
// SECURITY: If Authorization header is present but invalid, returns 401 to prevent security bypass
const optionalAuth = async (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  
  // No auth header - allow unauthenticated access
  if (!authHeader) {
    return next();
  }

  // Auth header present - must be valid or reject
  try {
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
    // If Authorization header exists but token is invalid/expired, reject the request
    console.error("Optional auth failed with invalid token:", error);
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

  // Delete cover image from a job
  app.delete("/api/jobs/:id/cover-image", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Verify the user has permission to delete (must be the job owner or admin)
      if (req.user?.partnerId !== job.partnerId && req.user?.role !== 'admin') {
        return res.status(403).json({ error: "Unauthorized to delete cover image" });
      }

      // Delete from Firebase Storage if exists
      if (job.propertyImage || job.propertyImageThumbnail) {
        try {
          const bucket = getStorage().bucket();
          
          // Helper function to extract storage path from Firebase URL
          const extractStoragePath = (url: string): string | null => {
            try {
              // Firebase URLs are like: https://storage.googleapis.com/.../o/cover-images%2Ffilename.jpg?...
              const match = url.match(/\/o\/(.+?)\?/);
              if (match && match[1]) {
                return decodeURIComponent(match[1]);
              }
              return null;
            } catch {
              return null;
            }
          };
          
          // Delete original image
          if (job.propertyImage) {
            const storagePath = extractStoragePath(job.propertyImage);
            if (storagePath) {
              await bucket.file(storagePath).delete().catch((err) => {
                console.log(`Original image not found in storage (${storagePath}), continuing...`, err.message);
              });
            }
          }

          // Delete thumbnail
          if (job.propertyImageThumbnail) {
            const storagePath = extractStoragePath(job.propertyImageThumbnail);
            if (storagePath) {
              await bucket.file(storagePath).delete().catch((err) => {
                console.log(`Thumbnail not found in storage (${storagePath}), continuing...`, err.message);
              });
            }
          }
        } catch (storageError) {
          console.error("Error deleting from Firebase Storage:", storageError);
          // Continue even if storage deletion fails
        }
      }

      // Update job to remove cover image URLs
      const updatedJob = await storage.updateJob(req.params.id, {
        propertyImage: null,
        propertyImageThumbnail: null,
      });

      // Log activity
      try {
        await storage.createActivity({
          partnerId: req.user?.partnerId || job.partnerId,
          jobId: job.id,
          userId: req.user?.uid || '',
          userEmail: req.user?.email || '',
          userName: req.user?.email || '',
          action: "update",
          category: "job",
          title: "Cover Image Deleted",
          description: `Cover image removed from job at ${job.address}`,
          metadata: JSON.stringify({
            jobId: job.jobId,
            address: job.address,
          }),
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });
      } catch (activityError) {
        console.error("Failed to log cover image deletion activity:", activityError);
      }

      res.json(updatedJob);
    } catch (error) {
      console.error("Error deleting cover image:", error);
      res.status(500).json({ error: "Failed to delete cover image" });
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
  app.post("/api/orders/submit", requireAuth, async (req, res) => {
    try {
      const { jobId, customerId, services, createdBy, assignedTo, estimatedTotal } = req.body;
      
      if (!services || !Array.isArray(services) || services.length === 0) {
        return res.status(400).json({ error: "Missing required fields: services" });
      }

      // Security: Always use server-side partnerId from authenticated user (never trust client)
      const partnerId = req.user.partnerId;
      if (!partnerId) {
        return res.status(403).json({ error: "User has no associated partner ID" });
      }

      // Use existing order reservation or generate new order number
      let orderNumber: string;
      if (req.body.orderNumber) {
        // Security: Validate reservation ownership before confirming
        const reservation = await storage.getReservation(req.body.orderNumber);
        if (!reservation) {
          return res.status(404).json({ error: "Order reservation not found" });
        }
        if (reservation.status !== 'reserved') {
          return res.status(409).json({ error: "Order reservation is not in reserved status" });
        }
        if (reservation.userId !== req.user.uid) {
          return res.status(403).json({ error: "Unauthorized: Cannot use another user's reservation" });
        }
        
        // Now confirm the validated reservation
        const confirmed = await storage.confirmReservation(req.body.orderNumber);
        if (!confirmed) {
          return res.status(400).json({ error: "Failed to confirm order reservation" });
        }
        orderNumber = req.body.orderNumber;
      } else {
        // Fallback to old behavior if no reservation provided
        orderNumber = await storage.generateOrderNumber();
      }
      
      // Calculate 14 days from now for file expiry
      const filesExpiryDate = new Date();
      filesExpiryDate.setDate(filesExpiryDate.getDate() + 14);

      // Create the main order with confirmed order number
      const order = await storage.createOrder({
        partnerId,
        jobId: jobId || null,
        customerId: customerId || null,
        assignedTo: assignedTo || null,
        status: "pending", // Always start as pending - editors must accept before processing
        createdBy: createdBy || null,
        estimatedTotal: estimatedTotal || "0"
      }, orderNumber); // Pass the confirmed order number

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

      // Create notifications for assigned editor
      try {
        if (assignedTo) {
          // Order is assigned to specific editor - notify only them
          const notification = {
            partnerId,
            recipientId: assignedTo,
            type: 'order_assigned',
            title: 'New Order Assigned',
            body: `Order #${order.orderNumber} has been assigned to you and is ready for processing.`,
            orderId: order.id,
            jobId: order.jobId,
            read: false
          };
          
          await storage.createNotifications([notification]);
          console.log(`Created notification for assigned editor ${assignedTo} for order ${order.orderNumber}`);
        } else {
          // Order is not assigned - use existing logic to notify eligible editors
          const serviceIds = services.map((service: any) => service.serviceId).filter((id: any) => id);
          const partnerships = await getPartnerPartnerships(partnerId);
          const eligibleEditorIds = new Set<string>();
          
          // Find editors who can handle the requested services
          if (serviceIds.length > 0) {
            for (const partnership of partnerships) {
              if (partnership.status === 'active') {
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

  // Jobs endpoints (actual endpoint is defined later with requireAuth)

  // Note: GET /api/jobs and POST /api/jobs are defined earlier in the file (lines 191-261)

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

  // Orders endpoints - Requires authentication for multi-tenant security
  app.get("/api/orders", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const allOrders = await storage.getOrders();
      
      // Multi-tenant security: Partners see only their orders, admins see all, others denied
      let filteredOrders: typeof allOrders;
      if (req.user?.partnerId) {
        // Partners: filter by their partnerId
        filteredOrders = allOrders.filter(order => order.partnerId === req.user?.partnerId);
      } else if (req.user?.role === 'admin') {
        // Admins: see all orders
        filteredOrders = allOrders;
      } else {
        // Other roles (editors, etc.): access denied
        return res.status(403).json({ error: "Access denied - insufficient permissions" });
      }
      
      // Enrich orders with job address for display in dropdowns
      const ordersWithJobData = await Promise.all(
        filteredOrders.map(async (order) => {
          if (order.jobId) {
            const job = await storage.getJob(order.jobId);
            return {
              ...order,
              jobAddress: job?.address || "Unknown Address"
            };
          }
          return {
            ...order,
            jobAddress: "No Job Assigned"
          };
        })
      );
      
      res.json(ordersWithJobData);
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
      
      // Create conversation between partner and editor
      const existingConversation = await storage.getConversationByParticipants(invite.partnerId, currentUser.uid);
      
      if (!existingConversation) {
        const conversationData = insertConversationSchema.parse({
          partnerId: invite.partnerId,
          editorId: currentUser.uid,
          partnerName: invite.partnerName,
          editorName: invite.editorStudioName || currentUser.email,
          partnerEmail: invite.partnerEmail,
          editorEmail: currentUser.email,
        });
        
        await storage.createConversation(conversationData);
      }
      
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

  // Editor accepts an assigned order
  app.post("/api/editor/orders/:orderId/accept", async (req, res) => {
    try {
      const { orderId } = req.params;
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: "Authorization header required" });
      }
      
      const idToken = authHeader.replace('Bearer ', '');
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      const uid = decodedToken.uid;
      const currentUser = await getUserDocument(uid);
      if (!currentUser || currentUser.role !== 'editor') {
        return res.status(403).json({ error: "Only editors can accept orders" });
      }
      
      // Get the order
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      
      // Verify the order is assigned to this editor
      if (order.assignedTo !== uid) {
        return res.status(403).json({ error: "This order is not assigned to you" });
      }
      
      // Verify order is in pending status
      if (order.status !== 'pending') {
        return res.status(400).json({ error: `Order is already ${order.status}` });
      }
      
      // Update order to processing status and set dateAccepted
      const acceptedOrder = await storage.updateOrder(orderId, {
        status: 'processing',
        dateAccepted: new Date()
      });
      
      // Log activity
      try {
        await storage.createActivity({
          partnerId: order.partnerId,
          orderId: order.id,
          jobId: order.jobId,
          userId: uid,
          userEmail: currentUser.email,
          userName: currentUser.studioName || currentUser.email,
          action: "acceptance",
          category: "order",
          title: "Order Accepted",
          description: `Order #${order.orderNumber} accepted by editor`,
          metadata: JSON.stringify({
            orderNumber: order.orderNumber,
            acceptedBy: currentUser.email,
            acceptedAt: new Date().toISOString()
          }),
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });
      } catch (activityError) {
        console.error("Failed to log order acceptance activity:", activityError);
      }
      
      // Create notification for the partner
      try {
        await storage.createNotification({
          partnerId: order.partnerId,
          recipientId: order.partnerId,
          type: 'order_accepted',
          title: 'Order Accepted',
          body: `Order #${order.orderNumber} has been accepted by ${currentUser.studioName || 'editor'} and is now being processed.`,
          orderId: order.id,
          jobId: order.jobId,
          read: false
        });
      } catch (notificationError) {
        console.error("Failed to create acceptance notification:", notificationError);
      }
      
      res.json({
        success: true,
        message: "Order accepted successfully",
        order: acceptedOrder
      });
    } catch (error: any) {
      console.error("Error accepting order:", error);
      res.status(500).json({ 
        error: "Failed to accept order", 
        details: error.message 
      });
    }
  });

  // Editor declines an assigned order
  app.post("/api/editor/orders/:orderId/decline", async (req, res) => {
    try {
      const { orderId } = req.params;
      const { reason } = req.body; // Optional decline reason
      
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: "Authorization header required" });
      }
      
      const idToken = authHeader.replace('Bearer ', '');
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      const uid = decodedToken.uid;
      const currentUser = await getUserDocument(uid);
      if (!currentUser || currentUser.role !== 'editor') {
        return res.status(403).json({ error: "Only editors can decline orders" });
      }
      
      // Get the order
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      
      // Verify the order is assigned to this editor
      if (order.assignedTo !== uid) {
        return res.status(403).json({ error: "This order is not assigned to you" });
      }
      
      // Verify order is in pending status
      if (order.status !== 'pending') {
        return res.status(400).json({ error: `Order is already ${order.status}` });
      }
      
      // Update order to cancelled status and clear assignedTo
      const declinedOrder = await storage.updateOrder(orderId, {
        status: 'cancelled',
        assignedTo: null // Unassign the order so partner can reassign
      });
      
      // Log activity
      try {
        await storage.createActivity({
          partnerId: order.partnerId,
          orderId: order.id,
          jobId: order.jobId,
          userId: uid,
          userEmail: currentUser.email,
          userName: currentUser.studioName || currentUser.email,
          action: "decline",
          category: "order",
          title: "Order Declined",
          description: `Order #${order.orderNumber} declined by editor${reason ? `: ${reason}` : ''}`,
          metadata: JSON.stringify({
            orderNumber: order.orderNumber,
            declinedBy: currentUser.email,
            declinedAt: new Date().toISOString(),
            reason: reason || 'No reason provided'
          }),
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });
      } catch (activityError) {
        console.error("Failed to log order decline activity:", activityError);
      }
      
      // Create notification for the partner
      try {
        await storage.createNotification({
          partnerId: order.partnerId,
          recipientId: order.partnerId,
          type: 'order_declined',
          title: 'Order Declined',
          body: `Order #${order.orderNumber} was declined by ${currentUser.studioName || 'editor'}${reason ? `. Reason: ${reason}` : ''}`,
          orderId: order.id,
          jobId: order.jobId,
          read: false
        });
      } catch (notificationError) {
        console.error("Failed to create decline notification:", notificationError);
      }
      
      res.json({
        success: true,
        message: "Order declined successfully",
        order: declinedOrder
      });
    } catch (error: any) {
      console.error("Error declining order:", error);
      res.status(500).json({ 
        error: "Failed to decline order", 
        details: error.message 
      });
    }
  });

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

  // Get all orders assigned to an editor
  app.get("/api/editor/orders", async (req, res) => {
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
        return res.status(403).json({ error: "Only editors can view their orders" });
      }
      
      // Get all orders assigned to this editor with job details
      const allOrders = await storage.getOrders();
      const editorOrders = allOrders
        .filter(o => o.assignedTo === uid)
        .map(order => ({
          id: order.id,
          orderNumber: order.orderNumber,
          jobId: order.jobId,
          jobAddress: order.jobAddress || '',
          status: order.status
        }));
      
      res.json(editorOrders);
    } catch (error: any) {
      console.error("Error getting editor orders:", error);
      res.status(500).json({ 
        error: "Failed to get editor orders", 
        details: error.message 
      });
    }
  });

  // Download order files as zip by order number  
  app.get("/api/editor/orders/:orderNumber/download", async (req, res) => {
    try {
      const { orderNumber } = req.params;
      console.log(`[DOWNLOAD] Download request for order: ${orderNumber}`);
      
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: "Authorization header required" });
      }
      
      const idToken = authHeader.replace('Bearer ', '');
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      const uid = decodedToken.uid;
      const currentUser = await getUserDocument(uid);
      if (!currentUser || currentUser.role !== 'editor') {
        return res.status(403).json({ error: "Only editors can download order files" });
      }
      
      // Find the order by order number and ensure it's assigned to current editor
      const allOrders = await storage.getOrders();
      const order = allOrders.find(o => o.orderNumber === orderNumber && o.assignedTo === uid);
      if (!order) {
        return res.status(404).json({ error: "Order not found or not assigned to you" });
      }
      
      // Get order files and services (for instructions)
      const orderFiles = await storage.getOrderFiles(order.id);
      const orderServices = await storage.getOrderServices(order.id);
      
      if (!orderFiles || orderFiles.length === 0) {
        return res.status(404).json({ error: "No files found for this order" });
      }
      
      console.log(`Found ${orderFiles.length} files for order ${orderNumber}`);
      
      // Create zip file
      const zip = new JSZip();
      const folderName = orderNumber.replace('#', ''); // Remove # from folder name
      
      // Add order files to zip
      for (const file of orderFiles) {
        try {
          let fileBuffer: Buffer;
          
          if (file.fileContent) {
            // Handle base64 content (legacy)
            fileBuffer = Buffer.from(file.fileContent, 'base64');
          } else if (file.downloadUrl || file.firebaseUrl) {
            // Fetch file from Firebase Storage
            const url = file.downloadUrl || file.firebaseUrl;
            console.log(`Fetching file ${file.fileName} from: ${url}`);
            
            const response = await fetch(url);
            if (!response.ok) {
              console.error(`Failed to fetch file ${file.fileName}: ${response.status}`);
              continue;
            }
            
            const arrayBuffer = await response.arrayBuffer();
            fileBuffer = Buffer.from(arrayBuffer);
            console.log(`Successfully fetched ${file.fileName} (${fileBuffer.length} bytes)`);
          } else {
            console.log(`Skipping file ${file.fileName} - no content or URL`);
            continue;
          }
          
          zip.file(`${folderName}/${file.fileName}`, fileBuffer);
        } catch (error) {
          console.error(`Error processing file ${file.fileName}:`, error);
          // Continue with other files even if one fails
        }
      }
      
      // Add instructions if any
      if (orderServices && orderServices.length > 0) {
        const instructions = orderServices.map(service => ({
          service: service.serviceName,
          instructions: service.instructions,
          notes: service.notes
        }));
        
        zip.file(`${folderName}/INSTRUCTIONS.json`, JSON.stringify(instructions, null, 2));
      }
      
      // Generate zip
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
      
      // Log activity: File Download
      try {
        await storage.createActivity({
          partnerId: currentUser.partnerId || '',
          orderId: order.id,
          jobId: order.jobId,
          userId: currentUser.uid,
          userEmail: currentUser.email,
          userName: currentUser.email,
          action: "download",
          category: "file",
          title: "Order Files Downloaded",
          description: `Editor downloaded files for order ${order.orderNumber}`,
          metadata: JSON.stringify({
            orderNumber: order.orderNumber,
            fileCount: orderFiles.length,
            totalSize: zipBuffer.length,
            downloadedFiles: orderFiles.map(f => ({
              fileName: f.fileName,
              fileSize: f.fileSize,
              mimeType: f.mimeType
            })),
            downloadedAt: new Date().toISOString()
          }),
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });
      } catch (activityError) {
        console.error("Failed to log download activity:", activityError);
        // Don't fail the download if activity logging fails
      }
      
      // Send the zip file
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${folderName}_files.zip"`);
      res.setHeader('Content-Length', zipBuffer.length);
      res.send(zipBuffer);
      
    } catch (error: any) {
      console.error("Error downloading order files:", error);
      res.status(500).json({ 
        error: "Failed to download order files", 
        details: error.message 
      });
    }
  });

  // Download job files as zip (legacy route - keeping for compatibility)
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
      
      // Get associated order using jobId - find one assigned to current editor
      const allOrders = await storage.getOrders();
      const order = allOrders.find(o => o.jobId === job.id && o.assignedTo === uid);
      if (!order) {
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
      
      // Log activity: File Download (legacy endpoint)
      try {
        const userDoc = await getUserDocument(uid);
        if (userDoc) {
          await storage.createActivity({
            partnerId: userDoc.partnerId || '',
            orderId: order.id,
            jobId: order.jobId,
            userId: uid,
            userEmail: userDoc.email,
            userName: userDoc.email,
            action: "download",
            category: "file",
            title: "Job Files Downloaded",
            description: `Editor downloaded files for job ${jobId} (legacy endpoint)`,
            metadata: JSON.stringify({
              orderNumber: order.orderNumber,
              jobId: jobId,
              fileCount: successfulFiles,
              totalSize: zipBuffer.length,
              downloadedAt: new Date().toISOString(),
              endpointType: 'legacy'
            }),
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
          });
        }
      } catch (activityError) {
        console.error("Failed to log download activity:", activityError);
        // Don't fail the download if activity logging fails
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
  app.get("/api/editor/jobs-ready-for-upload", requireAuth, async (req, res) => {
    try {
      const user = req.user; // Set by requireAuth middleware
      if (!user || user.role !== 'editor') {
        return res.status(403).json({ error: "Only editors can view jobs ready for upload" });
      }
      
      console.log(`[DEBUG] Editor dashboard request from: ${user.uid}, role: ${user.role}`);
      const jobs = await storage.getJobsReadyForUpload(user.uid);
      console.log(`[DEBUG] Returning ${jobs.length} jobs to editor dashboard`);
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

      // Get associated orders to verify assignment
      const allOrders = await storage.getOrders();
      // Match by job.id (UUID) or job.jobId (NanoID) - both are used in different contexts
      const jobOrders = allOrders.filter(o => o.jobId === job.id || o.jobId === job.jobId);
      const assignedOrder = jobOrders.find(order => order.assignedTo === uid);
      if (!assignedOrder) {
        console.log(`[UPLOAD ERROR] Editor ${uid} not assigned to job ${jobId}. Found ${jobOrders.length} orders for this job.`);
        return res.status(403).json({ error: "You are not assigned to this job" });
      }
      const order = assignedOrder; // Use the assigned order for upload records

      // Editor is already verified through assignment check above
      // No need for partnerId check - editors work across different partners

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
      // Match by job.id (UUID) or job.jobId (NanoID) - both are used in different contexts
      const jobOrders = allOrders.filter(o => o.jobId === job.id || o.jobId === job.jobId);
      const assignedOrder = jobOrders.find(order => order.assignedTo === uid);
      if (!assignedOrder) {
        console.log(`[STATUS UPDATE ERROR] Editor ${uid} not assigned to job ${jobId}. Found ${jobOrders.length} orders for this job.`);
        return res.status(403).json({ error: "You are not assigned to this job" });
      }
      const order = assignedOrder; // Use the assigned order for status updates

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

      const { userId, jobId, orderNumber, uploadType, folderToken, folderPath } = req.body;
      
      // For standalone folders (with folderToken), orderNumber is not required
      if (!userId || !jobId) {
        return res.status(400).json({ 
          error: "Missing required parameters: userId and jobId are required" 
        });
      }
      
      // If no folderToken, orderNumber is required
      if (!folderToken && !orderNumber) {
        return res.status(400).json({ 
          error: "Missing required parameters: orderNumber or folderToken is required" 
        });
      }

      // ENHANCED SECURITY: Comprehensive validation before processing upload
      
      // Step 1: Verify the reservation exists and is valid (skip for standalone folders with folderToken)
      let reservation = null;
      if (!folderToken) {
        reservation = await storage.getReservation(orderNumber);
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
      }

      // Step 2: Get user information and validate access based on role
      const user = await getUserDocument(userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      // Get job and order information for validation  
      // Try to find job by jobId (could be UUID or NanoID)
      let job = await storage.getJobByJobId(jobId);
      if (!job) {
        // If not found by jobId, try looking by UUID in the jobs map
        const allJobs = await storage.getJobs();
        job = allJobs.find(j => j.id === jobId || j.jobId === jobId);
      }
      
      if (!job) {
        console.log(`[UPLOAD DEBUG] Job not found for jobId: ${jobId}`);
        console.log(`[UPLOAD DEBUG] Available jobs:`, (await storage.getJobs()).map(j => ({ id: j.id, jobId: j.jobId, address: j.address })));
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
      
      // Note: orderEntity can be null for new orders - this is allowed
      if (!orderEntity) {
        console.log(`[UPLOAD DEBUG] No existing order for job ${job.id} - will work with reservation data`);
      } else {
        console.log(`[UPLOAD DEBUG] Found existing order ${orderEntity.orderNumber} for job`);
      }

      // Step 3: Role-based access validation
      let hasUploadAccess = false;
      let accessReason = "";

      if (user.role === 'partner' || user.role === 'admin') {
        // Partners and admins can upload to their own organization's jobs
        if (job.partnerId === user.partnerId) {
          hasUploadAccess = true;
          accessReason = "Partner/admin access to own organization's job";
        } else if (orderEntity && orderEntity.partnerId === user.partnerId) {
          hasUploadAccess = true;
          accessReason = "Partner/admin access to own organization's order";
        } else {
          accessReason = "Job/order does not belong to your organization";
        }
      } else if (user.role === 'editor') {
        // Editors can only upload to orders they're assigned to
        if (orderEntity && orderEntity.assignedTo === userId && ['processing', 'in_progress'].includes(orderEntity.status || 'pending')) {
          hasUploadAccess = true;
          accessReason = "Editor access to assigned order";
        } else if (!orderEntity) {
          accessReason = "No order found for editor to work on";
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
        orderId: orderEntity?.id || 'temp-new-order', // Use temp ID for new orders
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
        console.log(`[UPLOAD DEBUG] Validation failed:`, uploadValidation.errors);
        return res.status(400).json({ 
          error: "Upload validation failed", 
          details: uploadValidation.errors 
        });
      }

      const timestamp = Date.now();
      const sanitizedFileName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      const sanitizedUserId = userId.replace(/[^a-zA-Z0-9-]/g, '');
      const sanitizedJobId = jobId.replace(/[^a-zA-Z0-9-]/g, '');
      
      let filePath: string;
      
      if (folderToken && folderPath) {
        // Standalone folder upload: use tokenized path
        const sanitizedFolderPath = folderPath.replace(/[^a-zA-Z0-9/-]/g, '_');
        const sanitizedFolderToken = folderToken.replace(/[^a-zA-Z0-9-]/g, '');
        filePath = `completed/${sanitizedJobId}/folders/${sanitizedFolderToken}/${sanitizedFolderPath}/${timestamp}_${sanitizedFileName}`;
      } else {
        // Order-based upload: use order number path
        const sanitizedOrderNumber = orderNumber.replace(/[^a-zA-Z0-9-]/g, '');
        filePath = `orders/${sanitizedUserId}/${sanitizedJobId}/${sanitizedOrderNumber}/${timestamp}_${sanitizedFileName}`;
      }

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

      // CRITICAL: Create EditorUpload record IMMEDIATELY after successful Firebase upload
      // This must happen BEFORE activity logging to ensure data persistence regardless of auth issues
      // Note: job is guaranteed to exist here due to validation at line 2602-2606
      const uploadData = {
        jobId: job.id,
        orderId: orderEntity?.id || null, // Optional for standalone folders
        editorId: userId,
        fileName: req.file.originalname,
        originalName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        firebaseUrl: publicUrl,
        downloadUrl: publicUrl,
        folderPath: folderPath || null,
        editorFolderName: folderPath || null, // Set editorFolderName for standalone folders
        folderToken: folderToken || null,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: uploadType === 'client' ? 'completed' : 'uploaded',
        notes: `Uploaded with role-based validation - Role: ${user.role}, Access: ${hasUploadAccess}, Upload Valid: ${uploadValidation.valid}, Upload Type: ${uploadType || 'not specified'}${folderToken ? `, Folder Token: ${folderToken}` : ''}`
      };
      
      await storage.createEditorUpload(uploadData);

      // ENHANCED LOGGING: Comprehensive activity tracking with validation results
      try {
        const authHeader = req.headers.authorization;
        if (authHeader) {
          const idToken = authHeader.replace('Bearer ', '');
          const decodedToken = await adminAuth.verifyIdToken(idToken);
          const userDoc = await getUserDocument(decodedToken.uid);
          
          if (userDoc?.partnerId) {

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
                reservationOrderNumber: reservation?.orderNumber || null,
                folderToken: folderToken || null,
                uploadTimestamp: timestamp,
                securityLevel: 'enhanced_validation'
              }),
              ipAddress: req.ip,
              userAgent: req.get('User-Agent')
            });
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

  // Server-side Firebase upload endpoint for completed files (editor deliverables)
  app.post("/api/upload-completed-files", requireAuth, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Validate file type and size for completed files
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/tiff', 'image/tif', 'image/x-adobe-dng', 'application/zip'];
      if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ error: `Invalid file type. Allowed types: ${allowedTypes.join(', ')}` });
      }

      // File size limit (100MB)
      const maxFileSize = 100 * 1024 * 1024;
      if (req.file.size > maxFileSize) {
        return res.status(400).json({ error: `File too large. Maximum size: ${maxFileSize / 1024 / 1024}MB` });
      }

      const { jobId, orderNumber, folderPath, editorFolderName } = req.body;
      
      // Validate that completed files require folder organization
      if (!folderPath || !editorFolderName) {
        return res.status(400).json({
          error: "Folder path and folder name are required for completed file uploads",
          details: "All completed files must be organized in folders"
        });
      }
      
      if (!jobId) {
        return res.status(400).json({ 
          error: "Missing required parameter: jobId is required" 
        });
      }

      // Get authenticated user - editorId comes from authentication, not request body
      const user = req.user; // Set by requireAuth middleware
      if (!user || user.role !== 'editor') {
        return res.status(403).json({ error: "Only editors can upload completed files" });
      }

      const editorId = user.uid;

      // Find the job with detailed debugging
      console.log(`[UPLOAD DEBUG] Looking for job with jobId: ${jobId}`);
      
      let job = await storage.getJobByJobId(jobId);
      console.log(`[UPLOAD DEBUG] getJobByJobId result:`, job ? `Found job ${job.id}` : 'Not found');
      
      if (!job) {
        const allJobs = await storage.getJobs();
        console.log(`[UPLOAD DEBUG] Total jobs in system: ${allJobs.length}`);
        console.log(`[UPLOAD DEBUG] Available job IDs:`, allJobs.map(j => ({ id: j.id, jobId: j.jobId || 'no-jobId' })));
        
        job = allJobs.find(j => j.id === jobId || j.jobId === jobId);
        console.log(`[UPLOAD DEBUG] Fallback search result:`, job ? `Found job ${job.id}` : 'Still not found');
      }
      
      if (!job) {
        console.log(`[UPLOAD DEBUG] Job not found for jobId: ${jobId}`);
        return res.status(404).json({ error: "Job not found" });
      }
      
      console.log(`[UPLOAD DEBUG] Successfully found job:`, { id: job.id, jobId: job.jobId, partnerId: job.partnerId });

      // For completed file uploads, find an order assigned to this editor for the job
      const allOrders = await storage.getOrders();
      
      // First try to find by the provided orderNumber if it exists
      let orderEntity = null;
      if (orderNumber) {
        orderEntity = allOrders.find(o => o.orderNumber === orderNumber);
      }
      
      // If order not found by orderNumber, or no orderNumber provided, find any order assigned to this editor for this job
      if (!orderEntity) {
        console.log(`[UPLOAD DEBUG] Order ${orderNumber || 'not provided'} not found, searching for editor's assigned order`);
        
        // Find orders for this job that are assigned to the current editor
        // No partnerId check - editors work across different partners
        const jobOrders = allOrders.filter(o => 
          (o.jobId === job.id || o.jobId === job.jobId) && 
          o.assignedTo === editorId
        );
        
        console.log(`[UPLOAD DEBUG] Found ${jobOrders.length} orders assigned to editor for this job`);
        
        if (jobOrders.length === 0) {
          return res.status(403).json({ error: "No orders assigned to you for this job" });
        }
        
        // Prefer orders in processing status, then in_progress
        orderEntity = jobOrders.find(o => o.status === 'processing') || 
                     jobOrders.find(o => o.status === 'in_progress') ||
                     jobOrders[0]; // fallback to first order
        
        console.log(`[UPLOAD DEBUG] Selected order: ${orderEntity.orderNumber} (${orderEntity.status})`);
      }

      // Editor is verified through assignment check above
      // No partnerId check needed - editors work across different partners

      // CRITICAL: Validate the order actually belongs to the requested job
      if (orderEntity.jobId !== job.id && orderEntity.jobId !== job.jobId) {
        return res.status(400).json({ error: "Order does not belong to the specified job" });
      }

      // CRITICAL: Validate editor is actually assigned to this specific order
      if (orderEntity.assignedTo !== editorId) {
        return res.status(403).json({ error: "Access denied: You are not assigned to this order" });
      }

      // Additional validation: Ensure order is in a state that allows uploads
      if (!['processing', 'in_progress'].includes(orderEntity.status || 'pending')) {
        return res.status(400).json({ error: `Cannot upload to order with status: ${orderEntity.status}` });
      }

      // Get Firebase Admin Storage
      const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
      if (!bucketName) {
        throw new Error('FIREBASE_STORAGE_BUCKET environment variable not set');
      }
      
      const bucket = getStorage().bucket(bucketName);
      
      // Create file path with folder structure for completed files
      const timestamp = Date.now();
      const sanitizedFileName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      
      // Build file path with optional folder structure
      // Sanitize order number to remove special characters like #
      const sanitizedOrderNumber = orderEntity.orderNumber.replace(/[^a-zA-Z0-9_-]/g, '');
      let filePath = `completed/${jobId}/${sanitizedOrderNumber}`;
      if (folderPath) {
        // Safely sanitize folder path by segments
        const segments = folderPath.split('/').map(segment => {
          // Remove dangerous patterns and sanitize each segment
          return segment
            .replace(/\.\./g, '') // Remove path traversal attempts
            .replace(/[^a-zA-Z0-9 _-]/g, '_') // Safe character whitelist
            .trim() // Remove leading/trailing spaces
            .substring(0, 50); // Limit length
        }).filter(segment => segment.length > 0); // Remove empty segments
        
        if (segments.length > 0) {
          filePath += `/${segments.join('/')}`;
        }
      }
      filePath += `/${timestamp}_${sanitizedFileName}`;
      
      const file = bucket.file(filePath);

      // Read the uploaded file and upload to Firebase
      const fileBuffer = fs.readFileSync(req.file.path);
      
      await file.save(fileBuffer, {
        metadata: {
          contentType: req.file.mimetype,
        },
      });

      // Generate a signed URL that works for 7 days (more secure than makePublic)
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      const publicUrl = signedUrl;

      // Clean up temporary file
      fs.unlinkSync(req.file.path);

      // Create editor upload record with folder information
      // Store file path, not signed URL - proxy will generate fresh signed URLs on demand
      await storage.createEditorUpload({
        jobId: job.id,
        orderId: orderEntity.id,
        editorId: editorId,
        fileName: sanitizedFileName,
        originalName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        firebaseUrl: filePath, // Store path, not signed URL
        downloadUrl: filePath, // Store path for proxy to generate signed URL
        folderPath: folderPath || null,
        editorFolderName: editorFolderName || null,
        partnerFolderName: null, // Partners can rename later
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        status: 'completed',
        notes: 'Completed deliverable uploaded by editor'
      });

      // Log activity
      try {
        if (user?.partnerId) {
          await storage.createActivity({
            partnerId: orderEntity.partnerId || user.partnerId,
            jobId: job.id,
            orderId: orderEntity.id,
            userId: editorId,
            userEmail: user.email,
            userName: user.email,
            action: "upload_completed",
            category: "deliverable",
            title: "Completed File Upload",
            description: `Editor uploaded completed deliverable: ${req.file.originalname}`,
            metadata: JSON.stringify({
              fileName: req.file.originalname,
              fileSize: req.file.size,
              uploadPath: filePath,
              orderNumber: orderNumber
            }),
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
          });
        }
      } catch (activityError) {
        console.error("Failed to log completed file upload activity:", activityError);
      }

      res.json({
        url: publicUrl,
        path: filePath,
        size: req.file.size,
        originalName: req.file.originalname
      });

    } catch (error: any) {
      console.error("Error uploading completed file to Firebase:", error);
      
      // Clean up temporary file on error
      if (req.file?.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          console.error("Error cleaning up temp file:", unlinkError);
        }
      }
      
      res.status(500).json({ 
        error: "Failed to upload completed file to Firebase", 
        details: error.message 
      });
    }
  });

  // Get completed files for a job (for job card gallery display)
  app.get("/api/jobs/:jobId/completed-files", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { jobId } = req.params;
      
      if (!req.user?.partnerId) {
        return res.status(400).json({ error: "User must have a partnerId" });
      }

      // Find the job
      let job = await storage.getJobByJobId(jobId);
      if (!job) {
        const allJobs = await storage.getJobs();
        job = allJobs.find(j => j.id === jobId || j.jobId === jobId);
      }
      
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Verify job belongs to user's organization
      if (job.partnerId !== req.user.partnerId) {
        return res.status(403).json({ error: "Access denied: Job belongs to different organization" });
      }

      // Get all editor uploads for this job with completed status
      const allUploads = await storage.getEditorUploads(job.id);
      console.log(`[DEBUG] Total uploads for job ${job.id}:`, allUploads.length);
      console.log(`[DEBUG] Upload details:`, allUploads.map(u => ({ 
        id: u.id, 
        fileName: u.fileName, 
        status: u.status || 'no status',
        mimeType: u.mimeType 
      })));
      
      const completedFiles = allUploads.filter(upload => 
        upload.status === 'completed' && 
        upload.fileName !== '.folder_placeholder' // Exclude folder placeholders
      );
      
      console.log(`[DEBUG] Completed files after filtering:`, completedFiles.length);
      console.log(`[DEBUG] Completed file details:`, completedFiles.map(f => ({ 
        id: f.id, 
        fileName: f.fileName, 
        status: f.status 
      })));

      // Group files by order and enrich with order information
      const filesByOrder = completedFiles.reduce((acc, file) => {
        if (!acc[file.orderId]) {
          acc[file.orderId] = [];
        }
        acc[file.orderId].push(file);
        return acc;
      }, {} as Record<string, typeof completedFiles>);

      // Get order information for each group and use proxy URLs
      const enrichedFiles = await Promise.all(
        Object.entries(filesByOrder).map(async ([orderId, files]) => {
          const order = await storage.getOrder(orderId);
          
          // Use proxy URLs instead of direct Firebase URLs
          const filesWithProxyUrls = files.map((file) => ({
            id: file.id,
            fileName: file.fileName,
            originalName: file.originalName,
            fileSize: file.fileSize,
            mimeType: file.mimeType,
            downloadUrl: `/api/files/proxy/${file.id}`, // Use proxy endpoint
            uploadedAt: file.uploadedAt,
            notes: file.notes
          }));
          
          return {
            orderId,
            orderNumber: order?.orderNumber || 'Unknown',
            files: filesWithProxyUrls
          };
        })
      );

      res.json({ completedFiles: enrichedFiles });
    } catch (error: any) {
      console.error("Error fetching completed files:", error);
      res.status(500).json({ 
        error: "Failed to fetch completed files", 
        details: error.message 
      });
    }
  });

  // Get upload folders for a job
  app.get("/api/jobs/:jobId/folders", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { jobId } = req.params;
      
      if (!req.user?.partnerId) {
        return res.status(400).json({ error: "User must have a partnerId" });
      }

      // Find the job
      let job = await storage.getJobByJobId(jobId);
      if (!job) {
        const allJobs = await storage.getJobs();
        job = allJobs.find(j => j.id === jobId || j.jobId === jobId);
      }
      
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Verify job belongs to user's organization
      if (job.partnerId !== req.user.partnerId) {
        return res.status(403).json({ error: "Access denied: Job belongs to different organization" });
      }

      // Get folders for this job
      const folders = await storage.getUploadFolders(job.id);
      
      // Replace Firebase Storage URLs with proxy URLs in each folder's files
      const foldersWithProxyUrls = folders.map(folder => ({
        ...folder,
        files: folder.files.map(file => ({
          ...file,
          downloadUrl: `/api/files/proxy/${file.id}` // Use proxy endpoint
        }))
      }));
      
      res.json(foldersWithProxyUrls);
    } catch (error: any) {
      console.error("Error fetching upload folders:", error);
      res.status(500).json({ 
        error: "Failed to fetch upload folders", 
        details: error.message 
      });
    }
  });

  // Create new folder (for partners to create folders)
  app.post("/api/jobs/:jobId/folders", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { jobId } = req.params;
      const { partnerFolderName } = req.body;
      
      if (!req.user?.partnerId) {
        return res.status(400).json({ error: "User must have a partnerId" });
      }

      if (!partnerFolderName) {
        return res.status(400).json({ error: "partnerFolderName is required" });
      }

      // Find the job
      let job = await storage.getJobByJobId(jobId);
      if (!job) {
        const allJobs = await storage.getJobs();
        job = allJobs.find(j => j.id === jobId || j.jobId === jobId);
      }
      
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Verify job belongs to user's organization
      if (job.partnerId !== req.user.partnerId) {
        return res.status(403).json({ error: "Access denied: Job belongs to different organization" });
      }

      // Generate unique standalone token for this folder
      const folderToken = nanoid(10);

      // Create the folder in storage (in-memory) without order association
      const createdFolder = await storage.createFolder(job.id, partnerFolderName, undefined, undefined, folderToken);
      
      // Create a Firebase placeholder to establish the folder in Firebase Storage
      const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
      if (!bucketName) {
        throw new Error('FIREBASE_STORAGE_BUCKET environment variable not set');
      }
      
      const bucket = getStorage().bucket(bucketName);
      
      // Sanitize folder path with same logic as upload endpoint
      const sanitizedFolderPath = partnerFolderName.split('/').map(segment => {
        return segment
          .replace(/\.\./g, '') // Remove path traversal attempts
          .replace(/[^a-zA-Z0-9 _-]/g, '_') // Safe character whitelist
          .trim() // Remove leading/trailing spaces
          .substring(0, 50); // Limit length
      }).filter(segment => segment.length > 0).join('/');
      
      // Use standalone folder path structure: completed/{jobId}/folders/{token}/{folderPath}
      const placeholderPath = `completed/${job.jobId || job.id}/folders/${folderToken}/${sanitizedFolderPath}/.keep`;
      const placeholderFile = bucket.file(placeholderPath);
      
      // Upload empty placeholder file
      await placeholderFile.save('', {
        metadata: {
          contentType: 'application/octet-stream',
        },
      });
      
      res.json({ 
        success: true, 
        message: "Folder created successfully in Firebase",
        folder: { ...createdFolder, folderToken },
        firebasePath: placeholderPath
      });
    } catch (error: any) {
      console.error("Error creating folder template:", error);
      res.status(500).json({ 
        error: "Failed to create folder template", 
        details: error.message 
      });
    }
  });

  // Delete folder (for partners to delete standalone folders)
  app.delete("/api/jobs/:jobId/folders", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { jobId } = req.params;
      const { folderPath } = req.body;
      
      if (!req.user?.partnerId) {
        return res.status(400).json({ error: "User must have a partnerId" });
      }

      if (!folderPath) {
        return res.status(400).json({ error: "folderPath is required" });
      }

      // Find the job
      let job = await storage.getJobByJobId(jobId);
      if (!job) {
        const allJobs = await storage.getJobs();
        job = allJobs.find(j => j.id === jobId || j.jobId === jobId);
      }
      
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Verify job belongs to user's organization
      if (job.partnerId !== req.user.partnerId) {
        return res.status(403).json({ error: "Access denied: Job belongs to different organization" });
      }

      // Get all uploads for this folder
      const allUploads = Array.from((storage as any).editorUploads.values());
      const folderUploads = allUploads.filter((upload: any) => 
        upload.jobId === job!.id && upload.folderPath === folderPath
      );

      if (folderUploads.length === 0) {
        return res.status(404).json({ error: "Folder not found" });
      }

      // Check if folder has an order (prevent deletion of order-attached folders)
      const hasOrder = folderUploads.some((upload: any) => upload.orderId);
      if (hasOrder) {
        return res.status(400).json({ error: "Cannot delete folder attached to an order" });
      }

      // Get folderToken from any upload in the folder (they all share the same token)
      const uploadWithToken = folderUploads.find((upload: any) => (upload as any).folderToken);
      const folderToken = uploadWithToken ? (uploadWithToken as any).folderToken : (folderUploads[0] as any)?.folderToken;

      // Delete Firebase files if folderToken exists
      if (folderToken) {
        try {
          const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
          if (bucketName) {
            const bucket = getStorage().bucket(bucketName);
            
            // Sanitize folder path for Firebase deletion
            const sanitizedFolderPath = folderPath.split('/').map(segment => {
              return segment
                .replace(/\.\./g, '')
                .replace(/[^a-zA-Z0-9 _-]/g, '_')
                .trim()
                .substring(0, 50);
            }).filter(segment => segment.length > 0).join('/');
            
            // Delete all files in the Firebase folder
            const folderPrefix = `completed/${job.jobId || job.id}/folders/${folderToken}/${sanitizedFolderPath}/`;
            const [files] = await bucket.getFiles({ prefix: folderPrefix });
            
            await Promise.all(files.map(file => file.delete()));
            console.log(`Deleted ${files.length} files from Firebase for folder: ${folderPath}`);
          }
        } catch (firebaseError) {
          console.error("Error deleting Firebase files:", firebaseError);
          // Continue with database deletion even if Firebase deletion fails
        }
      }

      // Delete all upload records for this folder
      for (const upload of folderUploads) {
        (storage as any).editorUploads.delete(upload.id);
      }

      // Save changes
      await (storage as any).saveToFile();

      res.json({ 
        success: true, 
        message: `Folder deleted successfully. Removed ${folderUploads.length} upload(s).`,
        deletedCount: folderUploads.length
      });
    } catch (error: any) {
      console.error("Error deleting folder:", error);
      res.status(500).json({ 
        error: "Failed to delete folder", 
        details: error.message 
      });
    }
  });

  // Update folder name (for partners to rename folders)  
  app.patch("/api/jobs/:jobId/folders/rename", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { jobId } = req.params;
      const { folderPath, newPartnerFolderName } = req.body;
      
      if (!req.user?.partnerId) {
        return res.status(400).json({ error: "User must have a partnerId" });
      }

      if (!newPartnerFolderName) {
        return res.status(400).json({ error: "newPartnerFolderName is required" });
      }

      // Find the job
      let job = await storage.getJobByJobId(jobId);
      if (!job) {
        const allJobs = await storage.getJobs();
        job = allJobs.find(j => j.id === jobId || j.jobId === jobId);
      }
      
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Verify job belongs to user's organization
      if (job.partnerId !== req.user.partnerId) {
        return res.status(403).json({ error: "Access denied: Job belongs to different organization" });
      }

      // Update folder name
      await storage.updateFolderName(job.id, folderPath, newPartnerFolderName);
      
      res.json({ success: true, message: "Folder renamed successfully" });
    } catch (error: any) {
      console.error("Error renaming folder:", error);
      res.status(500).json({ 
        error: "Failed to rename folder", 
        details: error.message 
      });
    }
  });

  // Update job cover photo
  app.patch("/api/jobs/:jobId/cover-photo", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { jobId } = req.params;
      
      console.log("[COVER PHOTO] Request body:", req.body);
      console.log("[COVER PHOTO] User:", req.user);
      
      // Validate request body
      const coverPhotoSchema = z.object({
        imageUrl: z.string().min(1, "imageUrl is required"),
      });
      
      const validationResult = coverPhotoSchema.safeParse(req.body);
      if (!validationResult.success) {
        console.log("[COVER PHOTO] Validation failed:", validationResult.error.errors);
        return res.status(400).json({ 
          error: "Invalid request body", 
          details: validationResult.error.errors 
        });
      }
      
      const { imageUrl } = validationResult.data;
      
      if (!req.user?.partnerId) {
        return res.status(400).json({ error: "User must have a partnerId" });
      }

      // Find the job
      let job = await storage.getJobByJobId(jobId);
      if (!job) {
        const allJobs = await storage.getJobs();
        job = allJobs.find(j => j.id === jobId || j.jobId === jobId);
      }
      
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Verify job belongs to user's organization
      if (job.partnerId !== req.user.partnerId) {
        return res.status(403).json({ error: "Access denied: Job belongs to different organization" });
      }

      // Update job with the new cover photo
      await storage.updateJob(job.id, {
        propertyImage: imageUrl,
        propertyImageThumbnail: imageUrl, // Use same image for thumbnail for now
      });
      
      res.json({ success: true, message: "Cover photo updated successfully" });
    } catch (error: any) {
      console.error("Error updating cover photo:", error);
      res.status(500).json({ 
        error: "Failed to update cover photo", 
        details: error.message 
      });
    }
  });

  // Proxy endpoint to serve files from Firebase Storage
  // This bypasses browser issues with # character in URLs
  app.get("/api/files/proxy/:fileId", async (req, res) => {
    try {
      const { fileId } = req.params;
      
      // Search through all jobs to find the file
      const allJobs = await storage.getJobs();
      let file: EditorUpload | undefined;
      
      for (const job of allJobs) {
        const uploads = await storage.getEditorUploads(job.id);
        file = uploads.find(u => u.id === fileId);
        if (file) break;
      }
      
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      
      // Get file path - now stored directly, not as signed URL
      const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
      if (!bucketName) {
        throw new Error('FIREBASE_STORAGE_BUCKET environment variable not set');
      }
      
      let filePath: string;
      
      // Check if downloadUrl is a file path or a signed URL (for backwards compatibility)
      if (file.downloadUrl.startsWith('http')) {
        // Legacy signed URL - extract the path
        const urlPattern = new RegExp(`https://storage\\.googleapis\\.com/${bucketName.replace('.', '\\.')}/(.+?)(?:\\?|$)`);
        const match = file.downloadUrl.match(urlPattern);
        
        if (!match || !match[1]) {
          return res.status(400).json({ error: "Invalid file URL format" });
        }
        
        filePath = decodeURIComponent(match[1]);
      } else {
        // Modern file path stored directly
        filePath = file.downloadUrl;
      }
      
      console.log(`[PROXY] Streaming file: ${filePath}`);
      
      const bucket = getStorage().bucket(bucketName);
      const storageFile = bucket.file(filePath);
      
      // Check if file exists first
      const [exists] = await storageFile.exists();
      if (!exists) {
        console.error(`[PROXY] File does not exist in Firebase Storage: ${filePath}`);
        return res.status(404).json({ error: 'File not found in storage' });
      }
      
      // Get file metadata to set proper Content-Length
      const [metadata] = await storageFile.getMetadata();
      const fileSize = metadata.size;
      
      console.log(`[PROXY] File exists, size: ${fileSize} bytes, mimeType: ${file.mimeType}`);
      
      // Set headers before streaming
      res.setHeader('Content-Type', file.mimeType);
      res.setHeader('Content-Length', fileSize);
      res.setHeader('Content-Disposition', `inline; filename="${file.originalName}"`);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // 1 year cache
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('ETag', `"${fileId}"`); // Use fileId as ETag for cache validation
      
      // Stream the file from Firebase Storage to the client
      const stream = storageFile.createReadStream();
      
      stream.on('error', (error) => {
        console.error('[PROXY] Error streaming file:', error);
        if (!res.headersSent) {
          res.status(500).send('Failed to stream file');
        } else {
          res.end();
        }
      });
      
      stream.on('end', () => {
        console.log(`[PROXY] Successfully streamed file: ${file.fileName}`);
      });
      
      stream.pipe(res);
    } catch (error: any) {
      console.error('Error in file proxy:', error);
      res.status(500).json({ error: 'Failed to proxy file', details: error.message });
    }
  });

  // Public delivery endpoint - Uses deliveryToken for secure access only
  app.get("/api/delivery/:token", async (req, res) => {
    try {
      const { token } = req.params;

      // Find job by delivery token (secure, unguessable credential)
      const job = await storage.getJobByDeliveryToken(token);
      
      if (!job) {
        return res.status(404).json({ error: "Delivery not found" });
      }

      // Get customer details if available
      let customer = null;
      if (job.customerId) {
        customer = await storage.getCustomer(job.customerId);
      }

      // Get all editor uploads for this job with completed status
      const allUploads = await storage.getEditorUploads(job.id);
      const completedFiles = allUploads.filter(upload => 
        upload.status === 'completed' && 
        upload.fileName !== '.folder_placeholder' // Exclude folder placeholders
      );

      // Group files by order and enrich with order information (backward compatibility)
      const filesByOrder = completedFiles.reduce((acc, file) => {
        if (!acc[file.orderId]) {
          acc[file.orderId] = [];
        }
        acc[file.orderId].push(file);
        return acc;
      }, {} as Record<string, typeof completedFiles>);

      // Get order information for each group
      const enrichedFiles = await Promise.all(
        Object.entries(filesByOrder).map(async ([orderId, files]) => {
          const order = await storage.getOrder(orderId);
          return {
            orderId,
            orderNumber: order?.orderNumber || 'Unknown',
            files: files.map(file => ({
              id: file.id,
              fileName: file.fileName,
              originalName: file.originalName,
              fileSize: file.fileSize,
              mimeType: file.mimeType,
              downloadUrl: file.downloadUrl,
              uploadedAt: file.uploadedAt,
              notes: file.notes
            }))
          };
        })
      );

      // Get folder structure with files
      const folders = await storage.getUploadFolders(job.id);
      
      // Get all file comments for this job
      const allComments = await storage.getJobFileComments(job.id);
      
      // Create a map of file IDs to comment counts
      const commentCounts = allComments.reduce((acc, comment) => {
        acc[comment.fileId] = (acc[comment.fileId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Get order information and revision status
      const orders = await storage.getOrders(job.partnerId);
      const jobOrders = orders.filter(o => o.jobId === job.id);
      
      // Get revision status for each order (with defensive coding)
      const revisionStatuses = await Promise.all(
        jobOrders.map(async (order) => {
          const status = await storage.getOrderRevisionStatus(order.id);
          if (!status) {
            return { orderId: order.id, maxRounds: 2, usedRounds: 0, remainingRounds: 2 };
          }
          return { orderId: order.id, ...status };
        })
      );

      // Get job review if exists
      const jobReview = await storage.getJobReview(job.id);

      // Get partner settings for branding (logo, business name)
      const partnerSettings = await storage.getPartnerSettings(job.partnerId);
      const branding = partnerSettings?.businessProfile ? 
        JSON.parse(partnerSettings.businessProfile) : 
        { businessName: 'RPP', logoUrl: '' };

      // Enrich folders with comment counts
      const enrichedFolders = folders.map(folder => ({
        ...folder,
        files: folder.files.map(file => ({
          ...file,
          commentCount: commentCounts[file.id] || 0,
        }))
      }));

      // Return job info, folders with files, revision status, and branding
      // Keep completedFiles for backward compatibility
      res.json({
        job: {
          id: job.id,
          jobId: job.jobId,
          address: job.address,
          status: job.status,
          appointmentDate: job.appointmentDate,
          propertyImage: job.propertyImage,
          customer: customer ? {
            firstName: customer.firstName,
            lastName: customer.lastName,
            company: customer.company,
          } : null,
        },
        completedFiles: enrichedFiles, // Backward compatibility
        folders: enrichedFolders,
        revisionStatus: revisionStatuses,
        jobReview,
        branding: {
          businessName: branding.businessName || 'RPP',
          logoUrl: branding.logoUrl || '',
        },
      });
    } catch (error: any) {
      console.error("Error fetching delivery data:", error);
      res.status(500).json({ 
        error: "Failed to fetch delivery data", 
        details: error.message 
      });
    }
  });

  // Authenticated partner preview endpoint - Uses jobId for internal previews
  app.get("/api/jobs/:jobId/preview", requireAuth, async (req, res) => {
    try {
      const { jobId } = req.params;
      const { partnerId } = req.user;

      // Find job by jobId (supports both nanoId and UUID) and verify ownership
      const job = await storage.getJobByJobId(jobId);
      
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Verify the job belongs to this partner
      if (job.partnerId !== partnerId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Get customer details if available
      let customer = null;
      if (job.customerId) {
        customer = await storage.getCustomer(job.customerId);
      }

      // Get all editor uploads for this job with completed status
      const allUploads = await storage.getEditorUploads(job.id);
      const completedFiles = allUploads.filter(upload => 
        upload.status === 'completed' && 
        upload.fileName !== '.folder_placeholder'
      );

      // Group files by order and enrich with order information
      const filesByOrder = completedFiles.reduce((acc, file) => {
        if (!acc[file.orderId]) {
          acc[file.orderId] = [];
        }
        acc[file.orderId].push(file);
        return acc;
      }, {} as Record<string, typeof completedFiles>);

      const enrichedFiles = await Promise.all(
        Object.entries(filesByOrder).map(async ([orderId, files]) => {
          const order = await storage.getOrder(orderId);
          return {
            orderId,
            orderNumber: order?.orderNumber || 'Unknown',
            files: files.map(file => ({
              id: file.id,
              fileName: file.fileName,
              originalName: file.originalName,
              fileSize: file.fileSize,
              mimeType: file.mimeType,
              downloadUrl: file.downloadUrl,
              uploadedAt: file.uploadedAt,
              notes: file.notes
            }))
          };
        })
      );

      // Get folder structure with files
      const folders = await storage.getUploadFolders(job.id);
      
      // Get all file comments for this job
      const allComments = await storage.getJobFileComments(job.id);
      
      // Create a map of file IDs to comment counts
      const commentCounts = allComments.reduce((acc, comment) => {
        acc[comment.fileId] = (acc[comment.fileId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Get order information and revision status
      const orders = await storage.getOrders(job.partnerId);
      const jobOrders = orders.filter(o => o.jobId === job.id);
      
      // Get revision status for each order
      const revisionStatuses = await Promise.all(
        jobOrders.map(async (order) => {
          const status = await storage.getOrderRevisionStatus(order.id);
          if (!status) {
            return { orderId: order.id, maxRounds: 2, usedRounds: 0, remainingRounds: 2 };
          }
          return { orderId: order.id, ...status };
        })
      );

      // Get job review if exists
      const jobReview = await storage.getJobReview(job.id);

      // Get partner settings for branding (logo, business name)
      const partnerSettings = await storage.getPartnerSettings(job.partnerId);
      const branding = partnerSettings?.businessProfile ? 
        JSON.parse(partnerSettings.businessProfile) : 
        { businessName: 'RPP', logoUrl: '' };

      // Enrich folders with comment counts
      const enrichedFolders = folders.map(folder => ({
        ...folder,
        files: folder.files.map(file => ({
          ...file,
          commentCount: commentCounts[file.id] || 0,
        }))
      }));

      // Return same format as public delivery endpoint with branding
      res.json({
        job: {
          id: job.id,
          jobId: job.jobId,
          address: job.address,
          status: job.status,
          appointmentDate: job.appointmentDate,
          propertyImage: job.propertyImage,
          customer: customer ? {
            firstName: customer.firstName,
            lastName: customer.lastName,
            company: customer.company,
          } : null,
        },
        completedFiles: enrichedFiles,
        folders: enrichedFolders,
        revisionStatus: revisionStatuses,
        jobReview,
        branding: {
          businessName: branding.businessName || 'RPP',
          logoUrl: branding.logoUrl || '',
        },
      });
    } catch (error: any) {
      console.error("Error fetching job preview:", error);
      res.status(500).json({ 
        error: "Failed to fetch job preview", 
        details: error.message 
      });
    }
  });

  // Authenticated jobId-based endpoints for preview mode

  // Get file comments (authenticated preview mode)
  app.get("/api/jobs/:jobId/files/:fileId/comments", requireAuth, async (req, res) => {
    try {
      const { jobId, fileId } = req.params;
      const { partnerId } = req.user;

      // Get job (supports both nanoId and UUID) and verify ownership
      const job = await storage.getJobByJobId(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      if (job.partnerId !== partnerId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Verify file belongs to this job
      const jobUploads = await storage.getEditorUploads(job.id);
      const file = jobUploads.find(f => f.id === fileId);
      
      if (!file) {
        return res.status(404).json({ error: "File not found in this job" });
      }
      
      // Get comments scoped to this file
      const comments = await storage.getFileComments(fileId);
      res.json(comments);
    } catch (error: any) {
      console.error("Error fetching file comments:", error);
      res.status(500).json({ 
        error: "Failed to fetch file comments", 
        details: error.message 
      });
    }
  });

  // Create file comment (authenticated preview mode)
  app.post("/api/jobs/:jobId/files/:fileId/comments", requireAuth, async (req, res) => {
    try {
      const { jobId, fileId } = req.params;
      const { partnerId } = req.user;
      const { authorId, authorName, authorRole, message } = req.body;

      // Get job (supports both nanoId and UUID) and verify ownership
      const job = await storage.getJobByJobId(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      if (job.partnerId !== partnerId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Verify file belongs to this job
      const jobUploads = await storage.getEditorUploads(job.id);
      const file = jobUploads.find(f => f.id === fileId);
      
      if (!file) {
        return res.status(404).json({ error: "File not found in this job" });
      }
      
      // Create comment scoped to this job/file
      const validated = insertFileCommentSchema.parse({
        fileId,
        orderId: file.orderId,
        jobId: job.id,
        authorId,
        authorName,
        authorRole,
        message,
      });
      
      const comment = await storage.createFileComment(validated);
      res.status(201).json(comment);
    } catch (error: any) {
      console.error("Error creating file comment:", error);
      res.status(400).json({ 
        error: "Failed to create file comment", 
        details: error.message 
      });
    }
  });

  // Submit job review (authenticated preview mode)
  app.post("/api/jobs/:jobId/review", requireAuth, async (req, res) => {
    try {
      const { jobId } = req.params;
      const { partnerId } = req.user;
      const { rating, review, submittedBy, submittedByEmail } = req.body;

      // Get job (supports both nanoId and UUID) and verify ownership
      const job = await storage.getJobByJobId(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      if (job.partnerId !== partnerId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Check if review already exists
      const existingReview = await storage.getJobReview(job.id);
      if (existingReview) {
        return res.status(400).json({ error: "Review already submitted for this job" });
      }

      // Validate and create review
      const validated = insertJobReviewSchema.parse({
        jobId: job.id,
        rating,
        review,
        submittedBy,
        submittedByEmail,
      });

      const newReview = await storage.createJobReview(validated);
      res.status(201).json(newReview);
    } catch (error: any) {
      console.error("Error creating job review:", error);
      res.status(400).json({ 
        error: "Failed to create job review", 
        details: error.message 
      });
    }
  });

  // Request revisions (authenticated preview mode)
  app.post("/api/jobs/:jobId/revisions/request", requireAuth, async (req, res) => {
    try {
      const { jobId } = req.params;
      const { partnerId } = req.user;
      const { orderId, fileIds, comments } = req.body;

      if (!orderId || !fileIds || !Array.isArray(fileIds)) {
        return res.status(400).json({ error: "orderId and fileIds array required" });
      }

      // Get job (supports both nanoId and UUID) and verify ownership
      const job = await storage.getJobByJobId(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      if (job.partnerId !== partnerId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Verify order belongs to this job
      const order = await storage.getOrder(orderId);
      if (!order || order.jobId !== job.id) {
        return res.status(404).json({ error: "Order not found for this job" });
      }

      // Verify all files belong to this job
      const jobUploads = await storage.getEditorUploads(job.id);
      const validFileIds = jobUploads.map(f => f.id);
      const invalidFiles = fileIds.filter(fid => !validFileIds.includes(fid));
      
      if (invalidFiles.length > 0) {
        return res.status(400).json({ error: "Some files do not belong to this job" });
      }

      // Check revision limits
      const revisionStatus = await storage.getOrderRevisionStatus(orderId);
      if (revisionStatus && revisionStatus.remainingRounds <= 0) {
        return res.status(400).json({ 
          error: "No revision rounds remaining",
          revisionStatus 
        });
      }

      // Create revision request
      const validated = insertRevisionRequestSchema.parse({
        orderId,
        fileIds,
        comments,
        status: 'pending',
      });

      const revision = await storage.createRevisionRequest(validated);
      res.status(201).json(revision);
    } catch (error: any) {
      console.error("Error creating revision request:", error);
      res.status(400).json({ 
        error: "Failed to create revision request", 
        details: error.message 
      });
    }
  });

  // Get file comments for a specific file within a job (token scopes access)
  app.get("/api/delivery/:token/files/:fileId/comments", async (req, res) => {
    try {
      const { token, fileId } = req.params;
      
      // Verify job exists first (deliveryToken is the access credential)
      const job = await storage.getJobByDeliveryToken(token);
      
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      // Verify file belongs to this job
      const jobUploads = await storage.getEditorUploads(job.id);
      const file = jobUploads.find(f => f.id === fileId);
      
      if (!file) {
        return res.status(404).json({ error: "File not found in this job" });
      }
      
      // Get comments scoped to this file
      const comments = await storage.getFileComments(fileId);
      res.json(comments);
    } catch (error: any) {
      console.error("Error fetching file comments:", error);
      res.status(500).json({ 
        error: "Failed to fetch file comments", 
        details: error.message 
      });
    }
  });

  // Create a file comment scoped to a job (token is the access credential)
  app.post("/api/delivery/:token/files/:fileId/comments", async (req, res) => {
    try {
      const { token, fileId } = req.params;
      const { authorId, authorName, authorRole, message } = req.body;
      
      // Verify job exists first (deliveryToken is the access credential)
      const job = await storage.getJobByDeliveryToken(token);
      
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      // Verify file belongs to this job
      const jobUploads = await storage.getEditorUploads(job.id);
      const file = jobUploads.find(f => f.id === fileId);
      
      if (!file) {
        return res.status(404).json({ error: "File not found in this job" });
      }
      
      // Get the order for this file
      const order = await storage.getOrder(file.orderId);
      
      // Create comment scoped to this job/file
      const validated = insertFileCommentSchema.parse({
        fileId,
        orderId: file.orderId,
        jobId: job.id,
        authorId,
        authorName,
        authorRole,
        message,
      });
      
      const comment = await storage.createFileComment(validated);
      res.status(201).json(comment);
    } catch (error: any) {
      console.error("Error creating file comment:", error);
      res.status(400).json({ 
        error: "Failed to create file comment", 
        details: error.message 
      });
    }
  });

  // Update file comment status (requires auth)
  app.patch("/api/file-comments/:commentId/status", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { commentId } = req.params;
      const { status } = req.body;
      
      if (!['pending', 'in-progress', 'resolved'].includes(status)) {
        return res.status(400).json({ error: "Invalid status value" });
      }
      
      // Get the comment to verify access
      const existingComments = await storage.getJobFileComments(''); // Will need improvement
      const comment = existingComments.find(c => c.id === commentId);
      
      if (!comment) {
        return res.status(404).json({ error: "Comment not found" });
      }
      
      // Verify job/partner access
      const job = await storage.getJob(comment.jobId);
      if (!job || (req.user?.partnerId && job.partnerId !== req.user.partnerId)) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const updatedComment = await storage.updateFileCommentStatus(commentId, status);
      res.json(updatedComment);
    } catch (error: any) {
      console.error("Error updating comment status:", error);
      res.status(500).json({ 
        error: "Failed to update comment status", 
        details: error.message 
      });
    }
  });

  // Submit job review scoped to a job (token is the access credential)
  app.post("/api/delivery/:token/review", async (req, res) => {
    try {
      const { token } = req.params;
      const { rating, review, submittedBy, submittedByEmail } = req.body;
      
      // Verify job exists first (deliveryToken is the access credential)
      const job = await storage.getJobByDeliveryToken(token);
      
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      // Check if review already exists
      const existingReview = await storage.getJobReview(job.id);
      if (existingReview) {
        return res.status(400).json({ error: "Review already submitted for this job" });
      }
      
      // Create review scoped to this job
      const validated = insertJobReviewSchema.parse({
        jobId: job.id,
        partnerId: job.partnerId,
        rating,
        review,
        submittedBy,
        submittedByEmail,
      });
      
      const newReview = await storage.createJobReview(validated);
      res.status(201).json(newReview);
    } catch (error: any) {
      console.error("Error creating job review:", error);
      res.status(400).json({ 
        error: "Failed to create job review", 
        details: error.message 
      });
    }
  });

  // Generate delivery token for a job (requires auth - partner only)
  app.post("/api/jobs/:jobId/generate-delivery-token", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { jobId } = req.params;
      
      // Verify job exists and belongs to partner
      const job = await storage.getJobByJobId(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      if (req.user?.partnerId && job.partnerId !== req.user.partnerId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Generate or get existing delivery token
      const token = await storage.generateDeliveryToken(jobId);
      
      // Construct the delivery link
      const deliveryLink = `${req.protocol}://${req.get('host')}/delivery/${token}`;
      
      res.status(200).json({ token, deliveryLink });
    } catch (error: any) {
      console.error("Error generating delivery token:", error);
      res.status(500).json({ 
        error: "Failed to generate delivery token", 
        details: error.message 
      });
    }
  });

  // Send delivery email (requires auth - partner only)
  app.post("/api/delivery-emails", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const validated = insertDeliveryEmailSchema.parse(req.body);
      
      // Verify job exists and belongs to partner
      const job = await storage.getJob(validated.jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      if (req.user?.partnerId && job.partnerId !== req.user.partnerId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Generate delivery token if it doesn't exist
      const token = await storage.generateDeliveryToken(job.jobId || job.id);
      const deliveryLink = `${req.protocol}://${req.get('host')}/delivery/${token}`;
      
      // Set sentBy from authenticated user and include the secure delivery link
      const emailData = {
        ...validated,
        sentBy: req.user?.uid || 'system',
        deliveryLink, // Override with secure tokenized link
      };
      
      const email = await storage.createDeliveryEmail(emailData);
      
      // TODO: Integrate with actual email service here
      // For now, just log the email
      console.log('Delivery email created:', {
        to: email.recipientEmail,
        subject: email.subject,
        link: email.deliveryLink
      });
      
      res.status(201).json(email);
    } catch (error: any) {
      console.error("Error sending delivery email:", error);
      res.status(400).json({ 
        error: "Failed to send delivery email", 
        details: error.message 
      });
    }
  });

  // Request revisions scoped to a job (token is the access credential)
  app.post("/api/delivery/:token/revisions/request", async (req, res) => {
    try {
      const { token } = req.params;
      const { orderId, fileIds, comments } = req.body;
      
      if (!orderId || !fileIds || !Array.isArray(fileIds)) {
        return res.status(400).json({ error: "orderId and fileIds array required" });
      }
      
      // Verify job exists first (deliveryToken is the access credential)
      const job = await storage.getJobByDeliveryToken(token);
      
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      // Verify order belongs to this job
      const order = await storage.getOrder(orderId);
      if (!order || order.jobId !== job.id) {
        return res.status(404).json({ error: "Order not found for this job" });
      }
      
      // Verify all files belong to this job
      const jobUploads = await storage.getEditorUploads(job.id);
      const validFileIds = jobUploads.map(f => f.id);
      const invalidFiles = fileIds.filter(fid => !validFileIds.includes(fid));
      
      if (invalidFiles.length > 0) {
        return res.status(400).json({ error: "Some files do not belong to this job" });
      }
      
      // Increment revision round for the order
      const updatedOrder = await storage.incrementRevisionRound(orderId);
      if (!updatedOrder) {
        return res.status(404).json({ error: "Failed to update order" });
      }
      
      // Update order status to 'in_revision'
      await storage.updateOrderStatus(orderId, 'in_revision');
      
      // Create comment entries for each file if comments provided
      if (comments && Array.isArray(comments)) {
        await Promise.all(
          comments.map((comment: any) => 
            storage.createFileComment(insertFileCommentSchema.parse({
              ...comment,
              jobId: job.id,
              orderId,
            }))
          )
        );
      }
      
      // Get customer info for notifications
      const customer = job.customerId ? await storage.getCustomer(job.customerId) : null;
      const customerName = customer ? `${customer.firstName} ${customer.lastName}` : 'Client';
      
      // Create notifications for editor and partner
      const notifications = [];
      
      // Notify the assigned editor if exists
      if (order.assignedTo) {
        notifications.push(insertNotificationSchema.parse({
          partnerId: job.partnerId,
          recipientId: order.assignedTo,
          type: 'revision_request',
          title: 'Revision Requested',
          body: `${customerName} has requested revisions for ${job.address} (Order ${order.orderNumber})`,
          orderId: orderId,
          jobId: job.id,
        }));
      }
      
      // Notify the partner
      notifications.push(insertNotificationSchema.parse({
        partnerId: job.partnerId,
        recipientId: job.partnerId,
        type: 'revision_request',
        title: 'Revision Requested',
        body: `${customerName} has requested revisions for ${job.address} (Order ${order.orderNumber})`,
        orderId: orderId,
        jobId: job.id,
      }));
      
      await storage.createNotifications(notifications);
      
      res.json({ 
        success: true, 
        order: updatedOrder,
        message: "Revision request submitted successfully" 
      });
    } catch (error: any) {
      console.error("Error requesting revisions:", error);
      res.status(500).json({ 
        error: "Failed to request revisions", 
        details: error.message 
      });
    }
  });

  // Get revision status for an order scoped to a job (token is the access credential)
  app.get("/api/delivery/:token/orders/:orderId/revision-status", async (req, res) => {
    try {
      const { token, orderId } = req.params;
      
      // Verify job exists first (deliveryToken is the access credential)
      const job = await storage.getJobByDeliveryToken(token);
      
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      // Verify order belongs to this job
      const order = await storage.getOrder(orderId);
      if (!order || order.jobId !== job.id) {
        return res.status(404).json({ error: "Order not found for this job" });
      }
      
      const status = await storage.getOrderRevisionStatus(orderId);
      if (!status) {
        return res.status(404).json({ error: "Revision status not found" });
      }
      
      res.json(status);
    } catch (error: any) {
      console.error("Error fetching revision status:", error);
      res.status(500).json({ 
        error: "Failed to fetch revision status", 
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

  // Editing Options Routes (Settings - Master List)
  app.get("/api/editing-options", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.partnerId) {
        return res.status(401).json({ error: "Partner ID required" });
      }
      const options = await storage.getEditingOptions(req.user.partnerId);
      res.json(options);
    } catch (error: any) {
      console.error("Error fetching editing options:", error);
      res.status(500).json({ error: "Failed to fetch editing options" });
    }
  });

  app.post("/api/editing-options", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.partnerId) {
        return res.status(401).json({ error: "Partner ID required" });
      }
      const validatedData = insertEditingOptionSchema.parse({
        ...req.body,
        partnerId: req.user.partnerId
      });
      const option = await storage.createEditingOption(validatedData);
      res.status(201).json(option);
    } catch (error: any) {
      console.error("Error creating editing option:", error);
      res.status(400).json({ error: "Invalid editing option data" });
    }
  });

  app.patch("/api/editing-options/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.partnerId) {
        return res.status(401).json({ error: "Partner ID required" });
      }
      const option = await storage.updateEditingOption(
        req.params.id,
        req.body,
        req.user.partnerId
      );
      if (!option) {
        return res.status(404).json({ error: "Editing option not found" });
      }
      res.json(option);
    } catch (error: any) {
      console.error("Error updating editing option:", error);
      res.status(500).json({ error: "Failed to update editing option" });
    }
  });

  app.delete("/api/editing-options/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.partnerId) {
        return res.status(401).json({ error: "Partner ID required" });
      }
      await storage.deleteEditingOption(req.params.id, req.user.partnerId);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting editing option:", error);
      res.status(500).json({ error: "Failed to delete editing option" });
    }
  });

  // Customer Editing Preferences Routes
  app.get("/api/customers/:customerId/editing-preferences", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.partnerId) {
        return res.status(401).json({ error: "Partner ID required" });
      }

      // Verify customer belongs to partner
      const customer = await storage.getCustomer(req.params.customerId);
      if (!customer || customer.partnerId !== req.user.partnerId) {
        return res.status(404).json({ error: "Customer not found" });
      }

      const preferences = await storage.getCustomerEditingPreferences(req.params.customerId);
      res.json(preferences);
    } catch (error: any) {
      console.error("Error fetching customer preferences:", error);
      res.status(500).json({ error: "Failed to fetch customer editing preferences" });
    }
  });

  app.post("/api/customers/:customerId/editing-preferences", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.partnerId) {
        return res.status(401).json({ error: "Partner ID required" });
      }

      // Verify customer belongs to partner
      const customer = await storage.getCustomer(req.params.customerId);
      if (!customer || customer.partnerId !== req.user.partnerId) {
        return res.status(404).json({ error: "Customer not found" });
      }

      const { preferences } = req.body;
      if (!Array.isArray(preferences)) {
        return res.status(400).json({ error: "Preferences must be an array" });
      }
      await storage.saveCustomerPreferences(req.params.customerId, preferences);
      res.status(200).json({ success: true });
    } catch (error: any) {
      console.error("Error saving customer preferences:", error);
      res.status(500).json({ error: "Failed to save customer preferences" });
    }
  });

  // Get customer editing preferences with option details
  app.get("/api/customers/:customerId/editing-preferences/detailed", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.partnerId) {
        return res.status(401).json({ error: "Partner ID required" });
      }

      // Verify customer belongs to partner
      const customer = await storage.getCustomer(req.params.customerId);
      if (!customer || customer.partnerId !== req.user.partnerId) {
        return res.status(404).json({ error: "Customer not found" });
      }
      
      const [options, preferences] = await Promise.all([
        storage.getEditingOptions(req.user.partnerId),
        storage.getCustomerEditingPreferences(req.params.customerId)
      ]);
      
      // Map preferences to options with enabled status
      const detailedPreferences = options.map(option => {
        const pref = preferences.find(p => p.editingOptionId === option.id);
        return {
          ...option,
          isEnabled: pref?.isEnabled || false,
          notes: pref?.notes || null,
          preferenceId: pref?.id || null
        };
      });
      
      res.json(detailedPreferences);
    } catch (error: any) {
      console.error("Error fetching detailed preferences:", error);
      res.status(500).json({ error: "Failed to fetch detailed preferences" });
    }
  });


  // Get partner settings
  app.get("/api/settings", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.partnerId) {
        return res.status(401).json({ error: "Partner ID required" });
      }

      const settings = await storage.getPartnerSettings(req.user.partnerId);
      
      if (!settings) {
        return res.json({
          businessProfile: null,
          personalProfile: null,
          businessHours: null
        });
      }

      res.json({
        businessProfile: settings.businessProfile ? JSON.parse(settings.businessProfile) : null,
        personalProfile: settings.personalProfile ? JSON.parse(settings.personalProfile) : null,
        businessHours: settings.businessHours ? JSON.parse(settings.businessHours) : null,
        defaultMaxRevisionRounds: settings.defaultMaxRevisionRounds ?? 2
      });
    } catch (error: any) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  // Save partner settings
  app.put("/api/settings", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.partnerId) {
        return res.status(401).json({ error: "Partner ID required" });
      }

      const { businessProfile, personalProfile, businessHours, defaultMaxRevisionRounds } = req.body;

      // Save settings to storage with JSON stringified data
      const savedSettings = await storage.savePartnerSettings(req.user.partnerId, {
        partnerId: req.user.partnerId,
        businessProfile: businessProfile ? JSON.stringify(businessProfile) : null,
        personalProfile: personalProfile ? JSON.stringify(personalProfile) : null,
        businessHours: businessHours ? JSON.stringify(businessHours) : null,
        defaultMaxRevisionRounds: defaultMaxRevisionRounds !== undefined ? defaultMaxRevisionRounds : 2
      });

      res.json({ 
        success: true, 
        message: "Settings saved successfully",
        settings: savedSettings
      });
    } catch (error: any) {
      console.error("Error saving settings:", error);
      res.status(500).json({ error: "Failed to save settings" });
    }
  });

  // ============================================================================
  // MESSAGING ENDPOINTS
  // ============================================================================

  // Get all conversations for the current user (partner or editor)
  app.get("/api/conversations", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { uid, partnerId } = req.user!;

      // Get conversations where user is either partner or editor
      const conversations = await storage.getUserConversations(uid, partnerId);

      res.json(conversations);
    } catch (error: any) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  // Get total unread message count for current user (MUST come before /:id route)
  app.get("/api/conversations/unread-count", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { uid, partnerId } = req.user!;

      const count = await storage.getUnreadMessageCount(uid, partnerId);

      res.json({ count });
    } catch (error: any) {
      console.error("Error fetching unread count:", error);
      res.status(500).json({ error: "Failed to fetch unread count" });
    }
  });

  // Get a specific conversation with its messages
  app.get("/api/conversations/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const { uid, partnerId } = req.user!;

      // Get conversation
      const conversation = await storage.getConversation(id);

      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      // Verify user has access to this conversation
      if (conversation.partnerId !== partnerId && conversation.editorId !== uid) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Get messages for this conversation
      const messages = await storage.getConversationMessages(id);

      res.json({
        conversation,
        messages
      });
    } catch (error: any) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  // Create or get a conversation between partner and editor
  app.post("/api/conversations", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { uid, partnerId, email } = req.user!;
      const { editorId, editorEmail, editorName, orderId } = req.body;

      if (!editorId || !editorEmail) {
        return res.status(400).json({ error: "Editor ID and email are required" });
      }

      // Check if conversation already exists for this contact and order combination
      let conversation = await storage.getConversationByParticipants(partnerId!, editorId, orderId);

      if (!conversation) {
        // Get partner name from user document
        const userDoc = await getUserDocument(uid);
        const partnerName = userDoc ? `${userDoc.firstName || ''} ${userDoc.lastName || ''}`.trim() : email;

        // Create new conversation
        const conversationData = insertConversationSchema.parse({
          partnerId: partnerId!,
          editorId,
          orderId: orderId || null, // Link to order if provided
          partnerName,
          editorName,
          partnerEmail: email,
          editorEmail,
        });

        conversation = await storage.createConversation(conversationData);
      }

      res.json(conversation);
    } catch (error: any) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  // Send a message in a conversation
  app.post("/api/conversations/:id/messages", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const { uid, partnerId, email } = req.user!;
      const { content } = req.body;

      if (!content || content.trim() === "") {
        return res.status(400).json({ error: "Message content is required" });
      }

      // Get conversation
      const conversation = await storage.getConversation(id);

      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      // Verify user has access to this conversation
      if (conversation.partnerId !== partnerId && conversation.editorId !== uid) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Determine sender role
      const isPartner = conversation.partnerId === partnerId;
      const senderRole = isPartner ? "partner" : "editor";

      // Get sender name
      const userDoc = await getUserDocument(uid);
      const senderName = userDoc ? `${userDoc.firstName || ''} ${userDoc.lastName || ''}`.trim() || email : email;

      // Create message
      const messageData = insertMessageSchema.parse({
        conversationId: id,
        senderId: uid,
        senderEmail: email,
        senderName,
        senderRole,
        content: content.trim()
      });

      const message = await storage.createMessage(messageData);

      // Update conversation's last message and unread count
      await storage.updateConversationLastMessage(id, content.trim(), isPartner);

      res.json(message);
    } catch (error: any) {
      console.error("Error sending message:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // Mark messages in a conversation as read
  app.patch("/api/conversations/:id/read", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const { uid, partnerId } = req.user!;

      // Get conversation
      const conversation = await storage.getConversation(id);

      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      // Verify user has access to this conversation
      if (conversation.partnerId !== partnerId && conversation.editorId !== uid) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Determine if user is partner or editor
      const isPartner = conversation.partnerId === partnerId;

      // Mark messages as read
      await storage.markConversationAsRead(id, isPartner);

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error marking messages as read:", error);
      res.status(500).json({ error: "Failed to mark messages as read" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
