import type { Express } from "express";
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
  insertEditorServiceSchema
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

  app.post("/api/jobs", async (req, res) => {
    try {
      // For now, bypass schema validation and handle dates manually
      const data = { ...req.body };
      if (data.appointmentDate && typeof data.appointmentDate === 'string') {
        data.appointmentDate = new Date(data.appointmentDate);
      }
      if (data.dueDate && typeof data.dueDate === 'string') {
        data.dueDate = new Date(data.dueDate);
      }
      
      const job = await storage.createJob(data);
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

  app.post("/api/orders", async (req, res) => {
    try {
      const validatedData = insertOrderSchema.parse(req.body);
      const order = await storage.createOrder(validatedData);
      res.status(201).json(order);
    } catch (error) {
      res.status(400).json({ error: "Invalid order data" });
    }
  });

  app.patch("/api/orders/:id", async (req, res) => {
    try {
      const order = await storage.updateOrder(req.params.id, req.body);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      res.json(order);
    } catch (error) {
      res.status(500).json({ error: "Failed to update order" });
    }
  });

  // Submit order with services and files
  app.post("/api/orders/submit", async (req, res) => {
    try {
      const { partnerId, jobId, customerId, services, createdBy } = req.body;
      
      if (!partnerId || !services || !Array.isArray(services) || services.length === 0) {
        return res.status(400).json({ error: "Missing required fields: partnerId, services" });
      }

      // Generate sequential order number
      const orderNumber = await storage.generateOrderNumber();
      
      // Calculate 14 days from now for file expiry
      const filesExpiryDate = new Date();
      filesExpiryDate.setDate(filesExpiryDate.getDate() + 14);

      // Create the main order
      const order = await storage.createOrder({
        partnerId,
        orderNumber,
        jobId: jobId || null,
        customerId: customerId || null,
        status: "pending",
        createdBy: createdBy || null,
        estimatedTotal: "0",
        filesExpiryDate
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

  // ===== EDITOR SERVICE MANAGEMENT ENDPOINTS =====

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

  // Configure multer for file uploads
  const upload = multer({
    dest: '/tmp/uploads',
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB limit
    },
  });

  // Server-side Firebase upload endpoint
  app.post("/api/upload-firebase", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const orderNumber = req.body.orderNumber || 'temp-order';
      const timestamp = Date.now();
      const sanitizedFileName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      const sanitizedOrderNumber = orderNumber.replace(/[^a-zA-Z0-9-]/g, '');
      const filePath = `orders/${sanitizedOrderNumber}/${timestamp}_${sanitizedFileName}`;

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

  const httpServer = createServer(app);
  return httpServer;
}
