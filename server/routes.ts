import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage, firestoreStorage } from "./storage";
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
  getUserByPartnerId,
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
import { sendTeamInviteEmail, sendDeliveryEmail, sendPartnershipInviteEmail } from "./email-service";
import { z } from "zod";
import multer from "multer";
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import fs from 'fs';
import JSZip from 'jszip';
import { nanoid } from 'nanoid';
import sharp from 'sharp';

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
    firstName?: string;
    lastName?: string;
    studioName?: string;
    partnerName?: string;
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
      email: userDoc.email,
      firstName: userDoc.firstName,
      lastName: userDoc.lastName,
      studioName: userDoc.studioName,
      partnerName: userDoc.partnerName
    };

    next();
  } catch (error) {
    console.error("Authentication error:", error);
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

// Auth middleware for SSE endpoints - accepts token from query parameter or header
// EventSource doesn't support custom headers, so we allow token in query params
const requireAuthSSE = async (req: any, res: any, next: any) => {
  try {
    let idToken: string | null = null;
    
    // Check Authorization header first (for regular requests)
    const authHeader = req.headers.authorization;
    if (authHeader) {
      idToken = authHeader.replace('Bearer ', '');
    } else {
      // Check query parameter (for EventSource requests)
      const tokenParam = req.query.token;
      if (tokenParam && typeof tokenParam === 'string') {
        idToken = tokenParam;
      }
    }

    if (!idToken) {
      return res.status(401).json({ error: "Authorization token required" });
    }

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
      email: userDoc.email,
      firstName: userDoc.firstName,
      lastName: userDoc.lastName,
      studioName: userDoc.studioName,
      partnerName: userDoc.partnerName
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
  // Customers - SECURED with authentication and tenant isolation
  app.get("/api/customers", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const customers = await storage.getCustomers(req.user?.partnerId);
      res.json(customers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  app.post("/api/customers", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      // Inject partnerId from authenticated user to prevent cross-tenant data poisoning
      const validatedData = insertCustomerSchema.parse({
        ...req.body,
        partnerId: req.user?.partnerId
      });
      const customer = await storage.createCustomer(validatedData);
      res.status(201).json(customer);
    } catch (error) {
      res.status(400).json({ error: "Invalid customer data" });
    }
  });

  app.get("/api/customers/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const customer = await storage.getCustomer(req.params.id);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      // Verify customer belongs to user's tenant
      if (customer.partnerId !== req.user?.partnerId) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(customer);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customer" });
    }
  });

  app.get("/api/customers/:id/profile", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const customer = await storage.getCustomer(req.params.id);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      // Verify customer belongs to user's tenant
      if (customer.partnerId !== req.user?.partnerId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const jobs = await storage.getCustomerJobs(req.params.id, req.user?.partnerId || '');

      res.json({
        customer,
        jobs
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customer profile" });
    }
  });

  // Users - SECURED with authentication and tenant isolation
  app.get("/api/users", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const users = await storage.getUsers(req.user?.partnerId);
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Upload user profile image
  app.post("/api/user/profile-image", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { image } = req.body;
      const userId = req.user?.uid;

      if (!image) {
        return res.status(400).json({ error: "No image provided" });
      }

      // Extract base64 data
      const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      // Get file extension from base64 string
      const matches = image.match(/^data:image\/(\w+);base64,/);
      const ext = matches ? matches[1] : 'jpg';

      // Upload to Firebase Storage
      const bucket = getStorage().bucket(process.env.FIREBASE_STORAGE_BUCKET?.replace(/['"]/g, '').trim());
      const fileName = `profile-images/${userId}/profile.${ext}`;
      const file = bucket.file(fileName);

      await file.save(buffer, {
        metadata: {
          contentType: `image/${ext}`,
        },
        public: true,
      });

      const imageUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

      // Update user profile in Firestore
      await storage.updateUser(userId!, { profileImage: imageUrl });

      res.json({ imageUrl });
    } catch (error: any) {
      console.error("Error uploading profile image:", error);
      res.status(500).json({ error: "Failed to upload profile image", details: error.message });
    }
  });

  // Products - SECURED with authentication and tenant isolation
  app.get("/api/products", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const products = await storage.getProducts(req.user?.partnerId);
      res.json(products);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  // Get single product by ID - SECURED
  app.get("/api/products/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      // Verify product belongs to user's tenant
      if (product.partnerId !== req.user?.partnerId) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ error: "Failed to fetch product", details: error instanceof Error ? error.message : String(error) });
    }
  });

  // Product creation moved to line 1103 with better error handling

  app.patch("/api/products/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      // First verify the product exists and belongs to this tenant
      const existingProduct = await storage.getProduct(req.params.id);
      if (!existingProduct) {
        return res.status(404).json({ error: "Product not found" });
      }
      if (existingProduct.partnerId !== req.user?.partnerId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const product = await storage.updateProduct(req.params.id, req.body);
      res.json(product);
    } catch (error) {
      res.status(500).json({ error: "Failed to update product" });
    }
  });

  // Jobs - SECURED with authentication and tenant isolation
  app.get("/api/jobs", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const jobs = await storage.getJobs(req.user?.partnerId);
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
        await firestoreStorage.createActivity({
          partnerId: req.user.partnerId,
          jobId: job.jobId, // Use NanoID for consistency with frontend
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
        console.log(`[ACTIVITY] Created job creation activity for jobId: ${job.jobId}`);
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

  app.get("/api/jobs/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      // Verify job belongs to user's tenant
      if (job.partnerId !== req.user?.partnerId) {
        return res.status(403).json({ error: "Access denied" });
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
          jobId: job.jobId, // Use NanoID for consistency with frontend
          userId: req.user?.uid || '',
          userEmail: req.user?.email || '',
          userName: req.user?.email || '',
          action: "delete",
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

  // Orders - SECURED with authentication and tenant isolation
  // Note: This is the primary handler; it enriches orders with jobAddress for UI dropdowns
  app.get("/api/orders", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.partnerId) {
        return res.status(400).json({ error: "User must have a partnerId" });
      }

      const filteredOrders = await storage.getOrders(req.user.partnerId);

      // Enrich orders with job address for display in dropdowns
      const ordersWithJobData = await Promise.all(
        filteredOrders.map(async (order) => {
          if (order.jobId) {
            // order.jobId might be a Job id or a job.jobId (external). Try both.
            const job = (await storage.getJob(order.jobId)) || (await storage.getJobByJobId(order.jobId));
            return {
              ...order,
              jobAddress: job?.address || "Unknown Address",
            };
          }
          return {
            ...order,
            jobAddress: "No Job Assigned",
          };
        })
      );

      res.json(ordersWithJobData);
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

      // Create notifications for assigned editor or eligible editors
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

          await firestoreStorage.createNotifications([notification]); // Use createNotifications for consistency
          console.log(`Created notification for assigned editor ${assignedTo} for order ${order.orderNumber}`);
        } else {
          // Order is not assigned - notify eligible editors
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

            await firestoreStorage.createNotifications(notifications);
            console.log(`Created ${notifications.length} notifications for order ${order.orderNumber}`);
          }
        }
      } catch (notificationError) {
        // Log error but don't fail the order creation
        console.error("Failed to create order notifications:", notificationError);
      }

      // Log activity: Order Submitted for Editing
      try {
        const currentUser = await getUserDocument(req.user.uid);
        const userName = currentUser 
          ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.email
          : req.user.email || 'Unknown User';

        await storage.createActivity({
          partnerId: partnerId,
          orderId: order.id,
          jobId: order.jobId || null,
          userId: req.user.uid,
          userEmail: req.user.email || '',
          userName: userName,
          action: "submission",
          category: "order",
          title: "Order Submitted for Editing",
          description: `Order #${order.orderNumber} submitted for editing${assignedTo ? ` and assigned to editor` : ''}`,
          metadata: JSON.stringify({
            orderNumber: order.orderNumber,
            orderId: order.id,
            assignedTo: assignedTo || null,
            serviceCount: services.length,
            submittedBy: req.user.email,
            submittedAt: new Date().toISOString()
          }),
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });
      } catch (activityError) {
        console.error("Failed to log order submission activity:", activityError);
        // Don't fail the order creation if activity logging fails
      }

      // Return the complete order details
      const orderServices = await storage.getOrderServices(order.id, order.partnerId);
      const orderFiles = await storage.getOrderFiles(order.id, order.partnerId);

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

  // Dashboard stats - SECURED with authentication and tenant isolation
  app.get("/api/dashboard/stats", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const jobs = await storage.getJobs(req.user?.partnerId);
      const orders = await storage.getOrders(req.user?.partnerId);
      const customers = await storage.getCustomers(req.user?.partnerId);

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

  // Dashboard attention items - SECURED with authentication and tenant isolation
  app.get("/api/dashboard/attention-items", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { uid, partnerId } = req.user!;
      const attentionItems: any[] = [];

      // 1. Get orders that are completed (ready for delivery)
      const orders = await storage.getOrders(partnerId);
      const completedOrders = orders.filter(order => order.status === 'completed');

      // Get job details for each completed order
      const jobs = await storage.getJobs(partnerId);
      const jobMap = new Map(jobs.map(job => [job.id, job]));

      for (const order of completedOrders) {
        const job = order.jobId ? jobMap.get(order.jobId) : null;
        attentionItems.push({
          id: order.id,
          type: 'order_completed',
          title: 'Order Ready for Delivery',
          description: job?.address || 'Order completed and ready',
          time: order.dateAccepted || order.createdAt,
          priority: 'high',
          projectName: job?.address || '',
          orderId: order.id,
          jobId: order.jobId,
          orderNumber: order.orderNumber,
          unread: true,
        });
      }

      // 2. Get unread messages from conversations
      const conversations = await firestoreStorage.getUserConversations(uid, partnerId);

      for (const conversation of conversations) {
        // Check if current user is partner or editor
        const isPartner = conversation.partnerId === partnerId;
        const unreadCount = isPartner ? (conversation.partnerUnreadCount || 0) : (conversation.editorUnreadCount || 0);

        if (unreadCount > 0) {
          attentionItems.push({
            id: conversation.id,
            type: 'message',
            title: `${unreadCount} New Message${unreadCount > 1 ? 's' : ''}`,
            description: isPartner
              ? `From ${conversation.editorName}`
              : `From ${conversation.partnerName}`,
            time: conversation.lastMessageAt,
            priority: 'medium',
            projectName: conversation.orderId ? '' : 'General',
            conversationId: conversation.id,
            unreadCount,
            unread: true,
          });
        }
      }

      // Sort by time (most recent first)
      attentionItems.sort((a, b) => {
        const timeA = a.time ? new Date(a.time).getTime() : 0;
        const timeB = b.time ? new Date(b.time).getTime() : 0;
        return timeB - timeA;
      });

      res.json(attentionItems);
    } catch (error) {
      console.error("Error fetching attention items:", error);
      res.status(500).json({ error: "Failed to fetch attention items" });
    }
  });

  // Firebase Auth - Public Signup endpoint (always creates partner)
  const publicSignupSchema = z.object({
    uid: z.string(),
    email: z.string().email(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    businessName: z.string().min(1, "Business name is required")
  });

  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { uid, email, firstName, lastName, businessName } = publicSignupSchema.parse(req.body);

      // Public signups always create partner accounts
      const docId = await createUserDocument(uid, email, "partner", undefined, firstName, lastName, businessName);

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

      // Verify Firebase ID token and extract uid
      const idToken = authHeader.replace('Bearer ', '');
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      const uid = decodedToken.uid;

      const currentUser = await getUserDocument(uid);
      if (!currentUser || currentUser.role !== 'partner') {
        return res.status(403).json({ error: "Only partners can invite team members" });
      }

      // Create pending invite
      const inviteToken = await createPendingInvite(email, role as UserRole, currentUser.partnerId!, uid);

      const inviteLink = `${req.protocol}://${req.get('host')}/signup?invite=${inviteToken}`;

      // Send invitation email
      const inviterName = `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.email;
      const emailResult = await sendTeamInviteEmail(
        email,
        inviterName,
        currentUser.email,
        role,
        inviteLink
      );

      if (!emailResult.success) {
        console.error(`Failed to send invite email to ${email}:`, emailResult.error);
        // Don't fail the request if email fails - invite is still created
      }

      res.status(201).json({ 
        success: true, 
        inviteToken,
        inviteLink,
        message: `Team member invite created for ${email}`,
        emailSent: emailResult.success
      });
    } catch (error: any) {
      console.error("Error creating team invite:", error);
      
      // Handle Firebase auth errors specifically
      if (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error') {
        return res.status(401).json({ error: "Invalid or expired token" });
      }
      
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

  // Customers endpoints - REMOVED DUPLICATES (secured versions are defined earlier)
  
  // Products endpoints - REMOVED DUPLICATES (secured versions are defined earlier)
  
  // Product creation with enhanced error handling
  app.post("/api/products", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      // Inject partnerId from authenticated user
      const productData = insertProductSchema.parse({
        ...req.body,
        partnerId: req.user?.partnerId
      });
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

  // Product image upload endpoint
  app.post("/api/products/upload-image", async (req, res) => {
    try {
      const { imageData, fileName } = req.body;

      if (!imageData || !fileName) {
        return res.status(400).json({ error: "Missing imageData or fileName" });
      }

      console.log("[PRODUCT IMAGE] Starting upload for:", fileName);

      // Get Firebase Admin Storage
      const bucketName = (process.env.FIREBASE_STORAGE_BUCKET || '').replace(/['"]/g, '').trim();
      if (!bucketName) {
        throw new Error('FIREBASE_STORAGE_BUCKET environment variable not set');
      }

      const bucket = getStorage().bucket(bucketName);

      // Convert base64 to buffer
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');

      console.log("[PRODUCT IMAGE] Image buffer size:", imageBuffer.length);

      // Upload original image
      const originalPath = `product-images/${fileName}`;
      const originalFile = bucket.file(originalPath);
      
      await originalFile.save(imageBuffer, {
        metadata: {
          contentType: 'image/jpeg',
        },
      });

      await originalFile.makePublic();
      const originalUrl = `https://storage.googleapis.com/${bucketName}/${originalPath}`;

      console.log("[PRODUCT IMAGE] Original uploaded:", originalUrl);

      // Create and upload thumbnail (400x400)
      const thumbnailBuffer = await sharp(imageBuffer)
        .resize(400, 400, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: 80 })
        .toBuffer();

      const thumbnailPath = `product-images/thumbnails/${fileName}`;
      const thumbnailFile = bucket.file(thumbnailPath);
      
      await thumbnailFile.save(thumbnailBuffer, {
        metadata: {
          contentType: 'image/jpeg',
        },
      });

      await thumbnailFile.makePublic();
      const thumbnailUrl = `https://storage.googleapis.com/${bucketName}/${thumbnailPath}`;

      console.log("[PRODUCT IMAGE] Thumbnail uploaded:", thumbnailUrl);

      res.json({ 
        success: true,
        originalUrl,
        thumbnailUrl 
      });
    } catch (error: any) {
      console.error("Product image upload error:", error);
      res.status(500).json({ 
        error: "Failed to upload product image", 
        details: error.message 
      });
    }
  });

  // Orders endpoints - Requires authentication for multi-tenant security
  app.get("/api/orders", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      // SECURED: Always use partnerId for tenant isolation
      if (!req.user?.partnerId) {
        return res.status(400).json({ error: "User must have a partnerId" });
      }
      
      const filteredOrders = await storage.getOrders(req.user.partnerId);

      // Enrich orders with job address for display in dropdowns
      const ordersWithJobData = await Promise.all(
        filteredOrders.map(async (order) => {
          if (order.jobId) {
            // order.jobId may be the Job internal id or external job.jobId
            const job = (await storage.getJob(order.jobId)) || (await storage.getJobByJobId(order.jobId));
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

  // REMOVED DUPLICATE: Secured version already defined earlier in file

  // Notifications - All endpoints require authentication
  app.get("/api/notifications", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Only return notifications for the authenticated user with proper tenant filtering
      const notifications = await firestoreStorage.getNotificationsForUser(
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
      const notification = await firestoreStorage.markNotificationRead(req.params.id, req.user.uid);

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
      await firestoreStorage.markAllNotificationsRead(req.user.uid, req.user.partnerId || '');

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
      const partnerName = `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.email;
      const inviteToken = await createPartnershipInvite(
        editorEmail,
        editorStudioName,
        currentUser.partnerId!,
        partnerName,
        currentUser.email
      );

      // Send partnership invitation email
      // Note: Partnership invites may not have a direct signup link - editors need to log in first
      const emailResult = await sendPartnershipInviteEmail(
        editorEmail,
        editorStudioName,
        partnerName,
        currentUser.email
      );

      if (!emailResult.success) {
        console.error(`Failed to send partnership invite email to ${editorEmail}:`, emailResult.error);
        // Don't fail the request if email fails - invite is still created
      }

      res.status(201).json({ 
        success: true, 
        inviteToken,
        message: `Partnership invite sent to ${editorEmail}`,
        emailSent: emailResult.success
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

      // Create conversation between partner and editor if it doesn't exist
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
      // Get current user (should be partner or photographer)
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: "Authorization header required" });
      }

      const idToken = authHeader.replace('Bearer ', '');
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      const uid = decodedToken.uid;
      const currentUser = await getUserDocument(uid);
      if (!currentUser || (currentUser.role !== 'partner' && currentUser.role !== 'photographer')) {
        return res.status(403).json({ error: "Only partners and photographers can view their partnerships" });
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
      // Get current user (should be partner or photographer)
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: "Authorization header required" });
      }

      const idToken = authHeader.replace('Bearer ', '');
      // Verify the Firebase ID token and extract the UID
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      const uid = decodedToken.uid;
      const currentUser = await getUserDocument(uid);
      if (!currentUser || (currentUser.role !== 'partner' && currentUser.role !== 'photographer')) {
        return res.status(403).json({ error: "Only partners and photographers can view their suppliers" });
      }

      const partnerships = await getPartnerPartnerships(currentUser.partnerId!);

      // Get custom display names for photographers
      let editorDisplayNames: Record<string, string> = {};
      if (currentUser.role === 'photographer') {
        const settings = await storage.getPartnerSettings(currentUser.partnerId!);
        if (settings?.editorDisplayNames) {
          editorDisplayNames = JSON.parse(settings.editorDisplayNames);
        }
      }

      // Format for suppliers dropdown
      const suppliers = partnerships.map(partnership => {
        // Use custom display name for photographers if available
        const displayName = (currentUser.role === 'photographer' && editorDisplayNames[partnership.editorId]) 
          ? editorDisplayNames[partnership.editorId]
          : partnership.editorStudioName;

        return {
          id: partnership.editorId,
          firstName: displayName.split(' ')[0] || displayName,
          lastName: displayName.split(' ').slice(1).join(' ') || '',
          email: partnership.editorEmail,
          role: 'editor',
          studioName: displayName
        };
      });

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
          const orderServices = await storage.getOrderServices(order.id, order.partnerId);

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
        await firestoreStorage.createNotification({
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
        await firestoreStorage.createNotification({
          partnerId: order.partnerId,
          recipientId: order.partnerId, // Partner is the recipient of this notification
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
        await firestoreStorage.createNotification({
          partnerId: order.partnerId,
          recipientId: order.partnerId, // Partner is the recipient of this notification
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

      // Get all orders assigned to this editor and enrich with job address
      const editorOrders = await storage.getOrdersForEditor(uid);
      const enrichedOrders = await Promise.all(
        editorOrders.map(async (order) => {
          let jobAddress = '';
          if (order.jobId) {
            // order.jobId might be internal id or external job.jobId
            const job = (await storage.getJob(order.jobId)) || (await storage.getJobByJobId(order.jobId));
            jobAddress = job?.address || 'Unknown Address';
          } else {
            jobAddress = 'No Job Assigned';
          }
          return {
            id: order.id,
            orderNumber: order.orderNumber,
            jobId: order.jobId,
            jobAddress,
            status: order.status,
          };
        })
      );

      res.json(enrichedOrders);
    } catch (error: any) {
      console.error("Error getting editor orders:", error);
      res.status(500).json({ 
        error: "Failed to get editor orders", 
        details: error.message 
      });
    }
  });

  // Get job history for editors and partners/admins
  app.get("/api/editor/jobs/history", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: "Authorization header required" });
      }

      const idToken = authHeader.replace('Bearer ', '');
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      const uid = decodedToken.uid;
      const currentUser = await getUserDocument(uid);
      
      if (!currentUser) {
        return res.status(403).json({ error: "User not found" });
      }

      // Get date range filters from query params
      const { startDate, endDate } = req.query;
      const startDateFilter = startDate ? new Date(startDate as string) : null;
      const endDateFilter = endDate ? new Date(endDate as string) : null;

      // Get completed orders based on role
      let completedOrders: any[] = [];
      
      if (currentUser.role === 'editor') {
        // Editors can only see their own completed jobs
        const allEditorOrders = await storage.getOrdersForEditor(uid);
        completedOrders = allEditorOrders.filter(order => order.status === 'completed');
      } else if (currentUser.role === 'partner' || currentUser.role === 'admin') {
        // Partners/admins can see all completed jobs for their partnerId
        if (!currentUser.partnerId) {
          return res.status(400).json({ error: "User must have a partnerId" });
        }
        const allPartnerOrders = await storage.getOrders(currentUser.partnerId);
        completedOrders = allPartnerOrders.filter(order => order.status === 'completed');
      } else {
        return res.status(403).json({ error: "Unauthorized access" });
      }

      // Apply date range filter if provided
      if (startDateFilter || endDateFilter) {
        completedOrders = completedOrders.filter(order => {
          // Use dateCompleted if available, otherwise use createdAt
          const completionDate = (order as any).dateCompleted 
            ? new Date((order as any).dateCompleted) 
            : (order.createdAt ? new Date(order.createdAt) : null);
          
          if (!completionDate) return false;
          
          if (startDateFilter && completionDate < startDateFilter) return false;
          if (endDateFilter && completionDate > endDateFilter) return false;
          
          return true;
        });
      }

      // Enrich orders with billing information
      const enrichedHistory = await Promise.all(
        completedOrders.map(async (order) => {
          // Get customer info
          const customer = order.customerId ? await storage.getCustomer(order.customerId) : null;
          const customerName = customer 
            ? `${customer.firstName} ${customer.lastName}` 
            : 'Unknown Customer';

          // Get job info
          let job = null;
          let jobAddress = 'Unknown Address';
          if (order.jobId) {
            job = await storage.getJob(order.jobId) || await storage.getJobByJobId(order.jobId);
            jobAddress = job?.address || 'Unknown Address';
          }

          // Get partner business name
          let partnerBusinessName = 'Unknown Business';
          if (order.partnerId) {
            try {
              const partnerSettings = await storage.getPartnerSettings(order.partnerId);
              if (partnerSettings && partnerSettings.businessProfile) {
                try {
                  const businessProfile = JSON.parse(partnerSettings.businessProfile);
                  partnerBusinessName = businessProfile.businessName || 'Unknown Business';
                } catch (parseError) {
                  console.error("Error parsing business profile JSON:", parseError);
                }
              }
            } catch (error) {
              console.error("Error fetching partner settings:", error);
            }
          }

          // Get order services with costs
          const orderServices = await storage.getOrderServices(order.id, order.partnerId);
          
          // Get editor services if order has an assigned editor
          let editorServicesMap = new Map<string, any>();
          if (order.assignedTo) {
            try {
              const allEditorServices = await storage.getEditorServices(order.assignedTo);
              allEditorServices.forEach(service => {
                editorServicesMap.set(service.id, service);
              });
            } catch (error) {
              console.error("Error fetching editor services:", error);
            }
          }
          
          const servicesWithDetails = orderServices.map((service) => {
            let serviceName = 'Unknown Service';
            let serviceCost = 0;
            
            if (service.serviceId && editorServicesMap.has(service.serviceId)) {
              const editorService = editorServicesMap.get(service.serviceId);
              serviceName = editorService.name;
              serviceCost = parseFloat(editorService.basePrice) || 0;
            }
            
            return {
              id: service.id,
              name: serviceName,
              quantity: service.quantity || 1,
              cost: serviceCost,
              totalCost: serviceCost * (service.quantity || 1),
              instructions: service.instructions,
              exportTypes: service.exportTypes,
            };
          });

          // Calculate total cost
          const totalCost = servicesWithDetails.reduce((sum, service) => sum + service.totalCost, 0) || 
                           parseFloat(order.estimatedTotal) || 0;

          // Get file counts
          const orderFiles = await storage.getOrderFiles(order.id, order.partnerId);
          const originalFileCount = orderFiles.length;

          // Get delivered file count (editor uploads)
          let deliveredFileCount = 0;
          if (job) {
            try {
              const editorUploads = await storage.getEditorUploads(job.id);
              deliveredFileCount = editorUploads.filter(
                upload => upload.status === 'completed' && 
                upload.fileName !== '.folder_placeholder' &&
                !upload.firebaseUrl?.startsWith('orders/')
              ).length;
            } catch (error) {
              console.error("Error fetching editor uploads:", error);
            }
          }

          // Calculate time spent (from dateAccepted to completion)
          let timeSpent = null;
          if ((order as any).dateAccepted && (order as any).dateCompleted) {
            const acceptedDate = new Date((order as any).dateAccepted);
            const completedDate = new Date((order as any).dateCompleted);
            const diffMs = completedDate.getTime() - acceptedDate.getTime();
            const diffHours = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10; // Round to 1 decimal
            timeSpent = diffHours;
          } else if ((order as any).dateAccepted) {
            // If no dateCompleted, use createdAt as fallback
            const acceptedDate = new Date((order as any).dateAccepted);
            const completedDate = order.createdAt ? new Date(order.createdAt) : new Date();
            const diffMs = completedDate.getTime() - acceptedDate.getTime();
            const diffHours = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
            timeSpent = diffHours;
          }

          // Determine completion date
          const completionDate = (order as any).dateCompleted 
            ? new Date((order as any).dateCompleted) 
            : (order.createdAt ? new Date(order.createdAt) : new Date());

          return {
            orderId: order.id,
            orderNumber: order.orderNumber,
            completionDate: completionDate.toISOString(),
            customerName,
            customerEmail: customer?.email || '',
            partnerBusinessName,
            jobAddress,
            services: servicesWithDetails,
            totalCost,
            originalFileCount,
            deliveredFileCount,
            totalFileCount: originalFileCount + deliveredFileCount,
            notes: order.notes || job?.notes || '',
            timeSpent,
            dateAccepted: (order as any).dateAccepted ? new Date((order as any).dateAccepted).toISOString() : null,
            createdAt: order.createdAt ? new Date(order.createdAt).toISOString() : null,
          };
        })
      );

      // Sort by completion date (newest first)
      enrichedHistory.sort((a, b) => {
        const dateA = new Date(a.completionDate).getTime();
        const dateB = new Date(b.completionDate).getTime();
        return dateB - dateA;
      });

      res.json(enrichedHistory);
    } catch (error: any) {
      console.error("Error getting job history:", error);
      res.status(500).json({ 
        error: "Failed to get job history", 
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
      const editorOrders = await storage.getOrdersForEditor(uid);
      const order = editorOrders.find(o => o.orderNumber === orderNumber);
      if (!order) {
        return res.status(404).json({ error: "Order not found or not assigned to you" });
      }

      // Get order files and services (for instructions)
      const orderFiles = await storage.getOrderFiles(order.id, order.partnerId);
      const orderServices = await storage.getOrderServices(order.id, order.partnerId);

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

      // Helper function to strip HTML tags and format as plain text
      const stripHtml = (html: string): string => {
        return html
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/p>/gi, '\n\n')
          .replace(/<\/div>/gi, '\n')
          .replace(/<\/li>/gi, '\n')
          .replace(/<li>/gi, '  • ')
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\n\s*\n\s*\n/g, '\n\n')
          .trim();
      };

      // Add instructions if any (as plain text file)
      if (orderServices && orderServices.length > 0) {
        let instructionsContent = `ORDER: ${orderNumber}\n`;
        instructionsContent += `========================================\n\n`;
        
        orderServices.forEach((service, index) => {
          instructionsContent += `SERVICE ${index + 1}: ${service.serviceName || 'General Editing'}\n`;
          instructionsContent += `${'='.repeat(40)}\n\n`;
          
          // Process instructions
          if (service.instructions) {
            try {
              let instructions = service.instructions;
              
              // If it's a string, try to parse as JSON
              if (typeof instructions === 'string') {
                try {
                  instructions = JSON.parse(instructions);
                } catch (e) {
                  // If not JSON, treat as plain string (might contain HTML)
                  instructions = instructions;
                }
              }
              
              if (Array.isArray(instructions)) {
                instructions.forEach((inst, instIndex) => {
                  instructionsContent += `File ${instIndex + 1}: ${inst.fileName || 'N/A'}\n`;
                  if (inst.detail) {
                    const cleanDetail = stripHtml(inst.detail);
                    instructionsContent += `  Instructions: ${cleanDetail}\n`;
                  }
                  instructionsContent += '\n';
                });
              } else if (typeof instructions === 'string') {
                const cleanInstructions = stripHtml(instructions);
                instructionsContent += `${cleanInstructions}\n\n`;
              } else {
                instructionsContent += `${JSON.stringify(instructions, null, 2)}\n\n`;
              }
            } catch (e) {
              // If parsing fails, try to strip HTML from raw string
              const cleanInstructions = stripHtml(String(service.instructions));
              instructionsContent += `${cleanInstructions}\n\n`;
            }
          }
          
          // Process export types
          if (service.exportTypes) {
            try {
              let exportTypes = service.exportTypes;
              if (typeof exportTypes === 'string') {
                try {
                  exportTypes = JSON.parse(exportTypes);
                } catch (e) {
                  // Not JSON, continue
                }
              }
              
              instructionsContent += `Export Types:\n`;
              if (Array.isArray(exportTypes)) {
                exportTypes.forEach(exp => {
                  instructionsContent += `  • ${exp.type || 'N/A'}: ${exp.description || 'N/A'}\n`;
                });
              } else {
                instructionsContent += `  ${JSON.stringify(exportTypes)}\n`;
              }
              instructionsContent += '\n';
            } catch (e) {
              instructionsContent += `Export Types: ${service.exportTypes}\n\n`;
            }
          }
          
          // Add notes if any
          if (service.notes) {
            const cleanNotes = stripHtml(String(service.notes));
            instructionsContent += `Notes:\n${cleanNotes}\n\n`;
          }
          
          instructionsContent += '\n';
        });

        zip.file(`${folderName}/INSTRUCTIONS.txt`, instructionsContent);
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
      const editorOrders = await storage.getOrdersForEditor(uid);
      const order = editorOrders.find(o => o.jobId === job.id);
      if (!order) {
        return res.status(404).json({ error: "Job not found or not assigned to you" });
      }

      // Get order files and services (for instructions)
      const orderFiles = await storage.getOrderFiles(order.id, order.partnerId);
      const orderServices = await storage.getOrderServices(order.id, order.partnerId);

      if (orderFiles.length === 0) {
        return res.status(404).json({ error: "No files found for this job" });
      }

      // Create zip file
      const zip = new JSZip();
      let zipGenerationFailed = false;

      // Helper function to strip HTML tags and format as plain text
      const stripHtml = (html: string): string => {
        return html
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/p>/gi, '\n\n')
          .replace(/<\/div>/gi, '\n')
          .replace(/<\/li>/gi, '\n')
          .replace(/<li>/gi, '  • ')
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\n\s*\n\s*\n/g, '\n\n')
          .trim();
      };

      // Add instructions file if any (as plain text)
      if (orderServices.length > 0) {
        let instructionsContent = `ORDER: ${order.orderNumber}\n`;
        instructionsContent += `========================================\n\n`;
        
        orderServices.forEach((service, index) => {
          instructionsContent += `SERVICE ${index + 1}: ${service.serviceName || 'General Editing'}\n`;
          instructionsContent += `${'='.repeat(40)}\n\n`;
          
          if (service.instructions) {
            try {
              let instructions = service.instructions;
              
              // If it's a string, try to parse as JSON
              if (typeof instructions === 'string') {
                try {
                  instructions = JSON.parse(instructions);
                } catch (e) {
                  // If not JSON, treat as plain string (might contain HTML)
                  instructions = instructions;
                }
              }
              
              if (Array.isArray(instructions)) {
                instructions.forEach((inst, instIndex) => {
                  instructionsContent += `File ${instIndex + 1}: ${inst.fileName || 'N/A'}\n`;
                  if (inst.detail) {
                    const cleanDetail = stripHtml(inst.detail);
                    instructionsContent += `  Instructions: ${cleanDetail}\n`;
                  }
                  instructionsContent += '\n';
                });
              } else if (typeof instructions === 'string') {
                const cleanInstructions = stripHtml(instructions);
                instructionsContent += `${cleanInstructions}\n\n`;
              } else {
                instructionsContent += `${JSON.stringify(instructions, null, 2)}\n\n`;
              }
            } catch (e) {
              // If parsing fails, try to strip HTML from raw string
              const cleanInstructions = stripHtml(String(service.instructions));
              instructionsContent += `${cleanInstructions}\n\n`;
            }
          }
          
          if (service.exportTypes) {
            try {
              let exportTypes = service.exportTypes;
              if (typeof exportTypes === 'string') {
                try {
                  exportTypes = JSON.parse(exportTypes);
                } catch (e) {
                  // Not JSON, continue
                }
              }
              
              instructionsContent += `Export Types:\n`;
              if (Array.isArray(exportTypes)) {
                exportTypes.forEach(exp => {
                  instructionsContent += `  • ${exp.type || 'N/A'}: ${exp.description || 'N/A'}\n`;
                });
              } else {
                instructionsContent += `  ${JSON.stringify(exportTypes)}\n`;
              }
              instructionsContent += '\n';
            } catch (e) {
              instructionsContent += `Export Types: ${service.exportTypes}\n\n`;
            }
          }
          
          // Add notes if any
          if (service.notes) {
            const cleanNotes = stripHtml(String(service.notes));
            instructionsContent += `Notes:\n${cleanNotes}\n\n`;
          }
          
          instructionsContent += '\n';
        });

        zip.file('INSTRUCTIONS.txt', instructionsContent);
      }

      // Download each file and add to zip
      let successfulFiles = 0; // Track number of successfully downloaded files
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
            successfulFiles++;
          } else {
            console.error(`Failed to download file ${file.originalName} with status: ${response.status}`);
          }
        } catch (error) {
          console.error(`Error downloading file ${file.originalName}:`, error);
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
              fileCount: successfulFiles, // Use count of successfully downloaded files
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

  // Get services for a specific editor (for upload process)
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
      const editorOrders = await storage.getOrdersForEditor(uid);
      // Match by job.id (UUID) or job.jobId (NanoID) - both are used in different contexts
      const assignedOrder = editorOrders.find(o => o.jobId === job.id || o.jobId === job.jobId);
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

      // Log activity: Editor uploaded deliverables
      try {
        await storage.createActivity({
          partnerId: job.partnerId,
          jobId: job.jobId,
          orderId: order.id,
          userId: uid,
          userEmail: currentUser.email || 'editor',
          userName: currentUser.displayName || currentUser.email || 'Editor',
          action: "upload",
          category: "file",
          title: "Deliverables Uploaded",
          description: `${currentUser.displayName || 'Editor'} uploaded ${createdUploads.length} deliverable(s)`,
          metadata: JSON.stringify({
            fileCount: createdUploads.length,
            orderNumber: order.orderNumber,
            totalSize: uploads.reduce((sum: number, u: any) => sum + (u.fileSize || 0), 0),
            hasNotes: !!notes
          }),
          ipAddress: req.ip || req.socket.remoteAddress || '',
          userAgent: req.headers['user-agent'] || ''
        });
      } catch (activityError) {
        console.error("[ACTIVITY] Failed to log editor upload:", activityError);
      }

      // Note: Order status is NOT automatically changed on upload
      // Editors must manually click "Mark Complete" button when job is finished

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
      const editorOrders = await storage.getOrdersForEditor(uid);
      // Match by job.id (UUID) or job.jobId (NanoID) - both are used in different contexts
      const assignedOrder = editorOrders.find(o => o.jobId === job.id || o.jobId === job.jobId);
      if (!assignedOrder) {
        console.log(`[STATUS UPDATE ERROR] Editor ${uid} not assigned to job ${jobId}. Found ${editorOrders.length} orders for this job.`);
        return res.status(403).json({ error: "You are not assigned to this job" });
      }
      const order = assignedOrder; // Use the assigned order for status updates

      // Verify job has partnerId (tenant isolation) - editors don't have partnerId, so we validate through the order
      if (!job.partnerId) {
        console.error(`[SECURITY WARNING] Job ${jobId} is missing partnerId field`);
        return res.status(500).json({ error: "Job configuration error: missing partner information" });
      }
      
      // Verify the order belongs to the same partner as the job (cross-validation for security)
      if (job.partnerId !== order.partnerId) {
        console.error(`[SECURITY ERROR] Job partnerId (${job.partnerId}) doesn't match order partnerId (${order.partnerId})`);
        return res.status(403).json({ error: "Access denied: data integrity violation" });
      }

      // Update job status first
      const updatedJob = await storage.updateJobStatusAfterUpload(jobId, status);
      if (!updatedJob) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Also update order status using the new tracking method if completing job
      let updatedOrder = order;
      if (status === 'completed') {
        updatedOrder = await storage.markOrderUploaded(order.id, uid) || order;

        // Create activity record for job completion
        await storage.createActivity({
          partnerId: job.partnerId,
          jobId: job.id,
          orderId: order.id,
          userId: uid,
          userEmail: currentUser.email || 'Unknown',
          userName: currentUser.displayName || currentUser.email || 'Editor',
          action: 'status_change',
          category: 'job',
          title: 'Job Marked as Complete',
          description: `${currentUser.displayName || currentUser.email || 'Editor'} marked job at ${job.address} as complete`,
          metadata: JSON.stringify({
            jobId: job.jobId,
            orderNumber: order.orderNumber,
            previousStatus: job.status,
            newStatus: 'completed',
            completedBy: currentUser.email,
            completedAt: new Date().toISOString(),
            address: job.address
          }),
          ipAddress: req.ip || req.socket.remoteAddress || '',
          userAgent: req.headers['user-agent'] || ''
        });
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
      `^https://storage\\.googleapis\\.com/${bucketName.replace('.', '\\.')}/.+`
    );
    const firebaseDownloadPattern = new RegExp(
      `^https://firebasestorage\\.googleapis\\.com/v0/b/${bucketName.replace('.', '\\.')}/o/.+`
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
      fileSize: 500 * 1024 * 1024, // 500MB limit - increased for video files
    },
  });

  // Server-side Firebase upload endpoint with reservation system
  app.post("/api/upload-firebase", (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({
              error: "File too large",
              details: "Maximum file size is 100MB"
            });
          }
          return res.status(400).json({
            error: "Upload error",
            details: err.message
          });
        }
        return res.status(500).json({
          error: "Upload failed",
          details: err.message
        });
      }
      next();
    });
  }, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      console.log(`=== UPLOAD START ===`);
      console.log(`File: ${req.file.originalname} (${(req.file.size / 1024 / 1024).toFixed(2)}MB)`);
      console.log(`Body params:`, {
        userId: req.body.userId,
        jobId: req.body.jobId,
        orderNumber: req.body.orderNumber,
        folderToken: req.body.folderToken
      });

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
      const job = await storage.getJobByJobId(jobId);
      
      if (!job) {
        console.log(`[UPLOAD DEBUG] Job not found for jobId: ${jobId}`);
        return res.status(404).json({ error: "Job not found" });
      }

      console.log(`[UPLOAD DEBUG] Found job: ${job.id} (nanoId: ${job.jobId}) for request jobId: ${jobId}`);

      // Find the order associated with this job
      // Orders may reference jobs by either UUID (job.id) or NanoID (job.jobId)
      // For editors, we only need to check their assigned orders
      let editorOrders: any[] = [];
      let orderEntity = null;
      
      if (user.role === 'editor') {
        editorOrders = await storage.getOrdersForEditor(userId);
        orderEntity = editorOrders.find(o => 
          o.jobId === job.id || // Match by UUID
          o.jobId === job.jobId || // Match by NanoID
          (job.jobId && o.jobId === job.jobId) // Explicit NanoID match
        );
        console.log(`[UPLOAD DEBUG] Editor has ${editorOrders.length} assigned orders`);
      } else {
        // For partners/admins, get orders by their partnerId
        const partnerOrders = await storage.getOrders(user.partnerId);
        orderEntity = partnerOrders.find(o => 
          o.jobId === job.id || // Match by UUID
          o.jobId === job.jobId || // Match by NanoID
          (job.jobId && o.jobId === job.jobId) // Explicit NanoID match
        );
        console.log(`[UPLOAD DEBUG] Partner has ${partnerOrders.length} orders`);
      }

      console.log(`[UPLOAD DEBUG] Job UUID/NanoID match: ${orderEntity ? orderEntity.orderNumber : 'none'}`);

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
        const sanitizedFolderToken = folderToken.replace(/[^a-zA-Z0-9-]/g, '');
        filePath = `completed/${sanitizedJobId}/folders/${sanitizedFolderToken}/${timestamp}_${sanitizedFileName}`;
      } else {
        // Order-based upload: use order number path
        const sanitizedOrderNumber = orderNumber.replace(/[^a-zA-Z0-9-]/g, '');
        filePath = `orders/${sanitizedUserId}/${sanitizedJobId}/${sanitizedOrderNumber}/${timestamp}_${sanitizedFileName}`;
      }

      // Get Firebase Admin Storage with explicit bucket name
      const bucketName = (process.env.FIREBASE_STORAGE_BUCKET || '').replace(/['"]/g, '').trim();
      if (!bucketName) {
        throw new Error('FIREBASE_STORAGE_BUCKET environment variable not set');
      }

      const bucket = getStorage().bucket(bucketName);
      const file = bucket.file(filePath);

      // Read the uploaded file and upload to Firebase
      // For large files, use streaming instead of loading entire file into memory
      const fileBuffer = fs.readFileSync(req.file.path);

      console.log(`Uploading file to Firebase: ${filePath} (${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB)`);

      await file.save(fileBuffer, {
        metadata: {
          contentType: req.file.mimetype,
        },
        // Use resumable uploads for files larger than 5MB
        resumable: req.file.size > 5 * 1024 * 1024,
      });

      console.log(`Successfully uploaded to Firebase: ${filePath}`);

      // Generate a signed URL that expires in 24 hours for client files (secure, private access)
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      });

      // Clean up temporary file
      fs.unlinkSync(req.file.path);

      // CRITICAL: Create EditorUpload record IMMEDIATELY after successful Firebase upload
      // This must happen BEFORE activity logging to ensure data persistence regardless of auth issues
      // Note: job is guaranteed to exist here due to validation at line 2602-2606
      const uploadData = {
        jobId: job.id, // Use the job's internal ID
        orderId: orderEntity?.id || null, // Optional for standalone folders
        editorId: userId,
        fileName: req.file.originalname,
        originalName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        firebaseUrl: filePath, // Store file path for server-side reference
        downloadUrl: signedUrl, // Store signed URL for secure client download
        folderPath: folderPath || null,
        editorFolderName: folderPath || null, // Set editorFolderName for standalone folders
        folderToken: folderToken || null,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        status: uploadType === 'client' ? 'completed' : 'uploaded',
        notes: `Uploaded with role-based validation - Role: ${user.role}, Access: ${hasUploadAccess}, Upload Valid: ${uploadValidation.valid}, Upload Type: ${uploadType || 'not specified'}${folderToken ? `, Folder Token: ${folderToken}` : ''}`
      };

      await storage.createEditorUpload(uploadData);

      // ENHANCED LOGGING: Activity tracking disabled for individual file uploads per user preference
      // Individual file uploads are no longer tracked to reduce activity timeline clutter
      // Only major events like job creation, status changes, and assignments are tracked

      res.json({
        url: signedUrl,
        path: filePath,
        size: req.file.size,
        originalName: req.file.originalname
      });

    } catch (error: any) {
      console.error("=== FIREBASE UPLOAD ERROR ===");
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
      console.error("Request body:", {
        userId: req.body.userId,
        jobId: req.body.jobId,
        orderNumber: req.body.orderNumber,
        folderToken: req.body.folderToken
      });
      console.error("File info:", req.file ? {
        filename: req.file.originalname,
        size: `${(req.file.size / 1024 / 1024).toFixed(2)}MB`,
        mimetype: req.file.mimetype
      } : 'No file');
      console.error("=== END ERROR ===");

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
        details: error.message,
        hint: "Check server logs for detailed error information"
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
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/tiff', 'image/tif', 'image/x-adobe-dng', 'application/zip', 'video/mp4', 'video/quicktime'];
      if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ error: `Invalid file type. Allowed types: ${allowedTypes.join(', ')}` });
      }

      // File size limit (500MB - increased for video files)
      const maxFileSize = 500 * 1024 * 1024;
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

      const job = await storage.getJobByJobId(jobId);
      console.log(`[UPLOAD DEBUG] getJobByJobId result:`, job ? `Found job ${job.id}` : 'Not found');

      if (!job) {
        console.log(`[UPLOAD DEBUG] Job not found for jobId: ${jobId}`);
        return res.status(404).json({ error: "Job not found" });
      }

      console.log(`[UPLOAD DEBUG] Successfully found job:`, { id: job.id, jobId: job.jobId, partnerId: job.partnerId });

      // For completed file uploads, find an order assigned to this editor for the job
      const editorOrders = await storage.getOrdersForEditor(editorId);

      // First try to find by the provided orderNumber if it exists
      let orderEntity = null;
      if (orderNumber) {
        orderEntity = editorOrders.find(o => o.orderNumber === orderNumber);
      }

      // If order not found by orderNumber, or no orderNumber provided, find any order assigned to this editor for this job
      if (!orderEntity) {
        console.log(`[UPLOAD DEBUG] Order ${orderNumber || 'not provided'} not found, searching for editor's assigned order`);

        // Find orders for this job that are assigned to the current editor
        const jobOrders = editorOrders.filter(o => 
          o.jobId === job.id || o.jobId === job.jobId
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
      const bucketName = (process.env.FIREBASE_STORAGE_BUCKET || '').replace(/['"]/g, '').trim();
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

      // Generate a signed URL that expires in 30 days (secure, private access)
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      // Clean up temporary file
      fs.unlinkSync(req.file.path);

      // Create editor upload record with folder information
      // Store signed URL for download (secure), file path for storage reference
      await storage.createEditorUpload({
        jobId: job.id, // Use the job's internal ID
        orderId: orderEntity.id,
        editorId: editorId,
        fileName: sanitizedFileName,
        originalName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        firebaseUrl: filePath, // Store file path for server-side reference
        downloadUrl: signedUrl, // Store signed URL for secure client download
        folderPath: folderPath || null,
        editorFolderName: editorFolderName || null,
        partnerFolderName: null, // Partners can rename later
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        status: 'completed',
        notes: 'Completed deliverable uploaded by editor'
      });

      // Activity logging disabled for individual completed file uploads per user preference
      // This reduces activity timeline clutter while still tracking major job events

      res.json({
        url: signedUrl,
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
      const job = await storage.getJobByJobId(jobId);

      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Verify job belongs to user's organization
      if (job.partnerId !== req.user.partnerId) {
        return res.status(403).json({ error: "Access denied: Job belongs to different organization" });
      }

      // Get all editor uploads for this job with completed status
      const allUploads = await storage.getEditorUploads(job.id);

      const completedFiles = allUploads.filter(upload =>
        upload.status === 'completed' &&
        upload.fileName !== '.folder_placeholder' && // Exclude folder placeholders
        !upload.firebaseUrl?.startsWith('orders/') // Exclude files uploaded for editing (not deliverables)
      );

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

          // Use actual Firebase download URLs
          const filesWithDownloadUrls = files.map((file) => {
            console.log(`[DEBUG completed-files] File ${file.id} (${file.fileName}):`, {
              downloadUrl: file.downloadUrl,
              firebaseUrl: file.firebaseUrl
            });
            return {
              id: file.id,
              fileName: file.fileName,
              originalName: file.originalName,
              fileSize: file.fileSize,
              mimeType: file.mimeType,
              downloadUrl: file.downloadUrl, // Use actual Firebase download URL
              uploadedAt: file.uploadedAt,
              notes: file.notes
            };
          });

          return {
            orderId,
            orderNumber: order?.orderNumber || 'Unknown',
            files: filesWithDownloadUrls
          };
        })
      );

      console.log(`[DEBUG completed-files] Returning ${enrichedFiles.length} file groups`);
      res.json({ completedFiles: enrichedFiles });
    } catch (error: any) {
      console.error("Error fetching completed files:", error);
      res.status(500).json({ 
        error: "Failed to fetch completed files", 
        details: error.message 
      });
    }
  });

  // Delete individual file
  app.delete("/api/jobs/:jobId/files/:fileId", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { jobId, fileId } = req.params;

      if (!req.user?.partnerId) {
        return res.status(400).json({ error: "User must have a partnerId" });
      }

      // Find the job
      const job = await storage.getJobByJobId(jobId);

      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Verify job belongs to user's organization
      if (job.partnerId !== req.user.partnerId) {
        return res.status(403).json({ error: "Access denied: Job belongs to different organization" });
      }

      // Get all uploads for this job
      const allUploads = await storage.getEditorUploads(job.id);
      const fileToDelete = allUploads.find(upload => upload.id === fileId);

      if (!fileToDelete) {
        return res.status(404).json({ error: "File not found" });
      }

      // Verify file belongs to this job
      if (fileToDelete.jobId !== job.id) {
        return res.status(403).json({ error: "Access denied: File does not belong to this job" });
      }

      // Delete from Firebase Storage
      try {
        const bucketName = (process.env.FIREBASE_STORAGE_BUCKET || '').replace(/['"]/g, '').trim();
        if (bucketName && fileToDelete.firebaseUrl) {
          const bucket = getStorage().bucket(bucketName);
          const file = bucket.file(fileToDelete.firebaseUrl);
          
          const [exists] = await file.exists();
          if (exists) {
            await file.delete();
            console.log(`[DELETE FILE] Deleted from Firebase Storage: ${fileToDelete.firebaseUrl}`);
          }
        }
      } catch (storageError: any) {
        console.error(`[DELETE FILE] Failed to delete from Firebase Storage:`, storageError);
        // Continue with database deletion even if storage deletion fails
      }

      // Delete from database
      await storage.deleteEditorUpload(fileId);

      console.log(`[DELETE FILE] Successfully deleted file: ${fileId} (${fileToDelete.originalName})`);
      res.json({ 
        success: true, 
        message: "File deleted successfully",
        fileId 
      });
    } catch (error: any) {
      console.error("Error deleting file:", error);
      res.status(500).json({ 
        error: "Failed to delete file", 
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
      const job = await storage.getJobByJobId(jobId);

      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Verify job belongs to user's organization
      if (job.partnerId !== req.user.partnerId) {
        return res.status(403).json({ error: "Access denied: Job belongs to different organization" });
      }

      // Get folders for this job
      const folders = await storage.getUploadFolders(job.id);

      console.log(`[DEBUG] Folders for job ${jobId}:`, folders.map(f => ({
        folderPath: f.folderPath,
        editorFolderName: f.editorFolderName,
        partnerFolderName: f.partnerFolderName,
        folderToken: f.folderToken,
        fileCount: f.fileCount
      })));

      // Return folders with actual Firebase download URLs
      const foldersWithDownloadUrls = folders.map(folder => ({
        ...folder,
        files: folder.files.map(file => ({
          ...file,
          downloadUrl: file.downloadUrl // Use actual Firebase download URL
        }))
      }));

      res.json(foldersWithDownloadUrls);
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
      const { partnerFolderName, parentFolderPath } = req.body;

      if (!req.user?.partnerId) {
        return res.status(400).json({ error: "User must have a partnerId" });
      }

      if (!partnerFolderName) {
        return res.status(400).json({ error: "partnerFolderName is required" });
      }

      // Find the job
      const job = await storage.getJobByJobId(jobId);

      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Verify job belongs to user's organization
      if (job.partnerId !== req.user.partnerId) {
        return res.status(403).json({ error: "Access denied: Job belongs to different organization" });
      }

      // Generate unique standalone token for this folder
      const folderToken = nanoid(10);

      console.log(`[CREATE FOLDER] Name: ${partnerFolderName}, Parent: ${parentFolderPath}, Token: ${folderToken}`);

      // Create the folder in storage with parent folder path if provided
      const createdFolder = await storage.createFolder(job.id, partnerFolderName, parentFolderPath, undefined, folderToken);

      // Create a Firebase placeholder to establish the folder in Firebase Storage
      const bucketName = (process.env.FIREBASE_STORAGE_BUCKET || '').replace(/['"]/g, '').trim();
      if (!bucketName) {
        throw new Error('FIREBASE_STORAGE_BUCKET environment variable not set');
      }

      const bucket = getStorage().bucket(bucketName);

      // Build Firebase Storage path based on whether this is a root or nested folder
      // This should match the folderPath structure returned from createFolder
      let firebaseFolderPath: string;
      if (parentFolderPath) {
        // Nested folder: append token to parent path
        firebaseFolderPath = `${parentFolderPath}/${folderToken}`;
      } else {
        // Root folder: use standard structure
        firebaseFolderPath = `completed/${job.jobId || job.id}/folders/${folderToken}`;
      }

      // Create .keep file to establish folder structure in Firebase Storage
      const placeholderPath = `${firebaseFolderPath}/.keep`;
      const placeholderFile = bucket.file(placeholderPath);

      console.log(`[CREATE FOLDER] Firebase path: ${placeholderPath}`);

      // Upload empty placeholder file
      await placeholderFile.save('', {
        metadata: {
          contentType: 'application/octet-stream',
        },
      });

      // Log activity: Folder created
      try {
        await firestoreStorage.createActivity({
          partnerId: req.user.partnerId,
          jobId: job.jobId,
          userId: req.user.uid,
          userEmail: req.user.email,
          userName: req.user.email,
          action: "creation",
          category: "file",
          title: "Folder Created",
          description: `Folder "${partnerFolderName}" created${parentFolderPath ? ' in subfolder' : ''}`,
          metadata: JSON.stringify({
            folderName: partnerFolderName,
            folderPath: firebaseFolderPath,
            parentFolderPath: parentFolderPath || null,
            folderToken
          }),
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });
      } catch (activityError) {
        console.error("[ACTIVITY] Failed to log folder creation:", activityError);
      }

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
      const job = await storage.getJobByJobId(jobId);

      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Verify job belongs to user's organization
      if (job.partnerId !== req.user.partnerId) {
        return res.status(403).json({ error: "Access denied: Job belongs to different organization" });
      }

      console.log(`[DELETE] Starting deletion for folder: ${folderPath}`);

      // Get all uploads for this folder from Firestore
      const folderUploads = await storage.getEditorUploads(job.id);
      const uploadsInFolder = folderUploads.filter(upload => upload.folderPath === folderPath);

      console.log(`[DELETE] Found ${uploadsInFolder.length} uploads in folder`);
      uploadsInFolder.forEach(upload => {
        console.log(`[DELETE]   - File: ${upload.fileName}, Firebase path: ${upload.firebaseUrl}`);
      });

      // Also check if this folder exists in the folders collection
      const foldersSnapshot = await (storage as any).db.collection("folders")
        .where("jobId", "==", job.id)
        .where("folderPath", "==", folderPath)
        .get();

      const folderDoc = foldersSnapshot.docs[0];
      const folderToken = folderDoc?.data()?.folderToken;
      const folderData = folderDoc?.data();

      console.log(`[DELETE] Folder document found:`, folderDoc ? 'Yes' : 'No');
      console.log(`[DELETE] Folder token:`, folderToken);
      console.log(`[DELETE] Folder full data:`, folderData);

      // If no uploads and no folder document, folder doesn't exist
      if (uploadsInFolder.length === 0 && !folderDoc) {
        return res.status(404).json({ error: "Folder not found" });
      }

      // Check if folder has an order (prevent deletion of order-attached folders)
      const hasOrder = uploadsInFolder.some(upload => upload.orderId);
      if (hasOrder) {
        return res.status(400).json({ error: "Cannot delete folder attached to an order" });
      }

      // Delete Firebase files
      try {
        const bucketName = (process.env.FIREBASE_STORAGE_BUCKET || '').replace(/['"]/g, '').trim();
        if (bucketName) {
          const bucket = getStorage().bucket(bucketName);

          // Collect all Firebase file paths to delete
          const filesToDelete: string[] = [];

          // Get file paths from uploads in this folder
          for (const upload of uploadsInFolder) {
            if (upload.firebaseUrl) {
              filesToDelete.push(upload.firebaseUrl);
            }
          }

          // If we have a folderToken, also delete the .keep file and any other files in the folder
          if (folderToken) {
            const folderPrefix = `completed/${job.jobId || job.id}/folders/${folderToken}/`;
            console.log(`[DELETE] Checking Firebase folder: ${folderPrefix}`);
            const [prefixFiles] = await bucket.getFiles({ prefix: folderPrefix });
            prefixFiles.forEach(file => {
              if (!filesToDelete.includes(file.name)) {
                filesToDelete.push(file.name);
              }
            });
          }

          // Delete all collected files
          console.log(`[DELETE] Deleting ${filesToDelete.length} files from Firebase Storage`);
          await Promise.all(filesToDelete.map(async (filePath) => {
            try {
              await bucket.file(filePath).delete();
              console.log(`[DELETE] Deleted: ${filePath}`);
            } catch (err) {
              console.error(`[DELETE] Failed to delete ${filePath}:`, err);
            }
          }));

          console.log(`Successfully deleted ${filesToDelete.length} files from Firebase for folder: ${folderPath}`);
        }
      } catch (firebaseError) {
        console.error("Error deleting Firebase files:", firebaseError);
        // Continue with database deletion even if Firebase deletion fails
      }

      // Delete all upload records for this folder from Firestore
      const deletePromises = uploadsInFolder.map(upload =>
        (storage as any).db.collection("editorUploads").doc(upload.id).delete()
      );

      // Delete the folder document if it exists
      if (folderDoc) {
        deletePromises.push(folderDoc.ref.delete());
      }

      await Promise.all(deletePromises);

      // Log activity: Folder deleted
      try {
        await firestoreStorage.createActivity({
          partnerId: req.user.partnerId,
          jobId: job.jobId,
          userId: req.user.uid,
          userEmail: req.user.email,
          userName: req.user.email,
          action: "delete",
          category: "file",
          title: "Folder Deleted",
          description: `Folder deleted with ${uploadsInFolder.length} file(s)`,
          metadata: JSON.stringify({
            folderPath,
            deletedFileCount: uploadsInFolder.length,
            folderToken: folderToken || null
          }),
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });
      } catch (activityError) {
        console.error("[ACTIVITY] Failed to log folder deletion:", activityError);
      }

      res.json({
        success: true,
        message: `Folder deleted successfully. Removed ${uploadsInFolder.length} upload(s).`,
        deletedCount: uploadsInFolder.length
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
      const job = await storage.getJobByJobId(jobId);

      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Verify job belongs to user's organization
      if (job.partnerId !== req.user.partnerId) {
        return res.status(403).json({ error: "Access denied: Job belongs to different organization" });
      }

      // Update folder name
      await storage.updateFolderName(job.id, folderPath, newPartnerFolderName);

      // Log activity: Folder renamed
      try {
        await firestoreStorage.createActivity({
          partnerId: req.user.partnerId,
          jobId: job.jobId,
          userId: req.user.uid,
          userEmail: req.user.email,
          userName: req.user.email,
          action: "update",
          category: "file",
          title: "Folder Renamed",
          description: `Folder renamed to "${newPartnerFolderName}"`,
          metadata: JSON.stringify({
            folderPath,
            newFolderName: newPartnerFolderName
          }),
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });
      } catch (activityError) {
        console.error("[ACTIVITY] Failed to log folder rename:", activityError);
      }

      res.json({ success: true, message: "Folder renamed successfully" });
    } catch (error: any) {
      console.error("Error renaming folder:", error);
      res.status(500).json({ 
        error: "Failed to rename folder", 
        details: error.message 
      });
    }
  });

  app.patch("/api/jobs/:jobId/folders/visibility", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { jobId } = req.params;
      const { folderPath, isVisible, folderToken, orderId, uniqueKey } = req.body as { folderPath?: string; isVisible?: boolean; folderToken?: string | null; orderId?: string | null; uniqueKey?: string | null };

      if (!req.user?.partnerId) {
        return res.status(400).json({ error: "User must have a partnerId" });
      }

      if (!folderPath || typeof folderPath !== "string") {
        return res.status(400).json({ error: "folderPath is required" });
      }

      if (typeof isVisible !== "boolean") {
        return res.status(400).json({ error: "isVisible must be a boolean" });
      }

      const job = await storage.getJobByJobId(jobId);

      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      if (job.partnerId !== req.user.partnerId) {
        return res.status(403).json({ error: "Access denied: Job belongs to different organization" });
      }

      await storage.updateFolderVisibility(job.id, folderPath, isVisible, { uniqueKey: uniqueKey ?? null, folderToken: folderToken ?? null, orderId: orderId ?? null });

      try {
        await firestoreStorage.createActivity({
          partnerId: req.user.partnerId,
          jobId: job.jobId,
          userId: req.user.uid,
          userEmail: req.user.email,
          userName: req.user.email,
          action: "update",
          category: "file",
          title: "Folder Visibility Updated",
          description: `Folder visibility set to ${isVisible ? "visible" : "hidden"}`,
          metadata: JSON.stringify({
            folderPath,
            folderToken: folderToken || null,
            orderId: orderId || null,
            uniqueKey: uniqueKey || null,
            isVisible
          }),
          ipAddress: req.ip,
          userAgent: req.get("User-Agent")
        });
      } catch (activityError) {
        console.error("[ACTIVITY] Failed to log folder visibility update:", activityError);
      }

      res.json({
        success: true,
        message: "Folder visibility updated",
        folderPath,
        orderId: orderId ?? null,
        uniqueKey: uniqueKey ?? null,
        isVisible
      });
    } catch (error: any) {
      console.error("Error updating folder visibility:", error);
      res.status(500).json({
        error: "Failed to update folder visibility",
        details: error.message
      });
    }
  });

  // SSE endpoint for zip creation progress
  app.get("/api/jobs/:jobId/folders/download/progress", requireAuthSSE, async (req: AuthenticatedRequest, res) => {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      const { jobId } = req.params;
      const { folderPath } = req.query;

      console.log(`[FOLDER DOWNLOAD PROGRESS] Starting SSE for jobId: ${jobId}, folderPath: ${folderPath}`);

      if (!req.user?.partnerId) {
        res.write(`data: ${JSON.stringify({ stage: 'error', message: 'User must have a partnerId' })}\n\n`);
        return res.end();
      }

      if (!folderPath || typeof folderPath !== 'string') {
        res.write(`data: ${JSON.stringify({ stage: 'error', message: 'folderPath query parameter is required' })}\n\n`);
        return res.end();
      }

      // Find the job
      const job = await storage.getJobByJobId(jobId);

      if (!job) {
        res.write(`data: ${JSON.stringify({ stage: 'error', message: 'Job not found' })}\n\n`);
        return res.end();
      }

      // Verify job belongs to user's organization
      if (job.partnerId !== req.user.partnerId) {
        res.write(`data: ${JSON.stringify({ stage: 'error', message: 'Access denied: Job belongs to different organization' })}\n\n`);
        return res.end();
      }

      // Get all folders for this job
      const allFolders = await storage.getUploadFolders(job.id);

      // Find the target folder
      const targetFolder = allFolders.find(f => f.folderPath === folderPath);
      if (!targetFolder) {
        res.write(`data: ${JSON.stringify({ stage: 'error', message: 'Folder not found' })}\n\n`);
        return res.end();
      }

      // Collect all files recursively
      const allFiles: Array<{ file: any; relativePath: string }> = [];

      // Add files from root folder
      const rootFiles = targetFolder.files.filter(f => !f.fileName.startsWith('.') && f.downloadUrl);
      rootFiles.forEach(file => {
        allFiles.push({
          file,
          relativePath: file.originalName
        });
      });

      // Get all subfolders
      const subfolders = allFolders.filter(f =>
        f.folderPath.startsWith(folderPath + '/') &&
        f.folderPath !== folderPath
      );

      // Add files from each subfolder
      subfolders.forEach(subfolder => {
        const subfolderName = subfolder.partnerFolderName || subfolder.editorFolderName;
        const subfolderFiles = subfolder.files.filter(f => !f.fileName.startsWith('.') && f.downloadUrl);

        subfolderFiles.forEach(file => {
          allFiles.push({
            file,
            relativePath: `${subfolderName}/${file.originalName}`
          });
        });
      });

      const totalFiles = allFiles.length;

      if (totalFiles === 0) {
        res.write(`data: ${JSON.stringify({ stage: 'error', message: 'No files found in this folder' })}\n\n`);
        return res.end();
      }

      console.log(`[FOLDER DOWNLOAD PROGRESS] Total files to process: ${totalFiles}`);

      // Create zip file and report progress
      const zip = new JSZip();
      let filesProcessed = 0;

      // Fetch and add files to zip with progress updates
      for (const { file, relativePath } of allFiles) {
        try {
          const response = await fetch(file.downloadUrl);
          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            const fileBuffer = Buffer.from(arrayBuffer);
            zip.file(relativePath, fileBuffer);
          }

          filesProcessed++;
          const progress = (filesProcessed / totalFiles) * 50; // 0-50% for file collection

          res.write(`data: ${JSON.stringify({
            stage: 'creating',
            progress: Math.round(progress),
            filesProcessed,
            totalFiles
          })}\n\n`);

        } catch (error) {
          console.error(`[FOLDER DOWNLOAD PROGRESS] Error processing file ${file.originalName}:`, error);
          // Continue with other files
        }
      }

      // Generate zip with progress callback
      console.log(`[FOLDER DOWNLOAD PROGRESS] Generating zip file...`);
      const zipBuffer = await zip.generateAsync(
        {
          type: 'nodebuffer',
          streamFiles: true
        },
        (metadata) => {
          const progress = 50 + (metadata.percent * 0.5); // 50-100% for zip generation
          res.write(`data: ${JSON.stringify({
            stage: 'creating',
            progress: Math.round(progress),
            filesProcessed: totalFiles,
            totalFiles
          })}\n\n`);
        }
      );

      console.log(`[FOLDER DOWNLOAD PROGRESS] Zip generated (${zipBuffer.length} bytes)`);

      // Send completion event
      res.write(`data: ${JSON.stringify({
        stage: 'complete',
        totalBytes: zipBuffer.length
      })}\n\n`);

      res.end();

    } catch (error: any) {
      console.error("[FOLDER DOWNLOAD PROGRESS] Error occurred:", error);
      res.write(`data: ${JSON.stringify({ stage: 'error', message: error.message })}\n\n`);
      res.end();
    }
  });

  // Download folder as zip (all files and subfolders)
  app.get("/api/jobs/:jobId/folders/download", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { jobId } = req.params;
      const { folderPath } = req.query;

      console.log(`[FOLDER DOWNLOAD] Request for jobId: ${jobId}, folderPath: ${folderPath}`);

      if (!req.user?.partnerId) {
        return res.status(400).json({ error: "User must have a partnerId" });
      }

      if (!folderPath || typeof folderPath !== 'string') {
        return res.status(400).json({ error: "folderPath query parameter is required" });
      }

      // Find the job
      const job = await storage.getJobByJobId(jobId);

      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Verify job belongs to user's organization
      if (job.partnerId !== req.user.partnerId) {
        return res.status(403).json({ error: "Access denied: Job belongs to different organization" });
      }

      // Get all folders for this job
      const allFolders = await storage.getUploadFolders(job.id);

      // Find the target folder
      const targetFolder = allFolders.find(f => f.folderPath === folderPath);
      if (!targetFolder) {
        return res.status(404).json({ error: "Folder not found" });
      }

      console.log(`[FOLDER DOWNLOAD] Target folder: ${targetFolder.partnerFolderName || targetFolder.editorFolderName}`);

      // Collect all files recursively (from target folder and all subfolders)
      const allFiles: Array<{ file: any; relativePath: string }> = [];

      // Add files from root folder
      const rootFiles = targetFolder.files.filter(f => !f.fileName.startsWith('.') && f.downloadUrl);
      rootFiles.forEach(file => {
        allFiles.push({
          file,
          relativePath: file.originalName
        });
      });

      console.log(`[FOLDER DOWNLOAD] Found ${rootFiles.length} files in root folder`);

      // Get all subfolders recursively
      const subfolders = allFolders.filter(f =>
        f.folderPath.startsWith(folderPath + '/') &&
        f.folderPath !== folderPath
      );

      console.log(`[FOLDER DOWNLOAD] Found ${subfolders.length} subfolders`);

      // Add files from each subfolder
      subfolders.forEach(subfolder => {
        const subfolderName = subfolder.partnerFolderName || subfolder.editorFolderName;
        const subfolderFiles = subfolder.files.filter(f => !f.fileName.startsWith('.') && f.downloadUrl);

        subfolderFiles.forEach(file => {
          allFiles.push({
            file,
            relativePath: `${subfolderName}/${file.originalName}`
          });
        });
      });

      console.log(`[FOLDER DOWNLOAD] Total files to download: ${allFiles.length}`);

      if (allFiles.length === 0) {
        return res.status(404).json({ error: "No files found in this folder" });
      }

      // Create zip file
      const zip = new JSZip();
      const folderName = (targetFolder.partnerFolderName || targetFolder.editorFolderName || 'folder').replace(/[^a-zA-Z0-9-_]/g, '_');

      // Add all files to zip
      for (const { file, relativePath } of allFiles) {
        try {
          console.log(`[FOLDER DOWNLOAD] Fetching file: ${file.originalName} from ${file.downloadUrl}`);

          const response = await fetch(file.downloadUrl);
          if (!response.ok) {
            console.error(`[FOLDER DOWNLOAD] Failed to fetch ${file.originalName}: ${response.status}`);
            continue;
          }

          const arrayBuffer = await response.arrayBuffer();
          const fileBuffer = Buffer.from(arrayBuffer);

          zip.file(relativePath, fileBuffer);
          console.log(`[FOLDER DOWNLOAD] Added ${relativePath} to zip (${fileBuffer.length} bytes)`);
        } catch (error) {
          console.error(`[FOLDER DOWNLOAD] Error processing file ${file.originalName}:`, error);
          // Continue with other files even if one fails
        }
      }

      // Generate zip
      console.log(`[FOLDER DOWNLOAD] Generating zip file...`);
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
      console.log(`[FOLDER DOWNLOAD] Zip generated (${zipBuffer.length} bytes)`);

      // Send zip file
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${folderName}.zip"`);
      res.setHeader('Content-Length', zipBuffer.length.toString());
      res.send(zipBuffer);

      console.log(`[FOLDER DOWNLOAD] Download complete for ${folderName}.zip`);
    } catch (error: any) {
      console.error("[FOLDER DOWNLOAD] Error occurred:");
      console.error("[FOLDER DOWNLOAD] Error message:", error.message);
      console.error("[FOLDER DOWNLOAD] Error stack:", error.stack);
      console.error("[FOLDER DOWNLOAD] Full error:", error);
      res.status(500).json({
        error: "Failed to create folder download",
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
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
      const job = await storage.getJobByJobId(jobId);

      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Verify job belongs to user's organization
      if (job.partnerId !== req.user.partnerId) {
        return res.status(403).json({ error: "Access denied: Job belongs to different organization" });
      }

      // Check if this is an update or new upload
      const isUpdate = !!job.propertyImage;

      // Update job with the new cover photo
      await storage.updateJob(job.id, {
        propertyImage: imageUrl,
        propertyImageThumbnail: imageUrl, // Use same image for thumbnail for now
      });

      // Log activity: Cover photo uploaded or updated
      try {
        await firestoreStorage.createActivity({
          partnerId: req.user.partnerId,
          jobId: job.jobId,
          userId: req.user.uid,
          userEmail: req.user.email,
          userName: req.user.email,
          action: isUpdate ? "update" : "upload",
          category: "job",
          title: isUpdate ? "Cover Image Updated" : "Cover Image Uploaded",
          description: isUpdate
            ? `Job cover image was updated`
            : `Job cover image was uploaded`,
          metadata: JSON.stringify({
            imageUrl,
            hadPreviousImage: isUpdate
          }),
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });
      } catch (activityError) {
        console.error("[ACTIVITY] Failed to log cover photo update:", activityError);
        // Don't fail the request if activity logging fails
      }

      res.json({ success: true, message: "Cover photo updated successfully" });
    } catch (error: any) {
      console.error("Error updating cover photo:", error);
      res.status(500).json({
        error: "Failed to update cover photo",
        details: error.message
      });
    }
  });

  // Update job name
  app.patch("/api/jobs/:id/name", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;

      // Validate request body
      const jobNameSchema = z.object({
        jobName: z.string().min(1, "Job name is required").max(255, "Job name too long"),
      });

      const validationResult = jobNameSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Invalid request body",
          details: validationResult.error.errors
        });
      }

      const { jobName } = validationResult.data;

      if (!req.user?.partnerId) {
        return res.status(400).json({ error: "User must have a partnerId" });
      }

      // Find the job by UUID
      const job = await storage.getJob(id);

      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Verify job belongs to user's organization
      if (job.partnerId !== req.user.partnerId) {
        return res.status(403).json({ error: "Access denied: Job belongs to different organization" });
      }

      // Store previous job name
      const previousJobName = job.jobName;

      // Update job with the new name
      await storage.updateJob(id, {
        jobName: jobName,
      });

      // Log activity: Job name updated
      try {
        await firestoreStorage.createActivity({
          partnerId: req.user.partnerId,
          jobId: job.jobId,
          userId: req.user.uid,
          userEmail: req.user.email,
          userName: req.user.email,
          action: "update",
          category: "job",
          title: "Job Name Updated",
          description: `Job name changed from "${previousJobName || 'Untitled'}" to "${jobName}"`,
          metadata: JSON.stringify({
            previousJobName: previousJobName || null,
            newJobName: jobName
          }),
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });
      } catch (activityError) {
        console.error("[ACTIVITY] Failed to log job name update:", activityError);
        // Don't fail the request if activity logging fails
      }

      res.json({ success: true, message: "Job name updated successfully", jobName });
    } catch (error: any) {
      console.error("Error updating job name:", error);
      res.status(500).json({
        error: "Failed to update job name",
        details: error.message
      });
    }
  });

  // Note: The old proxy endpoint (/api/files/proxy/:fileId) has been removed
  // Files now use direct Firebase download URLs instead of a proxy

  // Update job status (requires auth - partner only)
  app.patch("/api/jobs/:id/status", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ error: "Status is required" });
      }

      if (!req.user?.partnerId) {
        return res.status(400).json({ error: "User must have a partnerId" });
      }

      // Get job by UUID (id parameter)
      const job = await storage.getJob(id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Verify job belongs to user's organization
      if (job.partnerId !== req.user.partnerId) {
        return res.status(403).json({ error: "Access denied: Job belongs to different organization" });
      }

      // Update job status
      const updatedJob = await storage.updateJob(id, { status });
      if (!updatedJob) {
        return res.status(404).json({ error: "Job not found" });
      }

      // If job is being marked as delivered, update all related orders to delivered status
      // This removes them from the "Needs Your Attention" list
      if (status === 'delivered') {
        try {
          // Get all orders for this job
          const allOrders = await storage.getOrders(job.partnerId);
          const jobOrders = allOrders.filter(order => 
            order.jobId === job.id || order.jobId === job.jobId
          );

          // Update all related orders to delivered status
          // Use updateOrder instead of updateOrderStatus to bypass editor validation
          // (partners can mark orders as delivered when delivering the job)
          await Promise.all(
            jobOrders.map(order => 
              storage.updateOrder(order.id, { status: 'delivered' })
            )
          );

          console.log(`[JOB STATUS] Updated ${jobOrders.length} order(s) to delivered status for job ${job.jobId || job.id}`);
        } catch (orderUpdateError: any) {
          console.error("[JOB STATUS] Error updating related orders:", orderUpdateError);
          // Don't fail the request if order update fails - job status is still updated
        }
      }

      // Log activity: Job status updated
      try {
        await storage.createActivity({
          partnerId: job.partnerId,
          jobId: job.jobId,
          userId: req.user?.uid || 'system',
          userEmail: req.user?.email || 'system',
          userName: req.user?.email || 'System',
          action: "status_change",
          category: "job",
          title: "Job Status Updated",
          description: `Job status changed to ${status}`,
          metadata: JSON.stringify({
            previousStatus: job.status,
            newStatus: status
          }),
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });
      } catch (activityError) {
        console.error("[ACTIVITY] Failed to log job status update:", activityError);
        // Don't fail the request if activity logging fails
      }

      res.json({ success: true, job: updatedJob });
    } catch (error: any) {
      console.error("Error updating job status:", error);
      res.status(500).json({
        error: "Failed to update job status",
        details: error.message
      });
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
        upload.fileName !== '.folder_placeholder' && // Exclude folder placeholders
        !upload.firebaseUrl?.startsWith('orders/') // Exclude files uploaded for editing (not deliverables)
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
              downloadUrl: file.downloadUrl, // This should be the file path for the proxy
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
      console.log('[DELIVERY ENDPOINT] Fetching review for job.id:', job.id);
      const jobReview = await storage.getJobReview(job.id);
      console.log('[DELIVERY ENDPOINT] Review found:', !!jobReview, jobReview ? { id: jobReview.id, rating: jobReview.rating } : null);

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

      // Log activity: Customer viewed delivery page
      try {
        await storage.createActivity({
          partnerId: job.partnerId,
          jobId: job.jobId,
          userId: 'customer',
          userEmail: customer?.email || 'customer',
          userName: customer ? `${customer.firstName} ${customer.lastName}` : 'Customer',
          action: "read",
          category: "job",
          title: "Delivery Page Viewed",
          description: `Customer accessed delivery page`,
          metadata: JSON.stringify({
            fileCount: completedFiles.length,
            folderCount: folders.length,
            hasReview: !!jobReview
          }),
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });
      } catch (activityError) {
        console.error("[ACTIVITY] Failed to log delivery page view:", activityError);
      }

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

  // PUBLIC ZIP DOWNLOAD FOR DELIVERY PAGE - Progress endpoint with SSE
  app.get("/api/delivery/:token/folders/download/progress", async (req, res) => {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      const { token } = req.params;
      const { folderPath } = req.query;

      console.log(`[DELIVERY FOLDER DOWNLOAD PROGRESS] Starting SSE for token: ${token}, folderPath: ${folderPath}`);

      if (!folderPath || typeof folderPath !== 'string') {
        res.write(`data: ${JSON.stringify({ stage: 'error', message: 'folderPath query parameter is required' })}\n\n`);
        return res.end();
      }

      // Find job by delivery token
      const job = await storage.getJobByDeliveryToken(token);

      if (!job) {
        res.write(`data: ${JSON.stringify({ stage: 'error', message: 'Delivery not found' })}\n\n`);
        return res.end();
      }

      // Get all folders for this job
      const allFolders = await storage.getUploadFolders(job.id);

      // Find the target folder
      const targetFolder = allFolders.find(f => f.folderPath === folderPath);
      if (!targetFolder) {
        res.write(`data: ${JSON.stringify({ stage: 'error', message: 'Folder not found' })}\n\n`);
        return res.end();
      }

      // Collect all files recursively
      const allFiles: Array<{ file: any; relativePath: string }> = [];

      // Add files from root folder
      const rootFiles = targetFolder.files.filter(f => !f.fileName.startsWith('.') && f.downloadUrl);
      rootFiles.forEach(file => {
        allFiles.push({
          file,
          relativePath: file.originalName
        });
      });

      // Get all subfolders
      const subfolders = allFolders.filter(f =>
        f.folderPath.startsWith(folderPath + '/') &&
        f.folderPath !== folderPath
      );

      // Add files from each subfolder
      subfolders.forEach(subfolder => {
        const subfolderName = subfolder.partnerFolderName || subfolder.editorFolderName;
        const subfolderFiles = subfolder.files.filter(f => !f.fileName.startsWith('.') && f.downloadUrl);

        subfolderFiles.forEach(file => {
          allFiles.push({
            file,
            relativePath: `${subfolderName}/${file.originalName}`
          });
        });
      });

      const totalFiles = allFiles.length;

      if (totalFiles === 0) {
        res.write(`data: ${JSON.stringify({ stage: 'error', message: 'No files found in this folder' })}\n\n`);
        return res.end();
      }

      console.log(`[DELIVERY FOLDER DOWNLOAD PROGRESS] Total files to process: ${totalFiles}`);

      // Create zip file and report progress
      const zip = new JSZip();
      let filesProcessed = 0;

      // Fetch and add files to zip with progress updates
      for (const { file, relativePath } of allFiles) {
        try {
          const response = await fetch(file.downloadUrl);
          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            const fileBuffer = Buffer.from(arrayBuffer);
            zip.file(relativePath, fileBuffer);
          }

          filesProcessed++;
          const progress = (filesProcessed / totalFiles) * 50; // 0-50% for file collection

          res.write(`data: ${JSON.stringify({
            stage: 'creating',
            progress: Math.round(progress),
            filesProcessed,
            totalFiles
          })}\n\n`);

        } catch (error) {
          console.error(`[DELIVERY FOLDER DOWNLOAD PROGRESS] Error processing file ${file.originalName}:`, error);
          // Continue with other files
        }
      }

      // Generate zip with progress callback
      console.log(`[DELIVERY FOLDER DOWNLOAD PROGRESS] Generating zip file...`);
      const zipBuffer = await zip.generateAsync(
        {
          type: 'nodebuffer',
          streamFiles: true
        },
        (metadata) => {
          const progress = 50 + (metadata.percent * 0.5); // 50-100% for zip generation
          res.write(`data: ${JSON.stringify({
            stage: 'creating',
            progress: Math.round(progress),
            filesProcessed: totalFiles,
            totalFiles
          })}\n\n`);
        }
      );

      console.log(`[DELIVERY FOLDER DOWNLOAD PROGRESS] Zip generated (${zipBuffer.length} bytes)`);

      // Send completion event
      res.write(`data: ${JSON.stringify({
        stage: 'complete',
        totalBytes: zipBuffer.length
      })}\n\n`);

      res.end();

    } catch (error: any) {
      console.error("[DELIVERY FOLDER DOWNLOAD PROGRESS] Error occurred:", error);
      res.write(`data: ${JSON.stringify({ stage: 'error', message: error.message })}\n\n`);
      res.end();
    }
  });

  // PUBLIC ZIP DOWNLOAD FOR DELIVERY PAGE - Actual download endpoint
  app.get("/api/delivery/:token/folders/download", async (req, res) => {
    try {
      const { token } = req.params;
      const { folderPath } = req.query;

      console.log(`[DELIVERY FOLDER DOWNLOAD] Request for token: ${token}, folderPath: ${folderPath}`);

      if (!folderPath || typeof folderPath !== 'string') {
        return res.status(400).json({ error: "folderPath query parameter is required" });
      }

      // Find job by delivery token
      const job = await storage.getJobByDeliveryToken(token);

      if (!job) {
        return res.status(404).json({ error: "Delivery not found" });
      }

      // Get all folders for this job
      const allFolders = await storage.getUploadFolders(job.id);

      // Find the target folder
      const targetFolder = allFolders.find(f => f.folderPath === folderPath);
      if (!targetFolder) {
        return res.status(404).json({ error: "Folder not found" });
      }

      console.log(`[DELIVERY FOLDER DOWNLOAD] Target folder: ${targetFolder.partnerFolderName || targetFolder.editorFolderName}`);

      // Collect all files recursively (from target folder and all subfolders)
      const allFiles: Array<{ file: any; relativePath: string }> = [];

      // Add files from root folder
      const rootFiles = targetFolder.files.filter(f => !f.fileName.startsWith('.') && f.downloadUrl);
      rootFiles.forEach(file => {
        allFiles.push({
          file,
          relativePath: file.originalName
        });
      });

      console.log(`[DELIVERY FOLDER DOWNLOAD] Found ${rootFiles.length} files in root folder`);

      // Get all subfolders recursively
      const subfolders = allFolders.filter(f =>
        f.folderPath.startsWith(folderPath + '/') &&
        f.folderPath !== folderPath
      );

      console.log(`[DELIVERY FOLDER DOWNLOAD] Found ${subfolders.length} subfolders`);

      // Add files from each subfolder
      subfolders.forEach(subfolder => {
        const subfolderName = subfolder.partnerFolderName || subfolder.editorFolderName;
        const subfolderFiles = subfolder.files.filter(f => !f.fileName.startsWith('.') && f.downloadUrl);

        subfolderFiles.forEach(file => {
          allFiles.push({
            file,
            relativePath: `${subfolderName}/${file.originalName}`
          });
        });
      });

      console.log(`[DELIVERY FOLDER DOWNLOAD] Total files to download: ${allFiles.length}`);

      if (allFiles.length === 0) {
        return res.status(404).json({ error: "No files found in this folder" });
      }

      // Create zip file
      const zip = new JSZip();
      const folderName = (targetFolder.partnerFolderName || targetFolder.editorFolderName || 'folder').replace(/[^a-zA-Z0-9-_]/g, '_');

      // Add all files to zip
      for (const { file, relativePath } of allFiles) {
        try {
          console.log(`[DELIVERY FOLDER DOWNLOAD] Fetching file: ${file.originalName} from ${file.downloadUrl}`);

          const response = await fetch(file.downloadUrl);
          if (!response.ok) {
            console.error(`[DELIVERY FOLDER DOWNLOAD] Failed to fetch ${file.originalName}: ${response.status}`);
            continue;
          }

          const arrayBuffer = await response.arrayBuffer();
          const fileBuffer = Buffer.from(arrayBuffer);

          zip.file(relativePath, fileBuffer);
          console.log(`[DELIVERY FOLDER DOWNLOAD] Added ${relativePath} to zip (${fileBuffer.length} bytes)`);
        } catch (error) {
          console.error(`[DELIVERY FOLDER DOWNLOAD] Error processing file ${file.originalName}:`, error);
          // Continue with other files even if one fails
        }
      }

      // Generate zip
      console.log(`[DELIVERY FOLDER DOWNLOAD] Generating zip file...`);
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
      console.log(`[DELIVERY FOLDER DOWNLOAD] Zip generated (${zipBuffer.length} bytes)`);

      // Send zip file
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${folderName}.zip"`);
      res.setHeader('Content-Length', zipBuffer.length.toString());
      res.send(zipBuffer);

      console.log(`[DELIVERY FOLDER DOWNLOAD] Download complete for ${folderName}.zip`);
    } catch (error: any) {
      console.error("[DELIVERY FOLDER DOWNLOAD] Error occurred:", error);
      res.status(500).json({
        error: "Failed to create folder download",
        details: error.message
      });
    }
  });

  // PUBLIC ZIP DOWNLOAD ALL FOR DELIVERY PAGE
  app.get("/api/delivery/:token/download-all", async (req, res) => {
    try {
      const { token } = req.params;

      console.log(`[DELIVERY DOWNLOAD ALL] Request for token: ${token}`);

      // Find job by delivery token
      const job = await storage.getJobByDeliveryToken(token);

      if (!job) {
        return res.status(404).json({ error: "Delivery not found" });
      }

      // Get all folders for this job
      const allFolders = await storage.getUploadFolders(job.id);

      console.log(`[DELIVERY DOWNLOAD ALL] Found ${allFolders.length} folders`);

      // Create zip file
      const zip = new JSZip();
      const jobName = `${job.address || 'delivery'}`.replace(/[^a-zA-Z0-9-_]/g, '_');

      // Add all files from all folders to zip, preserving folder structure
      for (const folder of allFolders) {
        const folderName = folder.partnerFolderName || folder.editorFolderName || 'Files';
        const folderFiles = folder.files.filter(f => !f.fileName.startsWith('.') && f.downloadUrl);

        for (const file of folderFiles) {
          try {
            console.log(`[DELIVERY DOWNLOAD ALL] Fetching file: ${file.originalName} from ${file.downloadUrl}`);

            const response = await fetch(file.downloadUrl);
            if (!response.ok) {
              console.error(`[DELIVERY DOWNLOAD ALL] Failed to fetch ${file.originalName}: ${response.status}`);
              continue;
            }

            const arrayBuffer = await response.arrayBuffer();
            const fileBuffer = Buffer.from(arrayBuffer);

            // Add file to zip with folder structure
            const relativePath = `${folderName}/${file.originalName}`;
            zip.file(relativePath, fileBuffer);
            console.log(`[DELIVERY DOWNLOAD ALL] Added ${relativePath} to zip (${fileBuffer.length} bytes)`);
          } catch (error) {
            console.error(`[DELIVERY DOWNLOAD ALL] Error processing file ${file.originalName}:`, error);
            // Continue with other files even if one fails
          }
        }
      }

      // Generate zip
      console.log(`[DELIVERY DOWNLOAD ALL] Generating zip file...`);
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
      console.log(`[DELIVERY DOWNLOAD ALL] Zip generated (${zipBuffer.length} bytes)`);

      // Send zip file
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${jobName}-all-files.zip"`);
      res.setHeader('Content-Length', zipBuffer.length.toString());
      res.send(zipBuffer);

      console.log(`[DELIVERY DOWNLOAD ALL] Download complete for ${jobName}-all-files.zip`);
    } catch (error: any) {
      console.error("[DELIVERY DOWNLOAD ALL] Error occurred:", error);
      res.status(500).json({
        error: "Failed to create download",
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
              downloadUrl: file.downloadUrl, // This should be the file path for the proxy
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
      console.log('[DELIVERY ENDPOINT] Fetching review for job.id:', job.id);
      const jobReview = await storage.getJobReview(job.id);
      console.log('[DELIVERY ENDPOINT] Review found:', !!jobReview, jobReview ? { id: jobReview.id, rating: jobReview.rating } : null);

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

  // AUTHENTICATED PREVIEW DOWNLOAD ENDPOINTS
  // Download folder as ZIP (preview mode with jobId)
  app.get("/api/jobs/:jobId/preview/folders/download", requireAuth, async (req, res) => {
    try {
      const { jobId } = req.params;
      const { folderPath } = req.query;
      const { partnerId } = req.user;

      console.log(`[PREVIEW FOLDER DOWNLOAD] Request for jobId: ${jobId}, folderPath: ${folderPath}`);

      if (!folderPath || typeof folderPath !== 'string') {
        return res.status(400).json({ error: "folderPath query parameter is required" });
      }

      // Find job by jobId and verify ownership
      const job = await storage.getJobByJobId(jobId);

      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      if (job.partnerId !== partnerId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Get all folders for this job
      const allFolders = await storage.getUploadFolders(job.id);

      // Find the target folder
      const targetFolder = allFolders.find(f => f.folderPath === folderPath);
      if (!targetFolder) {
        return res.status(404).json({ error: "Folder not found" });
      }

      console.log(`[PREVIEW FOLDER DOWNLOAD] Target folder: ${targetFolder.partnerFolderName || targetFolder.editorFolderName}`);

      // Collect all files recursively (from target folder and all subfolders)
      const allFiles: Array<{ file: any; relativePath: string }> = [];

      // Add files from root folder
      const rootFiles = targetFolder.files.filter(f => !f.fileName.startsWith('.') && f.downloadUrl);
      rootFiles.forEach(file => {
        allFiles.push({
          file,
          relativePath: file.originalName
        });
      });

      // Get all subfolders recursively
      const subfolders = allFolders.filter(f =>
        f.folderPath.startsWith(folderPath + '/') &&
        f.folderPath !== folderPath
      );

      // Add files from each subfolder
      subfolders.forEach(subfolder => {
        const subfolderName = subfolder.partnerFolderName || subfolder.editorFolderName;
        const subfolderFiles = subfolder.files.filter(f => !f.fileName.startsWith('.') && f.downloadUrl);

        subfolderFiles.forEach(file => {
          allFiles.push({
            file,
            relativePath: `${subfolderName}/${file.originalName}`
          });
        });
      });

      if (allFiles.length === 0) {
        return res.status(404).json({ error: "No files found in this folder" });
      }

      // Create zip file
      const zip = new JSZip();
      const folderName = (targetFolder.partnerFolderName || targetFolder.editorFolderName || 'folder').replace(/[^a-zA-Z0-9-_]/g, '_');

      // Add all files to zip
      for (const { file, relativePath } of allFiles) {
        try {
          const response = await fetch(file.downloadUrl);
          if (!response.ok) continue;

          const arrayBuffer = await response.arrayBuffer();
          const fileBuffer = Buffer.from(arrayBuffer);
          zip.file(relativePath, fileBuffer);
        } catch (error) {
          console.error(`[PREVIEW FOLDER DOWNLOAD] Error processing file ${file.originalName}:`, error);
        }
      }

      // Generate zip
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      // Send zip file
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${folderName}.zip"`);
      res.setHeader('Content-Length', zipBuffer.length.toString());
      res.send(zipBuffer);

      console.log(`[PREVIEW FOLDER DOWNLOAD] Download complete for ${folderName}.zip`);
    } catch (error: any) {
      console.error("[PREVIEW FOLDER DOWNLOAD] Error occurred:", error);
      res.status(500).json({
        error: "Failed to create folder download",
        details: error.message
      });
    }
  });

  // Download all files as ZIP (preview mode with jobId)
  app.get("/api/jobs/:jobId/preview/download-all", requireAuth, async (req, res) => {
    try {
      const { jobId } = req.params;
      const { partnerId } = req.user;

      console.log(`[PREVIEW DOWNLOAD ALL] Request for jobId: ${jobId}`);

      // Find job by jobId and verify ownership
      const job = await storage.getJobByJobId(jobId);

      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      if (job.partnerId !== partnerId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Get all folders for this job
      const allFolders = await storage.getUploadFolders(job.id);

      // Create zip file
      const zip = new JSZip();
      const jobName = `${job.address || 'delivery'}`.replace(/[^a-zA-Z0-9-_]/g, '_');

      // Add all files from all folders to zip, preserving folder structure
      for (const folder of allFolders) {
        const folderName = folder.partnerFolderName || folder.editorFolderName || 'Files';
        const folderFiles = folder.files.filter(f => !f.fileName.startsWith('.') && f.downloadUrl);

        for (const file of folderFiles) {
          try {
            const response = await fetch(file.downloadUrl);
            if (!response.ok) continue;

            const arrayBuffer = await response.arrayBuffer();
            const fileBuffer = Buffer.from(arrayBuffer);

            // Add file to zip with folder structure
            const relativePath = `${folderName}/${file.originalName}`;
            zip.file(relativePath, fileBuffer);
          } catch (error) {
            console.error(`[PREVIEW DOWNLOAD ALL] Error processing file ${file.originalName}:`, error);
          }
        }
      }

      // Generate zip
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      // Send zip file
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${jobName}-all-files.zip"`);
      res.setHeader('Content-Length', zipBuffer.length.toString());
      res.send(zipBuffer);

      console.log(`[PREVIEW DOWNLOAD ALL] Download complete for ${jobName}-all-files.zip`);
    } catch (error: any) {
      console.error("[PREVIEW DOWNLOAD ALL] Error occurred:", error);
      res.status(500).json({
        error: "Failed to create download",
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

      // Log activity: Comment added to file
      try {
        await storage.createActivity({
          partnerId: job.partnerId,
          jobId: job.jobId,
          orderId: file.orderId,
          userId: authorId || 'unknown',
          userEmail: authorId || 'unknown',
          userName: authorName || 'User',
          action: "comment",
          category: "file",
          title: "Comment Added",
          description: `Comment added to file "${file.originalName}"`,
          metadata: JSON.stringify({
            fileName: file.originalName,
            fileId,
            authorRole,
            messageLength: message?.length || 0
          }),
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });
      } catch (activityError) {
        console.error("[ACTIVITY] Failed to log file comment:", activityError);
      }

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
      console.log('[REVIEW CREATE] Creating review for job:', { id: job.id, jobId: job.jobId, partnerId: job.partnerId });
      const validated = insertJobReviewSchema.parse({
        jobId: job.id, // Use UUID (job.id) as stored in jobReviews collection
        partnerId: job.partnerId, // Include partnerId for security/auditing
        rating,
        review,
        submittedBy,
        submittedByEmail,
      });
      console.log('[REVIEW CREATE] Validated review data:', { jobId: validated.jobId, rating: validated.rating });

      const newReview = await storage.createJobReview(validated);
      console.log('[REVIEW CREATE] Review created successfully:', { id: newReview.id, jobId: newReview.jobId });

      // Create activity: Review received from client
      try {
        const activityData = {
          partnerId: job.partnerId,
          jobId: job.jobId, // Use NanoID for consistency with ActivityTimeline queries
          userId: 'customer',
          userEmail: submittedByEmail || 'customer',
          userName: submittedBy || 'Customer',
          action: "creation" as const,
          category: "job" as const,
          title: "Review Received",
          description: `Client submitted a ${rating}-star review${review ? ' with feedback' : ''}`,
          metadata: JSON.stringify({
            rating,
            hasReviewText: !!review,
            submittedBy,
            submittedByEmail
          }),
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        };
        console.log("[ACTIVITY] Creating review activity:", { jobId: job.jobId, partnerId: job.partnerId });
        await firestoreStorage.createActivity(activityData);
        console.log("[ACTIVITY] Successfully created review activity");
      } catch (activityError) {
        console.error("[ACTIVITY] Failed to log review submission:", activityError);
        console.error("[ACTIVITY] Error details:", {
          message: (activityError as any)?.message,
          stack: (activityError as any)?.stack,
          jobId: job.jobId,
          partnerId: job.partnerId
        });
      }

      // Create notifications for partner and editors who worked on this job
      try {
        const notifications: any[] = [];

        // Get partner user(s) to notify
        console.log("[NOTIFICATION] Getting partner user for partnerId:", job.partnerId);
        const partnerUser = await getUserByPartnerId(job.partnerId);
        if (partnerUser) {
          console.log("[NOTIFICATION] Found partner user:", partnerUser.uid);
          notifications.push({
            partnerId: job.partnerId,
            recipientId: partnerUser.uid,
            type: 'review_received',
            title: 'New Review Received',
            body: `You received a ${rating}-star review${review ? ' with feedback' : ''} for job at ${job.address}`,
            jobId: job.jobId, // Use NanoID for navigation consistency
            read: false
          });
        } else {
          console.log("[NOTIFICATION] No partner user found for partnerId:", job.partnerId);
        }

        // Get editors who worked on this job (via orders)
        console.log("[NOTIFICATION] Getting orders for partnerId:", job.partnerId);
        const allOrders = await storage.getOrders(job.partnerId);
        console.log("[NOTIFICATION] Found", allOrders.length, "total orders");
        const jobOrders = allOrders.filter(order => 
          order.jobId === job.id || order.jobId === job.jobId
        );
        console.log("[NOTIFICATION] Found", jobOrders.length, "orders for this job");
        const editorIds = new Set<string>();
        jobOrders.forEach(order => {
          if (order.assignedTo) {
            editorIds.add(order.assignedTo);
            console.log("[NOTIFICATION] Found editor:", order.assignedTo);
          }
        });

        // Create notifications for editors
        editorIds.forEach(editorId => {
          notifications.push({
            partnerId: job.partnerId,
            recipientId: editorId,
            type: 'review_received',
            title: 'New Review Received',
            body: `A client submitted a ${rating}-star review${review ? ' with feedback' : ''} for a job you worked on`,
            jobId: job.jobId, // Use NanoID for navigation consistency
            read: false
          });
        });

        if (notifications.length > 0) {
          console.log("[NOTIFICATION] Creating", notifications.length, "notification(s)");
          await firestoreStorage.createNotifications(notifications);
          console.log(`[NOTIFICATION] Successfully created ${notifications.length} notification(s) for review on job ${job.jobId}`);
        } else {
          console.log("[NOTIFICATION] No notifications to create");
        }
      } catch (notificationError) {
        console.error("[NOTIFICATION] Failed to create review notifications:", notificationError);
        console.error("[NOTIFICATION] Error details:", {
          message: (notificationError as any)?.message,
          stack: (notificationError as any)?.stack,
          jobId: job.jobId,
          partnerId: job.partnerId
        });
        // Don't fail the request if notifications fail
      }

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
  // TODO: This endpoint needs to be implemented using file comments system
  // app.post("/api/jobs/:jobId/revisions/request", requireAuth, async (req, res) => {
  //   try {
  //     const { jobId } = req.params;
  //     const { partnerId } = req.user;
  //     const { orderId, fileIds, comments } = req.body;

  //     if (!orderId || !fileIds || !Array.isArray(fileIds)) {
  //       return res.status(400).json({ error: "orderId and fileIds array required" });
  //     }

  //     // Get job (supports both nanoId and UUID) and verify ownership
  //     const job = await storage.getJobByJobId(jobId);
  //     if (!job) {
  //       return res.status(404).json({ error: "Job not found" });
  //     }
  //     if (job.partnerId !== partnerId) {
  //       return res.status(403).json({ error: "Access denied" });
  //     }

  //     // Verify order belongs to this job
  //     const order = await storage.getOrder(orderId);
  //     if (!order || (order.jobId !== job.id && order.jobId !== job.jobId)) { // Allow match by UUID or NanoID
  //       return res.status(404).json({ error: "Order not found for this job" });
  //     }

  //     // Verify all files belong to this job
  //     const jobUploads = await storage.getEditorUploads(job.id);
  //     const validFileIds = jobUploads.map(f => f.id);
  //     const invalidFiles = fileIds.filter(fid => !validFileIds.includes(fid));

  //     if (invalidFiles.length > 0) {
  //       return res.status(400).json({ error: "Some files do not belong to this job" });
  //     }

  //     // Check revision limits
  //     const revisionStatus = await storage.getOrderRevisionStatus(orderId);
  //     if (revisionStatus && revisionStatus.remainingRounds <= 0) {
  //       return res.status(400).json({ 
  //         error: "No revision rounds remaining",
  //         revisionStatus 
  //       });
  //     }

  //     // Create revision request using file comments
  //     // TODO: Implement using insertFileCommentSchema and storage.createFileComment
  //     res.status(501).json({ error: "Not implemented" });
  //   } catch (error: any) {
  //     console.error("Error creating revision request:", error);
  //     res.status(400).json({ 
  //       error: "Failed to create revision request", 
  //       details: error.message 
  //     });
  //   }
  // });

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

      // Log activity: Comment added by customer
      try {
        await storage.createActivity({
          partnerId: job.partnerId,
          jobId: job.jobId,
          orderId: file.orderId,
          userId: 'customer',
          userEmail: authorId || 'customer',
          userName: authorName || 'Customer',
          action: "comment",
          category: "file",
          title: "Comment Added",
          description: `Customer added comment to file "${file.originalName}"`,
          metadata: JSON.stringify({
            fileName: file.originalName,
            fileId,
            authorRole,
            messageLength: message?.length || 0
          }),
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });
      } catch (activityError) {
        console.error("[ACTIVITY] Failed to log customer file comment:", activityError);
      }

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
      // NOTE: This storage call needs to be improved to fetch a single comment efficiently
      // For now, fetching all comments and filtering is a workaround.
      const allComments = await storage.getJobFileComments(''); // Empty jobId to fetch all, needs optimization
      const comment = allComments.find(c => c.id === commentId);

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
        partnerId: job.partnerId, // Include partnerId for security/auditing
        rating,
        review,
        submittedBy,
        submittedByEmail,
      });

      const newReview = await storage.createJobReview(validated);

      // Create activity: Review received from client
      try {
        const activityData = {
          partnerId: job.partnerId,
          jobId: job.jobId, // Use NanoID for consistency with ActivityTimeline queries
          userId: 'customer',
          userEmail: submittedByEmail || 'customer',
          userName: submittedBy || 'Customer',
          action: "creation" as const,
          category: "job" as const,
          title: "Review Received",
          description: `Client submitted a ${rating}-star review${review ? ' with feedback' : ''}`,
          metadata: JSON.stringify({
            rating,
            hasReviewText: !!review,
            submittedBy,
            submittedByEmail
          }),
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        };
        console.log("[ACTIVITY] Creating review activity:", { jobId: job.jobId, partnerId: job.partnerId });
        await firestoreStorage.createActivity(activityData);
        console.log("[ACTIVITY] Successfully created review activity");
      } catch (activityError) {
        console.error("[ACTIVITY] Failed to log review submission:", activityError);
        console.error("[ACTIVITY] Error details:", {
          message: (activityError as any)?.message,
          stack: (activityError as any)?.stack,
          jobId: job.jobId,
          partnerId: job.partnerId
        });
      }

      // Create notifications for partner and editors who worked on this job
      try {
        const notifications: any[] = [];

        // Get partner user(s) to notify
        console.log("[NOTIFICATION] Getting partner user for partnerId:", job.partnerId);
        const partnerUser = await getUserByPartnerId(job.partnerId);
        if (partnerUser) {
          console.log("[NOTIFICATION] Found partner user:", partnerUser.uid);
          notifications.push({
            partnerId: job.partnerId,
            recipientId: partnerUser.uid,
            type: 'review_received',
            title: 'New Review Received',
            body: `You received a ${rating}-star review${review ? ' with feedback' : ''} for job at ${job.address}`,
            jobId: job.jobId, // Use NanoID for navigation consistency
            read: false
          });
        } else {
          console.log("[NOTIFICATION] No partner user found for partnerId:", job.partnerId);
        }

        // Get editors who worked on this job (via orders)
        console.log("[NOTIFICATION] Getting orders for partnerId:", job.partnerId);
        const allOrders = await storage.getOrders(job.partnerId);
        console.log("[NOTIFICATION] Found", allOrders.length, "total orders");
        const jobOrders = allOrders.filter(order => 
          order.jobId === job.id || order.jobId === job.jobId
        );
        console.log("[NOTIFICATION] Found", jobOrders.length, "orders for this job");
        const editorIds = new Set<string>();
        jobOrders.forEach(order => {
          if (order.assignedTo) {
            editorIds.add(order.assignedTo);
            console.log("[NOTIFICATION] Found editor:", order.assignedTo);
          }
        });

        // Create notifications for editors
        editorIds.forEach(editorId => {
          notifications.push({
            partnerId: job.partnerId,
            recipientId: editorId,
            type: 'review_received',
            title: 'New Review Received',
            body: `A client submitted a ${rating}-star review${review ? ' with feedback' : ''} for a job you worked on`,
            jobId: job.jobId, // Use NanoID for navigation consistency
            read: false
          });
        });

        if (notifications.length > 0) {
          console.log("[NOTIFICATION] Creating", notifications.length, "notification(s)");
          await firestoreStorage.createNotifications(notifications);
          console.log(`[NOTIFICATION] Successfully created ${notifications.length} notification(s) for review on job ${job.jobId}`);
        } else {
          console.log("[NOTIFICATION] No notifications to create");
        }
      } catch (notificationError) {
        console.error("[NOTIFICATION] Failed to create review notifications:", notificationError);
        console.error("[NOTIFICATION] Error details:", {
          message: (notificationError as any)?.message,
          stack: (notificationError as any)?.stack,
          jobId: job.jobId,
          partnerId: job.partnerId
        });
        // Don't fail the request if notifications fail
      }

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
      const token = await storage.generateDeliveryToken(job.jobId || job.id); // Use NanoID or UUID

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

  // Send delivery email endpoint (matches frontend expectation)
  app.post("/api/delivery/send-email", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { jobId, recipientEmail, subject, message } = req.body;

      if (!jobId || !recipientEmail || !subject || !message) {
        return res.status(400).json({ error: "Missing required fields: jobId, recipientEmail, subject, message" });
      }

      // Verify job exists and belongs to partner
      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      if (req.user?.partnerId && job.partnerId !== req.user.partnerId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Generate delivery token if it doesn't exist
      const token = await storage.generateDeliveryToken(job.jobId || job.id);
      const deliveryLink = `${req.protocol}://${req.get('host')}/delivery/${token}`;

      // Create delivery email record
      const emailData = {
        jobId,
        partnerId: job.partnerId,
        recipientEmail,
        subject,
        message,
        deliveryLink,
        sentBy: req.user?.uid || 'system',
      };

      const email = await storage.createDeliveryEmail(emailData);

      // Get customer info for personalized email
      const customer = job.customerId ? await storage.getCustomer(job.customerId) : null;
      const recipientName = customer 
        ? `${customer.firstName} ${customer.lastName}`.trim() 
        : recipientEmail.split('@')[0];

      // Send delivery email via SendGrid
      const emailResult = await sendDeliveryEmail(
        recipientEmail,
        recipientName,
        subject,
        message,
        deliveryLink
      );

      if (!emailResult.success) {
        console.error(`Failed to send delivery email to ${recipientEmail}:`, emailResult.error);
        // Don't fail the request if email fails - delivery email record is still created
      }

      // Log activity: Delivery link sent
      try {
        await storage.createActivity({
          partnerId: job.partnerId,
          jobId: job.jobId,
          userId: req.user?.uid || 'system',
          userEmail: req.user?.email || 'system',
          userName: req.user?.email || 'System',
          action: "notification",
          category: "job",
          title: "Delivery Link Sent",
          description: `Delivery link sent to ${recipientEmail}`,
          metadata: JSON.stringify({
            recipientEmail,
            subject,
            hasDeliveryLink: !!deliveryLink,
            emailSent: emailResult.success
          }),
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });
      } catch (activityError) {
        console.error("[ACTIVITY] Failed to log delivery email:", activityError);
      }

      res.status(201).json({
        ...email,
        emailSent: emailResult.success
      });
    } catch (error: any) {
      console.error("Error sending delivery email:", error);
      res.status(400).json({ 
        error: "Failed to send delivery email", 
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
      const token = await storage.generateDeliveryToken(job.jobId || job.id); // Use NanoID or UUID
      const deliveryLink = `${req.protocol}://${req.get('host')}/delivery/${token}`;

      // Set sentBy from authenticated user and include the secure delivery link
      const emailData = {
        ...validated,
        sentBy: req.user?.uid || 'system', // Use UID for sentBy
        deliveryLink, // Override with secure tokenized link
      };

      const email = await storage.createDeliveryEmail(emailData);

      // Get customer info for personalized email
      const customer = job.customerId ? await storage.getCustomer(job.customerId) : null;
      const recipientName = customer 
        ? `${customer.firstName} ${customer.lastName}`.trim() 
        : email.recipientEmail.split('@')[0];

      // Send delivery email via SendGrid
      const emailResult = await sendDeliveryEmail(
        email.recipientEmail,
        recipientName,
        email.subject,
        email.message,
        email.deliveryLink
      );

      if (!emailResult.success) {
        console.error(`Failed to send delivery email to ${email.recipientEmail}:`, emailResult.error);
        // Don't fail the request if email fails - delivery email record is still created
      } else {
        console.log('Delivery email sent successfully:', {
          to: email.recipientEmail,
          subject: email.subject,
          link: email.deliveryLink
        });
      }

      // Log activity: Delivery link sent
      try {
        await storage.createActivity({
          partnerId: job.partnerId,
          jobId: job.jobId,
          userId: req.user?.uid || 'system',
          userEmail: req.user?.email || 'system',
          userName: req.user?.email || 'System',
          action: "notification",
          category: "job",
          title: "Delivery Link Sent",
          description: `Delivery link sent to ${email.recipientEmail}`,
          metadata: JSON.stringify({
            recipientEmail: email.recipientEmail,
            subject: email.subject,
            hasDeliveryLink: !!email.deliveryLink
          }),
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });
      } catch (activityError) {
        console.error("[ACTIVITY] Failed to log delivery email:", activityError);
      }

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
        return res.status(404).json({ error: "Jobnot found" });
      }

      // Verify order belongs to this job
      const order = await storage.getOrder(orderId);
      if (!order || (order.jobId !== job.id && order.jobId !== job.jobId)) { // Allow match by UUID or NanoID
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
        recipientId: job.partnerId, // Partner is the recipient of this notification
        type: 'revision_request',
        title: 'Revision Requested',
        body: `${customerName} has requested revisions for ${job.address} (Order ${order.orderNumber})`,
        orderId: orderId,
        jobId: job.id,
      }));

      await firestoreStorage.createNotifications(notifications);

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
      if (!order || (order.jobId !== job.id && order.jobId !== job.jobId)) { // Allow match by UUID or NanoID
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
      const bucketName = (process.env.FIREBASE_STORAGE_BUCKET || '').replace(/['"]/g, '').trim();
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
        partnerId: req.user.partnerId, // Force partnerId from auth context
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

      // Build filters with mandatory partnerId for security
      const searchFilters: any = {
        partnerId: req.user.partnerId, // CRITICAL: Always filter by user's partnerId
        ...filters
      };

      // Convert date strings to Date objects
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

      const limit = Math.min(Number(req.query.limit) || 50, 100); // Default to 50, max 100
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

      // Build time range filters if provided
      let timeRange: { start: Date; end: Date } | undefined;
      if (req.query.startDate && typeof req.query.startDate === 'string' &&
          req.query.endDate && typeof req.query.endDate === 'string') {
        timeRange = {
          start: new Date(req.query.startDate as string),
          end: new Date(req.query.endDate as string)
        };
      }

      const analytics = await storage.getActivityCountByType(req.user.partnerId, timeRange);
      res.json(analytics);
    } catch (error: any) {
      console.error("Error fetching activity analytics:", error);
      res.status(500).json({ 
        error: "Failed to fetch activity analytics", 
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

      // Get job review if exists
      console.log('[DELIVERY ENDPOINT] Fetching review for job.id:', job.id);
      const jobReview = await storage.getJobReview(job.id);
      console.log('[DELIVERY ENDPOINT] Review found:', !!jobReview, jobReview ? { id: jobReview.id, rating: jobReview.rating } : null);

      res.json({
        ...job,
        customer,
        activities,
        jobReview
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
          total: activities.length // NOTE: This total is for the current page, not total available
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
      let timeRange: { start: Date; end: Date } | undefined;
      if (req.query.startDate && typeof req.query.startDate === 'string' &&
          req.query.endDate && typeof req.query.endDate === 'string') {
        timeRange = {
          start: new Date(req.query.startDate as string),
          end: new Date(req.query.endDate as string)
        };
      }

      const analytics = await storage.getActivityCountByType(req.user.partnerId, timeRange);
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
        userName: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email,
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

      // Fetch user document to get profile image and user details
      const userDoc = await getUserDocument(req.user.uid);
      const profileImage = userDoc?.profileImage || "";

      // For photographers, use their own user document data instead of partner settings
      if (req.user.role === 'photographer') {
        const personalProfile = {
          firstName: userDoc?.firstName || "",
          lastName: userDoc?.lastName || "",
          email: userDoc?.email || req.user.email || "",
          phone: (userDoc as any)?.phone || "",
          bio: (userDoc as any)?.bio || "",
          profileImage: profileImage
        };

        // Get business hours from partner settings (shared across team)
        const settings = await storage.getPartnerSettings(req.user.partnerId);
        const businessHours = settings?.businessHours ? JSON.parse(settings.businessHours) : null;

        const editorDisplayNames = settings?.editorDisplayNames ? JSON.parse(settings.editorDisplayNames) : {};

        return res.json({
          businessProfile: null, // Photographers don't need business profile
          personalProfile,
          businessHours,
          defaultMaxRevisionRounds: settings?.defaultMaxRevisionRounds ?? 2,
          editorDisplayNames
        });
      }

      // For partners/admins, use partner settings as before
      const settings = await storage.getPartnerSettings(req.user.partnerId);

      if (!settings) {
        return res.json({
          businessProfile: null,
          personalProfile: { profileImage },
          businessHours: null,
          defaultMaxRevisionRounds: 2,
          editorDisplayNames: {}
        });
      }

      const personalProfile = settings.personalProfile ? JSON.parse(settings.personalProfile) : {};
      personalProfile.profileImage = profileImage; // Add profile image from user document

      const editorDisplayNames = settings.editorDisplayNames ? JSON.parse(settings.editorDisplayNames) : {};

      res.json({
        businessProfile: settings.businessProfile ? JSON.parse(settings.businessProfile) : null,
        personalProfile,
        businessHours: settings.businessHours ? JSON.parse(settings.businessHours) : null,
        defaultMaxRevisionRounds: settings.defaultMaxRevisionRounds ?? 2,
        editorDisplayNames
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

      const { businessProfile, personalProfile, businessHours, defaultMaxRevisionRounds, editorDisplayNames } = req.body;

      // For photographers, save personal profile to their user document instead of partner settings
      if (req.user.role === 'photographer') {
        if (personalProfile) {
          const userRef = adminDb.collection('users').doc(req.user.uid);
          const updateData: any = {};
          
          if (personalProfile.firstName !== undefined) {
            updateData.firstName = personalProfile.firstName;
          }
          if (personalProfile.lastName !== undefined) {
            updateData.lastName = personalProfile.lastName;
          }
          if (personalProfile.email !== undefined) {
            updateData.email = personalProfile.email;
          }
          if (personalProfile.profileImage !== undefined) {
            updateData.profileImage = personalProfile.profileImage;
          }
          // Store phone and bio as additional fields in user document
          if (personalProfile.phone !== undefined) {
            updateData.phone = personalProfile.phone;
          }
          if (personalProfile.bio !== undefined) {
            updateData.bio = personalProfile.bio;
          }

          await userRef.update(updateData);
        }

        // Photographers can still update business hours (shared across team)
        if (businessHours !== undefined || defaultMaxRevisionRounds !== undefined) {
          const savedSettings = await storage.savePartnerSettings(req.user.partnerId, {
            partnerId: req.user.partnerId,
            businessProfile: null, // Photographers don't update business profile
            personalProfile: null, // Photographers don't update partner personal profile
            businessHours: businessHours ? JSON.stringify(businessHours) : null,
            defaultMaxRevisionRounds: defaultMaxRevisionRounds !== undefined ? defaultMaxRevisionRounds : 2
          });

          return res.json({ 
            success: true, 
            message: "Settings saved successfully",
            settings: savedSettings
          });
        }

        return res.json({ 
          success: true, 
          message: "Settings saved successfully"
        });
      }

      // For partners/admins, save settings to partner settings as before
      const savedSettings = await storage.savePartnerSettings(req.user.partnerId, {
        partnerId: req.user.partnerId,
        businessProfile: businessProfile ? JSON.stringify(businessProfile) : null,
        personalProfile: personalProfile ? JSON.stringify(personalProfile) : null,
        businessHours: businessHours ? JSON.stringify(businessHours) : null,
        defaultMaxRevisionRounds: defaultMaxRevisionRounds !== undefined ? defaultMaxRevisionRounds : 2,
        editorDisplayNames: editorDisplayNames ? JSON.stringify(editorDisplayNames) : null
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
      const { uid, partnerId, role } = req.user!;

      // Get conversations where user is either partner or editor
      // For photographers, filter by participantId
      const conversations = await firestoreStorage.getUserConversations(uid, partnerId!, role);

      res.json(conversations);
    } catch (error: any) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  // Get a specific conversation with its messages
  app.get("/api/conversations/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const { uid, partnerId } = req.user!;

      // Get conversation
      const conversation = await firestoreStorage.getConversation(id);

      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      // Verify user has access to this conversation
      if (conversation.partnerId !== partnerId && conversation.editorId !== uid) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Get messages for this conversation
      const messages = await firestoreStorage.getConversationMessages(id);

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
      const { uid, partnerId, email, role } = req.user!;
      const { editorId, editorEmail, editorName, orderId } = req.body;

      if (!editorId || !editorEmail) {
        return res.status(400).json({ error: "Editor ID and email are required" });
      }

      // For photographers, check if conversation exists with participantId
      // For partners/admins, check by partnerId
      let conversation;
      if (role === 'photographer') {
        // Check for existing conversation with this photographer as participant
        conversation = await firestoreStorage.getConversationByParticipants(partnerId!, editorId, orderId, uid);
      } else {
        conversation = await firestoreStorage.getConversationByParticipants(partnerId!, editorId, orderId);
      }

      if (!conversation) {
        // Get partner name from user document
        const userDoc = await getUserDocument(uid);
        const partnerName = userDoc ? `${userDoc.firstName || ''} ${userDoc.lastName || ''}`.trim() || email : email;

        // Create new conversation
        const conversationData: any = {
          partnerId: partnerId!,
          editorId,
          orderId: orderId || null, // Link to order if provided
          partnerName,
          editorName,
          partnerEmail: email,
          editorEmail,
        };

        // Add participantId for photographers
        if (role === 'photographer') {
          conversationData.participantId = uid;
        }

        conversation = await firestoreStorage.createConversation(conversationData);
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
      const conversation = await firestoreStorage.getConversation(id);

      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      // Verify user has access to this conversation
      if (conversation.partnerId !== partnerId && conversation.editorId !== uid) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Determine sender role by checking if sender is the editor
      // Don't use partnerId comparison because editors have partnerId too (assigned partner)
      const isPartner = conversation.editorId !== uid;
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

      const message = await firestoreStorage.createMessage(messageData);

      // Update conversation's last message and unread count
      await firestoreStorage.updateConversationLastMessage(id, content.trim(), isPartner);

      // Create notification for the recipient (the other party in the conversation)
    try {
      console.log(`[MESSAGE NOTIFICATION] Starting notification creation for message in conversation ${id}`);
      console.log(`[MESSAGE NOTIFICATION] Sender: uid=${uid}, partnerId=${partnerId}, email=${email}, role=${senderRole}`);
      
      const conversation = await firestoreStorage.getConversation(id);
      if (!conversation) {
        console.error('Conversation not found for notification creation');
        return;
      }

      console.log(`[MESSAGE NOTIFICATION] Conversation: partnerId=${conversation.partnerId}, editorId=${conversation.editorId}`);

      // Determine sender role from conversation participants, not from the senderRole field
      // which may be unreliable. Check if the senderId matches the editorId in the conversation.
      const isEditorSender = uid === conversation.editorId;
      const isPartnerSender = !isEditorSender;
      const recipientName = isPartnerSender ? conversation.editorName : conversation.partnerName;
      
      console.log(`[MESSAGE NOTIFICATION] Role determination: senderId=${uid}, editorId=${conversation.editorId}, isEditorSender=${isEditorSender}, isPartnerSender=${isPartnerSender}`);
      
      // Get the recipient's Firebase UID
      // For partner recipients, we need to look up their Firebase UID from partnerId
      // For editor recipients, we already have their Firebase UID in conversation.editorId
      let recipientFirebaseUid: string;
      
      console.log(`[MESSAGE NOTIFICATION] Determining recipient - isPartnerSender: ${isPartnerSender}`);
      
      if (isPartnerSender) {
        // Partner is sending to editor - use editor's Firebase UID directly
        recipientFirebaseUid = conversation.editorId;
        console.log(`[MESSAGE NOTIFICATION] Partner→Editor: Using conversation.editorId = ${recipientFirebaseUid}`);
      } else {
        // Editor is sending to partner - look up partner's Firebase UID from partnerId
        console.log(`[MESSAGE NOTIFICATION] Editor→Partner: Looking up partner user for partnerId = ${conversation.partnerId}`);
        const partnerUser = await getUserByPartnerId(conversation.partnerId);
        if (!partnerUser) {
          console.error(`[MESSAGE NOTIFICATION] ✗ Could not find partner user for partnerId: ${conversation.partnerId}`);
          return;
        }
        console.log(`[MESSAGE NOTIFICATION] Found partner user: uid=${partnerUser.uid}, email=${partnerUser.email}`);
        recipientFirebaseUid = partnerUser.uid;
      }

      console.log(`[MESSAGE NOTIFICATION] Final recipient: Firebase UID=${recipientFirebaseUid}, Name=${recipientName}`);

      await firestoreStorage.createNotification({
        partnerId: conversation.partnerId,
        recipientId: recipientFirebaseUid, // Use Firebase UID for notifications
        type: 'new_message',
        title: 'New Message',
        body: `You have a new message from ${senderName}`,
        read: false
      });

      console.log(`[MESSAGE NOTIFICATION] ✓ Created notification for ${recipientName} (Firebase UID: ${recipientFirebaseUid}) about new message from ${email}`);
    } catch (notificationError) {
      console.error('[MESSAGE NOTIFICATION] ✗ Failed to create message notification:', notificationError);
      // Don't fail the message creation if notification fails
    }

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
      const conversation = await firestoreStorage.getConversation(id);

      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      // Verify user has access to this conversation
      if (conversation.partnerId !== partnerId && conversation.editorId !== uid) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Determine if user is partner or editor by checking UID
      const isEditor = conversation.editorId === uid;
      const isPartner = !isEditor;

      // Mark messages as read
      await firestoreStorage.markConversationAsRead(id, isPartner);

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error marking messages as read:", error);
      res.status(500).json({ error: "Failed to mark messages as read" });
    }
  });

  // Migration endpoint to convert old public URLs to signed URLs
  app.post("/api/admin/migrate-to-signed-urls", async (req, res) => {
    try {
      const bucketName = (process.env.FIREBASE_STORAGE_BUCKET || '').replace(/['"]/g, '').trim();
      if (!bucketName) {
        return res.status(500).json({ error: 'FIREBASE_STORAGE_BUCKET not configured' });
      }

      const bucket = getStorage().bucket(bucketName);
      
      // Get all editor uploads
      const allUploads = await firestoreStorage.getAllEditorUploads();
      
      let updatedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      const updates = [];

      for (const upload of allUploads) {
        try {
          // Check if downloadUrl is a public storage URL that needs conversion
          const isPublicUrl = upload.downloadUrl && 
            upload.downloadUrl.includes('storage.googleapis.com') &&
            !upload.downloadUrl.includes('X-Goog-Algorithm'); // Signed URLs contain this param
          
          if (isPublicUrl) {
            // Extract file path from public URL
            let filePath = upload.firebaseUrl || upload.downloadUrl;
            
            // Remove the bucket prefix if present
            const bucketPrefix = `https://storage.googleapis.com/${bucketName}/`;
            if (filePath.startsWith(bucketPrefix)) {
              filePath = filePath.substring(bucketPrefix.length);
            }
            
            // Get the file reference
            const file = bucket.file(filePath);
            
            // Check if file exists in storage
            const [exists] = await file.exists();
            
            if (!exists) {
              console.log(`[MIGRATION] File not found in storage: ${filePath}`);
              errorCount++;
              continue;
            }
            
            // Generate signed URL (30 days for completed files)
            const [signedUrl] = await file.getSignedUrl({
              action: 'read',
              expires: Date.now() + 30 * 24 * 60 * 60 * 1000,
            });
            
            updates.push({
              id: upload.id,
              fileName: upload.fileName,
              oldUrl: upload.downloadUrl.substring(0, 100) + '...',
              newUrl: 'signed-url-generated'
            });
            
            // Update with signed URL
            await firestoreStorage.updateEditorUpload(upload.id, {
              downloadUrl: signedUrl,
              firebaseUrl: filePath // Store just the path for future regeneration
            });
            
            updatedCount++;
          } else {
            skippedCount++;
          }
        } catch (fileError: any) {
          console.error(`[MIGRATION] Error processing file ${upload.id}:`, fileError.message);
          errorCount++;
        }
      }

      res.json({ 
        success: true, 
        updatedCount,
        skippedCount,
        errorCount,
        totalFiles: allUploads.length,
        sampleUpdates: updates.slice(0, 10)
      });
    } catch (error: any) {
      console.error("Error migrating to signed URLs:", error);
      res.status(500).json({ error: "Failed to migrate to signed URLs", details: error.message });
    }
  });

  // Backfill missing partnerId in jobs
  app.post("/api/maintenance/backfill-job-partnerids", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      // Only allow partners or admins to run this
      if (!req.user || (req.user.role !== 'partner' && req.user.role !== 'admin')) {
        return res.status(403).json({ error: "Only partners and admins can run maintenance tasks" });
      }

      console.log("[BACKFILL] Starting job partnerId backfill...");
      
      // Get all jobs
      const allJobsSnapshot = await adminDb.collection("jobs").get();
      let updatedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      const updates: any[] = [];

      for (const jobDoc of allJobsSnapshot.docs) {
        try {
          const job = jobDoc.data();
          
          // Skip if job already has partnerId
          if (job.partnerId) {
            skippedCount++;
            continue;
          }

          // Find the partnerId from related orders
          const ordersSnapshot = await adminDb.collection("orders")
            .where("jobId", "==", job.id)
            .limit(1)
            .get();

          if (!ordersSnapshot.empty) {
            const order = ordersSnapshot.docs[0].data();
            if (order.partnerId) {
              await adminDb.collection("jobs").doc(jobDoc.id).update({
                partnerId: order.partnerId
              });
              
              updates.push({
                jobId: job.jobId,
                oldPartnerId: null,
                newPartnerId: order.partnerId
              });
              
              updatedCount++;
              console.log(`[BACKFILL] Updated job ${job.jobId} with partnerId ${order.partnerId}`);
            } else {
              console.warn(`[BACKFILL] Order found for job ${job.jobId} but order has no partnerId`);
              errorCount++;
            }
          } else {
            console.warn(`[BACKFILL] No orders found for job ${job.jobId}, cannot determine partnerId`);
            errorCount++;
          }
        } catch (error: any) {
          console.error(`[BACKFILL] Error processing job ${jobDoc.id}:`, error.message);
          errorCount++;
        }
      }

      res.json({
        success: true,
        message: "Job partnerId backfill completed",
        updatedCount,
        skippedCount,
        errorCount,
        totalJobs: allJobsSnapshot.size,
        sampleUpdates: updates.slice(0, 10)
      });
    } catch (error: any) {
      console.error("[BACKFILL] Error in job partnerId backfill:", error);
      res.status(500).json({ 
        error: "Failed to backfill job partnerIds", 
        details: error.message 
      });
    }
  });

  // Cleanup endpoint for expired order files
  app.delete('/api/cleanup/expired-orders-files', async (req, res) => {
    try {
      console.log('[CLEANUP] Starting expired order files cleanup...');

      // Get all expired files
      const expiredFiles = await storage.getExpiredOrderFiles();

      if (expiredFiles.length === 0) {
        return res.json({
          success: true,
          message: "No expired order files to clean up",
          deletedCount: 0
        });
      }

      console.log(`[CLEANUP] Found ${expiredFiles.length} expired files to delete`);

      let deletedCount = 0;
      let errorCount = 0;
      const deletionResults: any[] = [];

      // Delete each expired file
      for (const file of expiredFiles) {
        try {
          await storage.deleteExpiredOrderFile(file.id, file.firebaseUrl);
          deletedCount++;
          deletionResults.push({
            fileId: file.id,
            fileName: file.fileName,
            firebaseUrl: file.firebaseUrl,
            expiresAt: file.expiresAt,
            status: 'deleted'
          });
          console.log(`[CLEANUP] Deleted expired file: ${file.fileName} (${file.id})`);
        } catch (error: any) {
          errorCount++;
          deletionResults.push({
            fileId: file.id,
            fileName: file.fileName,
            firebaseUrl: file.firebaseUrl,
            expiresAt: file.expiresAt,
            status: 'error',
            error: error.message
          });
          console.error(`[CLEANUP] Error deleting file ${file.id}:`, error.message);
        }
      }

      res.json({
        success: true,
        message: `Cleanup completed: ${deletedCount} deleted, ${errorCount} errors`,
        deletedCount,
        errorCount,
        totalExpired: expiredFiles.length,
        results: deletionResults
      });

      console.log(`[CLEANUP] Cleanup completed: ${deletedCount} deleted, ${errorCount} errors`);
    } catch (error: any) {
      console.error("[CLEANUP] Error in expired files cleanup:", error);
      res.status(500).json({
        error: "Failed to cleanup expired files",
        details: error.message
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
