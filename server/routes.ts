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
  getPartnerOwnerUid,
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
import {
  getAuthUrl as getGoogleCalendarAuthUrl,
  exchangeCodeForTokens,
  getConnection as getGoogleCalendarConnection,
  getConnectionByPartnerId as getGoogleCalendarConnectionByPartnerId,
  getValidConnection,
  deleteConnection as deleteGoogleCalendarConnection,
  updateConnectionSettings as updateGoogleCalendarSettings,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  listBusyBlocks,
} from "./google-calendar";
import {
  getAuthUrl as getXeroAuthUrl,
  exchangeCodeForTokens as xeroExchangeCodeForTokens,
  getConnection as getXeroConnection,
  deleteConnection as deleteXeroConnection,
  listContacts as xeroListContacts,
  listAccounts as xeroListAccounts,
  listTaxRates as xeroListTaxRates,
  createInvoice as xeroCreateInvoice,
  getInvoicePdf as xeroGetInvoicePdf,
  getProfitAndLoss as xeroGetProfitAndLoss,
  getProfitAndLossMonthly as xeroGetProfitAndLossMonthly,
  getExecutiveSummary as xeroGetExecutiveSummary,
  getInvoiceCount as xeroGetInvoiceCount,
} from "./xero";
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
    actualPartnerId?: string; // Original partnerId for master users viewing another business
    role: string;
    email: string;
    firstName?: string;
    lastName?: string;
    studioName?: string;
    partnerName?: string;
    isMasterViewing?: boolean; // True when master is viewing another business
  };
}

// Helper: determine if a master user should be treated as read-only
// Master is read-only only when impersonating a different partner's account
const isMasterReadOnly = (user?: AuthenticatedRequest["user"]): boolean => {
  if (!user) return false;
  if (user.role !== "master") return false;
  if (!user.isMasterViewing) return false;
  // If we don't know the original partner, be safe and treat as read-only
  if (!user.actualPartnerId) return true;
  // Read-only when viewing a different partner than their own
  return user.partnerId !== user.actualPartnerId;
};

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
      studioName: (userDoc as any).studioName || userDoc.businessName,
      partnerName: (userDoc as any).partnerName || `${userDoc.firstName || ''} ${userDoc.lastName || ''}`.trim() || userDoc.email
    };

    // Master role can view any business's data (read-only)
    // Check for viewingPartnerId query parameter
    if (userDoc.role === 'master') {
      const viewingPartnerId = req.query.viewingPartnerId as string;
      if (viewingPartnerId) {
        // Store original partnerId and set viewing partnerId
        req.user.actualPartnerId = userDoc.partnerId;
        req.user.partnerId = viewingPartnerId;
        req.user.isMasterViewing = true;
        console.log(`[Master View] User ${userDoc.email} viewing business: ${viewingPartnerId}`);
      }
    }

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
      studioName: (userDoc as any).studioName || userDoc.businessName,
      partnerName: (userDoc as any).partnerName || `${userDoc.firstName || ''} ${userDoc.lastName || ''}`.trim() || userDoc.email
    };

    // Master role can view any business's data (read-only)
    if (userDoc.role === 'master') {
      const viewingPartnerId = req.query.viewingPartnerId as string;
      if (viewingPartnerId) {
        req.user.actualPartnerId = userDoc.partnerId;
        req.user.partnerId = viewingPartnerId;
        req.user.isMasterViewing = true;
      }
    }

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

// Helper function to regenerate expired cover photo URLs
async function regenerateCoverPhotoUrls(job: any, bucket: any): Promise<{ propertyImage?: string; propertyImageThumbnail?: string }> {
  console.log(`[regenerateCoverPhotoUrls] Called for job ${job?.id || 'unknown'}, has propertyImage: ${!!job?.propertyImage}, has propertyImageThumbnail: ${!!job?.propertyImageThumbnail}, has bucket: ${!!bucket}`);
  const result: { propertyImage?: string; propertyImageThumbnail?: string } = {};
  
  if (!bucket) {
    console.log(`[regenerateCoverPhotoUrls] No bucket available for job ${job?.id || 'unknown'}`);
    return result;
  }
  
  // Helper function to extract storage path from Firebase URL
  const extractStoragePath = (url: string): string | null => {
    try {
      if (!url || typeof url !== 'string') {
        console.log(`[regenerateCoverPhotoUrls] Invalid URL: ${url}`);
        return null;
      }
      
      // Handle signed URLs: https://storage.googleapis.com/.../o/path?X-Goog-Algorithm=...
      // Handle public URLs: https://storage.googleapis.com/.../o/path
      let match = url.match(/\/o\/(.+?)(\?|$)/);
      if (match && match[1]) {
        const path = decodeURIComponent(match[1]);
        console.log(`[regenerateCoverPhotoUrls] Extracted path from storage.googleapis.com URL: ${path}`);
        return path;
      }
      
      // Also handle firebasestorage.app URLs
      match = url.match(/firebasestorage\.app\/o\/(.+?)(\?|$)/);
      if (match && match[1]) {
        const path = decodeURIComponent(match[1]);
        console.log(`[regenerateCoverPhotoUrls] Extracted path from firebasestorage.app URL: ${path}`);
        return path;
      }
      
      // Try alternative pattern for URLs that might have different formats
      match = url.match(/\/o\/([^?]+)/);
      if (match && match[1]) {
        const path = decodeURIComponent(match[1]);
        console.log(`[regenerateCoverPhotoUrls] Extracted path using alternative pattern: ${path}`);
        return path;
      }
      
      console.log(`[regenerateCoverPhotoUrls] Could not extract path from URL: ${url.substring(0, 100)}...`);
      return null;
    } catch (error) {
      console.error(`[regenerateCoverPhotoUrls] Error extracting path from URL: ${error}`);
      return null;
    }
  };
  
  // Regenerate propertyImage if it exists
  if (job.propertyImage) {
    try {
      console.log(`[regenerateCoverPhotoUrls] Processing propertyImage for job ${job.id}: ${job.propertyImage.substring(0, 100)}...`);
      const storagePath = extractStoragePath(job.propertyImage);
      if (storagePath) {
        console.log(`[regenerateCoverPhotoUrls] Attempting to regenerate URL for path: ${storagePath}`);
        const gcsFile = bucket.file(storagePath);
        const [exists] = await gcsFile.exists();
        
        if (exists) {
          console.log(`[regenerateCoverPhotoUrls] File exists, generating new signed URL`);
          // Generate new signed URL (30 days expiration)
          const [signedUrl] = await gcsFile.getSignedUrl({
            action: 'read',
            expires: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
          });
          
          result.propertyImage = signedUrl;
          console.log(`[regenerateCoverPhotoUrls] Generated new URL for propertyImage: ${signedUrl.substring(0, 100)}...`);
          
          // Update the database with the new URL
          try {
            await storage.updateJob(job.id, { propertyImage: signedUrl });
            console.log(`[regenerateCoverPhotoUrls] Successfully cached regenerated propertyImage URL for job ${job.id}`);
          } catch (updateError) {
            console.error(`[regenerateCoverPhotoUrls] Failed to cache regenerated propertyImage URL for job ${job.id}:`, updateError);
          }
        } else {
          console.warn(`[regenerateCoverPhotoUrls] File does not exist in storage: ${storagePath}`);
        }
      } else {
        console.warn(`[regenerateCoverPhotoUrls] Could not extract storage path from propertyImage URL for job ${job.id}`);
        // Try to look up the file in editor_uploads by matching the URL
        try {
          console.log(`[regenerateCoverPhotoUrls] Attempting to find file in editor_uploads for job ${job.id}`);
          const uploads = await storage.getEditorUploads(job.id);
          // Try to find a file with a matching downloadUrl (might be expired but we can use firebaseUrl)
          const matchingFile = uploads.find((upload: any) => {
            // Check if the downloadUrl matches (even if expired, the base URL should match)
            if (upload.downloadUrl && job.propertyImage) {
              // Extract base URL without query params for comparison
              const uploadBase = upload.downloadUrl.split('?')[0];
              const jobImageBase = job.propertyImage.split('?')[0];
              return uploadBase === jobImageBase;
            }
            return false;
          });
          
          if (matchingFile && matchingFile.firebaseUrl) {
            console.log(`[regenerateCoverPhotoUrls] Found matching file in editor_uploads with firebaseUrl: ${matchingFile.firebaseUrl}`);
            const gcsFile = bucket.file(matchingFile.firebaseUrl);
            const [exists] = await gcsFile.exists();
            
            if (exists) {
              const [signedUrl] = await gcsFile.getSignedUrl({
                action: 'read',
                expires: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
              });
              
              result.propertyImage = signedUrl;
              console.log(`[regenerateCoverPhotoUrls] Generated new URL from editor_uploads firebaseUrl: ${signedUrl.substring(0, 100)}...`);
              
              // Update the database with the new URL
              try {
                await storage.updateJob(job.id, { propertyImage: signedUrl });
                console.log(`[regenerateCoverPhotoUrls] Successfully cached regenerated propertyImage URL for job ${job.id}`);
              } catch (updateError) {
                console.error(`[regenerateCoverPhotoUrls] Failed to cache regenerated propertyImage URL for job ${job.id}:`, updateError);
              }
            } else {
              console.warn(`[regenerateCoverPhotoUrls] File from editor_uploads does not exist in storage: ${matchingFile.firebaseUrl}`);
            }
          } else {
            console.warn(`[regenerateCoverPhotoUrls] No matching file found in editor_uploads for job ${job.id}`);
          }
        } catch (lookupError) {
          console.error(`[regenerateCoverPhotoUrls] Error looking up file in editor_uploads for job ${job.id}:`, lookupError);
        }
      }
    } catch (urlError) {
      console.error(`[regenerateCoverPhotoUrls] Error regenerating propertyImage URL for job ${job.id}:`, urlError);
    }
  } else {
    console.log(`[regenerateCoverPhotoUrls] No propertyImage for job ${job.id}`);
  }
  
  // Regenerate propertyImageThumbnail if it exists and is different from propertyImage
  if (job.propertyImageThumbnail && job.propertyImageThumbnail !== job.propertyImage) {
    try {
      console.log(`[regenerateCoverPhotoUrls] Processing propertyImageThumbnail for job ${job.id}: ${job.propertyImageThumbnail.substring(0, 100)}...`);
      const storagePath = extractStoragePath(job.propertyImageThumbnail);
      if (storagePath) {
        console.log(`[regenerateCoverPhotoUrls] Attempting to regenerate URL for thumbnail path: ${storagePath}`);
        const gcsFile = bucket.file(storagePath);
        const [exists] = await gcsFile.exists();
        
        if (exists) {
          console.log(`[regenerateCoverPhotoUrls] Thumbnail file exists, generating new signed URL`);
          // Generate new signed URL (30 days expiration)
          const [signedUrl] = await gcsFile.getSignedUrl({
            action: 'read',
            expires: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
          });
          
          result.propertyImageThumbnail = signedUrl;
          console.log(`[regenerateCoverPhotoUrls] Generated new URL for propertyImageThumbnail: ${signedUrl.substring(0, 100)}...`);
          
          // Update the database with the new URL
          try {
            await storage.updateJob(job.id, { propertyImageThumbnail: signedUrl });
            console.log(`[regenerateCoverPhotoUrls] Successfully cached regenerated propertyImageThumbnail URL for job ${job.id}`);
          } catch (updateError) {
            console.error(`[regenerateCoverPhotoUrls] Failed to cache regenerated propertyImageThumbnail URL for job ${job.id}:`, updateError);
          }
        } else {
          console.warn(`[regenerateCoverPhotoUrls] Thumbnail file does not exist in storage: ${storagePath}`);
        }
      } else {
        console.warn(`[regenerateCoverPhotoUrls] Could not extract storage path from propertyImageThumbnail URL for job ${job.id}`);
        // Try to look up the file in editor_uploads by matching the URL
        try {
          console.log(`[regenerateCoverPhotoUrls] Attempting to find thumbnail file in editor_uploads for job ${job.id}`);
          const uploads = await storage.getEditorUploads(job.id);
          // Try to find a file with a matching downloadUrl (might be expired but we can use firebaseUrl)
          const matchingFile = uploads.find((upload: any) => {
            // Check if the downloadUrl matches (even if expired, the base URL should match)
            if (upload.downloadUrl && job.propertyImageThumbnail) {
              // Extract base URL without query params for comparison
              const uploadBase = upload.downloadUrl.split('?')[0];
              const jobImageBase = job.propertyImageThumbnail.split('?')[0];
              return uploadBase === jobImageBase;
            }
            return false;
          });
          
          if (matchingFile && matchingFile.firebaseUrl) {
            console.log(`[regenerateCoverPhotoUrls] Found matching thumbnail file in editor_uploads with firebaseUrl: ${matchingFile.firebaseUrl}`);
            const gcsFile = bucket.file(matchingFile.firebaseUrl);
            const [exists] = await gcsFile.exists();
            
            if (exists) {
              const [signedUrl] = await gcsFile.getSignedUrl({
                action: 'read',
                expires: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
              });
              
              result.propertyImageThumbnail = signedUrl;
              console.log(`[regenerateCoverPhotoUrls] Generated new thumbnail URL from editor_uploads firebaseUrl: ${signedUrl.substring(0, 100)}...`);
              
              // Update the database with the new URL
              try {
                await storage.updateJob(job.id, { propertyImageThumbnail: signedUrl });
                console.log(`[regenerateCoverPhotoUrls] Successfully cached regenerated propertyImageThumbnail URL for job ${job.id}`);
              } catch (updateError) {
                console.error(`[regenerateCoverPhotoUrls] Failed to cache regenerated propertyImageThumbnail URL for job ${job.id}:`, updateError);
              }
            } else {
              console.warn(`[regenerateCoverPhotoUrls] Thumbnail file from editor_uploads does not exist in storage: ${matchingFile.firebaseUrl}`);
            }
          } else {
            console.warn(`[regenerateCoverPhotoUrls] No matching thumbnail file found in editor_uploads for job ${job.id}`);
          }
        } catch (lookupError) {
          console.error(`[regenerateCoverPhotoUrls] Error looking up thumbnail file in editor_uploads for job ${job.id}:`, lookupError);
        }
      }
    } catch (urlError) {
      console.error(`[regenerateCoverPhotoUrls] Error regenerating propertyImageThumbnail URL for job ${job.id}:`, urlError);
    }
  } else if (job.propertyImageThumbnail === job.propertyImage) {
    // If thumbnail is same as main image, use the regenerated main image URL
    result.propertyImageThumbnail = result.propertyImage;
  }
  
  return result;
}

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

  app.patch("/api/customers/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      // First verify the customer exists and belongs to this tenant
      const existingCustomer = await storage.getCustomer(req.params.id);
      if (!existingCustomer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      if (existingCustomer.partnerId !== req.user?.partnerId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const customer = await storage.updateCustomer(req.params.id, req.body);
      res.json(customer);
    } catch (error) {
      res.status(500).json({ error: "Failed to update customer" });
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

  // Search endpoint - searches across jobs, customers, products, and orders
  app.get("/api/search", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const query = (req.query.q as string) || "";
      const partnerId = req.user?.partnerId;

      if (!query || query.trim().length === 0) {
        return res.json({
          jobs: [],
          customers: [],
          products: [],
          orders: []
        });
      }

      const searchTerm = query.toLowerCase().trim();

      // Fetch all data for the partner
      const [jobs, customers, products, orders] = await Promise.all([
        storage.getJobs(partnerId || ""),
        storage.getCustomers(partnerId || ""),
        storage.getProducts(partnerId || ""),
        storage.getOrders(partnerId || "")
      ]);

      // Search jobs by address, jobId, jobName, or customer name
      const jobResults = jobs.filter((job: any) => {
        const addressMatch = job.address?.toLowerCase().includes(searchTerm);
        const jobIdMatch = job.jobId?.toLowerCase().includes(searchTerm);
        const jobNameMatch = job.jobName?.toLowerCase().includes(searchTerm);
        const notesMatch = job.notes?.toLowerCase().includes(searchTerm);
        
        // Get customer name if customerId exists
        let customerNameMatch = false;
        if (job.customerId) {
          const customer = customers.find((c: any) => c.id === job.customerId);
          if (customer) {
            const fullName = `${customer.firstName || ""} ${customer.lastName || ""}`.toLowerCase();
            customerNameMatch = fullName.includes(searchTerm) || 
                               customer.email?.toLowerCase().includes(searchTerm) ||
                               customer.company?.toLowerCase().includes(searchTerm);
          }
        }
        
        return addressMatch || jobIdMatch || jobNameMatch || notesMatch || customerNameMatch;
      });

      // Search customers by name, email, company, or phone
      const customerResults = customers.filter((customer: any) => {
        const firstNameMatch = customer.firstName?.toLowerCase().includes(searchTerm);
        const lastNameMatch = customer.lastName?.toLowerCase().includes(searchTerm);
        const fullNameMatch = `${customer.firstName || ""} ${customer.lastName || ""}`.toLowerCase().includes(searchTerm);
        const emailMatch = customer.email?.toLowerCase().includes(searchTerm);
        const companyMatch = customer.company?.toLowerCase().includes(searchTerm);
        const phoneMatch = customer.phone?.toLowerCase().includes(searchTerm);
        const notesMatch = customer.notes?.toLowerCase().includes(searchTerm);
        return firstNameMatch || lastNameMatch || fullNameMatch || emailMatch || companyMatch || phoneMatch || notesMatch;
      });

      // Search products by title, description, or category
      const productResults = products.filter((product: any) => {
        const titleMatch = product.title?.toLowerCase().includes(searchTerm);
        const descriptionMatch = product.description?.toLowerCase().includes(searchTerm);
        const categoryMatch = product.category?.toLowerCase().includes(searchTerm);
        const typeMatch = product.type?.toLowerCase().includes(searchTerm);
        return titleMatch || descriptionMatch || categoryMatch || typeMatch;
      });

      // Search orders by orderNumber, job address, or customer name
      const orderResults = orders.filter((order: any) => {
        const orderNumberMatch = order.orderNumber?.toLowerCase().includes(searchTerm);
        
        // Get job address if jobId exists
        let jobAddressMatch = false;
        if (order.jobId) {
          const job = jobs.find((j: any) => j.id === order.jobId || j.jobId === order.jobId);
          if (job) {
            jobAddressMatch = job.address?.toLowerCase().includes(searchTerm);
          }
        }
        
        // Get customer name if customerId exists
        let customerNameMatch = false;
        if (order.customerId) {
          const customer = customers.find((c: any) => c.id === order.customerId);
          if (customer) {
            const fullName = `${customer.firstName || ""} ${customer.lastName || ""}`.toLowerCase();
            customerNameMatch = fullName.includes(searchTerm) || 
                               customer.email?.toLowerCase().includes(searchTerm);
          }
        }
        
        return orderNumberMatch || jobAddressMatch || customerNameMatch;
      }).map((order: any) => {
        // Enrich order with job address for display
        if (order.jobId) {
          const job = jobs.find((j: any) => j.id === order.jobId || j.jobId === order.jobId);
          return {
            ...order,
            jobAddress: job?.address || null
          };
        }
        return order;
      });

      res.json({
        jobs: jobResults.slice(0, 20), // Limit to 20 results per category
        customers: customerResults.slice(0, 20),
        products: productResults.slice(0, 20),
        orders: orderResults.slice(0, 20)
      });
    } catch (error: any) {
      console.error("Error performing search:", error);
      res.status(500).json({ error: "Failed to perform search", details: error.message });
    }
  });

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
    console.log(`[GET /api/jobs] ========== ENDPOINT CALLED ==========`);
    try {
      console.log(`[GET /api/jobs] Fetching jobs for partnerId: ${req.user?.partnerId}`);
      const jobs = await storage.getJobs(req.user?.partnerId);
      console.log(`[GET /api/jobs] Found ${jobs.length} jobs`);
      
      // Check how many jobs have cover images
      const jobsWithImages = jobs.filter((j: any) => j.propertyImage || j.propertyImageThumbnail);
      console.log(`[GET /api/jobs] Jobs with cover images: ${jobsWithImages.length}`);
      if (jobsWithImages.length > 0) {
        console.log(`[GET /api/jobs] Sample job with image:`, {
          id: jobsWithImages[0].id,
          propertyImage: jobsWithImages[0].propertyImage?.substring(0, 100),
          propertyImageThumbnail: jobsWithImages[0].propertyImageThumbnail?.substring(0, 100)
        });
      }
      
      // Get Firebase Storage bucket for regenerating expired cover photo URLs
      const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.replace(/['"]/g, '').trim();
      console.log(`[GET /api/jobs] Bucket name: ${bucketName || 'NOT SET'}`);
      const bucket = bucketName ? getStorage().bucket(bucketName) : null;
      console.log(`[GET /api/jobs] Bucket initialized: ${!!bucket}`);
      
      // Regenerate expired cover photo URLs for all jobs
      console.log(`[GET /api/jobs] Starting URL regeneration for ${jobs.length} jobs...`);
      const jobsWithRegeneratedUrls = await Promise.all(
        jobs.map(async (job: any) => {
          const regeneratedUrls = await regenerateCoverPhotoUrls(job, bucket);
          return {
            ...job,
            propertyImage: regeneratedUrls.propertyImage || job.propertyImage,
            propertyImageThumbnail: regeneratedUrls.propertyImageThumbnail || job.propertyImageThumbnail
          };
        })
      );
      
      console.log(`[GET /api/jobs] Completed URL regeneration, returning ${jobsWithRegeneratedUrls.length} jobs`);
      res.json(jobsWithRegeneratedUrls);
    } catch (error) {
      console.error("Error fetching jobs:", error);
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

      // Remove appointmentDate from job data - will be stored in appointments table
      const { appointmentDate, ...jobDataWithoutAppointment } = data;

      // Extract products from request body if provided (before createJob so we can build billingItems)
      const products = (req.body as any).products || (req.body as any).selectedProducts;

      // Build billing items from selected products so they appear in the billing section
      if (products && Array.isArray(products) && products.length > 0) {
        try {
          const allProducts = await storage.getProducts(req.user.partnerId);
          const billingItems: any[] = [];

          for (const selected of products) {
            const product = allProducts.find((p: any) => p.id === selected.id);
            if (!product) continue;

            let name = selected.title || selected.name || product.title;
            let unitPrice = 0;
            const taxRate = product.taxRate ? parseFloat(product.taxRate.toString()) : 10;

            if (selected.variationName && product.variations) {
              const variations = typeof product.variations === "string"
                ? JSON.parse(product.variations)
                : product.variations;
              if (Array.isArray(variations)) {
                const variation = variations.find((v: any) => v.name === selected.variationName);
                if (variation) {
                  name = `${product.title} - ${variation.name}`;
                  unitPrice = variation.noCharge ? 0 : parseFloat((variation.price ?? 0).toString());
                }
              }
            }
            if (unitPrice === 0 && !selected.variationName) {
              unitPrice = parseFloat((product.price || "0").toString());
            }

            const quantity = selected.quantity || 1;
            const amount = unitPrice * quantity;

            billingItems.push({
              id: nanoid(),
              productId: product.id,
              name,
              quantity,
              unitPrice,
              taxRate,
              amount,
            });
          }

          if (billingItems.length > 0) {
            jobDataWithoutAppointment.billingItems = JSON.stringify(billingItems);
          }
        } catch (billingErr) {
          console.error("Error building billing items from selected products:", billingErr);
        }
      }

      // Do not persist products on the job document (they live on appointment or in billingItems)
      delete jobDataWithoutAppointment.products;
      delete jobDataWithoutAppointment.selectedProducts;

      const job = await storage.createJob(jobDataWithoutAppointment);

      // Create appointment if appointmentDate is provided
      let appointment = null;
      if (appointmentDate) {
        try {
          // Calculate estimated duration from products if available
          let estimatedDuration = data.estimatedDuration;
          if (!estimatedDuration && products && Array.isArray(products) && products.length > 0) {
            const allProducts = await storage.getProducts(req.user.partnerId);
            let totalDuration = 0;
            for (const selectedProduct of products) {
              const product = allProducts.find(p => p.id === selectedProduct.id);
              if (product) {
                const productDuration = product.appointmentDuration || 60;
                const quantity = selectedProduct.quantity || 1;
                totalDuration += productDuration * quantity;
              }
            }
            if (totalDuration > 0) {
              estimatedDuration = totalDuration;
            }
          }

          appointment = await storage.createAppointment({
            jobId: job.id,
            partnerId: req.user.partnerId,
            appointmentDate: appointmentDate instanceof Date ? appointmentDate : new Date(appointmentDate),
            estimatedDuration: estimatedDuration || undefined,
            assignedTo: data.assignedTo || undefined,
            products: products ? JSON.stringify(products.map((p: any) => ({
              id: p.id,
              name: p.title || p.name,
              quantity: p.quantity || 1,
              variationName: p.variationName
            }))) : undefined,
            notes: data.notes || undefined,
            status: 'scheduled',
          });
          if (appointment && req.user.partnerId) {
            try {
              const target = await getCalendarTargetForAppointment(req.user.partnerId, appointment, job);
              if (target) {
                const extras = await buildCalendarEventExtras(job, appointment);
                const eventId = await createCalendarEvent(target.userId, {
                  appointment: { ...appointment, id: appointment.id },
                  jobAddress: job.address,
                  ...extras,
                }, { byPartnerId: target.byPartnerId });
                if (eventId) {
                  await storage.updateAppointment(appointment.id, { googleCalendarEventId: eventId });
                }
              }
            } catch (syncErr) {
              console.error("Google Calendar sync after job create:", syncErr);
            }
          }
        } catch (appointmentError) {
          console.error("Failed to create appointment:", appointmentError);
          // Don't fail the job creation if appointment creation fails
        }
      }

      // Log activity: Job Creation
      try {
        const metadata: any = {
          jobId: job.jobId,
          address: job.address,
          status: job.status,
          customerId: job.customerId,
          totalValue: job.totalValue,
          source: 'create_job_modal',
          appointmentId: appointment?.appointmentId
        };

        // Add products to metadata if provided
        if (products && Array.isArray(products) && products.length > 0) {
          metadata.products = products.map((p: any) => ({
            id: p.id,
            name: p.title || p.name,
            quantity: p.quantity || 1,
            variationName: p.variationName
          }));
        }

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
          metadata: JSON.stringify(metadata),
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });
        console.log(`[ACTIVITY] Created job creation activity for jobId: ${job.jobId}`);
      } catch (activityError) {
        console.error("Failed to log job creation activity:", activityError);
        // Don't fail the job creation if activity logging fails
      }

      res.status(201).json({ ...job, appointmentId: appointment?.appointmentId });
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
      
      // Regenerate expired cover photo URLs
      const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.replace(/['"]/g, '').trim();
      const bucket = bucketName ? getStorage().bucket(bucketName) : null;
      const regeneratedUrls = await regenerateCoverPhotoUrls(job, bucket);
      
      res.json({
        ...job,
        propertyImage: regeneratedUrls.propertyImage || job.propertyImage,
        propertyImageThumbnail: regeneratedUrls.propertyImageThumbnail || job.propertyImageThumbnail
      });
    } catch (error) {
      console.error("Error fetching job:", error);
      res.status(500).json({ error: "Failed to fetch job" });
    }
  });

  // Update job (PATCH - partial update)
  app.patch("/api/jobs/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      
      if (!req.user?.partnerId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Get the job first
      const job = await storage.getJob(id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Verify job belongs to user's organization
      if (job.partnerId !== req.user.partnerId) {
        return res.status(403).json({ error: "Access denied: Job belongs to different organization" });
      }

      // Extract allowed fields for update
      const { appointmentDate, assignedTo, notes, status, jobName, address, latitude, longitude, totalValue, estimatedDuration, billingItems, invoiceStatus } = req.body;
      
      const updateData: any = {};
      
      if (appointmentDate !== undefined) {
        updateData.appointmentDate = appointmentDate;
      }
      if (assignedTo !== undefined) {
        updateData.assignedTo = assignedTo;
      }
      if (notes !== undefined) {
        updateData.notes = notes;
      }
      if (status !== undefined) {
        updateData.status = status;
      }
      if (jobName !== undefined) {
        updateData.jobName = jobName;
      }
      if (address !== undefined) {
        updateData.address = address;
      }
      if (latitude !== undefined) {
        updateData.latitude = latitude;
      }
      if (longitude !== undefined) {
        updateData.longitude = longitude;
      }
      if (totalValue !== undefined) {
        updateData.totalValue = totalValue;
      }
      if (estimatedDuration !== undefined) {
        updateData.estimatedDuration = estimatedDuration;
      }
      if (billingItems !== undefined) {
        updateData.billingItems = billingItems;
      }
      if (invoiceStatus !== undefined) {
        updateData.invoiceStatus = invoiceStatus;
      }

      // Update the job
      const updatedJob = await storage.updateJob(id, updateData);
      if (!updatedJob) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Log activity for significant changes
      try {
        const changes: string[] = [];
        if (appointmentDate !== undefined) changes.push('appointment date');
        if (assignedTo !== undefined) changes.push('assigned photographer');
        if (status !== undefined) changes.push('status');
        if (notes !== undefined) changes.push('notes');
        
        if (changes.length > 0) {
          await storage.createActivity({
            partnerId: req.user.partnerId,
            jobId: updatedJob.jobId,
            userId: req.user.uid,
            userEmail: req.user.email,
            userName: req.user.email,
            action: "update",
            category: "job",
            title: "Job Updated",
            description: `Updated ${changes.join(', ')} for job at ${updatedJob.address}`,
            metadata: JSON.stringify({
              jobId: updatedJob.jobId,
              changes: updateData
            }),
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
          });
        }
      } catch (activityError) {
        console.error("Failed to create activity for job update:", activityError);
      }

      res.json(updatedJob);
    } catch (error: any) {
      console.error("Error updating job:", error);
      res.status(500).json({ error: "Failed to update job" });
    }
  });

  // Appointments routes
  // GET /api/jobs/:jobId/appointments - Get all appointments for a job
  app.get("/api/jobs/:jobId/appointments", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { jobId } = req.params;
      console.log(`[APPOINTMENTS API] Fetching appointments for jobId: ${jobId}`);
      
      const job = await storage.getJobByJobId(jobId);
      if (!job) {
        console.error(`[APPOINTMENTS API] Job not found for jobId: ${jobId}`);
        return res.status(404).json({ error: "Job not found" });
      }
      
      if (job.partnerId !== req.user?.partnerId) {
        console.error(`[APPOINTMENTS API] Access denied - job partnerId: ${job.partnerId}, user partnerId: ${req.user?.partnerId}`);
        return res.status(403).json({ error: "Access denied" });
      }
      
      console.log(`[APPOINTMENTS API] Job found: ${job.id}, fetching appointments with job.id: ${job.id}, partnerId: ${req.user.partnerId}`);
      const appointments = await storage.getAppointments(job.id, req.user.partnerId);
      console.log(`[APPOINTMENTS API] Found ${appointments.length} appointments for job ${job.id}`);
      res.json(appointments);
    } catch (error: any) {
      console.error("[APPOINTMENTS API] Error fetching appointments:", error);
      console.error("[APPOINTMENTS API] Error stack:", error.stack);
      res.status(500).json({ error: "Failed to fetch appointments", details: error.message });
    }
  });

  // POST /api/jobs/:jobId/appointments - Create new appointment
  app.post("/api/jobs/:jobId/appointments", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { jobId } = req.params;
      const job = await storage.getJobByJobId(jobId);
      if (!job || job.partnerId !== req.user?.partnerId) {
        return res.status(404).json({ error: "Job not found" });
      }

      const { appointmentDate, estimatedDuration, assignedTo, products, notes } = req.body;
      
      if (!appointmentDate) {
        return res.status(400).json({ error: "appointmentDate is required" });
      }

      const appointment = await storage.createAppointment({
        jobId: job.id,
        partnerId: req.user.partnerId,
        appointmentDate: new Date(appointmentDate),
        estimatedDuration,
        assignedTo,
        products: products ? JSON.stringify(products) : undefined,
        notes,
        status: 'scheduled',
      });

      if (appointment && req.user.partnerId) {
        try {
          const target = await getCalendarTargetForAppointment(req.user.partnerId, appointment, job);
          if (target) {
            const extras = await buildCalendarEventExtras(job, appointment);
            const eventId = await createCalendarEvent(target.userId, {
              appointment: { ...appointment, id: appointment.id },
              jobAddress: job.address,
              ...extras,
            }, { byPartnerId: target.byPartnerId });
            if (eventId) {
              await storage.updateAppointment(appointment.id, { googleCalendarEventId: eventId });
            }
          }
        } catch (syncErr) {
          console.error("Google Calendar sync after appointment create:", syncErr);
        }
      }

      // Add products from appointment to job billing items if they don't already exist
      if (products && Array.isArray(products) && products.length > 0) {
        try {
          console.log(`[Appointment] Adding ${products.length} products to billing for job ${job.id}`);
          
          // Get current billing items
          let currentBillingItems: any[] = [];
          if (job.billingItems) {
            try {
              currentBillingItems = typeof job.billingItems === 'string' 
                ? JSON.parse(job.billingItems) 
                : job.billingItems;
              if (!Array.isArray(currentBillingItems)) {
                currentBillingItems = [];
              }
            } catch (e) {
              console.error("Error parsing existing billingItems:", e);
              currentBillingItems = [];
            }
          }
          
          console.log(`[Appointment] Current billing items count: ${currentBillingItems.length}`);

          // Get all products to fetch tax rates
          const allProducts = await storage.getProducts(req.user.partnerId);
          
          // Add new products to billing items
          const newBillingItems = [...currentBillingItems];
          let itemsAdded = 0;
          
          for (const appointmentProduct of products) {
            console.log(`[Appointment] Processing product: ${appointmentProduct.id} - ${appointmentProduct.name}`);
            
            // Check if this product already exists in billing items
            const exists = newBillingItems.some((item: any) => 
              item.productId === appointmentProduct.id && 
              item.name === appointmentProduct.name
            );
            
            if (!exists) {
              // Find the product to get tax rate
              const product = allProducts.find((p: any) => p.id === appointmentProduct.id);
              const taxRate = product?.taxRate ? parseFloat(product.taxRate.toString()) : 10;
              
              // Create billing item
              const billingItem = {
                id: nanoid(),
                productId: appointmentProduct.id,
                name: appointmentProduct.name,
                quantity: appointmentProduct.quantity || 1,
                unitPrice: parseFloat(appointmentProduct.price?.toString() || "0"),
                taxRate: taxRate,
                amount: parseFloat(appointmentProduct.price?.toString() || "0") * (appointmentProduct.quantity || 1),
              };
              
              console.log(`[Appointment] Adding billing item:`, billingItem);
              newBillingItems.push(billingItem);
              itemsAdded++;
            } else {
              console.log(`[Appointment] Product already exists in billing, skipping: ${appointmentProduct.name}`);
            }
          }
          
          // Always update job with billing items if we processed products
          if (itemsAdded > 0) {
            console.log(`[Appointment] Updating job ${job.id} with ${newBillingItems.length} billing items`);
            const updatedJob = await storage.updateJob(job.id, {
              billingItems: JSON.stringify(newBillingItems),
            });
            console.log(`[Appointment] Job updated successfully. New billing items:`, updatedJob?.billingItems ? 'present' : 'missing');
          } else {
            console.log(`[Appointment] No new items to add to billing`);
          }
        } catch (billingError: any) {
          console.error("Error updating billing items from appointment:", billingError);
          console.error("Error stack:", billingError.stack);
          // Don't fail the appointment creation, but log the error
        }
      }

      // Log activity
      try {
        await firestoreStorage.createActivity({
          partnerId: req.user.partnerId,
          jobId: job.jobId,
          userId: req.user.uid,
          userEmail: req.user.email,
          userName: req.user.email,
          action: "creation",
          category: "appointment",
          title: "Appointment Created",
          description: `New appointment scheduled for ${new Date(appointmentDate).toLocaleString()}`,
          metadata: JSON.stringify({
            appointmentId: appointment.appointmentId,
            appointmentDate: appointmentDate,
            products: products || [],
          }),
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
        });
      } catch (activityError) {
        console.error("Failed to log appointment creation activity:", activityError);
      }

      res.status(201).json(appointment);
    } catch (error: any) {
      console.error("Error creating appointment:", error);
      res.status(500).json({ error: "Failed to create appointment", details: error.message });
    }
  });

  // GET /api/appointments/:id - Get single appointment
  app.get("/api/appointments/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      // Try to get appointment by document ID first
      let appointment = await storage.getAppointment(req.params.id);
      
      // If not found, try to get by appointmentId (NanoID)
      if (!appointment) {
        appointment = await storage.getAppointmentByAppointmentId(req.params.id);
      }
      
      if (!appointment || appointment.partnerId !== req.user?.partnerId) {
        return res.status(404).json({ error: "Appointment not found" });
      }
      res.json(appointment);
    } catch (error: any) {
      console.error("Error fetching appointment:", error);
      res.status(500).json({ error: "Failed to fetch appointment", details: error.message });
    }
  });

  // PATCH /api/appointments/:id - Update appointment
  app.patch("/api/appointments/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      // Try to get appointment by document ID first
      let appointment = await storage.getAppointment(req.params.id);
      
      // If not found, try to get by appointmentId (NanoID)
      if (!appointment) {
        appointment = await storage.getAppointmentByAppointmentId(req.params.id);
      }
      
      if (!appointment || appointment.partnerId !== req.user?.partnerId) {
        return res.status(404).json({ error: "Appointment not found" });
      }
      
      // Use the document ID for updates (not appointmentId)
      const documentId = appointment.id;

      const updates: any = {};
      if (req.body.appointmentDate !== undefined) {
        updates.appointmentDate = new Date(req.body.appointmentDate);
      }
      if (req.body.estimatedDuration !== undefined) {
        updates.estimatedDuration = req.body.estimatedDuration;
      }
      if (req.body.assignedTo !== undefined) {
        updates.assignedTo = req.body.assignedTo;
      }
      if (req.body.status !== undefined) {
        updates.status = req.body.status;
      }
      if (req.body.products !== undefined) {
        updates.products = JSON.stringify(req.body.products);
      }
      if (req.body.notes !== undefined) {
        updates.notes = req.body.notes;
      }

      const updated = await storage.updateAppointment(documentId, updates);
      if (!updated) {
        return res.status(404).json({ error: "Appointment not found" });
      }

      if (req.user?.partnerId) {
        try {
          const job = await storage.getJob(updated.jobId);
          const jobAddress = job?.address;
          const target = await getCalendarTargetForAppointment(req.user.partnerId, updated, job);
          if (target) {
            const extras = await buildCalendarEventExtras(job, updated);
            if ((updated as any).googleCalendarEventId) {
              await updateCalendarEvent(target.userId, (updated as any).googleCalendarEventId, {
                appointment: { ...updated, id: updated.id },
                jobAddress,
                ...extras,
              }, { byPartnerId: target.byPartnerId });
            } else {
              const eventId = await createCalendarEvent(target.userId, {
                appointment: { ...updated, id: updated.id },
                jobAddress,
                ...extras,
              }, { byPartnerId: target.byPartnerId });
              if (eventId) {
                await storage.updateAppointment(documentId, { googleCalendarEventId: eventId });
              }
            }
          }
        } catch (syncErr) {
          console.error("Google Calendar sync after appointment update:", syncErr);
        }
      }

      // Log activity
      try {
        const job = await storage.getJob(appointment.jobId);
        if (job) {
          await firestoreStorage.createActivity({
            partnerId: req.user.partnerId,
            jobId: job.jobId,
            userId: req.user.uid,
            userEmail: req.user.email,
            userName: req.user.email,
            action: "update",
            category: "appointment",
            title: "Appointment Updated",
            description: `Appointment updated`,
            metadata: JSON.stringify({
              appointmentId: appointment.appointmentId,
              changes: updates,
            }),
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
          });
        }
      } catch (activityError) {
        console.error("Failed to log appointment update activity:", activityError);
      }

      res.json(updated);
    } catch (error: any) {
      console.error("Error updating appointment:", error);
      res.status(500).json({ error: "Failed to update appointment", details: error.message });
    }
  });

  // DELETE /api/appointments/:id - Delete appointment
  app.delete("/api/appointments/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      // Try to get appointment by document ID first
      let appointment = await storage.getAppointment(req.params.id);
      
      // If not found, try to get by appointmentId (NanoID)
      if (!appointment) {
        appointment = await storage.getAppointmentByAppointmentId(req.params.id);
      }
      
      if (!appointment || appointment.partnerId !== req.user?.partnerId) {
        return res.status(404).json({ error: "Appointment not found" });
      }

      if (req.user?.partnerId && (appointment as any).googleCalendarEventId) {
        try {
          const job = await storage.getJob(appointment.jobId);
          const target = await getCalendarTargetForAppointment(req.user.partnerId, appointment, job ?? undefined);
          if (target) {
            await deleteCalendarEvent(target.userId, (appointment as any).googleCalendarEventId, { byPartnerId: target.byPartnerId });
          }
        } catch (syncErr) {
          console.error("Google Calendar sync on appointment delete:", syncErr);
        }
      }

      // Use the document ID for deletion (not appointmentId)
      const documentId = appointment.id;
      await storage.deleteAppointment(documentId);

      // Log activity
      try {
        const job = await storage.getJob(appointment.jobId);
        if (job) {
          await firestoreStorage.createActivity({
            partnerId: req.user.partnerId,
            jobId: job.jobId,
            userId: req.user.uid,
            userEmail: req.user.email,
            userName: req.user.email,
            action: "delete",
            category: "appointment",
            title: "Appointment Deleted",
            description: `Appointment deleted`,
            metadata: JSON.stringify({
              appointmentId: appointment.appointmentId,
            }),
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
          });
        }
      } catch (activityError) {
        console.error("Failed to log appointment deletion activity:", activityError);
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting appointment:", error);
      res.status(500).json({ error: "Failed to delete appointment", details: error.message });
    }
  });

  // ----- Google Calendar integration -----
  app.get("/api/calendar/google/auth-url", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.partnerId || !req.user?.uid) {
        return res.status(400).json({ error: "Partner ID and user ID required" });
      }
      const envBase = process.env.BASE_URL?.replace(/^["']|["']$/g, "").trim();
      const host = req.get("host");
      const protocol = req.protocol === "https" || req.get("x-forwarded-proto") === "https" ? "https" : "http";
      const baseUrl = envBase || (host ? `${protocol}://${host}` : null) || "http://localhost:5001";
      const authUrl = getGoogleCalendarAuthUrl(req.user.uid, req.user.partnerId, baseUrl);
      res.json({ authUrl });
    } catch (error: any) {
      console.error("[Google Calendar] auth-url error:", error);
      const msg = error?.message || "Failed to get auth URL";
      if (msg === "GOOGLE_CALENDAR_NOT_CONFIGURED") {
        return res.status(503).json({
          error: "Google Calendar is not configured",
          code: "GOOGLE_CALENDAR_NOT_CONFIGURED",
          detail: "Set GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET in server environment.",
        });
      }
      if (msg === "GOOGLE_CALENDAR_BASE_URL_REQUIRED") {
        return res.status(503).json({
          error: "Base URL required for Google Calendar",
          code: "GOOGLE_CALENDAR_BASE_URL_REQUIRED",
          detail: "Set BASE_URL in server environment or ensure request Host header is correct.",
        });
      }
      res.status(500).json({ error: msg, detail: error?.stack || undefined });
    }
  });

  /** Build customer name, products description, and job link for Google Calendar event. */
  async function buildCalendarEventExtras(
    job: any,
    appointment: any
  ): Promise<{ customerName?: string; productsDescription?: string; jobLink?: string }> {
    let customerName: string | undefined;
    if (job?.customerId) {
      try {
        const customer = await storage.getCustomer(job.customerId);
        if (customer) {
          const name = `${(customer as any).firstName ?? ""} ${(customer as any).lastName ?? ""}`.trim();
          customerName = (customer as any).company ? `${name} (${(customer as any).company})` : name || undefined;
        }
      } catch (_) {}
    }
    let productsDescription: string | undefined;
    if (appointment?.products) {
      try {
        const products = typeof appointment.products === "string" ? JSON.parse(appointment.products) : appointment.products;
        if (Array.isArray(products)) {
          productsDescription = products
            .map((p: any) => {
              const qty = p.quantity ?? 1;
              const name = p.name ?? p.title ?? "Product";
              const variation = p.variationName ? ` [${p.variationName}]` : "";
              return `(${qty}) ${name}${variation}`;
            })
            .join("\n");
        }
      } catch (_) {}
    }
    const appUrl = (process.env.APP_URL ?? process.env.BASE_URL ?? "").replace(/^["']|["']$/g, "").trim();
    const jobLink = appUrl && job?.jobId ? `${appUrl.replace(/\/$/, "")}/jobs/${job.jobId}` : undefined;
    return { customerName, productsDescription, jobLink };
  }

  /** Resolve which user's calendar to use for an appointment (assigned user or partner owner, or legacy partner connection). */
  async function getCalendarTargetForAppointment(
    partnerId: string,
    appointment: { assignedTo?: string | null },
    job?: { assignedTo?: string | null } | null
  ): Promise<{ userId: string; byPartnerId: boolean } | null> {
    const assignedTo = appointment?.assignedTo ?? job?.assignedTo;
    if (assignedTo) {
      const conn = await getGoogleCalendarConnection(assignedTo);
      if (conn) return { userId: assignedTo, byPartnerId: false };
    }
    const ownerUid = await getPartnerOwnerUid(partnerId);
    if (ownerUid) {
      const conn = await getGoogleCalendarConnection(ownerUid);
      if (conn) return { userId: ownerUid, byPartnerId: false };
    }
    const legacyConn = await getGoogleCalendarConnectionByPartnerId(partnerId);
    if (legacyConn) return { userId: partnerId, byPartnerId: true };
    return null;
  }

  /** Sync existing appointments assigned to this user to their Google Calendar after connect. Runs in background. */
  async function syncAllAppointmentsToGoogleAfterConnect(userId: string, partnerId: string) {
    try {
      const conn = await getGoogleCalendarConnection(userId);
      if (!conn) return;
      const snapshot = await adminDb.collection("appointments").where("partnerId", "==", partnerId).get();
      const jobs = await storage.getJobs(partnerId);
      const jobsById = new Map(jobs.map((j: any) => [j.id, j]));
      let synced = 0;
      let failed = 0;
      for (const doc of snapshot.docs) {
        const apt = doc.data();
        if (apt.status === "cancelled") continue;
        if (apt.googleCalendarEventId) continue;
        if (apt.assignedTo && apt.assignedTo !== userId) continue;
        if (!apt.assignedTo) {
          const job = jobsById.get(apt.jobId);
          const jobAssignedTo = job?.assignedTo;
          if (jobAssignedTo && jobAssignedTo !== userId) continue;
        }
        let appointmentDate: Date;
        if (apt.appointmentDate?.toDate) {
          appointmentDate = apt.appointmentDate.toDate();
        } else if (apt.appointmentDate instanceof Date) {
          appointmentDate = apt.appointmentDate;
        } else {
          appointmentDate = new Date(apt.appointmentDate);
        }
        const job = jobsById.get(apt.jobId);
        const appointment = {
          id: doc.id,
          appointmentId: apt.appointmentId,
          jobId: apt.jobId,
          partnerId: apt.partnerId,
          appointmentDate,
          estimatedDuration: apt.estimatedDuration,
          notes: apt.notes,
          status: apt.status,
          products: apt.products,
        };
        const extras = await buildCalendarEventExtras(job, appointment);
        const eventId = await createCalendarEvent(userId, {
          appointment,
          jobAddress: job?.address,
          ...extras,
        });
        if (eventId) {
          await storage.updateAppointment(doc.id, { googleCalendarEventId: eventId });
          synced++;
        } else {
          failed++;
        }
      }
      if (synced > 0 || failed > 0) {
        console.log(`[Google Calendar] Post-connect sync for user ${userId}: ${synced} synced, ${failed} failed`);
      }
    } catch (err: any) {
      console.error("[Google Calendar] syncAllAppointmentsToGoogleAfterConnect error:", err);
    }
  }

  app.get("/api/auth/google-calendar/callback", async (req, res) => {
    try {
      const { code, state, error } = req.query;
      if (error) {
        const baseUrl = process.env.BASE_URL?.trim() || "http://localhost:5000";
        return res.redirect(`${baseUrl}/settings#integrations&calendar_error=${encodeURIComponent(String(error))}`);
      }
      if (!code || !state || typeof code !== "string" || typeof state !== "string") {
        const baseUrl = process.env.BASE_URL?.trim() || "http://localhost:5000";
        return res.redirect(`${baseUrl}/settings#integrations&calendar_error=missing_code_or_state`);
      }
      const result = await exchangeCodeForTokens(code, state);
      if ("error" in result) {
        const baseUrl = process.env.BASE_URL?.trim() || "http://localhost:5000";
        return res.redirect(`${baseUrl}/settings#integrations&calendar_error=${encodeURIComponent(result.error)}`);
      }
      const { userId, partnerId } = result;
      setImmediate(() => {
        syncAllAppointmentsToGoogleAfterConnect(userId, partnerId).catch((err) =>
          console.error("[Google Calendar] Background sync error:", err)
        );
      });
      const baseUrl = process.env.BASE_URL?.trim() || "http://localhost:5000";
      res.redirect(`${baseUrl}/settings#integrations&calendar_connected=1`);
    } catch (err: any) {
      console.error("[Google Calendar] callback error:", err);
      const baseUrl = process.env.BASE_URL?.trim() || "http://localhost:5000";
      res.redirect(`${baseUrl}/settings#integrations&calendar_error=callback_failed`);
    }
  });

  app.get("/api/calendar/google/status", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.partnerId || !req.user?.uid) {
        return res.status(400).json({ error: "Partner ID and user ID required" });
      }
      const conn = await getGoogleCalendarConnection(req.user.uid)
        ?? (req.user.role === "partner" ? await getGoogleCalendarConnectionByPartnerId(req.user.partnerId) : null);
      res.json({
        connected: !!conn,
        twoWaySyncEnabled: conn?.twoWaySyncEnabled ?? false,
      });
    } catch (error: any) {
      console.error("[Google Calendar] status error:", error);
      res.status(500).json({ error: "Failed to get status" });
    }
  });

  app.put("/api/calendar/google/settings", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.partnerId || !req.user?.uid) {
        return res.status(400).json({ error: "Partner ID and user ID required" });
      }
      const { twoWaySyncEnabled } = req.body;
      const updated = await updateGoogleCalendarSettings(req.user.uid, {
        twoWaySyncEnabled: typeof twoWaySyncEnabled === "boolean" ? twoWaySyncEnabled : undefined,
      });
      if (!updated) {
        return res.status(404).json({ error: "Google Calendar not connected" });
      }
      res.json({ twoWaySyncEnabled: updated.twoWaySyncEnabled });
    } catch (error: any) {
      console.error("[Google Calendar] settings error:", error);
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  app.delete("/api/calendar/google/disconnect", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.partnerId || !req.user?.uid) {
        return res.status(400).json({ error: "Partner ID and user ID required" });
      }
      const conn = await getGoogleCalendarConnection(req.user.uid)
        ?? (req.user.role === "partner" ? await getGoogleCalendarConnectionByPartnerId(req.user.partnerId) : null);
      if (conn) {
        await adminDb.collection("googleCalendarConnections").doc(conn.id).delete();
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Google Calendar] disconnect error:", error);
      res.status(500).json({ error: "Failed to disconnect" });
    }
  });

  // ----- Xero integration -----
  app.get("/api/auth/xero/auth-url", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.partnerId) {
        return res.status(400).json({ error: "Partner ID required" });
      }
      const envBase = process.env.BASE_URL?.replace(/^["']|["']$/g, "").trim();
      const host = req.get("host");
      const protocol = req.protocol === "https" || req.get("x-forwarded-proto") === "https" ? "https" : "http";
      const baseUrl = envBase || (host ? `${protocol}://${host}` : null) || "http://localhost:5001";
      const authUrl = getXeroAuthUrl(req.user.partnerId, baseUrl);
      res.json({ authUrl });
    } catch (error: any) {
      console.error("[Xero] auth-url error:", error);
      const msg = error?.message || "Failed to get auth URL";
      if (msg === "XERO_NOT_CONFIGURED") {
        return res.status(503).json({
          error: "Xero is not configured",
          code: "XERO_NOT_CONFIGURED",
          detail: "Set XERO_CLIENT_ID and XERO_CLIENT_SECRET in server environment.",
        });
      }
      if (msg === "XERO_BASE_URL_REQUIRED") {
        return res.status(503).json({
          error: "Base URL required for Xero",
          code: "XERO_BASE_URL_REQUIRED",
          detail: "Set BASE_URL in server environment or ensure request Host header is correct.",
        });
      }
      res.status(500).json({ error: msg, detail: error?.stack || undefined });
    }
  });

  app.get("/api/auth/xero/callback", async (req, res) => {
    try {
      const { code, state, error } = req.query;
      const baseUrl = process.env.BASE_URL?.trim() || "http://localhost:5000";
      const redirectBase = `${baseUrl}/settings#integrations`;
      if (error) {
        return res.redirect(`${redirectBase}&xero_error=${encodeURIComponent(String(error))}`);
      }
      if (!code || !state || typeof code !== "string" || typeof state !== "string") {
        return res.redirect(`${redirectBase}&xero_error=missing_code_or_state`);
      }
      const result = await xeroExchangeCodeForTokens(code, state);
      if ("error" in result) {
        return res.redirect(`${redirectBase}&xero_error=${encodeURIComponent(result.error)}`);
      }
      res.redirect(`${redirectBase}&xero_connected=1`);
    } catch (err: any) {
      console.error("[Xero] callback error:", err);
      const baseUrl = process.env.BASE_URL?.trim() || "http://localhost:5000";
      res.redirect(`${baseUrl}/settings#integrations&xero_error=callback_failed`);
    }
  });

  app.get("/api/auth/xero/status", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.partnerId) {
        return res.status(400).json({ error: "Partner ID required" });
      }
      const conn = await getXeroConnection(req.user.partnerId);
      res.json({
        connected: !!conn,
        tenantName: conn?.tenantName ?? undefined,
      });
    } catch (error: any) {
      console.error("[Xero] status error:", error);
      res.status(500).json({ error: "Failed to get status" });
    }
  });

  app.delete("/api/auth/xero/disconnect", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.partnerId) {
        return res.status(400).json({ error: "Partner ID required" });
      }
      await deleteXeroConnection(req.user.partnerId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Xero] disconnect error:", error);
      res.status(500).json({ error: "Failed to disconnect" });
    }
  });

  // Xero config and data API — use partnerId as doc id so one config per partner, no query order ambiguity
  const XERO_CONFIG_COLLECTION = "xeroConfig";

  function xeroConfigRef(partnerId: string) {
    return adminDb.collection(XERO_CONFIG_COLLECTION).doc(partnerId);
  }

  async function getXeroConfig(partnerId: string): Promise<any> {
    const ref = xeroConfigRef(partnerId);
    const doc = await ref.get();
    if (doc.exists) return doc.data();
    // Migrate from old query-based docs (one-time): copy first matching doc to doc(partnerId)
    const legacy = await adminDb.collection(XERO_CONFIG_COLLECTION).where("partnerId", "==", partnerId).limit(1).get();
    if (!legacy.empty) {
      const data = legacy.docs[0].data();
      await ref.set({ ...data, updatedAt: new Date() }, { merge: true });
      return data;
    }
    return null;
  }

  async function saveXeroConfig(partnerId: string, data: any): Promise<any> {
    const existing = await getXeroConfig(partnerId);
    const customerMappings =
      data.customerMappings && typeof data.customerMappings === "object"
        ? data.customerMappings
        : (existing?.customerMappings && typeof existing.customerMappings === "object" ? existing.customerMappings : {});
    const productMappings =
      data.productMappings && typeof data.productMappings === "object"
        ? data.productMappings
        : (existing?.productMappings && typeof existing.productMappings === "object" ? existing.productMappings : {});
    const payload = {
      partnerId,
      invoiceTrigger: data.invoiceTrigger ?? existing?.invoiceTrigger ?? "manual_only",
      invoiceStatus: data.invoiceStatus ?? existing?.invoiceStatus ?? "DRAFT",
      customerMappings,
      productMappings,
      updatedAt: new Date(),
    };
    await xeroConfigRef(partnerId).set(payload, { merge: true });
    return payload;
  }

  app.get("/api/xero/config", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.partnerId) return res.status(400).json({ error: "Partner ID required" });
      const config = await getXeroConfig(req.user.partnerId);
      res.json(config ?? { invoiceTrigger: "manual_only", invoiceStatus: "DRAFT", customerMappings: {}, productMappings: {} });
    } catch (error: any) {
      console.error("[Xero] config GET error:", error);
      res.status(500).json({ error: "Failed to get config" });
    }
  });

  app.put("/api/xero/config", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.partnerId) return res.status(400).json({ error: "Partner ID required" });
      const body = req.body || {};
      const invoiceTrigger = body.invoiceTrigger ?? "manual_only";
      const invoiceStatus = body.invoiceStatus ?? "DRAFT";
      const customerMappings = typeof body.customerMappings === "object" && body.customerMappings !== null ? body.customerMappings : undefined;
      const productMappings = typeof body.productMappings === "object" && body.productMappings !== null ? body.productMappings : undefined;
      if (process.env.NODE_ENV !== "production") {
        console.log("[Xero] config PUT body keys:", Object.keys(body), "customerMappings keys:", customerMappings ? Object.keys(customerMappings) : "none", "productMappings keys:", productMappings ? Object.keys(productMappings) : "none");
      }
      const config = await saveXeroConfig(req.user.partnerId, {
        invoiceTrigger,
        invoiceStatus,
        customerMappings,
        productMappings,
      });
      res.json(config);
    } catch (error: any) {
      console.error("[Xero] config PUT error:", error);
      res.status(500).json({ error: "Failed to save config" });
    }
  });

  app.get("/api/xero/contacts", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.partnerId) return res.status(400).json({ error: "Partner ID required" });
      const contacts = await xeroListContacts(req.user.partnerId);
      res.json(contacts);
    } catch (error: any) {
      console.error("[Xero] contacts error:", error);
      if (error?.message === "XERO_NOT_CONNECTED") {
        return res.status(503).json({ error: "Xero not connected" });
      }
      res.status(500).json({ error: "Failed to fetch contacts" });
    }
  });

  app.get("/api/xero/accounts", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.partnerId) return res.status(400).json({ error: "Partner ID required" });
      const accounts = await xeroListAccounts(req.user.partnerId);
      res.json(accounts);
    } catch (error: any) {
      console.error("[Xero] accounts error:", error);
      if (error?.message === "XERO_NOT_CONNECTED") {
        return res.status(503).json({ error: "Xero not connected" });
      }
      res.status(500).json({ error: "Failed to fetch accounts" });
    }
  });

  app.get("/api/xero/tax-rates", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.partnerId) return res.status(400).json({ error: "Partner ID required" });
      const taxRates = await xeroListTaxRates(req.user.partnerId);
      res.json(taxRates);
    } catch (error: any) {
      console.error("[Xero] tax-rates error:", error);
      if (error?.message === "XERO_NOT_CONNECTED") {
        return res.status(503).json({ error: "Xero not connected" });
      }
      res.status(500).json({ error: "Failed to fetch tax rates" });
    }
  });

  app.get("/api/xero/invoices/:invoiceId/pdf", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.partnerId) return res.status(400).json({ error: "Partner ID required" });
      const { invoiceId } = req.params;
      if (!invoiceId) return res.status(400).json({ error: "Invoice ID required" });
      const pdfBuffer = await xeroGetInvoicePdf(req.user.partnerId, invoiceId);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "inline; filename=invoice.pdf");
      res.send(Buffer.from(pdfBuffer));
    } catch (error: any) {
      console.error("[Xero] invoice PDF error:", error);
      if (error?.message === "XERO_NOT_CONNECTED") {
        return res.status(503).json({ error: "Xero not connected" });
      }
      res.status(500).json({ error: "Failed to fetch invoice PDF" });
    }
  });

  app.get("/api/xero/reports/profit-and-loss", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.partnerId) return res.status(400).json({ error: "Partner ID required" });
      const { fromDate, toDate, periods, timeframe } = req.query;
      if (typeof fromDate !== "string" || typeof toDate !== "string") {
        return res.status(400).json({ error: "fromDate and toDate query params required (YYYY-MM-DD)" });
      }
      const options: { periods?: number; timeframe?: string; standardLayout?: boolean } = { standardLayout: true };
      if (periods != null) options.periods = Number(periods);
      if (typeof timeframe === "string") options.timeframe = timeframe;
      const summary = await xeroGetProfitAndLoss(req.user.partnerId, fromDate, toDate, options);
      res.json(summary);
    } catch (error: any) {
      console.error("[Xero] profit-and-loss error:", error);
      if (error?.message === "XERO_NOT_CONNECTED") {
        return res.status(503).json({ error: "Xero not connected", code: "XERO_NOT_CONNECTED" });
      }
      res.status(500).json({ error: error?.message ?? "Failed to fetch profit and loss" });
    }
  });

  app.get("/api/xero/reports/executive-summary", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.partnerId) return res.status(400).json({ error: "Partner ID required" });
      const date = typeof req.query.date === "string" ? req.query.date : undefined;
      const summary = await xeroGetExecutiveSummary(req.user.partnerId, date);
      res.json(summary);
    } catch (error: any) {
      console.error("[Xero] executive-summary error:", error);
      if (error?.message === "XERO_NOT_CONNECTED") {
        return res.status(503).json({ error: "Xero not connected", code: "XERO_NOT_CONNECTED" });
      }
      res.status(500).json({ error: error?.message ?? "Failed to fetch executive summary" });
    }
  });

  app.post("/api/jobs/:jobId/raise-invoice", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (isMasterReadOnly(req.user)) {
        return res.status(403).json({ error: "Read-only mode" });
      }
      const { jobId } = req.params;
      const partnerId = req.user?.partnerId;
      if (!partnerId) return res.status(400).json({ error: "Partner ID required" });

      const job = await storage.getJobByJobId(jobId);
      if (!job) return res.status(404).json({ error: "Job not found" });
      if ((job as any).partnerId !== partnerId) return res.status(403).json({ error: "Unauthorized" });

      const conn = await getXeroConnection(partnerId);
      if (!conn) return res.status(503).json({ error: "Xero not connected" });

      const xeroConfig = await getXeroConfig(partnerId) ?? {};
      const status = xeroConfig.invoiceStatus ?? "DRAFT";
      const productMappings = xeroConfig.productMappings ?? {};
      const customerMappings = xeroConfig.customerMappings ?? {};

      const billingItems = (() => {
        try {
          const raw = (job as any).billingItems;
          if (!raw) return [];
          const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })();

      if (billingItems.length === 0) {
        return res.status(400).json({ error: "No billing items on job" });
      }

      let contactId: string | null = null;
      const customerId = (job as any).customerId;
      if (customerId) {
        const customer = await storage.getCustomer(customerId);
        if (customer) {
          contactId = (customer as any).accountingContactId ?? customerMappings[customerId] ?? null;
          if (!contactId) {
            return res.status(400).json({
              error: "Customer not mapped to Xero contact",
              detail: "Map this customer to a Xero contact in Settings > Integrations > Xero configuration.",
            });
          }
        }
      }
      if (!contactId) {
        return res.status(400).json({
          error: "Job has no customer or customer not mapped",
          detail: "Assign a customer to the job and map them to a Xero contact in Settings > Integrations.",
        });
      }

      const lineItems = billingItems.map((item: any) => {
        const mapping = productMappings[item.productId] ?? {};
        const accountCode = mapping.accountCode || "200";
        const taxType = mapping.taxType || "OUTPUT";
        return {
          description: item.name ?? "Item",
          quantity: item.quantity ?? 1,
          unitAmount: item.unitPrice ?? item.amount ?? 0,
          accountCode,
          taxType,
        };
      });

      const today = new Date().toISOString().slice(0, 10);
      const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const reference = (job as any).jobName?.trim() || (job as any).address?.trim() || (job as any).jobId || undefined;
      const result = await xeroCreateInvoice(partnerId, {
        contactId,
        lineItems,
        date: today,
        dueDate,
        status: status as "DRAFT" | "AUTHORISED",
        reference,
      });

      await storage.updateJob(job.id, {
        xeroInvoiceId: result.invoiceId,
        xeroInvoiceNumber: result.invoiceNumber,
      } as any);

      res.json({
        success: true,
        invoiceId: result.invoiceId,
        invoiceNumber: result.invoiceNumber,
        viewUrl: `https://go.xero.com/AccountsReceivable/View.aspx?InvoiceID=${result.invoiceId}`,
      });
    } catch (error: any) {
      console.error("[Xero] raise-invoice error:", error);
      res.status(500).json({
        error: error?.message ?? "Failed to raise invoice",
      });
    }
  });

  app.get("/api/calendar/google/busy", async (req, res) => {
    try {
      const { partnerId: queryPartnerId, start, end, userId: queryUserId } = req.query;
      let partnerId: string | null = (req as AuthenticatedRequest).user?.partnerId ?? null;
      if (!partnerId && typeof queryPartnerId === "string") partnerId = queryPartnerId;
      if (!partnerId) {
        const authHeader = req.headers.authorization;
        if (authHeader) {
          try {
            const idToken = authHeader.replace("Bearer ", "");
            const decodedToken = await adminAuth.verifyIdToken(idToken);
            const userDoc = await getUserDocument(decodedToken.uid);
            if (userDoc?.partnerId) partnerId = userDoc.partnerId;
          } catch (_) {}
        }
      }
      if (!partnerId || !start || !end || typeof start !== "string" || typeof end !== "string") {
        return res.status(400).json({ error: "partnerId, start, and end required" });
      }
      const startDate = new Date(start);
      const endDate = new Date(end);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ error: "Invalid start or end date" });
      }
      let targetUserId: string;
      let usePartnerIdLegacy = false;
      if (typeof queryUserId === "string" && queryUserId) {
        const userDoc = await getUserDocument(queryUserId);
        if (!userDoc || userDoc.partnerId !== partnerId) {
          return res.status(403).json({ error: "User does not belong to this partner" });
        }
        targetUserId = queryUserId;
      } else if ((req as AuthenticatedRequest).user?.uid) {
        targetUserId = (req as AuthenticatedRequest).user!.uid;
        const connByUid = await getGoogleCalendarConnection(targetUserId);
        if (!connByUid && req.user?.role === "partner") {
          const legacyConn = await getGoogleCalendarConnectionByPartnerId(partnerId);
          if (legacyConn) usePartnerIdLegacy = true;
        }
      } else {
        const ownerUid = await getPartnerOwnerUid(partnerId);
        targetUserId = ownerUid ?? "";
        if (!ownerUid) usePartnerIdLegacy = true;
      }
      const blocks = usePartnerIdLegacy
        ? await listBusyBlocks(partnerId, startDate, endDate, { byPartnerId: true })
        : await listBusyBlocks(targetUserId, startDate, endDate);
      res.json(blocks);
    } catch (error: any) {
      console.error("[Google Calendar] busy error:", error);
      res.status(500).json({ error: "Failed to fetch busy blocks" });
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
      // Transform human_check status to processing for partner-facing view
      const ordersWithJobData = await Promise.all(
        filteredOrders.map(async (order) => {
          // Transform human_check to processing for partner view (human_check is editor-only workflow)
          const displayStatus = order.status === 'human_check' ? 'processing' : order.status;
          
          if (order.jobId) {
            // order.jobId might be a Job id or a job.jobId (external). Try both.
            const job = (await storage.getJob(order.jobId)) || (await storage.getJobByJobId(order.jobId));
            return {
              ...order,
              status: displayStatus,
              jobAddress: job?.address || "Unknown Address",
            };
          }
          return {
            ...order,
            status: displayStatus,
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

      let customerId = req.body.customerId;
      const jobId = req.body.jobId;
      if ((customerId == null || customerId === "") && jobId) {
        const job = await storage.getJob(jobId).catch(() => null) || await storage.getJobByJobId(jobId).catch(() => null);
        if (job?.customerId) customerId = job.customerId;
      }

      const orderData = {
        ...req.body,
        partnerId: req.user.partnerId,
        ...(customerId != null && customerId !== "" ? { customerId } : {})
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

  // Get complete order details with services and files
  app.get("/api/orders/:orderId/details", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { orderId } = req.params;
      
      if (!req.user?.partnerId) {
        return res.status(400).json({ error: "User must have a partnerId" });
      }

      // Get the order - first try by ID, then by orderNumber
      let order = await storage.getOrder(orderId);
      if (!order) {
        // Try looking up by orderNumber (e.g., "00058")
        order = await storage.getOrderByNumber(orderId, req.user.partnerId);
      }
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      // Security: Verify order belongs to user's partner
      if (order.partnerId !== req.user.partnerId) {
        return res.status(403).json({ error: "Access denied to this order" });
      }

      // Get job details - try by document ID first, then by jobId field
      let job = null;
      if (order.jobId) {
        job = await storage.getJob(order.jobId);
        if (!job) {
          // Try looking up by human-readable jobId field
          job = await storage.getJobByJobId(order.jobId);
        }
      }
      
      // Get customer details
      const customer = order.customerId ? await storage.getCustomer(order.customerId) : null;

      // Get order services
      const orderServices = await storage.getOrderServices(order.id, order.partnerId);
      
      // Get order files
      const orderFiles = await storage.getOrderFiles(order.id, order.partnerId);

      // Get editor/supplier details
      let supplier = null;
      if (order.assignedTo) {
        try {
          const editorDoc = await adminDb.collection('users').doc(order.assignedTo).get();
          if (editorDoc.exists) {
            const editorData = editorDoc.data();
            supplier = {
              id: order.assignedTo,
              studioName: editorData?.studioName || editorData?.email || 'Unknown Editor',
              email: editorData?.email
            };
          }
        } catch (err) {
          console.warn("Failed to fetch editor details:", err);
        }
      }

      // Get creator details
      let createdBy = null;
      if (order.createdBy) {
        try {
          const creatorDoc = await adminDb.collection('users').doc(order.createdBy).get();
          if (creatorDoc.exists) {
            const creatorData = creatorDoc.data();
            createdBy = {
              id: order.createdBy,
              name: creatorData?.firstName 
                ? `${creatorData.firstName} ${creatorData.lastName || ''}`.trim()
                : creatorData?.email || 'Unknown',
              email: creatorData?.email
            };
          }
        } catch (err) {
          console.warn("Failed to fetch creator details:", err);
        }
      }

      // Get editor services for pricing info
      let editorServicesMap = new Map<string, any>();
      if (order.assignedTo) {
        try {
          const editorServices = await storage.getEditorServices(order.assignedTo);
          editorServices.forEach(service => {
            editorServicesMap.set(service.id, service);
          });
        } catch (err) {
          console.warn("Failed to fetch editor services:", err);
        }
      }

      // Build services array with pricing
      const services = orderServices.map((service) => {
        const editorService = service.serviceId ? editorServicesMap.get(service.serviceId) : null;
        const unitPrice = editorService ? parseFloat(editorService.basePrice) || 0 : 0;
        const quantity = service.quantity || 1;
        
        return {
          id: service.id,
          serviceId: service.serviceId,
          name: editorService?.name || 'Unknown Service',
          quantity: quantity,
          unitPrice: unitPrice,
          total: unitPrice * quantity,
          instructions: service.instructions,
          exportTypes: service.exportTypes,
          addedBySupplier: false, // Could be enhanced to track this
        };
      });

      // Calculate totals
      const subtotal = services.reduce((sum, s) => sum + s.total, 0);
      const serviceFee = parseFloat(order.estimatedTotal) - subtotal > 0 
        ? parseFloat(order.estimatedTotal) - subtotal 
        : 0;
      const total = parseFloat(order.estimatedTotal) || subtotal;

      // Get revision status
      const revisionStatus = await storage.getOrderRevisionStatus(order.id);

      // Build response
      // Transform human_check status to processing for partner-facing view (human_check is editor-only workflow)
      const displayStatus = order.status === 'human_check' ? 'processing' : order.status;
      
      const orderDetails = {
        id: order.id,
        orderNumber: order.orderNumber,
        status: displayStatus,
        createdAt: order.createdAt,
        jobId: order.jobId,
        jobAddress: job?.address || 'No address',
        supplier,
        createdBy,
        services,
        files: orderFiles.map(file => ({
          id: file.id,
          fileName: file.fileName,
          originalName: file.originalName,
          downloadUrl: file.downloadUrl,
          fileSize: file.fileSize
        })),
        serviceFee,
        subtotal,
        total,
        revisionStatus: revisionStatus || undefined
      };

      res.json(orderDetails);
    } catch (error: any) {
      console.error("Error fetching order details:", error);
      res.status(500).json({ 
        error: "Failed to fetch order details", 
        details: error.message 
      });
    }
  });

  // Download order original files as ZIP (for partners)
  app.get("/api/orders/:orderId/files/download", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { orderId } = req.params;
      
      if (!req.user?.partnerId) {
        return res.status(400).json({ error: "User must have a partnerId" });
      }

      // Get the order - first try by ID, then by orderNumber
      let order = await storage.getOrder(orderId);
      if (!order) {
        order = await storage.getOrderByNumber(orderId, req.user.partnerId);
      }
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      // Security: Verify order belongs to user's partner
      if (order.partnerId !== req.user.partnerId) {
        return res.status(403).json({ error: "Access denied to this order" });
      }

      // Get order files
      const orderFiles = await storage.getOrderFiles(order.id, order.partnerId);

      if (!orderFiles || orderFiles.length === 0) {
        return res.status(404).json({ error: "No files found for this order" });
      }

      console.log(`[ORDER FILES DOWNLOAD] Found ${orderFiles.length} files for order ${order.orderNumber}`);

      // Create ZIP file
      const zip = new JSZip();
      const folderName = `order_${order.orderNumber.replace('#', '')}`;

      // Add files to ZIP
      for (const file of orderFiles) {
        try {
          // Validate URL is from Firebase Storage to prevent SSRF
          if (!file.downloadUrl.includes('googleapis.com') && !file.downloadUrl.includes('firebasestorage.app')) {
            console.warn(`Skipping file with invalid URL: ${file.fileName}`);
            continue;
          }

          const response = await fetch(file.downloadUrl);
          if (response.ok) {
            const buffer = await response.arrayBuffer();
            zip.file(file.originalName, buffer);
            console.log(`[ORDER FILES DOWNLOAD] Added ${file.originalName} to zip`);
          } else {
            console.error(`Failed to download file ${file.originalName} with status: ${response.status}`);
          }
        } catch (error) {
          console.error(`Error processing file ${file.originalName}:`, error);
          // Continue with other files even if one fails
        }
      }

      // Generate ZIP
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
      console.log(`[ORDER FILES DOWNLOAD] Zip generated (${zipBuffer.length} bytes)`);

      // Send ZIP file
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${folderName}_files.zip"`);
      res.setHeader('Content-Length', zipBuffer.length.toString());
      res.send(zipBuffer);

    } catch (error: any) {
      console.error("Error downloading order files:", error);
      res.status(500).json({ 
        error: "Failed to download order files", 
        details: error.message 
      });
    }
  });

  // Request revision for an order (authenticated users)
  app.post("/api/orders/:orderId/revisions/request", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { orderId } = req.params;
      const { serviceId, reason, requestText } = req.body;
      
      if (!req.user?.partnerId) {
        return res.status(400).json({ error: "User must have a partnerId" });
      }

      // Validate request
      if (!reason || !requestText) {
        return res.status(400).json({ error: "Reason and request text are required" });
      }

      // Get the order - first try by ID, then by orderNumber
      let order = await storage.getOrder(orderId);
      if (!order) {
        // Try looking up by orderNumber (e.g., "00059")
        order = await storage.getOrderByNumber(orderId, req.user.partnerId);
      }
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      // Security: Verify order belongs to user's partner
      if (order.partnerId !== req.user.partnerId) {
        return res.status(403).json({ error: "Access denied to this order" });
      }

      // Partners/photographers have unlimited revisions - no limit check here

      // Get service name for the notes
      let serviceName = "All Services";
      if (serviceId && serviceId !== "all") {
        const orderServices = await storage.getOrderServices(order.id, order.partnerId);
        const targetService = orderServices.find(s => s.id === serviceId);
        if (targetService && order.assignedTo) {
          const editorServices = await storage.getEditorServices(order.assignedTo);
          const editorService = editorServices.find(es => es.id === targetService.serviceId);
          if (editorService) {
            serviceName = editorService.name;
          }
        }
      }

      // Build revision notes
      const reasonLabels: Record<string, string> = {
        quality_issues: "Quality Issues",
        missing_requirements: "Missing Requirements",
        incorrect_format: "Incorrect Format",
        color_correction: "Color Correction Needed",
        cropping_issues: "Cropping/Framing Issues",
        object_removal: "Object Removal Incomplete",
        other: "Other"
      };
      
      const revisionNotes = `Service: ${serviceName}\nReason: ${reasonLabels[reason] || reason}\n\n${requestText}`;

      // Update order status and revision info
      const usedRounds = (order as any).usedRevisionRounds || 0;
      const updatedOrder = await storage.updateOrder(order.id, {
        status: 'in_revision',
        revisionNotes,
        usedRevisionRounds: usedRounds + 1
      });

      if (!updatedOrder) {
        return res.status(500).json({ error: "Failed to update order" });
      }

      // Get job details for notifications
      const job = order.jobId ? await storage.getJob(order.jobId) : null;
      
      // Create activity log
      try {
        await storage.createActivity({
          partnerId: req.user.partnerId,
          orderId: order.id,
          jobId: order.jobId,
          userId: req.user.uid,
          userEmail: req.user.email,
          userName: req.user.email,
          action: "revision_requested",
          category: "order",
          title: "Revision Requested",
          description: `Revision requested for Order #${order.orderNumber}`,
          metadata: JSON.stringify({
            orderNumber: order.orderNumber,
            serviceId,
            serviceName,
            reason,
            requestText,
            revisionRound: usedRounds + 1
          }),
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });
      } catch (activityError) {
        console.error("Failed to log revision request activity:", activityError);
      }

      // Create in-app notification for editor
      if (order.assignedTo) {
        try {
          const notification = insertNotificationSchema.parse({
            partnerId: order.partnerId,
            recipientId: order.assignedTo,
            type: 'revision_request',
            title: 'Revision Requested',
            body: `A revision has been requested for Order #${order.orderNumber}${job ? ` (${job.address})` : ''}`,
            orderId: order.id,
            jobId: order.jobId,
          });
          await firestoreStorage.createNotifications([notification]);
        } catch (notifyError) {
          console.error("Failed to create notification:", notifyError);
        }
      }

      // Send email notification to editor (will be handled by email service)
      if (order.assignedTo) {
        try {
          const editorDoc = await adminDb.collection('users').doc(order.assignedTo).get();
          if (editorDoc.exists) {
            const editorData = editorDoc.data();
            const editorEmail = editorData?.email;
            const editorName = editorData?.studioName || editorData?.email || 'Editor';
            
            // Get customer name
            const customer = order.customerId ? await storage.getCustomer(order.customerId) : null;
            const customerName = customer 
              ? `${customer.firstName} ${customer.lastName}`.trim()
              : 'Customer';

            if (editorEmail) {
              // Import and call email service
              const { sendRevisionRequestEmail } = await import('./email-service');
              const baseUrl = `${req.protocol}://${req.get('host')}`;
              
              await sendRevisionRequestEmail(
                editorEmail,
                editorName,
                order.orderNumber,
                revisionNotes,
                customerName,
                job?.address || 'No address',
                [serviceName],
                `${baseUrl}/editor/dashboard`
              );
            }
          }
        } catch (emailError) {
          console.error("Failed to send revision email:", emailError);
          // Don't fail the request if email fails
        }
      }

      res.json({ 
        success: true, 
        order: updatedOrder,
        message: "Revision request submitted successfully" 
      });
    } catch (error: any) {
      console.error("Error requesting revision:", error);
      res.status(500).json({ 
        error: "Failed to request revision", 
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

      // Derive customerId from job when not provided (so editors get customer editing preferences)
      let resolvedCustomerId = customerId;
      if ((resolvedCustomerId == null || resolvedCustomerId === "") && jobId) {
        const job = await storage.getJob(jobId).catch(() => null) || await storage.getJobByJobId(jobId).catch(() => null);
        if (job?.customerId) resolvedCustomerId = job.customerId;
      }

      // Calculate 14 days from now for file expiry
      const filesExpiryDate = new Date();
      filesExpiryDate.setDate(filesExpiryDate.getDate() + 14);

      // Create the main order with confirmed order number
      const order = await storage.createOrder({
        partnerId,
        jobId: jobId || null,
        customerId: resolvedCustomerId || null,
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

  // ============================================
  // Master (Franchisor) Endpoints - Read-only access to all businesses
  // ============================================

  // Get all partners/businesses (master role only)
  app.get("/api/master/partners", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      // Only master role can access this endpoint
      if (req.user?.role !== 'master') {
        return res.status(403).json({ error: "Access denied. Master role required." });
      }

      // Get all users with role 'partner' from Firestore
      const usersSnapshot = await adminDb.collection('users')
        .where('role', '==', 'partner')
        .get();

      const partners: { partnerId: string; businessName: string; email: string; firstName?: string; lastName?: string }[] = [];
      const partnerIds = new Set<string>();

      // Collect partner data
      for (const doc of usersSnapshot.docs) {
        const userData = doc.data();
        if (userData.partnerId && !partnerIds.has(userData.partnerId)) {
          partnerIds.add(userData.partnerId);
          partners.push({
            partnerId: userData.partnerId,
            businessName: userData.businessName || userData.email || 'Unknown Business',
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName
          });
        }
      }

      // Ensure the master's own business (partnerId) is included, even if they are not a 'partner' role
      const masterPartnerId = req.user?.partnerId;
      if (masterPartnerId && !partnerIds.has(masterPartnerId)) {
        try {
          // Try to find any user document for this partnerId (could be master or team member)
          const masterUsersSnapshot = await adminDb.collection('users')
            .where('partnerId', '==', masterPartnerId)
            .limit(1)
            .get();

          let email = req.user.email;
          let firstName = req.user.firstName;
          let lastName = req.user.lastName;

          if (!masterUsersSnapshot.empty) {
            const masterUserData = masterUsersSnapshot.docs[0].data() as any;
            email = masterUserData.email || email;
            firstName = masterUserData.firstName || firstName;
            lastName = masterUserData.lastName || lastName;
          }

          partners.push({
            partnerId: masterPartnerId,
            businessName: email || 'My Franchise',
            email,
            firstName,
            lastName
          });
          partnerIds.add(masterPartnerId);
        } catch (err) {
          console.warn(`[master/partners] Failed to ensure master business is included for partnerId ${masterPartnerId}:`, err);
        }
      }

      // Fetch partner settings to get proper business names
      for (const partner of partners) {
        try {
          const settingsSnapshot = await adminDb.collection('partnerSettings')
            .where('partnerId', '==', partner.partnerId)
            .limit(1)
            .get();

          if (!settingsSnapshot.empty) {
            const settings = settingsSnapshot.docs[0].data();
            if (settings.businessProfile) {
              const businessProfile = typeof settings.businessProfile === 'string' 
                ? JSON.parse(settings.businessProfile) 
                : settings.businessProfile;
              if (businessProfile.businessName) {
                partner.businessName = businessProfile.businessName;
              }
            }
          }
        } catch (err) {
          // If settings fetch fails, keep the existing name
          console.warn(`Failed to fetch settings for partner ${partner.partnerId}:`, err);
        }
      }

      // Sort by business name
      partners.sort((a, b) => a.businessName.localeCompare(b.businessName));

      res.json(partners);
    } catch (error) {
      console.error("Error fetching partners for master:", error);
      res.status(500).json({ error: "Failed to fetch partners" });
    }
  });

  // Dashboard stats - SECURED with authentication and tenant isolation
  // All stats reset at the start of each month (current month only)
  app.get("/api/dashboard/stats", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const jobs = await storage.getJobs(req.user?.partnerId);
      const orders = await storage.getOrders(req.user?.partnerId);
      const customers = await storage.getCustomers(req.user?.partnerId);

      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const startOfMonth = new Date(currentYear, currentMonth, 1);

      const isInCurrentMonth = (d: Date | string | null | undefined) => {
        if (!d) return false;
        const dt = new Date(d);
        return dt >= startOfMonth && dt.getMonth() === currentMonth && dt.getFullYear() === currentYear;
      };

      // Jobs: count only those created this month
      const jobsThisMonth = jobs.filter((j) => isInCurrentMonth(j.createdAt));
      const totalJobs = jobsThisMonth.length;

      // Orders: count only those created this month
      const ordersThisMonth = orders.filter((o) => isInCurrentMonth(o.createdAt));
      const totalOrders = ordersThisMonth.length;

      // Revenue: delivered jobs this month only (resets each month)
      const totalSalesExGst = jobs.reduce((sum, job) => {
        if (job.status?.toLowerCase() !== 'delivered') return sum;
        const deliveredDate = job.deliveredAt
          ? new Date(job.deliveredAt)
          : (job.createdAt ? new Date(job.createdAt) : null);
        if (!deliveredDate || !isInCurrentMonth(deliveredDate)) return sum;
        if (!job.billingItems) return sum;
        try {
          const billingItems = typeof job.billingItems === 'string'
            ? JSON.parse(job.billingItems)
            : job.billingItems;
          if (!Array.isArray(billingItems) || billingItems.length === 0) return sum;
          const jobRevenue = billingItems.reduce((itemSum: number, item: any) => {
            return itemSum + (parseFloat(item.amount?.toString() || "0"));
          }, 0);
          return sum + jobRevenue;
        } catch (e) {
          console.error(`Error parsing billingItems for job ${job.id}:`, e);
          return sum;
        }
      }, 0);

      // Active clients this month: distinct customers with job or order in current month
      const customerIdsThisMonth = new Set<string>();
      for (const j of jobsThisMonth) {
        if (j.customerId) customerIdsThisMonth.add(j.customerId);
      }
      for (const o of ordersThisMonth) {
        if (o.customerId) customerIdsThisMonth.add(o.customerId);
      }
      const activeClientsThisMonth = customerIdsThisMonth.size;

      res.json({
        jobs: totalJobs,
        orders: totalOrders,
        sales: totalSalesExGst.toFixed(2),
        customers: customers.length,
        activeClientsThisMonth,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  // Dashboard revenue chart - Xero P&L monthly data for Revenue Overview card
  app.get("/api/dashboard/revenue-chart", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const partnerId = req.user?.partnerId;
      if (!partnerId) return res.status(400).json({ error: "User must have a partnerId" });
      const debug = req.query.debug === "1" || req.query.debug === "true";
      const data = await xeroGetProfitAndLossMonthly(partnerId, { debug });
      res.json({ ...data, connected: true });
    } catch (e: any) {
      if (e?.message === "XERO_NOT_CONNECTED") {
        return res.json({ monthlyData: [], thisMonth: 0, connected: false });
      }
      console.error("[Dashboard revenue-chart] Xero error:", e);
      res.status(500).json({ error: "Failed to fetch revenue data" });
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

  // ============================================
  // JOB REPORTS ENDPOINTS
  // ============================================

  // Helper function to parse date range
  const parseDateRange = (dateRange: string, startDate?: string, endDate?: string): { start: Date | null; end: Date | null } => {
    const now = new Date();
    switch (dateRange) {
      case 'today':
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        return { start: todayStart, end: now };
      case 'yesterday':
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        const yesterdayEnd = new Date(yesterday);
        yesterdayEnd.setHours(23, 59, 59, 999);
        return { start: yesterday, end: yesterdayEnd };
      case 'last_7_days':
        const last7Days = new Date(now);
        last7Days.setDate(last7Days.getDate() - 7);
        return { start: last7Days, end: now };
      case 'last_30_days':
        const last30Days = new Date(now);
        last30Days.setDate(last30Days.getDate() - 30);
        return { start: last30Days, end: now };
      case 'this_month':
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        return { start: thisMonthStart, end: thisMonthEnd };
      case 'last_month':
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        return { start: lastMonthStart, end: lastMonthEnd };
      case 'this_quarter':
        const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
        const thisQuarterStart = new Date(now.getFullYear(), quarterMonth, 1);
        const thisQuarterEnd = new Date(now.getFullYear(), quarterMonth + 3, 0, 23, 59, 59, 999);
        return { start: thisQuarterStart, end: thisQuarterEnd };
      case 'this_year':
        const thisYearStart = new Date(now.getFullYear(), 0, 1);
        const thisYearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        return { start: thisYearStart, end: thisYearEnd };
      case 'custom':
        return {
          start: startDate ? new Date(startDate) : null,
          end: endDate ? new Date(endDate) : null
        };
      case 'all_time':
      default:
        return { start: null, end: null };
    }
  };

  // Helper function to get previous period for comparison
  const getPreviousPeriod = (start: Date | null, end: Date | null): { start: Date | null; end: Date | null } => {
    if (!start || !end) return { start: null, end: null };
    const duration = end.getTime() - start.getTime();
    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - duration);
    return { start: prevStart, end: prevEnd };
  };

  // Helper function to filter jobs by date range
  const filterByDateRange = <T extends { createdAt?: Date | string | null }>(
    items: T[],
    start: Date | null,
    end: Date | null
  ): T[] => {
    if (!start && !end) return items;
    return items.filter(item => {
      if (!item.createdAt) return false;
      const itemDate = new Date(item.createdAt);
      if (start && itemDate < start) return false;
      if (end && itemDate > end) return false;
      return true;
    });
  };

  // Helper function to extract keywords from revision notes
  const analyzeRevisionNotes = (orders: any[]): Array<{ reason: string; count: number; percentage: number }> => {
    const keywords: Record<string, number> = {};
    const commonKeywords = [
      'color', 'colours', 'brightness', 'exposure', 'contrast', 'saturation',
      'crop', 'cropping', 'straighten', 'align', 'alignment',
      'remove', 'object removal', 'clone', 'erase',
      'sky', 'sky replacement', 'clouds',
      'grass', 'lawn', 'green',
      'white balance', 'temperature', 'warmth',
      'sharpen', 'blur', 'noise', 'grain',
      'shadows', 'highlights', 'blacks', 'whites',
      'perspective', 'distortion', 'lens correction',
      'hdr', 'bracket', 'merge',
      'twilight', 'dusk', 'sunset',
      'virtual staging', 'furniture', 'declutter',
      'window', 'tv', 'screen', 'fire'
    ];
    
    let totalMatches = 0;
    
    orders.forEach(order => {
      if (!order.revisionNotes) return;
      const notes = order.revisionNotes.toLowerCase();
      
      commonKeywords.forEach(keyword => {
        if (notes.includes(keyword.toLowerCase())) {
          keywords[keyword] = (keywords[keyword] || 0) + 1;
          totalMatches++;
        }
      });
    });
    
    return Object.entries(keywords)
      .map(([reason, count]) => ({
        reason: reason.charAt(0).toUpperCase() + reason.slice(1),
        count,
        percentage: totalMatches > 0 ? (count / totalMatches) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  };

  // Helper function to parse job revenue from billingItems
  const getJobRevenue = (job: any): number => {
    if (!job.billingItems) return parseFloat(job.totalValue?.toString() || '0');
    try {
      const billingItems = typeof job.billingItems === 'string'
        ? JSON.parse(job.billingItems)
        : job.billingItems;
      if (!Array.isArray(billingItems)) return parseFloat(job.totalValue?.toString() || '0');
      return billingItems.reduce((sum: number, item: any) => {
        return sum + parseFloat(item.amount?.toString() || '0');
      }, 0);
    } catch {
      return parseFloat(job.totalValue?.toString() || '0');
    }
  };

  // GET /api/jobs/reports/stats - Get aggregated statistics
  app.get("/api/jobs/reports/stats", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { dateRange = 'this_month', startDate, endDate, status, customerId, photographerId, invoiceStatus, orderStatus } = req.query;
      const partnerId = req.user?.partnerId;
      
      if (!partnerId) {
        return res.status(400).json({ error: "User must have a partnerId" });
      }

      // Get all jobs and orders
      const allJobs = await storage.getJobs(partnerId);
      const allOrders = await storage.getOrders(partnerId);
      const customers = await storage.getCustomers(partnerId);

      // Parse date range
      const { start, end } = parseDateRange(
        dateRange as string,
        startDate as string | undefined,
        endDate as string | undefined
      );

      // Get previous period for comparison
      const prevPeriod = getPreviousPeriod(start, end);

      // Filter jobs
      let jobs = filterByDateRange(allJobs, start, end);
      if (status && status !== 'all') {
        jobs = jobs.filter(j => j.status === status);
      }
      if (customerId && customerId !== 'all') {
        jobs = jobs.filter(j => j.customerId === customerId);
      }
      if (photographerId && photographerId !== 'all') {
        jobs = jobs.filter(j => j.assignedTo === photographerId);
      }
      if (invoiceStatus && invoiceStatus !== 'all') {
        jobs = jobs.filter(j => j.invoiceStatus === invoiceStatus);
      }

      // Filter orders
      let orders = filterByDateRange(allOrders, start, end);
      if (orderStatus && orderStatus !== 'all') {
        orders = orders.filter(o => o.status === orderStatus);
      }

      // Previous period jobs and orders
      let prevJobs = filterByDateRange(allJobs, prevPeriod.start, prevPeriod.end);
      let prevOrders = filterByDateRange(allOrders, prevPeriod.start, prevPeriod.end);

      // Calculate job metrics
      const totalJobs = jobs.length;
      const totalRevenue = jobs.reduce((sum, job) => sum + getJobRevenue(job), 0);
      const averageJobValue = totalJobs > 0 ? totalRevenue / totalJobs : 0;
      
      const jobsByStatus: Record<string, number> = {};
      jobs.forEach(job => {
        const s = job.status || 'unknown';
        jobsByStatus[s] = (jobsByStatus[s] || 0) + 1;
      });

      const invoiceStatusBreakdown: Record<string, number> = {};
      jobs.forEach(job => {
        const s = job.invoiceStatus || 'draft';
        invoiceStatusBreakdown[s] = (invoiceStatusBreakdown[s] || 0) + 1;
      });

      const deliveredJobs = jobs.filter(j => j.status === 'delivered').length;
      const completionRate = totalJobs > 0 ? (deliveredJobs / totalJobs) * 100 : 0;

      // Calculate order metrics
      const totalOrders = orders.length;
      const ordersByStatus: Record<string, number> = {};
      orders.forEach(order => {
        const s = order.status || 'unknown';
        ordersByStatus[s] = (ordersByStatus[s] || 0) + 1;
      });

      const totalRevisions = orders.reduce((sum, o) => sum + ((o as any).usedRevisionRounds || 0), 0);
      const averageRevisionsPerOrder = totalOrders > 0 ? totalRevisions / totalOrders : 0;
      
      const ordersWithRevisions = orders.filter(o => ((o as any).usedRevisionRounds || 0) > 0).length;
      const revisionRate = totalOrders > 0 ? (ordersWithRevisions / totalOrders) * 100 : 0;
      const ordersCompletedWithoutRevisions = totalOrders - ordersWithRevisions;

      // Previous period metrics
      const prevTotalJobs = prevJobs.length;
      const prevTotalRevenue = prevJobs.reduce((sum, job) => sum + getJobRevenue(job), 0);
      const prevTotalOrders = prevOrders.length;
      const prevOrdersWithRevisions = prevOrders.filter(o => ((o as any).usedRevisionRounds || 0) > 0).length;
      const prevRevisionRate = prevTotalOrders > 0 ? (prevOrdersWithRevisions / prevTotalOrders) * 100 : 0;

      res.json({
        // Job metrics
        totalJobs,
        totalRevenue,
        averageJobValue,
        jobsByStatus,
        invoiceStatusBreakdown,
        completionRate,
        
        // Order metrics
        totalOrders,
        ordersByStatus,
        averageRevisionsPerOrder,
        revisionRate,
        ordersRequiringRevisions: ordersWithRevisions,
        ordersCompletedWithoutRevisions,
        
        // Period comparison
        periodComparison: {
          previousPeriod: {
            totalJobs: prevTotalJobs,
            totalRevenue: prevTotalRevenue,
            totalOrders: prevTotalOrders,
            revisionRate: prevRevisionRate
          }
        }
      });
    } catch (error) {
      console.error("Error fetching job reports stats:", error);
      res.status(500).json({ error: "Failed to fetch job reports stats" });
    }
  });

  // GET /api/jobs/reports/timeline - Get time-series data for charts
  app.get("/api/jobs/reports/timeline", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { dateRange = 'this_month', startDate, endDate, groupBy = 'day' } = req.query;
      const partnerId = req.user?.partnerId;
      
      if (!partnerId) {
        return res.status(400).json({ error: "User must have a partnerId" });
      }

      const allJobs = await storage.getJobs(partnerId);
      const allOrders = await storage.getOrders(partnerId);

      const { start, end } = parseDateRange(
        dateRange as string,
        startDate as string | undefined,
        endDate as string | undefined
      );

      const jobs = filterByDateRange(allJobs, start, end);
      const orders = filterByDateRange(allOrders, start, end);

      // Group data by date
      const getDateKey = (date: Date): string => {
        if (groupBy === 'month') {
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
        } else if (groupBy === 'week') {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          return weekStart.toISOString().split('T')[0];
        }
        return date.toISOString().split('T')[0];
      };

      // Jobs over time
      const jobsByDate: Record<string, number> = {};
      const revenueByDate: Record<string, number> = {};
      jobs.forEach(job => {
        if (!job.createdAt) return;
        const key = getDateKey(new Date(job.createdAt));
        jobsByDate[key] = (jobsByDate[key] || 0) + 1;
        revenueByDate[key] = (revenueByDate[key] || 0) + getJobRevenue(job);
      });

      // Orders over time
      const ordersByDate: Record<string, number> = {};
      const revisionsByDate: Record<string, number> = {};
      orders.forEach(order => {
        if (!order.createdAt) return;
        const key = getDateKey(new Date(order.createdAt));
        ordersByDate[key] = (ordersByDate[key] || 0) + 1;
        revisionsByDate[key] = (revisionsByDate[key] || 0) + ((order as any).usedRevisionRounds || 0);
      });

      // Get all unique dates and sort
      const allDates = [...new Set([
        ...Object.keys(jobsByDate),
        ...Object.keys(ordersByDate)
      ])].sort();

      // Build timeline arrays
      const jobsOverTime = allDates.map(date => ({ date, count: jobsByDate[date] || 0 }));
      const revenueOverTime = allDates.map(date => ({ date, revenue: revenueByDate[date] || 0 }));
      const ordersOverTime = allDates.map(date => ({ date, count: ordersByDate[date] || 0 }));
      const revisionsOverTime = allDates.map(date => ({ date, count: revisionsByDate[date] || 0 }));
      
      // Revision rate over time
      const revisionRateOverTime = allDates.map(date => {
        const orderCount = ordersByDate[date] || 0;
        const revisionCount = revisionsByDate[date] || 0;
        return {
          date,
          rate: orderCount > 0 ? (revisionCount / orderCount) * 100 : 0
        };
      });

      res.json({
        jobsOverTime,
        revenueOverTime,
        ordersOverTime,
        revisionsOverTime,
        revisionRateOverTime
      });
    } catch (error) {
      console.error("Error fetching job reports timeline:", error);
      res.status(500).json({ error: "Failed to fetch job reports timeline" });
    }
  });

  // GET /api/jobs/reports/breakdowns - Get breakdown data
  app.get("/api/jobs/reports/breakdowns", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { dateRange = 'this_month', startDate, endDate, status, customerId, photographerId } = req.query;
      const partnerId = req.user?.partnerId;
      
      if (!partnerId) {
        return res.status(400).json({ error: "User must have a partnerId" });
      }

      const allJobs = await storage.getJobs(partnerId);
      const allOrders = await storage.getOrders(partnerId);
      const customers = await storage.getCustomers(partnerId);
      const users = await storage.getUsers(partnerId);

      const { start, end } = parseDateRange(
        dateRange as string,
        startDate as string | undefined,
        endDate as string | undefined
      );

      let jobs = filterByDateRange(allJobs, start, end);
      let orders = filterByDateRange(allOrders, start, end);

      // Apply filters
      if (status && status !== 'all') {
        jobs = jobs.filter(j => j.status === status);
      }
      if (customerId && customerId !== 'all') {
        jobs = jobs.filter(j => j.customerId === customerId);
      }
      if (photographerId && photographerId !== 'all') {
        jobs = jobs.filter(j => j.assignedTo === photographerId);
      }

      // Top Customers
      const customerStats: Record<string, { jobCount: number; totalRevenue: number }> = {};
      jobs.forEach(job => {
        if (!job.customerId) return;
        if (!customerStats[job.customerId]) {
          customerStats[job.customerId] = { jobCount: 0, totalRevenue: 0 };
        }
        customerStats[job.customerId].jobCount++;
        customerStats[job.customerId].totalRevenue += getJobRevenue(job);
      });

      const customerMap = new Map(customers.map(c => [c.id, c]));
      const topCustomers = Object.entries(customerStats)
        .map(([customerId, stats]) => {
          const customer = customerMap.get(customerId);
          return {
            customerId,
            customerName: customer ? `${customer.firstName} ${customer.lastName}` : 'Unknown',
            ...stats
          };
        })
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, 20);

      // Top Photographers
      const photographerStats: Record<string, { jobCount: number; totalRevenue: number }> = {};
      jobs.forEach(job => {
        if (!job.assignedTo) return;
        if (!photographerStats[job.assignedTo]) {
          photographerStats[job.assignedTo] = { jobCount: 0, totalRevenue: 0 };
        }
        photographerStats[job.assignedTo].jobCount++;
        photographerStats[job.assignedTo].totalRevenue += getJobRevenue(job);
      });

      const userMap = new Map(users.map(u => [u.id, u]));
      const topPhotographers = Object.entries(photographerStats)
        .map(([userId, stats]) => {
          const user = userMap.get(userId);
          return {
            userId,
            userName: user ? `${user.firstName} ${user.lastName}` : 'Unknown',
            ...stats
          };
        })
        .sort((a, b) => b.jobCount - a.jobCount)
        .slice(0, 20);

      // Most Common Revision Reasons
      const mostCommonRevisionReasons = analyzeRevisionNotes(orders);

      // Most Common Edit Requests (from order services instructions)
      // For now, return empty array - would need to join with orderServices
      const mostCommonEditRequests: Array<{ request: string; count: number; percentage: number }> = [];

      // Orders by Editor
      const editorStats: Record<string, { orderCount: number; revisionCount: number }> = {};
      orders.forEach(order => {
        if (!order.assignedTo) return;
        if (!editorStats[order.assignedTo]) {
          editorStats[order.assignedTo] = { orderCount: 0, revisionCount: 0 };
        }
        editorStats[order.assignedTo].orderCount++;
        editorStats[order.assignedTo].revisionCount += (order as any).usedRevisionRounds || 0;
      });

      const ordersByEditor = Object.entries(editorStats)
        .map(([editorId, stats]) => ({
          editorId,
          editorName: editorId.substring(0, 8) + '...',
          orderCount: stats.orderCount,
          revisionCount: stats.revisionCount,
          revisionRate: stats.orderCount > 0 ? (stats.revisionCount / stats.orderCount) * 100 : 0
        }))
        .sort((a, b) => b.orderCount - a.orderCount)
        .slice(0, 20);

      // Revision Frequency Distribution
      const revisionCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
      orders.forEach(order => {
        const revisions = (order as any).usedRevisionRounds || 0;
        if (revisions >= 3) {
          revisionCounts[3] = (revisionCounts[3] || 0) + 1;
        } else {
          revisionCounts[revisions] = (revisionCounts[revisions] || 0) + 1;
        }
      });

      const totalOrders = orders.length;
      const revisionFrequencyDistribution = Object.entries(revisionCounts)
        .map(([count, orderCount]) => ({
          revisionCount: parseInt(count),
          orderCount,
          percentage: totalOrders > 0 ? (orderCount / totalOrders) * 100 : 0
        }))
        .sort((a, b) => a.revisionCount - b.revisionCount);

      // Orders by Status
      const orderStatusCounts: Record<string, number> = {};
      orders.forEach(order => {
        const s = order.status || 'unknown';
        orderStatusCounts[s] = (orderStatusCounts[s] || 0) + 1;
      });

      const ordersByStatus = Object.entries(orderStatusCounts)
        .map(([status, count]) => ({
          status,
          count,
          percentage: totalOrders > 0 ? (count / totalOrders) * 100 : 0
        }));

      res.json({
        topCustomers,
        topPhotographers,
        mostCommonRevisionReasons,
        mostCommonEditRequests,
        ordersByEditor,
        revisionFrequencyDistribution,
        ordersByStatus
      });
    } catch (error) {
      console.error("Error fetching job reports breakdowns:", error);
      res.status(500).json({ error: "Failed to fetch job reports breakdowns" });
    }
  });

  // GET /api/jobs/reports/performance - Get performance metrics
  app.get("/api/jobs/reports/performance", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { dateRange = 'this_month', startDate, endDate } = req.query;
      const partnerId = req.user?.partnerId;
      
      if (!partnerId) {
        return res.status(400).json({ error: "User must have a partnerId" });
      }

      const allJobs = await storage.getJobs(partnerId);
      const allOrders = await storage.getOrders(partnerId);
      const customers = await storage.getCustomers(partnerId);
      const users = await storage.getUsers(partnerId);

      const { start, end } = parseDateRange(
        dateRange as string,
        startDate as string | undefined,
        endDate as string | undefined
      );

      const jobs = filterByDateRange(allJobs, start, end);
      const orders = filterByDateRange(allOrders, start, end);

      // Average Turnaround Time (job creation to delivery)
      const deliveredJobs = jobs.filter(j => j.status === 'delivered' && j.deliveredAt && j.createdAt);
      const turnaroundTimes = deliveredJobs.map(job => {
        const created = new Date(job.createdAt!);
        const delivered = new Date(job.deliveredAt!);
        return (delivered.getTime() - created.getTime()) / (1000 * 60 * 60 * 24); // days
      });
      const averageTurnaroundTime = turnaroundTimes.length > 0
        ? turnaroundTimes.reduce((a, b) => a + b, 0) / turnaroundTimes.length
        : 0;

      // On-Time Delivery Rate
      const jobsWithDueDate = jobs.filter(j => j.status === 'delivered' && j.dueDate && j.deliveredAt);
      const onTimeDeliveries = jobsWithDueDate.filter(job => {
        const dueDate = new Date(job.dueDate!);
        const deliveredAt = new Date(job.deliveredAt!);
        return deliveredAt <= dueDate;
      });
      const onTimeDeliveryRate = jobsWithDueDate.length > 0
        ? (onTimeDeliveries.length / jobsWithDueDate.length) * 100
        : 100; // Default to 100% if no due dates

      // Revenue per Customer
      const totalRevenue = jobs.reduce((sum, job) => sum + getJobRevenue(job), 0);
      const uniqueCustomers = new Set(jobs.map(j => j.customerId).filter(Boolean));
      const revenuePerCustomer = uniqueCustomers.size > 0 ? totalRevenue / uniqueCustomers.size : 0;

      // Jobs per Photographer
      const uniquePhotographers = new Set(jobs.map(j => j.assignedTo).filter(Boolean));
      const jobsPerPhotographer = uniquePhotographers.size > 0 ? jobs.length / uniquePhotographers.size : 0;

      // Average Order Processing Time
      const completedOrders = orders.filter(o => o.status === 'completed' && o.approvedAt && o.createdAt);
      const processingTimes = completedOrders.map(order => {
        const created = new Date(order.createdAt!);
        const approved = new Date(order.approvedAt!);
        return (approved.getTime() - created.getTime()) / (1000 * 60 * 60 * 24); // days
      });
      const averageOrderProcessingTime = processingTimes.length > 0
        ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
        : 0;

      // Orders Completed on First Try Rate
      const ordersWithoutRevisions = orders.filter(o => ((o as any).usedRevisionRounds || 0) === 0);
      const ordersCompletedOnFirstTryRate = orders.length > 0
        ? (ordersWithoutRevisions.length / orders.length) * 100
        : 100;

      // Editor Performance
      const editorStats: Record<string, { ordersCompleted: number; revisions: number; processingTimes: number[] }> = {};
      completedOrders.forEach(order => {
        if (!order.assignedTo) return;
        if (!editorStats[order.assignedTo]) {
          editorStats[order.assignedTo] = { ordersCompleted: 0, revisions: 0, processingTimes: [] };
        }
        editorStats[order.assignedTo].ordersCompleted++;
        editorStats[order.assignedTo].revisions += (order as any).usedRevisionRounds || 0;
        if (order.approvedAt && order.createdAt) {
          const days = (new Date(order.approvedAt).getTime() - new Date(order.createdAt).getTime()) / (1000 * 60 * 60 * 24);
          editorStats[order.assignedTo].processingTimes.push(days);
        }
      });

      const editorPerformance = Object.entries(editorStats)
        .map(([editorId, stats]) => ({
          editorId,
          editorName: editorId.substring(0, 8) + '...',
          ordersCompleted: stats.ordersCompleted,
          revisionRate: stats.ordersCompleted > 0 ? (stats.revisions / stats.ordersCompleted) * 100 : 0,
          averageProcessingTime: stats.processingTimes.length > 0
            ? stats.processingTimes.reduce((a, b) => a + b, 0) / stats.processingTimes.length
            : 0
        }))
        .sort((a, b) => b.ordersCompleted - a.ordersCompleted)
        .slice(0, 20);

      // Peak Days
      const dayOfWeekCounts: Record<string, number> = {
        'Sunday': 0, 'Monday': 0, 'Tuesday': 0, 'Wednesday': 0,
        'Thursday': 0, 'Friday': 0, 'Saturday': 0
      };
      jobs.forEach(job => {
        if (!job.createdAt) return;
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const day = dayNames[new Date(job.createdAt).getDay()];
        dayOfWeekCounts[day]++;
      });
      const peakDays = Object.entries(dayOfWeekCounts)
        .map(([day, count]) => ({ day, count }))
        .sort((a, b) => b.count - a.count);

      // Peak Times (hours)
      const hourCounts: Record<number, number> = {};
      jobs.forEach(job => {
        if (!job.createdAt) return;
        const hour = new Date(job.createdAt).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      });
      const peakTimes = Object.entries(hourCounts)
        .map(([hour, count]) => ({ hour: parseInt(hour), count }))
        .sort((a, b) => b.count - a.count);

      res.json({
        averageTurnaroundTime,
        onTimeDeliveryRate,
        revenuePerCustomer,
        jobsPerPhotographer,
        averageOrderProcessingTime,
        ordersCompletedOnFirstTryRate,
        editorPerformance,
        peakDays,
        peakTimes
      });
    } catch (error) {
      console.error("Error fetching job reports performance:", error);
      res.status(500).json({ error: "Failed to fetch job reports performance" });
    }
  });

  // GET /api/reports/revenue/overview - Revenue overview (Xero P&L + internal metrics + invoice breakdown)
  app.get("/api/reports/revenue/overview", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { dateRange = "this_month", startDate, endDate } = req.query;
      const partnerId = req.user?.partnerId;
      if (!partnerId) return res.status(400).json({ error: "User must have a partnerId" });

      const { start, end } = parseDateRange(
        dateRange as string,
        startDate as string | undefined,
        endDate as string | undefined
      );

      const allJobs = await storage.getJobs(partnerId);
      const allOrders = await storage.getOrders(partnerId);
      let jobs = filterByDateRange(allJobs, start, end);
      let orders = filterByDateRange(allOrders, start, end);
      orders = orders.filter((o: any) => o.status !== "cancelled");

      const jobRevenue = jobs.reduce((sum: number, job: any) => sum + getJobRevenue(job), 0);
      const totalEditingSpend = orders.reduce((sum: number, o: any) => sum + parseFloat(o.estimatedTotal || "0"), 0);
      const grossMargin = jobRevenue - totalEditingSpend;

      const invoiceStatusBreakdown: Record<string, number> = {};
      let noInvoiceCount = 0;
      jobs.forEach((job: any) => {
        if (!(job as any).xeroInvoiceId) {
          noInvoiceCount++;
        } else {
          const s = job.invoiceStatus || "draft";
          invoiceStatusBreakdown[s] = (invoiceStatusBreakdown[s] || 0) + 1;
        }
      });
      if (noInvoiceCount > 0) invoiceStatusBreakdown.no_invoice = noInvoiceCount;

      const fromStr = start ? start.toISOString().slice(0, 10) : new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
      const toStr = end ? end.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
      let xero: {
        totalIncome: number;
        totalExpenses: number;
        operatingExpenses: number;
        netProfit: number;
        averageOrder: number;
        fromDate: string;
        toDate: string;
      } | null = null;
      try {
        const pl = await xeroGetProfitAndLoss(partnerId, fromStr, toStr, { standardLayout: true });
        let invoiceCount = 0;
        try {
          invoiceCount = await xeroGetInvoiceCount(partnerId, fromStr, toStr);
        } catch (e) {
          // non-fatal; average order will be 0
        }
        const averageOrder = invoiceCount > 0 ? pl.totalIncome / invoiceCount : 0;
        xero = {
          totalIncome: pl.totalIncome,
          totalExpenses: pl.totalExpenses,
          operatingExpenses: pl.operatingExpenses,
          netProfit: pl.netProfit,
          averageOrder,
          fromDate: pl.fromDate,
          toDate: pl.toDate,
        };
      } catch (e: any) {
        if (e?.message !== "XERO_NOT_CONNECTED") console.error("[Revenue overview] Xero P&L error:", e);
      }

      res.json({
        xero,
        jobRevenue,
        totalEditingSpend,
        grossMargin,
        invoiceStatusBreakdown,
        jobCount: jobs.length,
        orderCount: orders.length,
        fromDate: fromStr,
        toDate: toStr,
      });
    } catch (error) {
      console.error("Error fetching revenue overview:", error);
      res.status(500).json({ error: "Failed to fetch revenue overview" });
    }
  });

  // GET /api/reports/revenue/jobs-by-invoice - List jobs filterable by invoice status
  app.get("/api/reports/revenue/jobs-by-invoice", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { startDate, endDate, invoiceStatus = "all", limit = "100" } = req.query;
      const partnerId = req.user?.partnerId;
      if (!partnerId) return res.status(400).json({ error: "User must have a partnerId" });

      const start = startDate && typeof startDate === "string" ? new Date(startDate) : null;
      const end = endDate && typeof endDate === "string" ? new Date(endDate) : null;
      const lim = Math.min(parseInt(String(limit), 10) || 100, 200);

      const allJobs = await storage.getJobs(partnerId);
      let jobs = start || end ? filterByDateRange(allJobs, start, end) : allJobs;

      const statusFilter = typeof invoiceStatus === "string" ? invoiceStatus : "all";
      if (statusFilter === "no_invoice") {
        jobs = jobs.filter((j: any) => !(j as any).xeroInvoiceId);
      } else if (statusFilter !== "all") {
        jobs = jobs.filter((j: any) => (j.invoiceStatus || "draft") === statusFilter);
      }

      const customers = await storage.getCustomers(partnerId);
      const customerMap = new Map(customers.map((c: any) => [c.id, c]));

      const list = jobs.slice(0, lim).map((job: any) => {
        const customer = job.customerId ? customerMap.get(job.customerId) : null;
        const customerName = customer
          ? [customer.firstName, customer.lastName].filter(Boolean).join(" ") || (customer as any).company || "—"
          : "—";
        return {
          id: job.id,
          jobId: job.jobId,
          jobName: job.jobName,
          address: job.address,
          customerId: job.customerId,
          customerName,
          status: job.status,
          invoiceStatus: job.xeroInvoiceId ? (job.invoiceStatus || "draft") : "no_invoice",
          xeroInvoiceId: job.xeroInvoiceId ?? null,
          totalValue: job.totalValue,
          revenue: getJobRevenue(job),
          deliveredAt: job.deliveredAt,
          createdAt: job.createdAt,
          appointmentDate: job.appointmentDate,
        };
      });

      res.json({ jobs: list, total: jobs.length });
    } catch (error) {
      console.error("Error fetching jobs by invoice:", error);
      res.status(500).json({ error: "Failed to fetch jobs by invoice status" });
    }
  });

  // ============================================
  // END JOB REPORTS ENDPOINTS
  // ============================================

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
      // Transform human_check status to processing for partner-facing view
      const ordersWithJobData = await Promise.all(
        filteredOrders.map(async (order) => {
          // Transform human_check to processing for partner view (human_check is editor-only workflow)
          const displayStatus = order.status === 'human_check' ? 'processing' : order.status;
          
          if (order.jobId) {
            // order.jobId may be the Job internal id or external job.jobId
            const job = (await storage.getJob(order.jobId)) || (await storage.getJobByJobId(order.jobId));
            return {
              ...order,
              status: displayStatus,
              jobAddress: job?.address || "Unknown Address"
            };
          }
          return {
            ...order,
            status: displayStatus,
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

  // Delete all notifications endpoint
  app.delete("/api/notifications/delete-all", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Only delete notifications for the authenticated user with proper tenant scoping
      await firestoreStorage.deleteAllNotifications(req.user.uid, req.user.partnerId || '');

      res.json({ message: "All notifications deleted" });
    } catch (error) {
      console.error("Failed to delete all notifications:", error);
      res.status(500).json({ error: "Failed to delete all notifications" });
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

      // Resolve job (order.jobId may be document id or human-readable jobId) for customer editing preferences
      let job = order.jobId ? await storage.getJob(order.jobId).catch(() => null) : null;
      if (!job && order.jobId) {
        job = await storage.getJobByJobId(order.jobId).catch(() => null) ?? null;
      }
      const customerId = order.customerId || job?.customerId;
      let editingPreferencesText = '';
      if (customerId && order.partnerId) {
        try {
          const [options, preferences] = await Promise.all([
            storage.getEditingOptions(order.partnerId),
            storage.getCustomerEditingPreferences(customerId)
          ]);
          const enabled = options.map((option: any) => {
            const pref = preferences.find((p: any) => p.editingOptionId === option.id);
            return { name: option.name, description: option.description, isEnabled: pref?.isEnabled ?? false, notes: pref?.notes };
          }).filter((p: any) => p.isEnabled);
          if (enabled.length > 0) {
            editingPreferencesText += `CUSTOMER EDITING PREFERENCES\n`;
            editingPreferencesText += `${'='.repeat(40)}\n\n`;
            enabled.forEach((p: any) => {
              editingPreferencesText += `• ${p.name}\n`;
              if (p.description) editingPreferencesText += `  ${String(p.description).replace(/\n/g, '\n  ')}\n`;
              if (p.notes) editingPreferencesText += `  Notes: ${String(p.notes).replace(/\n/g, '\n  ')}\n`;
              editingPreferencesText += '\n';
            });
          }
        } catch (prefErr) {
          console.error("Error fetching customer editing preferences for download:", prefErr);
        }
      }

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

      // Build INSTRUCTIONS.txt (order + services + customer editing preferences)
      let instructionsContent = `ORDER: ${orderNumber}\n`;
      instructionsContent += `========================================\n\n`;

      if (orderServices && orderServices.length > 0) {
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
      }

      // Append customer editing preferences (from customer profile in partner dashboard)
      if (editingPreferencesText) {
        instructionsContent += editingPreferencesText;
      }

      zip.file(`${folderName}/INSTRUCTIONS.txt`, instructionsContent);

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

      // Update order status from pending to processing when files are downloaded
      if (order.status === 'pending') {
        try {
          await storage.updateOrder(order.id, { status: 'processing' });
          console.log(`[DOWNLOAD] Updated order ${order.orderNumber} status from pending to processing`);
        } catch (statusError) {
          console.error("Failed to update order status:", statusError);
          // Don't fail the download if status update fails
        }
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

      // Customer editing preferences for INSTRUCTIONS.txt
      const customerIdLegacy = order.customerId || job.customerId;
      let editingPreferencesTextLegacy = '';
      if (customerIdLegacy && order.partnerId) {
        try {
          const [optionsLegacy, preferencesLegacy] = await Promise.all([
            storage.getEditingOptions(order.partnerId),
            storage.getCustomerEditingPreferences(customerIdLegacy)
          ]);
          const enabledLegacy = optionsLegacy.map((option: any) => {
            const pref = preferencesLegacy.find((p: any) => p.editingOptionId === option.id);
            return { name: option.name, description: option.description, isEnabled: pref?.isEnabled ?? false, notes: pref?.notes };
          }).filter((p: any) => p.isEnabled);
          if (enabledLegacy.length > 0) {
            editingPreferencesTextLegacy += `CUSTOMER EDITING PREFERENCES\n`;
            editingPreferencesTextLegacy += `${'='.repeat(40)}\n\n`;
            enabledLegacy.forEach((p: any) => {
              editingPreferencesTextLegacy += `• ${p.name}\n`;
              if (p.description) editingPreferencesTextLegacy += `  ${String(p.description).replace(/\n/g, '\n  ')}\n`;
              if (p.notes) editingPreferencesTextLegacy += `  Notes: ${String(p.notes).replace(/\n/g, '\n  ')}\n`;
              editingPreferencesTextLegacy += '\n';
            });
          }
        } catch (prefErr) {
          console.error("Error fetching customer editing preferences for job download:", prefErr);
        }
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

      // Build INSTRUCTIONS.txt (order + services + customer editing preferences)
      let instructionsContentLegacy = `ORDER: ${order.orderNumber}\n`;
      instructionsContentLegacy += `========================================\n\n`;

      if (orderServices.length > 0) {
        orderServices.forEach((service, index) => {
          instructionsContentLegacy += `SERVICE ${index + 1}: ${service.serviceName || 'General Editing'}\n`;
          instructionsContentLegacy += `${'='.repeat(40)}\n\n`;
          
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
                  instructionsContentLegacy += `File ${instIndex + 1}: ${inst.fileName || 'N/A'}\n`;
                  if (inst.detail) {
                    const cleanDetail = stripHtml(inst.detail);
                    instructionsContentLegacy += `  Instructions: ${cleanDetail}\n`;
                  }
                  instructionsContentLegacy += '\n';
                });
              } else if (typeof instructions === 'string') {
                const cleanInstructions = stripHtml(instructions);
                instructionsContentLegacy += `${cleanInstructions}\n\n`;
              } else {
                instructionsContentLegacy += `${JSON.stringify(instructions, null, 2)}\n\n`;
              }
            } catch (e) {
              // If parsing fails, try to strip HTML from raw string
              const cleanInstructions = stripHtml(String(service.instructions));
              instructionsContentLegacy += `${cleanInstructions}\n\n`;
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
              
              instructionsContentLegacy += `Export Types:\n`;
              if (Array.isArray(exportTypes)) {
                exportTypes.forEach(exp => {
                  instructionsContentLegacy += `  • ${exp.type || 'N/A'}: ${exp.description || 'N/A'}\n`;
                });
              } else {
                instructionsContentLegacy += `  ${JSON.stringify(exportTypes)}\n`;
              }
              instructionsContentLegacy += '\n';
            } catch (e) {
              instructionsContentLegacy += `Export Types: ${service.exportTypes}\n\n`;
            }
          }
          
          // Add notes if any
          if (service.notes) {
            const cleanNotes = stripHtml(String(service.notes));
            instructionsContentLegacy += `Notes:\n${cleanNotes}\n\n`;
          }
          
          instructionsContentLegacy += '\n';
        });
      }

      if (editingPreferencesTextLegacy) {
        instructionsContentLegacy += editingPreferencesTextLegacy;
      }

      zip.file('INSTRUCTIONS.txt', instructionsContentLegacy);

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
          expiresAt: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)), // 30 days from now
          status: 'completed' // Editor deliverables are completed files
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

      // Update order status to human_check when editor uploads completed work
      // This moves the order to the Human Check stage for QC review
      if (order.status === 'processing' || order.status === 'in_revision') {
        try {
          await storage.updateOrder(order.id, { status: 'human_check' });
          console.log(`[UPLOAD] Updated order ${order.orderNumber} status from ${order.status} to human_check`);
        } catch (statusError) {
          console.error("Failed to update order status:", statusError);
          // Don't fail the upload if status update fails
        }
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

  // ===== EDITOR FOLDER MANAGEMENT ENDPOINTS =====

  // Get folders for a job (editor version - validates editor assignment)
  app.get("/api/editor/jobs/:jobId/folders", async (req, res) => {
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
        return res.status(403).json({ error: "Only editors can access folders" });
      }

      // Find the job
      const job = await storage.getJobByJobId(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Verify editor is assigned to this job through an order
      const editorOrders = await storage.getOrdersForEditor(uid);
      const assignedOrder = editorOrders.find(o => o.jobId === job.id || o.jobId === job.jobId);
      if (!assignedOrder) {
        return res.status(403).json({ error: "You are not assigned to this job" });
      }

      // Get folders for this job
      const allFolders = await storage.getUploadFolders(job.id);

      console.log(`[EDITOR FOLDERS] Found ${allFolders.length} total folders for job ${jobId}. Assigned order: ${assignedOrder.id} (${assignedOrder.orderNumber})`);
      allFolders.forEach(f => {
        console.log(`[EDITOR FOLDERS] Folder: ${f.partnerFolderName || f.editorFolderName}, orderId: ${f.orderId}, matches: ${f.orderId === assignedOrder.id}, noOrderId: ${!f.orderId}`);
      });

      // Filter folders to only show those associated with this editor's assigned order
      // Folders can be associated with an order via orderId field
      const filteredFolders = allFolders.filter(folder => {
        // Include folder if it belongs to this order OR has no orderId (legacy folders)
        // Handle both null and undefined as "no orderId"
        const hasNoOrderId = folder.orderId === null || folder.orderId === undefined;
        return folder.orderId === assignedOrder.id || hasNoOrderId;
      });

      console.log(`[EDITOR FOLDERS] Returning ${filteredFolders.length} of ${allFolders.length} folders for job ${jobId}, order ${assignedOrder.orderNumber} to editor ${uid}`);

      // Return folders with actual Firebase download URLs
      const foldersWithDownloadUrls = filteredFolders.map(folder => ({
        ...folder,
        files: folder.files.map(file => ({
          ...file,
          downloadUrl: file.downloadUrl
        }))
      }));

      res.json(foldersWithDownloadUrls);
    } catch (error: any) {
      console.error("Error fetching editor folders:", error);
      res.status(500).json({ 
        error: "Failed to fetch folders", 
        details: error.message 
      });
    }
  });

  // Create folder for a job (editor version - validates editor assignment)
  app.post("/api/editor/jobs/:jobId/folders", async (req, res) => {
    try {
      const { jobId } = req.params;
      const { editorFolderName, folderPath, parentFolderPath } = req.body;

      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: "Authorization header required" });
      }

      const idToken = authHeader.replace('Bearer ', '');
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      const uid = decodedToken.uid;
      const currentUser = await getUserDocument(uid);
      if (!currentUser || currentUser.role !== 'editor') {
        return res.status(403).json({ error: "Only editors can create folders" });
      }

      if (!editorFolderName) {
        return res.status(400).json({ error: "editorFolderName is required" });
      }

      // Find the job
      const job = await storage.getJobByJobId(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Verify editor is assigned to this job through an order
      const editorOrders = await storage.getOrdersForEditor(uid);
      const assignedOrder = editorOrders.find(o => o.jobId === job.id || o.jobId === job.jobId);
      if (!assignedOrder) {
        return res.status(403).json({ error: "You are not assigned to this job" });
      }

      // Generate unique standalone token for this folder
      const folderToken = nanoid(10);

      console.log(`[EDITOR CREATE FOLDER] Name: ${editorFolderName}, Parent: ${parentFolderPath || 'root'}, Token: ${folderToken}, JobId: ${job.id}, OrderId: ${assignedOrder.id}`);

      // Create the folder in storage
      // Use folderPath if provided, otherwise use editorFolderName
      const finalFolderPath = folderPath || (parentFolderPath ? `${parentFolderPath}/${editorFolderName}` : editorFolderName);
      const createdFolder = await storage.createFolder(job.id, editorFolderName, parentFolderPath, assignedOrder.id, folderToken);

      // Create a Firebase placeholder to establish the folder in Firebase Storage
      const bucketName = (process.env.FIREBASE_STORAGE_BUCKET || '').replace(/['"]/g, '').trim();
      if (!bucketName) {
        throw new Error('FIREBASE_STORAGE_BUCKET environment variable not set');
      }

      const bucket = getStorage().bucket(bucketName);

      // Build Firebase Storage path
      let firebaseFolderPath: string;
      if (parentFolderPath) {
        firebaseFolderPath = `completed/${jobId}/${parentFolderPath}/${folderToken}/.placeholder`;
      } else {
        firebaseFolderPath = `completed/${jobId}/${folderToken}/.placeholder`;
      }

      // Create a placeholder file in the folder to establish it
      const placeholderFile = bucket.file(firebaseFolderPath);
      await placeholderFile.save('', {
        metadata: {
          contentType: 'text/plain',
          metadata: {
            isPlaceholder: 'true',
            folderToken: folderToken,
            editorFolderName: editorFolderName,
            createdBy: uid,
            createdAt: new Date().toISOString()
          }
        }
      });

      res.json({
        success: true,
        folder: {
          ...createdFolder,
          folderToken
        },
        message: `Folder "${editorFolderName}" created successfully`
      });
    } catch (error: any) {
      console.error("Error creating editor folder:", error);
      res.status(500).json({ 
        error: "Failed to create folder", 
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

  // ===== QC (Quality Control) ENDPOINTS =====

  // Mark order as complete - move to human_check for QC review
  app.post("/api/editor/orders/:orderId/mark-complete", async (req, res) => {
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
        return res.status(403).json({ error: "Only editors can mark orders as complete" });
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

      // Verify order is in processing or in_revision status
      if (order.status !== 'processing' && order.status !== 'in_revision') {
        return res.status(400).json({ error: `Order cannot be marked complete from ${order.status} status` });
      }

      // Update order to human_check status for QC review
      const updatedOrder = await storage.updateOrder(orderId, {
        status: 'human_check'
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
          action: "mark_complete",
          category: "order",
          title: "Order Marked Complete",
          description: `Order #${order.orderNumber} marked complete and sent for QC review`,
          metadata: JSON.stringify({
            orderNumber: order.orderNumber,
            previousStatus: order.status,
            newStatus: 'human_check',
            markedBy: uid,
            markedAt: new Date().toISOString()
          }),
          ipAddress: req.ip || req.socket.remoteAddress || '',
          userAgent: req.headers['user-agent'] || ''
        });
      } catch (activityError) {
        console.error("[ACTIVITY] Failed to log mark complete:", activityError);
      }

      res.json({
        success: true,
        order: updatedOrder,
        message: "Order marked complete and sent for QC review"
      });
    } catch (error: any) {
      console.error("Error marking order complete:", error);
      res.status(500).json({ 
        error: "Failed to mark order complete", 
        details: error.message 
      });
    }
  });

  // Get QC files and data for an order
  app.get("/api/editor/orders/:orderId/qc/files", async (req, res) => {
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
        return res.status(403).json({ error: "Only editors can access QC" });
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

      // Verify order is in human_check status
      if (order.status !== 'human_check') {
        return res.status(400).json({ error: `Order is not in QC stage (current: ${order.status})` });
      }

      // Get job info (order.jobId may be document id or human-readable jobId)
      let job = order.jobId ? await storage.getJob(order.jobId).catch(() => null) : null;
      if (!job && order.jobId) {
        job = await storage.getJobByJobId(order.jobId).catch(() => null) ?? null;
      }

      // Get uploaded files for this order
      const uploads = await storage.getEditorUploadsForOrder(orderId);

      // Get file comments
      const comments = await storage.getFileCommentsForOrder(orderId);

      // Get folder metadata from folders collection to get proper display names
      // This is needed because editorUploads may not have the folder name, but folders collection does
      let folderNameMap = new Map<string, string>();
      if (job?.id) {
        try {
          const { adminDb } = await import('./firebase-admin');
          
          // Query by jobId
          const foldersSnapshot = await adminDb.collection("folders")
            .where("jobId", "==", job.id)
            .get();
          
          console.log('[QC FILES] Found', foldersSnapshot.docs.length, 'folders for jobId:', job.id);
          
          foldersSnapshot.docs.forEach(doc => {
            const data = doc.data();
            const folderPath = data.folderPath;
            const displayName = data.editorFolderName || data.partnerFolderName;
            
            console.log('[QC FILES] Folder doc:', {
              docId: doc.id,
              folderPath,
              folderToken: data.folderToken,
              editorFolderName: data.editorFolderName,
              partnerFolderName: data.partnerFolderName,
              displayName
            });
            
            if (displayName) {
              // Map all possible keys that might be used
              if (folderPath) {
                folderNameMap.set(folderPath, displayName);
              }
              if (data.folderToken) {
                // Map the token directly
                folderNameMap.set(data.folderToken, displayName);
                // Map with folders/ prefix
                folderNameMap.set(`folders/${data.folderToken}`, displayName);
                // Also try without any prefix in case folderPath in uploads is just the token
              }
            }
          });
          
          // Also query by orderId in case folders are linked to order, not job
          const orderFoldersSnapshot = await adminDb.collection("folders")
            .where("orderId", "==", orderId)
            .get();
          
          console.log('[QC FILES] Found', orderFoldersSnapshot.docs.length, 'folders for orderId:', orderId);
          
          orderFoldersSnapshot.docs.forEach(doc => {
            const data = doc.data();
            const folderPath = data.folderPath;
            const displayName = data.editorFolderName || data.partnerFolderName;
            
            if (displayName) {
              if (folderPath) {
                folderNameMap.set(folderPath, displayName);
              }
              if (data.folderToken) {
                folderNameMap.set(data.folderToken, displayName);
                folderNameMap.set(`folders/${data.folderToken}`, displayName);
              }
            }
          });
          
          console.log('[QC FILES] Final folder name map keys:', Array.from(folderNameMap.keys()));
          
          // If no folders found in folders collection, try to extract names from placeholder files
          // Older folders might not have entries in folders collection but have placeholder files
          if (folderNameMap.size === 0) {
            console.log('[QC FILES] No folders found in folders collection, checking for placeholder files...');
            const placeholderSnapshot = await adminDb.collection("editorUploads")
              .where("jobId", "==", job.id)
              .where("fileName", "==", ".folder_placeholder")
              .get();
            
            console.log('[QC FILES] Found', placeholderSnapshot.docs.length, 'placeholder files');
            
            placeholderSnapshot.docs.forEach(doc => {
              const data = doc.data();
              const displayName = data.editorFolderName || data.partnerFolderName;
              if (displayName && data.folderPath) {
                folderNameMap.set(data.folderPath, displayName);
              }
              if (displayName && data.folderToken) {
                folderNameMap.set(data.folderToken, displayName);
                folderNameMap.set(`folders/${data.folderToken}`, displayName);
              }
            });
          }
        } catch (folderLookupErr) {
          console.error('[QC FILES] Error looking up folder names:', folderLookupErr);
        }
      }

      // Get order services with instructions for QC verification
      const orderServices = await storage.getOrderServices(orderId, order.partnerId);
      
      // Enrich services with editor service details (name, description)
      const enrichedServices = await Promise.all(
        orderServices.map(async (service) => {
          const editorService = await storage.getEditorService(service.serviceId);
          return {
            id: service.id,
            serviceId: service.serviceId,
            serviceName: editorService?.name || 'Unknown Service',
            serviceDescription: editorService?.description || null,
            quantity: service.quantity,
            instructions: service.instructions, // JSON string of instruction pairs
            exportTypes: service.exportTypes, // JSON string of export types
            createdAt: service.createdAt,
          };
        })
      );

      // Helper to check if a string looks like a random token (nanoid-style)
      const looksLikeToken = (str: string): boolean => {
        if (!str || str.length < 8 || str.length > 25) return false;
        // Tokens are purely alphanumeric with no spaces or common patterns
        if (!/^[a-zA-Z0-9_-]+$/.test(str)) return false;
        // Check for common folder name keywords - if present, it's likely a real name
        if (/photo|image|video|floor|plan|virtual|tour|edit|raw|file|folder|high|low|res|final|draft|web|print|social|hdr|mls|deliver|complet/i.test(str)) {
          return false;
        }
        // Check vowel ratio - real words have 15-50% vowels, random strings often don't
        const vowelCount = (str.match(/[aeiouAEIOU]/g) || []).length;
        const vowelRatio = vowelCount / str.length;
        if (vowelRatio >= 0.15 && vowelRatio <= 0.5) return false;
        // Check for camelCase or PascalCase (indicates real naming)
        if (/[a-z][A-Z]/.test(str)) return false;
        return true;
      };

      // Helper to extract a display-friendly folder name
      const extractFolderDisplayName = (editorName: string | null | undefined, partnerName: string | null | undefined, path: string, folderToken?: string | null): string => {
        // Priority 0: Look up in folder name map (most reliable source)
        if (path && folderNameMap.has(path)) {
          return folderNameMap.get(path)!;
        }
        if (folderToken && folderNameMap.has(folderToken)) {
          return folderNameMap.get(folderToken)!;
        }
        if (folderToken && folderNameMap.has(`folders/${folderToken}`)) {
          return folderNameMap.get(`folders/${folderToken}`)!;
        }
        
        // Priority 1: Use editorFolderName if it's a real name (not a path, not a token)
        if (editorName && !editorName.includes('/') && !looksLikeToken(editorName)) {
          return editorName;
        }
        // Priority 2: Use partnerFolderName if it's a real name
        if (partnerName && !partnerName.includes('/') && !looksLikeToken(partnerName)) {
          return partnerName;
        }
        // Priority 3: If editorFolderName is a path, extract meaningful segments
        if (editorName && editorName.includes('/')) {
          const segments = editorName.split('/').filter(s => s && !looksLikeToken(s) && s !== 'folders');
          if (segments.length > 0) {
            return segments[segments.length - 1];
          }
        }
        // Priority 4: Extract meaningful segment from folderPath (skip tokens and 'folders' prefix)
        if (path && path !== 'Root') {
          const segments = path.split('/').filter(s => s && !looksLikeToken(s) && s !== 'folders');
          if (segments.length > 0) {
            return segments[segments.length - 1];
          }
        }
        // Fallback: return "Files" if we couldn't find a good name
        return 'Files';
      };

      // Organize uploads into folder hierarchy for QC display
      const folderHierarchy = uploads.reduce((acc, upload) => {
        const folderPath = upload.folderPath || 'Root';
        const folderName = extractFolderDisplayName(
          upload.editorFolderName, 
          upload.partnerFolderName, 
          folderPath, 
          upload.folderToken
        );
        
        // Debug logging for folder name resolution
        console.log('[QC FILES] Upload folder resolution:', {
          uploadId: upload.id,
          folderPath,
          folderToken: upload.folderToken,
          editorFolderName: upload.editorFolderName,
          partnerFolderName: upload.partnerFolderName,
          resolvedName: folderName,
          mapHasPath: folderNameMap.has(folderPath),
          mapHasToken: upload.folderToken ? folderNameMap.has(upload.folderToken) : false
        });
        
        if (!acc[folderPath]) {
          acc[folderPath] = {
            folderPath,
            folderName,
            files: []
          };
        }
        acc[folderPath].files.push(upload);
        return acc;
      }, {} as Record<string, { folderPath: string; folderName: string; files: typeof uploads }>);
      
      const folders = Object.values(folderHierarchy).sort((a, b) => 
        a.folderPath.localeCompare(b.folderPath)
      );

      // Customer editing preferences (from customer profile in partner dashboard)
      let editingPreferences: any[] = [];
      const customerId = order.customerId || job?.customerId;
      if (customerId && order.partnerId) {
        try {
          const [options, preferences] = await Promise.all([
            storage.getEditingOptions(order.partnerId),
            storage.getCustomerEditingPreferences(customerId)
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
          console.error("Error fetching customer editing preferences for QC order:", orderId, prefErr);
        }
      }

      res.json({
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          partnerId: order.partnerId,
          jobId: order.jobId,
          customerId: order.customerId,
          assignedTo: order.assignedTo,
          createdAt: order.createdAt,
          revisionNotes: (order as any).revisionNotes || null,
          usedRevisionRounds: (order as any).usedRevisionRounds || 0,
          maxRevisionRounds: (order as any).maxRevisionRounds || 2,
        },
        job: job ? {
          id: job.id,
          jobId: job.jobId,
          address: job.address,
          customerName: job.customerName,
        } : null,
        uploads: uploads || [],
        folders: folders, // Files organized by folder
        services: enrichedServices, // Order services with instructions
        comments: comments || [],
        editingPreferences,
      });
    } catch (error: any) {
      console.error("Error getting QC files:", error);
      res.status(500).json({ 
        error: "Failed to get QC files", 
        details: error.message 
      });
    }
  });

  // Pass QC - approve order and mark as complete
  app.post("/api/editor/orders/:orderId/qc/pass", async (req, res) => {
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
      if (!currentUser) {
        return res.status(403).json({ error: "User not found" });
      }

      // Allow editors, admins, and partners to pass QC
      const allowedRoles = ['editor', 'admin', 'partner'];
      if (!allowedRoles.includes(currentUser.role)) {
        return res.status(403).json({ error: "Only editors, admins, and partners can pass QC" });
      }

      // Get the order
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      // For editors, verify the order is assigned to them (editors can only QC their own work)
      // For admins/partners, allow them to QC any order in their tenant
      if (currentUser.role === 'editor' && order.assignedTo !== uid) {
        return res.status(403).json({ error: "This order is not assigned to you" });
      }

      // Verify tenant access for admins/partners
      if ((currentUser.role === 'admin' || currentUser.role === 'partner') && order.partnerId !== currentUser.partnerId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Verify order is in human_check status
      if (order.status !== 'human_check') {
        return res.status(400).json({ error: `Order is not in QC stage (current: ${order.status})` });
      }

      // Update order to completed status
      console.log(`[QC PASS] Updating order ${order.orderNumber} (${orderId}) from ${order.status} to completed`);
      const updatedOrder = await storage.updateOrder(orderId, {
        status: 'completed',
        approvedBy: uid,
        approvedAt: new Date(),
      });

      if (!updatedOrder) {
        console.error(`[QC PASS] Failed to update order ${order.orderNumber} - updateOrder returned undefined`);
        return res.status(500).json({ error: "Failed to update order status" });
      }

      console.log(`[QC PASS] Successfully updated order ${order.orderNumber} to status: ${updatedOrder.status}`);

      // Log activity
      try {
        await storage.createActivity({
          partnerId: order.partnerId,
          orderId: order.id,
          jobId: order.jobId,
          userId: uid,
          userEmail: currentUser.email,
          userName: currentUser.studioName || currentUser.email,
          action: "qc_pass",
          category: "order",
          title: "QC Passed",
          description: `Order #${order.orderNumber} passed quality control`,
          metadata: JSON.stringify({
            orderNumber: order.orderNumber,
            approvedBy: uid,
            approvedAt: new Date().toISOString()
          }),
          ipAddress: req.ip || req.socket.remoteAddress || '',
          userAgent: req.headers['user-agent'] || ''
        });
      } catch (activityError) {
        console.error("[ACTIVITY] Failed to log QC pass:", activityError);
      }

      res.json({
        success: true,
        order: updatedOrder,
        message: "Order passed QC and marked as complete"
      });
    } catch (error: any) {
      console.error("Error passing QC:", error);
      res.status(500).json({ 
        error: "Failed to pass QC", 
        details: error.message 
      });
    }
  });

  // Request revision - send order back for revision
  app.post("/api/editor/orders/:orderId/qc/revision", async (req, res) => {
    try {
      const { orderId } = req.params;
      const { revisionNotes } = req.body;

      if (!revisionNotes || typeof revisionNotes !== 'string' || !revisionNotes.trim()) {
        return res.status(400).json({ error: "Revision notes are required" });
      }

      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: "Authorization header required" });
      }

      const idToken = authHeader.replace('Bearer ', '');
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      const uid = decodedToken.uid;
      const currentUser = await getUserDocument(uid);
      if (!currentUser || currentUser.role !== 'editor') {
        return res.status(403).json({ error: "Only editors can request revisions" });
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

      // Verify order is in human_check status
      if (order.status !== 'human_check') {
        return res.status(400).json({ error: `Order is not in QC stage (current: ${order.status})` });
      }

      // Increment revision count
      const currentRevisions = (order as any).usedRevisionRounds || 0;

      // Update order to in_revision status
      const updatedOrder = await storage.updateOrder(orderId, {
        status: 'in_revision',
        revisionNotes: revisionNotes.trim(),
        usedRevisionRounds: currentRevisions + 1,
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
          action: "qc_revision",
          category: "order",
          title: "Revision Requested",
          description: `Order #${order.orderNumber} sent back for revision`,
          metadata: JSON.stringify({
            orderNumber: order.orderNumber,
            revisionNotes: revisionNotes.trim(),
            revisionRound: currentRevisions + 1,
            requestedBy: uid,
            requestedAt: new Date().toISOString()
          }),
          ipAddress: req.ip || req.socket.remoteAddress || '',
          userAgent: req.headers['user-agent'] || ''
        });
      } catch (activityError) {
        console.error("[ACTIVITY] Failed to log revision request:", activityError);
      }

      res.json({
        success: true,
        order: updatedOrder,
        message: "Order sent back for revision"
      });
    } catch (error: any) {
      console.error("Error requesting revision:", error);
      res.status(500).json({ 
        error: "Failed to request revision", 
        details: error.message 
      });
    }
  });

  // Add/update comment on a file
  app.post("/api/editor/files/:fileId/comments", async (req, res) => {
    try {
      const { fileId } = req.params;
      const { content } = req.body;

      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: "Authorization header required" });
      }

      const idToken = authHeader.replace('Bearer ', '');
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      const uid = decodedToken.uid;
      const currentUser = await getUserDocument(uid);
      if (!currentUser || currentUser.role !== 'editor') {
        return res.status(403).json({ error: "Only editors can add comments" });
      }

      // Get the file to verify access
      const file = await storage.getEditorUpload(fileId);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }

      // Verify the file's order is assigned to this editor
      if (file.orderId) {
        const order = await storage.getOrder(file.orderId);
        if (order && order.assignedTo !== uid) {
          return res.status(403).json({ error: "You don't have access to this file" });
        }
      }

      // Create or update comment
      const comment = await storage.createFileComment({
        fileId,
        orderId: file.orderId,
        jobId: file.jobId,
        authorId: uid,
        authorName: currentUser.studioName || currentUser.displayName || currentUser.email || 'Editor',
        authorRole: 'editor',
        content: content || '',
      });

      res.json({
        success: true,
        comment,
        message: "Comment saved"
      });
    } catch (error: any) {
      console.error("Error saving comment:", error);
      res.status(500).json({ 
        error: "Failed to save comment", 
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
        expiresAt: new Date(Date.now() + (uploadType === 'client' ? 14 : 30) * 24 * 60 * 60 * 1000), // 14 days for orders folder, 30 days for completed
        status: uploadType === 'client' ? 'for_editing' : 'completed', // 'for_editing' for orders folder, 'completed' for deliverables
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
  app.post("/api/upload-completed-files", requireAuth, upload.single('file'), async (req: AuthenticatedRequest, res) => {
    try {
      // Master users cannot upload files when in read-only mode (viewing other businesses)
      if (isMasterReadOnly(req.user)) {
        return res.status(403).json({ error: "Master users have read-only access and cannot upload files for other businesses" });
      }

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

      const { jobId, orderNumber, folderPath, editorFolderName, folderToken } = req.body;

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
      // Include 'in_revision' to allow editors to upload revised work
      if (!['processing', 'in_progress', 'in_revision'].includes(orderEntity.status || 'pending')) {
        return res.status(400).json({ error: `Cannot upload to order with status: ${orderEntity.status}` });
      }

      // Get Firebase Admin Storage
      const bucketName = (process.env.FIREBASE_STORAGE_BUCKET || '').replace(/['"]/g, '').trim();
      if (!bucketName) {
        throw new Error('FIREBASE_STORAGE_BUCKET environment variable not set');
      }

      const bucket = getStorage().bucket(bucketName);

      // Check for existing file with same name in same folder (for replacement)
      const existingUploads = await storage.getEditorUploads(job.id);
      const duplicateFile = existingUploads.find(f => 
        f.folderPath === folderPath && 
        f.originalName === req.file!.originalname &&
        f.status === 'completed'
      );

      if (duplicateFile) {
        console.log(`[UPLOAD] Found duplicate file to replace: ${duplicateFile.originalName} in folder ${folderPath}`);
        
        // Delete old file from Firebase Storage
        try {
          const oldFile = bucket.file(duplicateFile.firebaseUrl);
          await oldFile.delete();
          console.log(`[UPLOAD] Deleted old file from Firebase Storage: ${duplicateFile.firebaseUrl}`);
        } catch (deleteError: any) {
          // Log but continue - file may already be deleted
          console.log(`[UPLOAD] Note: Could not delete old file from Firebase (may already be deleted): ${deleteError.message}`);
        }
        
        // Delete old database record
        await storage.deleteEditorUpload(duplicateFile.id);
        console.log(`[UPLOAD] Deleted old database record: ${duplicateFile.id}`);
        console.log(`[UPLOAD] Replaced existing file: ${duplicateFile.originalName}`);
      }

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
        folderToken: folderToken || null, // Associate with existing folder if token provided
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

      // Get Firebase Storage bucket for regenerating expired URLs
      const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.replace(/['"]/g, '').trim();
      const bucket = bucketName ? getStorage().bucket(bucketName) : null;

      // Get order information for each group and regenerate expired URLs
      const enrichedFiles = await Promise.all(
        Object.entries(filesByOrder).map(async ([orderId, files]) => {
          const order = await storage.getOrder(orderId);

          // Regenerate signed URLs for files (check if expired and regenerate)
          const filesWithDownloadUrls = await Promise.all(
            files.map(async (file) => {
              let downloadUrl = file.downloadUrl;
              
              // Always regenerate signed URLs to ensure they're fresh and not expired
              // Signed URLs expire after 30 days, so we regenerate them on each request
              // This ensures images always load, even if the stored URL has expired
              if (file.firebaseUrl && bucket) {
                try {
                  const gcsFile = bucket.file(file.firebaseUrl);
                  const [exists] = await gcsFile.exists();
                  
                  if (exists) {
                    // Generate new signed URL (30 days expiration)
                    const [signedUrl] = await gcsFile.getSignedUrl({
                      action: 'read',
                      expires: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
                    });
                    
                    downloadUrl = signedUrl;
                    
                    // Update the database with the new URL to cache it for future requests
                    // This reduces regeneration overhead on subsequent requests
                    try {
                      await storage.updateEditorUpload(file.id, {
                        downloadUrl: signedUrl
                      });
                    } catch (updateError) {
                      // Log but don't fail - we still have the fresh URL to return
                      console.error(`[completed-files] Failed to cache regenerated URL for file ${file.id}:`, updateError);
                    }
                  } else {
                    console.warn(`[completed-files] File not found in storage: ${file.firebaseUrl}`);
                  }
                } catch (urlError) {
                  console.error(`[completed-files] Error regenerating URL for file ${file.id}:`, urlError);
                  // Fall back to existing URL if regeneration fails
                }
              }

              return {
                id: file.id,
                fileName: file.fileName,
                originalName: file.originalName,
                fileSize: file.fileSize,
                mimeType: file.mimeType,
                downloadUrl: downloadUrl, // Use regenerated or existing URL
                uploadedAt: file.uploadedAt,
                notes: file.notes
              };
            })
          );

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
      // Master users cannot delete files when in read-only mode (viewing other businesses)
      if (isMasterReadOnly(req.user)) {
        return res.status(403).json({ error: "Master users have read-only access and cannot delete files for other businesses" });
      }

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
      // Master users cannot create folders when in read-only mode (viewing other businesses)
      if (isMasterReadOnly(req.user)) {
        return res.status(403).json({ error: "Master users have read-only access and cannot create folders for other businesses" });
      }

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
      // Master users cannot delete folders when in read-only mode (viewing other businesses)
      if (isMasterReadOnly(req.user)) {
        return res.status(403).json({ error: "Master users have read-only access and cannot delete folders for other businesses" });
      }

      const { jobId } = req.params;
      const { folderPath, folderToken } = req.body;

      if (!req.user?.partnerId) {
        return res.status(400).json({ error: "User must have a partnerId" });
      }

      if (!folderPath && !folderToken) {
        return res.status(400).json({ error: "folderPath or folderToken is required" });
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

      console.log(`[DELETE] Starting deletion for folder: ${folderPath || 'N/A'}, token: ${folderToken || 'N/A'}`);

      // Get all uploads for this folder from Firestore
      const folderUploads = await storage.getEditorUploads(job.id);
      
      // If folderToken is provided, also filter by folderToken
      let uploadsInFolder = folderUploads.filter(upload => {
        if (folderToken && upload.folderToken === folderToken) {
          return true;
        }
        if (folderPath && upload.folderPath === folderPath) {
          return true;
        }
        return false;
      });

      console.log(`[DELETE] Found ${uploadsInFolder.length} uploads in folder`);
      uploadsInFolder.forEach(upload => {
        console.log(`[DELETE]   - File: ${upload.fileName}, Firebase path: ${upload.firebaseUrl}, folderPath: ${upload.folderPath}, folderToken: ${upload.folderToken}`);
      });

      // Also check if this folder exists in the folders collection
      // Try folderPath first, then folderToken if folderPath doesn't work
      let foldersSnapshot;
      if (folderPath) {
        foldersSnapshot = await (storage as any).db.collection("folders")
          .where("jobId", "==", job.id)
          .where("folderPath", "==", folderPath)
          .get();
      }
      
      // If no folder found by folderPath and folderToken is provided, try folderToken
      if ((!foldersSnapshot || foldersSnapshot.empty) && folderToken) {
        foldersSnapshot = await (storage as any).db.collection("folders")
          .where("jobId", "==", job.id)
          .where("folderToken", "==", folderToken)
          .get();
      }

      const folderDoc = foldersSnapshot?.docs[0];
      const resolvedFolderToken = folderDoc?.data()?.folderToken || folderToken;
      const folderData = folderDoc?.data();
      
      // If we found a folder doc but didn't have folderPath, use the folderPath from the doc
      const resolvedFolderPath = folderDoc?.data()?.folderPath || folderPath;

      console.log(`[DELETE] Folder document found:`, folderDoc ? 'Yes' : 'No');
      console.log(`[DELETE] Folder token:`, resolvedFolderToken);
      console.log(`[DELETE] Resolved folder path:`, resolvedFolderPath);
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
          if (resolvedFolderToken) {
            const folderPrefix = `completed/${job.jobId || job.id}/folders/${resolvedFolderToken}/`;
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
            folderPath: resolvedFolderPath,
            deletedFileCount: uploadsInFolder.length,
            folderToken: resolvedFolderToken || null
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

  app.patch("/api/jobs/:jobId/folders/order", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { jobId } = req.params;
      const { folders } = req.body;

      if (!req.user?.partnerId) {
        return res.status(400).json({ error: "User must have a partnerId" });
      }

      if (!Array.isArray(folders)) {
        return res.status(400).json({ error: "folders must be an array" });
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

      // Validate folders array
      for (const folder of folders) {
        if (!folder.uniqueKey || typeof folder.displayOrder !== 'number') {
          return res.status(400).json({ error: "Each folder must have uniqueKey and displayOrder" });
        }
      }

      console.log(`[FOLDER ORDER] Updating order for job ${job.id}:`, folders.map(f => ({ uniqueKey: f.uniqueKey, displayOrder: f.displayOrder })));

      // Update folder order
      await storage.updateFolderOrder(job.id, folders);
      
      console.log(`[FOLDER ORDER] Successfully updated order for job ${job.id}`);

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error updating folder order:", error);
      res.status(500).json({ 
        error: "Failed to update folder order", 
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

  // Download multiple files as zip by file IDs
  app.post("/api/jobs/:jobId/files/download", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { jobId } = req.params;
      const { fileIds } = req.body;

      console.log(`[FILES DOWNLOAD] Request for jobId: ${jobId}, fileIds count: ${fileIds?.length}`);

      if (!req.user?.partnerId) {
        return res.status(400).json({ error: "User must have a partnerId" });
      }

      if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
        return res.status(400).json({ error: "fileIds array is required and must not be empty" });
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

      // Get all folders for this job to find the files
      const allFolders = await storage.getUploadFolders(job.id);

      // Collect all files from all folders
      const allFilesMap = new Map<string, any>();
      allFolders.forEach(folder => {
        folder.files.forEach(file => {
          if (!file.fileName.startsWith('.') && file.downloadUrl) {
            allFilesMap.set(file.id, file);
          }
        });
      });

      // Find requested files
      const filesToDownload: any[] = [];
      const missingFileIds: string[] = [];

      for (const fileId of fileIds) {
        const file = allFilesMap.get(fileId);
        if (file) {
          filesToDownload.push(file);
        } else {
          missingFileIds.push(fileId);
        }
      }

      if (missingFileIds.length > 0) {
        console.warn(`[FILES DOWNLOAD] Some files not found: ${missingFileIds.join(', ')}`);
      }

      if (filesToDownload.length === 0) {
        return res.status(404).json({ error: "No valid files found for the provided IDs" });
      }

      console.log(`[FILES DOWNLOAD] Found ${filesToDownload.length} files to download`);

      // Create zip file
      const zip = new JSZip();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const zipFileName = `selected-files-${timestamp}`;

      // Add all files to zip
      for (const file of filesToDownload) {
        try {
          console.log(`[FILES DOWNLOAD] Fetching file: ${file.originalName} from ${file.downloadUrl}`);

          const response = await fetch(file.downloadUrl);
          if (!response.ok) {
            console.error(`[FILES DOWNLOAD] Failed to fetch ${file.originalName}: ${response.status}`);
            continue;
          }

          const arrayBuffer = await response.arrayBuffer();
          const fileBuffer = Buffer.from(arrayBuffer);

          zip.file(file.originalName, fileBuffer);
          console.log(`[FILES DOWNLOAD] Added ${file.originalName} to zip (${fileBuffer.length} bytes)`);
        } catch (error) {
          console.error(`[FILES DOWNLOAD] Error processing file ${file.originalName}:`, error);
          // Continue with other files even if one fails
        }
      }

      // Generate zip
      console.log(`[FILES DOWNLOAD] Generating zip file...`);
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
      console.log(`[FILES DOWNLOAD] Zip generated (${zipBuffer.length} bytes)`);

      // Send zip file
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}.zip"`);
      res.setHeader('Content-Length', zipBuffer.length.toString());
      res.send(zipBuffer);

      console.log(`[FILES DOWNLOAD] Download complete for ${zipFileName}.zip`);
    } catch (error: any) {
      console.error("[FILES DOWNLOAD] Error occurred:");
      console.error("[FILES DOWNLOAD] Error message:", error.message);
      console.error("[FILES DOWNLOAD] Error stack:", error.stack);
      res.status(500).json({
        error: "Failed to create files download",
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
      // If marking as delivered, also set deliveredAt timestamp for monthly revenue tracking
      const updateData: any = { status };
      if (status === 'delivered' && !job.deliveredAt) {
        updateData.deliveredAt = new Date();
      }
      
      const updatedJob = await storage.updateJob(id, updateData);
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

      // Get order information for each group - only include files where order status is 'completed'
      // This ensures files don't appear until QC (human check) passes
      const enrichedFilesWithNulls = await Promise.all(
        Object.entries(filesByOrder)
          .filter(([orderId]) => orderId && orderId !== 'null' && orderId !== 'undefined') // Filter out null/undefined orderIds
          .map(async ([orderId, files]) => {
            const order = await storage.getOrder(orderId);
            // Only include if order exists and status is completed (QC passed)
            if (!order || order.status !== 'completed') {
              return null;
            }
            return {
              orderId,
              orderNumber: order.orderNumber || 'Unknown',
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
      // Filter out null entries (orders that haven't passed QC)
      const enrichedFiles = enrichedFilesWithNulls.filter(item => item !== null);

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

      // Regenerate expired cover photo URLs
      console.log(`[GET /api/delivery/:token] Job ${job.id} has propertyImage: ${!!job.propertyImage}, propertyImageThumbnail: ${!!job.propertyImageThumbnail}`);
      const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.replace(/['"]/g, '').trim();
      console.log(`[GET /api/delivery/:token] Bucket name: ${bucketName || 'NOT SET'}`);
      const bucket = bucketName ? getStorage().bucket(bucketName) : null;
      console.log(`[GET /api/delivery/:token] Bucket initialized: ${!!bucket}, calling regenerateCoverPhotoUrls...`);
      const regeneratedUrls = await regenerateCoverPhotoUrls(job, bucket);
      console.log(`[GET /api/delivery/:token] Regenerated URLs result:`, {
        hasPropertyImage: !!regeneratedUrls.propertyImage,
        hasPropertyImageThumbnail: !!regeneratedUrls.propertyImageThumbnail
      });

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
          propertyImage: regeneratedUrls.propertyImage || job.propertyImage,
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

      // Only include files where order status is 'completed' (QC passed)
      // This ensures files don't appear until human check passes
      const enrichedFilesWithNulls = await Promise.all(
        Object.entries(filesByOrder)
          .filter(([orderId]) => orderId && orderId !== 'null' && orderId !== 'undefined') // Filter out null/undefined orderIds
          .map(async ([orderId, files]) => {
            const order = await storage.getOrder(orderId);
            // Only include if order exists and status is completed (QC passed)
            if (!order || order.status !== 'completed') {
              return null;
            }
            return {
              orderId,
              orderNumber: order.orderNumber || 'Unknown',
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
      // Filter out null entries (orders that haven't passed QC)
      const enrichedFiles = enrichedFilesWithNulls.filter(item => item !== null);

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

      // Regenerate expired cover photo URLs
      console.log(`[GET /api/jobs/:jobId/preview] Job ${job.id} has propertyImage: ${!!job.propertyImage}, propertyImageThumbnail: ${!!job.propertyImageThumbnail}`);
      const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.replace(/['"]/g, '').trim();
      console.log(`[GET /api/jobs/:jobId/preview] Bucket name: ${bucketName || 'NOT SET'}`);
      const bucket = bucketName ? getStorage().bucket(bucketName) : null;
      console.log(`[GET /api/jobs/:jobId/preview] Bucket initialized: ${!!bucket}, calling regenerateCoverPhotoUrls...`);
      const regeneratedUrls = await regenerateCoverPhotoUrls(job, bucket);
      console.log(`[GET /api/jobs/:jobId/preview] Regenerated URLs result:`, {
        hasPropertyImage: !!regeneratedUrls.propertyImage,
        hasPropertyImageThumbnail: !!regeneratedUrls.propertyImageThumbnail
      });

      // Return same format as public delivery endpoint with branding
      res.json({
        job: {
          id: job.id,
          jobId: job.jobId,
          address: job.address,
          status: job.status,
          appointmentDate: job.appointmentDate,
          propertyImage: regeneratedUrls.propertyImage || job.propertyImage,
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

      // Check revision limits - only for end clients after job delivery
      // First check if job/order is delivered
      const isDelivered = job.status === 'delivered' || order.status === 'delivered' || order.status === 'completed';
      
      if (isDelivered) {
        // Get customer to check for override
        const customer = job.customerId ? await storage.getCustomer(job.customerId) : null;
        const customerOverride = customer?.revisionLimitOverride;
        
        // Determine if we should check limits
        let shouldCheckLimit = false;
        let maxRevisionRounds = 2; // Default
        
        if (customerOverride === 'unlimited') {
          // Customer has unlimited revisions - no limit check
          shouldCheckLimit = false;
        } else if (customerOverride && !isNaN(parseInt(customerOverride))) {
          // Customer has custom limit
          shouldCheckLimit = true;
          maxRevisionRounds = parseInt(customerOverride);
        } else {
          // No customer override - check partner settings
          const partnerSettings = await storage.getPartnerSettings(job.partnerId);
          if (partnerSettings?.enableClientRevisionLimit) {
            shouldCheckLimit = true;
            maxRevisionRounds = partnerSettings.clientRevisionRoundLimit || 2;
          }
        }
        
        if (shouldCheckLimit) {
          const usedRounds = order.usedRevisionRounds || 0;
          const remainingRounds = maxRevisionRounds - usedRounds;
          
          if (remainingRounds <= 0) {
            return res.status(400).json({ 
              error: "No revision rounds remaining",
              revisionStatus: {
                maxRounds: maxRevisionRounds,
                usedRounds,
                remainingRounds
              }
            });
          }
        }
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

      // Check if job/order is delivered
      const isDelivered = job.status === 'delivered' || order.status === 'delivered' || order.status === 'completed';
      const usedRounds = order.usedRevisionRounds || 0;
      
      if (!isDelivered) {
        // Not delivered yet - unlimited revisions
        return res.json({
          maxRounds: null,
          usedRounds,
          remainingRounds: null,
          unlimited: true
        });
      }

      // Get customer to check for override
      const customer = job.customerId ? await storage.getCustomer(job.customerId) : null;
      const customerOverride = customer?.revisionLimitOverride;
      
      if (customerOverride === 'unlimited') {
        // Customer has unlimited revisions
        return res.json({
          maxRounds: null,
          usedRounds,
          remainingRounds: null,
          unlimited: true
        });
      } else if (customerOverride && !isNaN(parseInt(customerOverride))) {
        // Customer has custom limit
        const maxRounds = parseInt(customerOverride);
        return res.json({
          maxRounds,
          usedRounds,
          remainingRounds: maxRounds - usedRounds,
          unlimited: false
        });
      } else {
        // No customer override - check partner settings
        const partnerSettings = await storage.getPartnerSettings(job.partnerId);
        if (partnerSettings?.enableClientRevisionLimit) {
          const maxRounds = partnerSettings.clientRevisionRoundLimit || 2;
          return res.json({
            maxRounds,
            usedRounds,
            remainingRounds: maxRounds - usedRounds,
            unlimited: false
          });
        } else {
          // Partner has not enabled limits - unlimited
          return res.json({
            maxRounds: null,
            usedRounds,
            remainingRounds: null,
            unlimited: true
          });
        }
      }
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
      // Use getJobByJobId to handle both UUID and NanoID
      const job = await storage.getJobByJobId(jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      if (job.partnerId !== req.user.partnerId) {
        return res.status(403).json({ error: "Access denied to this job" });
      }

      // Use job.jobId (NanoID) for activities query since activities are stored with NanoID
      const activities = await storage.getJobActivities(job.jobId, req.user.partnerId);
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

      // Get the order - first try by ID, then by orderNumber
      let order = await storage.getOrder(orderId);
      if (!order) {
        // Try looking up by orderNumber (e.g., "00059")
        order = await storage.getOrderByNumber(orderId, req.user.partnerId);
      }
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      // Verify order belongs to user's partner
      if (order.partnerId !== req.user.partnerId) {
        return res.status(403).json({ error: "Access denied to this order" });
      }

      const activities = await storage.getOrderActivities(order.id, req.user.partnerId);
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

      // Regenerate expired cover photo URLs
      const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.replace(/['"]/g, '').trim();
      const bucket = bucketName ? getStorage().bucket(bucketName) : null;
      const regeneratedUrls = await regenerateCoverPhotoUrls(job, bucket);

      res.json({
        ...job,
        propertyImage: regeneratedUrls.propertyImage || job.propertyImage,
        propertyImageThumbnail: regeneratedUrls.propertyImageThumbnail || job.propertyImageThumbnail,
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
        const teamMemberColors = settings?.teamMemberColors ? JSON.parse(settings.teamMemberColors) : {};

        return res.json({
          businessProfile: null, // Photographers don't need business profile
          personalProfile,
          businessHours,
          enableClientRevisionLimit: settings?.enableClientRevisionLimit ?? false,
          clientRevisionRoundLimit: settings?.clientRevisionRoundLimit ?? 2,
          editorDisplayNames,
          teamMemberColors
        });
      }

      // For partners/admins, use partner settings as before
      const settings = await storage.getPartnerSettings(req.user.partnerId);

      if (!settings) {
        return res.json({
          businessProfile: null,
          personalProfile: { profileImage },
          businessHours: null,
          enableClientRevisionLimit: false,
          clientRevisionRoundLimit: 2,
          editorDisplayNames: {},
          teamMemberColors: {}
        });
      }

      const personalProfile = settings.personalProfile ? JSON.parse(settings.personalProfile) : {};
      personalProfile.profileImage = profileImage; // Add profile image from user document

      const editorDisplayNames = settings.editorDisplayNames ? JSON.parse(settings.editorDisplayNames) : {};
      const teamMemberColors = settings.teamMemberColors ? JSON.parse(settings.teamMemberColors) : {};

      res.json({
        businessProfile: settings.businessProfile ? JSON.parse(settings.businessProfile) : null,
        personalProfile,
        businessHours: settings.businessHours ? JSON.parse(settings.businessHours) : null,
        enableClientRevisionLimit: settings.enableClientRevisionLimit ?? false,
        clientRevisionRoundLimit: settings.clientRevisionRoundLimit ?? 2,
        editorDisplayNames,
        teamMemberColors
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

      const { businessProfile, personalProfile, businessHours, enableClientRevisionLimit, clientRevisionRoundLimit, editorDisplayNames, teamMemberColors } = req.body;

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
        if (businessHours !== undefined || enableClientRevisionLimit !== undefined || clientRevisionRoundLimit !== undefined || teamMemberColors !== undefined) {
          const savedSettings = await storage.savePartnerSettings(req.user.partnerId, {
            partnerId: req.user.partnerId,
            businessProfile: null, // Photographers don't update business profile
            personalProfile: null, // Photographers don't update partner personal profile
            businessHours: businessHours ? JSON.stringify(businessHours) : null,
            enableClientRevisionLimit: enableClientRevisionLimit !== undefined ? enableClientRevisionLimit : false,
            clientRevisionRoundLimit: clientRevisionRoundLimit !== undefined ? clientRevisionRoundLimit : 2,
            editorDisplayNames: undefined,
            teamMemberColors: teamMemberColors ? JSON.stringify(teamMemberColors) : undefined
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
        enableClientRevisionLimit: enableClientRevisionLimit !== undefined ? enableClientRevisionLimit : false,
        clientRevisionRoundLimit: clientRevisionRoundLimit !== undefined ? clientRevisionRoundLimit : 2,
        editorDisplayNames: editorDisplayNames ? JSON.stringify(editorDisplayNames) : null,
        teamMemberColors: teamMemberColors ? JSON.stringify(teamMemberColors) : null
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
  // SERVICE AREAS ENDPOINTS
  // ============================================================================

  // Point-in-polygon helper function (Ray Casting Algorithm)
  function isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
    const [x, y] = point; // [lng, lat]
    let inside = false;
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i];
      const [xj, yj] = polygon[j];
      
      const intersect = ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      
      if (intersect) inside = !inside;
    }
    
    return inside;
  }

  // Get all service areas for partner
  app.get("/api/service-areas", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.partnerId) {
        return res.status(401).json({ error: "Partner ID required" });
      }

      const serviceAreas = await storage.getServiceAreas(req.user.partnerId);
      
      // Parse polygon JSON for each service area and include assigned operator details
      const users = await storage.getUsers(req.user.partnerId);
      
      const areasWithDetails = serviceAreas.map(area => {
        let polygon = null;
        try {
          polygon = area.polygon ? JSON.parse(area.polygon) : null;
        } catch (e) {
          console.error(`Failed to parse polygon for service area ${area.id}:`, e);
        }
        
        let assignedOperators: any[] = [];
        if (area.assignedOperatorIds) {
          try {
            const operatorIds = JSON.parse(area.assignedOperatorIds) as string[];
            assignedOperators = operatorIds.map(id => {
              const user = users.find(u => u.id === id);
              return user ? {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                profileImage: user.profileImage
              } : { id, firstName: 'Unknown', lastName: '', email: '' };
            });
          } catch (e) {
            console.error(`Failed to parse assignedOperatorIds for service area ${area.id}:`, e);
          }
        }
        
        return {
          ...area,
          polygon,
          assignedOperators
        };
      });

      res.json(areasWithDetails);
    } catch (error: any) {
      console.error("Error fetching service areas:", error);
      res.status(500).json({ error: "Failed to fetch service areas" });
    }
  });

  // Create a new service area
  app.post("/api/service-areas", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.partnerId) {
        return res.status(401).json({ error: "Partner ID required" });
      }

      // Check for master read-only mode
      if (isMasterReadOnly(req.user)) {
        return res.status(403).json({ error: "Read-only access - cannot create service areas while viewing another business" });
      }

      const { name, polygon, color, assignedOperatorIds } = req.body;

      if (!name || !polygon) {
        return res.status(400).json({ error: "Name and polygon are required" });
      }

      // Validate polygon format (GeoJSON)
      if (!polygon.type || polygon.type !== 'Polygon' || !Array.isArray(polygon.coordinates)) {
        return res.status(400).json({ error: "Invalid polygon format. Expected GeoJSON Polygon." });
      }

      const serviceArea = await storage.createServiceArea({
        partnerId: req.user.partnerId,
        name,
        polygon: JSON.stringify(polygon),
        color: color || '#3B82F6',
        assignedOperatorIds: assignedOperatorIds ? JSON.stringify(assignedOperatorIds) : null,
        isActive: true
      });

      res.status(201).json({
        ...serviceArea,
        polygon,
        assignedOperators: []
      });
    } catch (error: any) {
      console.error("Error creating service area:", error);
      res.status(500).json({ error: "Failed to create service area" });
    }
  });

  // Update a service area
  app.patch("/api/service-areas/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.partnerId) {
        return res.status(401).json({ error: "Partner ID required" });
      }

      // Check for master read-only mode
      if (isMasterReadOnly(req.user)) {
        return res.status(403).json({ error: "Read-only access - cannot update service areas while viewing another business" });
      }

      const { id } = req.params;
      const { name, polygon, color, assignedOperatorIds, isActive } = req.body;

      // Verify service area belongs to partner
      const existing = await storage.getServiceArea(id);
      if (!existing) {
        return res.status(404).json({ error: "Service area not found" });
      }
      if (existing.partnerId !== req.user.partnerId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (polygon !== undefined) {
        // Validate polygon format
        if (!polygon.type || polygon.type !== 'Polygon' || !Array.isArray(polygon.coordinates)) {
          return res.status(400).json({ error: "Invalid polygon format. Expected GeoJSON Polygon." });
        }
        updates.polygon = JSON.stringify(polygon);
      }
      if (color !== undefined) updates.color = color;
      if (assignedOperatorIds !== undefined) {
        updates.assignedOperatorIds = assignedOperatorIds ? JSON.stringify(assignedOperatorIds) : null;
      }
      if (isActive !== undefined) updates.isActive = isActive;

      const updated = await storage.updateServiceArea(id, updates);

      // Get assigned operator details
      const users = await storage.getUsers(req.user.partnerId);
      let assignedOperators: any[] = [];
      const operatorIds = assignedOperatorIds || (updated?.assignedOperatorIds ? JSON.parse(updated.assignedOperatorIds) : []);
      if (Array.isArray(operatorIds)) {
        assignedOperators = operatorIds.map((opId: string) => {
          const user = users.find(u => u.id === opId);
          return user ? {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            profileImage: user.profileImage
          } : { id: opId, firstName: 'Unknown', lastName: '', email: '' };
        });
      }

      res.json({
        ...updated,
        polygon: polygon || (updated?.polygon ? JSON.parse(updated.polygon) : null),
        assignedOperators
      });
    } catch (error: any) {
      console.error("Error updating service area:", error);
      res.status(500).json({ error: "Failed to update service area" });
    }
  });

  // Delete a service area
  app.delete("/api/service-areas/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.partnerId) {
        return res.status(401).json({ error: "Partner ID required" });
      }

      // Check for master read-only mode
      if (isMasterReadOnly(req.user)) {
        return res.status(403).json({ error: "Read-only access - cannot delete service areas while viewing another business" });
      }

      const { id } = req.params;

      // Verify service area belongs to partner
      const existing = await storage.getServiceArea(id);
      if (!existing) {
        return res.status(404).json({ error: "Service area not found" });
      }
      if (existing.partnerId !== req.user.partnerId) {
        return res.status(403).json({ error: "Access denied" });
      }

      await storage.deleteServiceArea(id);
      res.json({ success: true, message: "Service area deleted" });
    } catch (error: any) {
      console.error("Error deleting service area:", error);
      res.status(500).json({ error: "Failed to delete service area" });
    }
  });

  // Validate if an address/coordinates are within any service area
  // Public endpoint for booking form validation
  app.post("/api/service-areas/validate-address", async (req, res) => {
    try {
      const { partnerId, latitude, longitude, address } = req.body;

      if (!partnerId) {
        return res.status(400).json({ error: "Partner ID required" });
      }

      if (latitude === undefined || longitude === undefined) {
        return res.status(400).json({ error: "Latitude and longitude are required" });
      }

      const serviceAreas = await storage.getServiceAreas(partnerId);
      
      if (serviceAreas.length === 0) {
        // No service areas defined - allow all addresses
        return res.json({ 
          isValid: true, 
          matchingAreas: [],
          message: "No service areas defined - all addresses accepted"
        });
      }

      const point: [number, number] = [longitude, latitude]; // GeoJSON uses [lng, lat]
      const matchingAreas: any[] = [];

      for (const area of serviceAreas) {
        if (!area.polygon || !area.isActive) continue;
        
        try {
          const polygon = JSON.parse(area.polygon);
          if (polygon.type === 'Polygon' && polygon.coordinates?.[0]) {
            const coordinates = polygon.coordinates[0] as [number, number][];
            
            if (isPointInPolygon(point, coordinates)) {
              matchingAreas.push({
                id: area.id,
                name: area.name,
                color: area.color
              });
            }
          }
        } catch (e) {
          console.error(`Failed to parse polygon for service area ${area.id}:`, e);
        }
      }

      const isValid = matchingAreas.length > 0;
      
      res.json({
        isValid,
        matchingAreas,
        message: isValid 
          ? `Address is within ${matchingAreas.length} service area(s)` 
          : "This address is outside our service areas. Please contact us for bookings in this location."
      });
    } catch (error: any) {
      console.error("Error validating address:", error);
      res.status(500).json({ error: "Failed to validate address" });
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

  // ============================================================================
  // BOOKING FORM ENDPOINTS
  // ============================================================================

  // Get booking settings (authenticated partner route)
  app.get("/api/booking/settings", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.partnerId) {
        return res.status(401).json({ error: "Partner ID required" });
      }

      const settings = await storage.getPartnerSettings(req.user.partnerId);
      
      // Default booking settings
      const defaultSettings = {
        isEnabled: true,
        timeZone: "Australia/Sydney",
        allowNewClients: true,
        requireExistingCustomer: false,
        minLeadTimeHours: 24,
        maxDriveDistanceKm: 50,
        bufferMinutes: 15,
        timeSlotInterval: 30,
        allowTeamSelection: false,
        restrictToServiceAreas: false,
        customQuestions: [],
        paymentMode: 'invoice',
        depositPercentage: 0
      };

      if (!settings || !settings.bookingSettings) {
        // Return default booking settings
        console.log('[BookingSettings] GET: No saved settings, returning defaults');
        return res.json(defaultSettings);
      }

      // Merge saved settings with defaults to ensure all fields exist
      // Filter out undefined/null values from saved settings to not override defaults
      const savedSettings = JSON.parse(settings.bookingSettings);
      const filteredSaved = Object.fromEntries(
        Object.entries(savedSettings).filter(([_, v]) => v !== undefined && v !== null)
      );
      const mergedSettings = { ...defaultSettings, ...filteredSaved };
      console.log('[BookingSettings] GET: Returning merged settings, timeSlotInterval:', mergedSettings.timeSlotInterval);
      res.json(mergedSettings);
    } catch (error: any) {
      console.error("Error fetching booking settings:", error);
      res.status(500).json({ error: "Failed to fetch booking settings" });
    }
  });

  // Save booking settings (authenticated partner route)
  app.put("/api/booking/settings", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.partnerId) {
        return res.status(401).json({ error: "Partner ID required" });
      }

      const bookingSettings = req.body;
      console.log('[BookingSettings] Received settings to save:', JSON.stringify(bookingSettings, null, 2));
      console.log('[BookingSettings] timeSlotInterval value:', bookingSettings.timeSlotInterval);
      
      // Get existing settings and update only bookingSettings
      const existingSettings = await storage.getPartnerSettings(req.user.partnerId);
      
      await storage.savePartnerSettings(req.user.partnerId, {
        partnerId: req.user.partnerId,
        businessProfile: existingSettings?.businessProfile || null,
        personalProfile: existingSettings?.personalProfile || null,
        businessHours: existingSettings?.businessHours || null,
        defaultMaxRevisionRounds: existingSettings?.defaultMaxRevisionRounds ?? 2,
        editorDisplayNames: existingSettings?.editorDisplayNames || null,
        teamMemberColors: existingSettings?.teamMemberColors || null,
        bookingSettings: JSON.stringify(bookingSettings)
      });

      console.log('[BookingSettings] Settings saved successfully');
      res.json({ success: true, message: "Booking settings saved successfully" });
    } catch (error: any) {
      console.error("Error saving booking settings:", error);
      res.status(500).json({ error: "Failed to save booking settings" });
    }
  });

  // Public route: Get booking settings for booking form
  app.get("/api/booking/public-settings/:partnerId", async (req, res) => {
    try {
      const { partnerId } = req.params;
      
      if (!partnerId) {
        return res.status(400).json({ error: "Partner ID required" });
      }

      const settings = await storage.getPartnerSettings(partnerId);
      
      if (!settings || !settings.bookingSettings) {
        // Default to enabled for new partners
        return res.json({
          isEnabled: true,
          partnerId,
          timeZone: "Australia/Sydney",
          allowNewClients: true,
          requireExistingCustomer: false,
          minimumBookingHours: 24,
          maximumDriveDistanceKm: 50,
          allowTeamMemberSelection: true,
          restrictToServiceAreas: false,
          customQuestions: [],
          paymentMode: 'invoice',
          depositPercentage: 0,
          bufferMinutes: 15,
          timeSlotInterval: 30
        });
      }

      const savedSettings = JSON.parse(settings.bookingSettings);
      
      // Merge with defaults to ensure all fields exist (handles new fields added after settings were saved)
      const defaultBookingSettings = {
        isEnabled: true,
        timeZone: "Australia/Sydney",
        allowNewClients: true,
        requireExistingCustomer: false,
        minLeadTimeHours: 24,
        maxDriveDistanceKm: 50,
        bufferMinutes: 15,
        timeSlotInterval: 30,
        allowTeamSelection: false,
        restrictToServiceAreas: false,
        customQuestions: [],
        paymentMode: 'invoice',
        depositPercentage: 0
      };
      
      // Filter out undefined/null values from saved settings to not override defaults
      const filteredSaved = Object.fromEntries(
        Object.entries(savedSettings).filter(([_, v]) => v !== undefined && v !== null)
      );
      const bookingSettings = { ...defaultBookingSettings, ...filteredSaved };
      
      // Also include business info for display
      const businessProfile = settings.businessProfile ? JSON.parse(settings.businessProfile) : {};
      const businessHours = settings.businessHours ? JSON.parse(settings.businessHours) : null;

      // Derive final time zone: booking-specific override, then business profile, then default
      const finalTimeZone =
        bookingSettings.timeZone ||
        businessProfile.timeZone ||
        "Australia/Sydney";

      // In development mode, always enable booking for testing
      const isEnabled = process.env.NODE_ENV === 'development' 
        ? true 
        : bookingSettings.isEnabled ?? true;

      res.json({
        ...bookingSettings,
        timeZone: finalTimeZone,
        isEnabled,
        partnerId,
        businessName: businessProfile.businessName || null,
        businessLogo: businessProfile.logo || null,
        businessPhone: businessProfile.phone || null,
        businessEmail: businessProfile.email || null,
        businessHours
      });
    } catch (error: any) {
      console.error("Error fetching public booking settings:", error);
      res.status(500).json({ error: "Failed to fetch booking settings" });
    }
  });

  // Public route: Get products for booking form
  app.get("/api/booking/products/:partnerId", async (req, res) => {
    try {
      const { partnerId } = req.params;
      
      if (!partnerId) {
        return res.status(400).json({ error: "Partner ID required" });
      }

      const products = await storage.getProducts(partnerId);
      
      // Filter to only active and live products (treat null as true for backwards compatibility)
      const bookingProducts = products
        .filter(p => p.isActive !== false && p.isLive !== false)
        .map(p => {
          // Parse variations and ensure prices are numbers
          let variations = null;
          if (p.variations) {
            try {
              const parsed = JSON.parse(p.variations);
              variations = Array.isArray(parsed) ? parsed.map((v: any) => ({
                ...v,
                price: parseFloat(v.price?.toString() || '0'),
                appointmentDuration: parseInt(v.appointmentDuration?.toString() || '60', 10),
              })) : null;
            } catch {
              variations = null;
            }
          }
          
          // Parse availableAddons
          let availableAddons: string[] | null = null;
          if (p.availableAddons) {
            try {
              const parsed = JSON.parse(p.availableAddons);
              availableAddons = Array.isArray(parsed) ? parsed : null;
            } catch {
              availableAddons = null;
            }
          }
          
          return {
            id: p.id,
            partnerId: p.partnerId,
            title: p.title,
            description: p.description,
            type: p.type,
            category: p.category,
            price: parseFloat(p.price?.toString() || '0'),
            taxRate: parseFloat(p.taxRate?.toString() || '10'),
            hasVariations: p.hasVariations || false,
            variations,
            productType: p.productType || 'onsite',
            requiresAppointment: p.requiresAppointment ?? true,
            appointmentDuration: p.appointmentDuration || 60,
            isActive: p.isActive !== false,
            isLive: p.isLive !== false,
            image: p.image,
            availableAddons
          };
        });

      res.json(bookingProducts);
    } catch (error: any) {
      console.error("Error fetching booking products:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  // Public route: Get team members for booking form
  app.get("/api/booking/team/:partnerId", async (req, res) => {
    try {
      const { partnerId } = req.params;
      
      if (!partnerId) {
        return res.status(400).json({ error: "Partner ID required" });
      }

      const users = await storage.getUsers(partnerId);
      
      // Filter to photographers and partners who can be assigned
      const teamMembers = users
        .filter(u => u.role === 'photographer' || u.role === 'partner')
        .map(u => ({
          id: u.id,
          firstName: u.firstName,
          lastName: u.lastName,
          name: `${u.firstName} ${u.lastName}`.trim(),
          profileImage: u.profileImage,
          role: u.role
        }));

      res.json(teamMembers);
    } catch (error: any) {
      console.error("Error fetching team members:", error);
      res.status(500).json({ error: "Failed to fetch team members" });
    }
  });

  // Public route: Get team member availability
  app.get("/api/booking/team-availability/:partnerId", async (req, res) => {
    try {
      const { partnerId } = req.params;
      
      if (!partnerId) {
        return res.status(400).json({ error: "Partner ID required" });
      }

      // Get partner settings for business hours
      const settings = await storage.getPartnerSettings(partnerId);
      const businessHours = settings?.businessHours ? JSON.parse(settings.businessHours) : null;

      // Get all team members
      const users = await storage.getUsers(partnerId);
      const teamMembers = users.filter(u => u.role === 'photographer' || u.role === 'partner');

      // Generate availability based on business hours
      // In a real implementation, each team member could have their own hours
      const dayMap: Record<string, number> = {
        sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
        thursday: 4, friday: 5, saturday: 6
      };

      const availability: any[] = [];

      for (const member of teamMembers) {
        if (businessHours) {
          for (const [day, hours] of Object.entries(businessHours) as [string, any][]) {
            availability.push({
              teamMemberId: member.id,
              dayOfWeek: dayMap[day] ?? 0,
              startTime: hours.start || '09:00',
              endTime: hours.end || '17:00',
              isAvailable: hours.enabled !== false
            });
          }
        } else {
          // Default availability: Monday-Friday 9-5
          for (let day = 1; day <= 5; day++) {
            availability.push({
              teamMemberId: member.id,
              dayOfWeek: day,
              startTime: '09:00',
              endTime: '17:00',
              isAvailable: true
            });
          }
        }
      }

      res.json(availability);
    } catch (error: any) {
      console.error("Error fetching team availability:", error);
      res.status(500).json({ error: "Failed to fetch availability" });
    }
  });

  // Public route: Get existing appointments for scheduling
  app.get("/api/booking/appointments/:partnerId", async (req, res) => {
    try {
      const { partnerId } = req.params;
      const { start, end } = req.query;
      
      if (!partnerId) {
        return res.status(400).json({ error: "Partner ID required" });
      }

      const appointments: any[] = [];

      // Get all jobs for this partner (used for enriching appointments and legacy support)
      const jobs = await storage.getJobs(partnerId);
      const jobsById = new Map(jobs.map(j => [j.id, j]));

      // Fetch appointments from the appointments table/collection
      try {
        // Query appointments by partnerId (fetch all, filter cancelled in memory)
        // This is more reliable than Firestore's != operator which has limitations with composite queries
        const appointmentsSnapshot = await adminDb.collection("appointments")
          .where("partnerId", "==", partnerId)
          .get();

        // Filter out cancelled appointments in memory (more reliable than Firestore != operator)
        const activeAppointments = appointmentsSnapshot.docs.filter(doc => {
          const status = doc.data().status;
          return !status || status !== 'cancelled';
        });

        // Transform appointments from the appointments table
        console.log('[BOOKING APPOINTMENTS] Raw appointments from Firestore:', appointmentsSnapshot.docs.length);
        console.log('[BOOKING APPOINTMENTS] Active appointments (after filtering cancelled):', activeAppointments.length);
        console.log('[BOOKING APPOINTMENTS] Appointment statuses:', appointmentsSnapshot.docs.map(doc => ({
          id: doc.id,
          status: doc.data().status || 'undefined'
        })));
        
        for (const doc of activeAppointments) {
          const apt = doc.data();
          
          // Convert Firestore timestamp to Date
          let appointmentDate: Date;
          if (apt.appointmentDate?.toDate) {
            appointmentDate = apt.appointmentDate.toDate();
          } else if (apt.appointmentDate instanceof Date) {
            appointmentDate = apt.appointmentDate;
          } else {
            appointmentDate = new Date(apt.appointmentDate);
          }

          console.log('[BOOKING APPOINTMENTS] Processing appointment:', {
            appointmentId: doc.id,
            appointmentDate_raw: apt.appointmentDate,
            appointmentDate_parsed: appointmentDate.toISOString(),
            assignedTo: apt.assignedTo,
            dateRange: { start, end }
          });

          // Filter by date range if provided
          if (start) {
            const startDate = new Date(start as string);
            startDate.setUTCHours(0, 0, 0, 0); // Use UTC to avoid timezone issues
            if (appointmentDate < startDate) {
              console.log('[BOOKING APPOINTMENTS] Filtered out (before start):', {
                appointmentId: doc.id,
                appointmentDate: appointmentDate.toISOString(),
                startDate: startDate.toISOString(),
                assignedTo: apt.assignedTo
              });
              continue;
            }
          }
          if (end) {
            const endDate = new Date(end as string);
            endDate.setUTCHours(23, 59, 59, 999); // Use UTC to avoid timezone issues
            if (appointmentDate > endDate) {
              console.log('[BOOKING APPOINTMENTS] Filtered out (after end):', {
                appointmentId: doc.id,
                appointmentDate: appointmentDate.toISOString(),
                endDate: endDate.toISOString(),
                assignedTo: apt.assignedTo
              });
              continue;
            }
          }

          // Get job information for address and coordinates
          const job = jobsById.get(apt.jobId);
          const jobId = job?.jobId || apt.jobId;

          // Extract time components from appointmentDate
          const startHours = appointmentDate.getHours();
          const startMinutes = appointmentDate.getMinutes();
          const startTime = `${String(startHours).padStart(2, '0')}:${String(startMinutes).padStart(2, '0')}`;

          // Calculate end time based on estimated duration
          const duration = apt.estimatedDuration || 60;
          const endDate = new Date(appointmentDate.getTime() + duration * 60 * 1000);
          const endHours = endDate.getHours();
          const endMinutes = endDate.getMinutes();
          const endTime = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;

          // Use appointment's assignedTo, fall back to job's assignedTo if not set
          const teamMemberId = apt.assignedTo || job?.assignedTo || null;

          appointments.push({
            id: doc.id,
            jobId: jobId,
            partnerId: apt.partnerId,
            teamMemberId: teamMemberId,
            appointmentDate: appointmentDate,
            startTime,
            endTime,
            estimatedDuration: duration,
            status: apt.status || 'scheduled',
            address: job?.address || '',
            latitude: job?.latitude || null,
            longitude: job?.longitude || null,
          });

          // Log appointment assignment for debugging
          console.log('[BOOKING APPOINTMENTS] Appointment loaded:', {
            appointmentId: doc.id,
            appointmentDate: appointmentDate.toISOString(),
            startTime,
            status: apt.status || 'scheduled',
            appointment_assignedTo: apt.assignedTo,
            job_assignedTo: job?.assignedTo,
            final_teamMemberId: teamMemberId,
            jobId: jobId,
            address: job?.address || ''
          });
        }
      } catch (error: any) {
        console.error("Error fetching appointments from appointments table:", error);
        // Continue to legacy appointments from jobs table
      }

      // Also include legacy appointments from jobs table (for backward compatibility)
      const legacyAppointments = jobs
        .filter(j => j.appointmentDate && j.status !== 'cancelled')
        .map(j => {
          const appointmentDate = new Date(j.appointmentDate!);
          
          // Filter by date range if provided
          if (start) {
            const startDate = new Date(start as string);
            startDate.setHours(0, 0, 0, 0);
            if (appointmentDate < startDate) return null;
          }
          if (end) {
            const endDate = new Date(end as string);
            endDate.setHours(23, 59, 59, 999);
            if (appointmentDate > endDate) return null;
          }

          const startHours = appointmentDate.getHours();
          const startMinutes = appointmentDate.getMinutes();
          const startTime = `${String(startHours).padStart(2, '0')}:${String(startMinutes).padStart(2, '0')}`;
          
          const duration = (j as any).estimatedDuration || 60;
          const endDate = new Date(appointmentDate.getTime() + duration * 60 * 1000);
          const endHours = endDate.getHours();
          const endMinutes = endDate.getMinutes();
          const endTime = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
          
          return {
            id: j.id,
            jobId: j.jobId,
            partnerId: j.partnerId,
            teamMemberId: j.assignedTo || null,
            appointmentDate: j.appointmentDate,
            startTime,
            endTime,
            estimatedDuration: duration,
            status: j.status,
            address: j.address,
            latitude: (j as any).latitude || null,
            longitude: (j as any).longitude || null,
          };
        })
        .filter(a => a !== null);

      // Combine and deduplicate (prefer appointments table over legacy)
      const appointmentMap = new Map<string, any>();
      
      // Add legacy appointments first
      legacyAppointments.forEach(apt => {
        if (apt) {
          appointmentMap.set(apt.jobId + '_' + apt.appointmentDate?.toString(), apt);
        }
      });
      
      // Override with appointments table entries (these take precedence)
      appointments.forEach(apt => {
        const key = apt.jobId + '_' + apt.appointmentDate?.toString();
        appointmentMap.set(key, apt);
      });

      const allAppointments = Array.from(appointmentMap.values());
      
      // Sort by appointment date
      allAppointments.sort((a, b) => {
        const dateA = new Date(a.appointmentDate);
        const dateB = new Date(b.appointmentDate);
        return dateA.getTime() - dateB.getTime();
      });

      // Comprehensive logging of all appointments being returned
      console.log('[BOOKING APPOINTMENTS] FINAL RESULT:', {
        partnerId,
        dateRange: { start, end },
        totalAppointmentsFromAppointmentsTable: appointments.length,
        totalLegacyAppointments: legacyAppointments.length,
        totalAfterDeduplication: allAppointments.length,
        appointments: allAppointments.map(a => ({
          id: a.id,
          appointmentDate: a.appointmentDate?.toISOString(),
          startTime: a.startTime,
          status: a.status || 'scheduled',
          teamMemberId: a.teamMemberId || 'NULL',
          jobId: a.jobId,
          address: a.address
        }))
      });
      
      // Summary log for quick debugging
      console.log('[BOOKING APPOINTMENTS] SUMMARY:', {
        partnerId,
        totalReturned: allAppointments.length,
        withTeamMember: allAppointments.filter(a => a.teamMemberId).length,
        withoutTeamMember: allAppointments.filter(a => !a.teamMemberId).length,
        statusBreakdown: allAppointments.reduce((acc, a) => {
          const status = a.status || 'scheduled';
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      });

      res.json(allAppointments);
    } catch (error: any) {
      console.error("Error fetching appointments:", error);
      res.status(500).json({ error: "Failed to fetch appointments", details: error.message });
    }
  });

  // Simple in-memory cache for drive time results (cleared on server restart)
  const driveTimeCache: Map<string, { duration: number; distance: number; timestamp: number }> = new Map();
  const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  // Public route: Get drive time between two locations using Google Maps API
  app.get("/api/booking/drive-time", async (req, res) => {
    try {
      const { originLat, originLng, destLat, destLng } = req.query;
      
      if (!originLat || !originLng || !destLat || !destLng) {
        return res.status(400).json({ error: "Origin and destination coordinates required" });
      }

      const oLat = parseFloat(originLat as string);
      const oLng = parseFloat(originLng as string);
      const dLat = parseFloat(destLat as string);
      const dLng = parseFloat(destLng as string);

      if (isNaN(oLat) || isNaN(oLng) || isNaN(dLat) || isNaN(dLng)) {
        return res.status(400).json({ error: "Invalid coordinates" });
      }

      // Create cache key (round to 4 decimal places for reasonable precision)
      const cacheKey = `${oLat.toFixed(4)},${oLng.toFixed(4)}-${dLat.toFixed(4)},${dLng.toFixed(4)}`;
      
      // Check cache
      const cached = driveTimeCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return res.json({
          durationMinutes: cached.duration,
          distanceKm: cached.distance,
          source: 'cache'
        });
      }

      // Try Google Maps Distance Matrix API
      const googleApiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;
      
      console.log(`[DriveTime API] Request: (${oLat},${oLng}) -> (${dLat},${dLng}), API key: ${googleApiKey ? 'present' : 'missing'}`);
      
      if (googleApiKey) {
        try {
          const url = `https://maps.googleapis.com/maps/api/distancematrix/json?` +
            `origins=${oLat},${oLng}&destinations=${dLat},${dLng}` +
            `&mode=driving&units=metric&key=${googleApiKey}`;
          
          const response = await fetch(url);
          const data = await response.json();
          
          console.log(`[DriveTime API] Google response status: ${data.status}`);
          
          if (data.status === 'OK' && data.rows?.[0]?.elements?.[0]?.status === 'OK') {
            const element = data.rows[0].elements[0];
            const durationMinutes = Math.ceil(element.duration.value / 60);
            const distanceKm = Math.round(element.distance.value / 100) / 10; // Round to 1 decimal
            
            console.log(`[DriveTime API] Google Maps result: ${durationMinutes} min, ${distanceKm} km`);
            
            // Cache the result
            driveTimeCache.set(cacheKey, {
              duration: durationMinutes,
              distance: distanceKm,
              timestamp: Date.now()
            });
            
            return res.json({
              durationMinutes,
              distanceKm,
              source: 'google'
            });
          } else {
            console.log(`[DriveTime API] Google Maps failed: ${data.status}, element: ${data.rows?.[0]?.elements?.[0]?.status}`);
          }
        } catch (googleError) {
          console.error("[DriveTime API] Google Maps API error:", googleError);
          // Fall through to Haversine calculation
        }
      }

      // Fallback: Haversine formula for distance calculation
      console.log(`[DriveTime API] Using Haversine fallback`);
      const R = 6371; // Earth's radius in km
      const dLat2 = toRad(dLat - oLat);
      const dLng2 = toRad(dLng - oLng);
      const a = Math.sin(dLat2 / 2) * Math.sin(dLat2 / 2) +
                Math.cos(toRad(oLat)) * Math.cos(toRad(dLat)) *
                Math.sin(dLng2 / 2) * Math.sin(dLng2 / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distanceKm = Math.round(R * c * 10) / 10;
      
      // Estimate driving time (average 40km/h in urban areas)
      const durationMinutes = Math.round((distanceKm / 40) * 60);
      
      // Cache the result
      driveTimeCache.set(cacheKey, {
        duration: durationMinutes,
        distance: distanceKm,
        timestamp: Date.now()
      });
      
      res.json({
        durationMinutes,
        distanceKm,
        source: 'haversine'
      });
    } catch (error: any) {
      console.error("Error calculating drive time:", error);
      res.status(500).json({ error: "Failed to calculate drive time" });
    }
  });

  // Helper function for Haversine calculation
  function toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  // Public route: Get drive time from an address to coordinates (geocodes the address first)
  app.get("/api/booking/drive-time-address", async (req, res) => {
    try {
      const { originAddress, destLat, destLng } = req.query;
      
      if (!originAddress || !destLat || !destLng) {
        return res.status(400).json({ error: "Origin address and destination coordinates required" });
      }

      const dLat = parseFloat(destLat as string);
      const dLng = parseFloat(destLng as string);

      if (isNaN(dLat) || isNaN(dLng)) {
        return res.status(400).json({ error: "Invalid destination coordinates" });
      }

      const googleApiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;
      
      console.log(`[DriveTime Address API] Request: "${originAddress}" -> (${dLat},${dLng}), API key: ${googleApiKey ? 'present' : 'missing'}`);
      
      if (!googleApiKey) {
        // Without API key, return a conservative default
        console.log(`[DriveTime Address API] No API key, returning default`);
        return res.json({
          durationMinutes: 30,
          distanceKm: 20,
          source: 'default-no-api-key'
        });
      }

      // Create cache key using address
      const cacheKey = `addr:${(originAddress as string).toLowerCase().trim()}-${dLat.toFixed(4)},${dLng.toFixed(4)}`;
      
      // Check cache
      const cached = driveTimeCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`[DriveTime Address API] Returning cached result: ${cached.duration} min`);
        return res.json({
          durationMinutes: cached.duration,
          distanceKm: cached.distance,
          source: 'cache'
        });
      }

      try {
        // Use Distance Matrix API directly with address as origin
        const url = `https://maps.googleapis.com/maps/api/distancematrix/json?` +
          `origins=${encodeURIComponent(originAddress as string)}&destinations=${dLat},${dLng}` +
          `&mode=driving&units=metric&key=${googleApiKey}`;
        
        console.log(`[DriveTime Address API] Calling Google Maps API`);
        const response = await fetch(url);
        const data = await response.json();
        
        console.log(`[DriveTime Address API] Google response status: ${data.status}`);
        
        if (data.status === 'OK' && data.rows?.[0]?.elements?.[0]?.status === 'OK') {
          const element = data.rows[0].elements[0];
          const durationMinutes = Math.ceil(element.duration.value / 60);
          const distanceKm = Math.round(element.distance.value / 100) / 10;
          
          console.log(`[DriveTime Address API] Google Maps result: ${durationMinutes} min, ${distanceKm} km`);
          
          // Cache the result
          driveTimeCache.set(cacheKey, {
            duration: durationMinutes,
            distance: distanceKm,
            timestamp: Date.now()
          });
          
          return res.json({
            durationMinutes,
            distanceKm,
            source: 'google-address'
          });
        } else {
          console.log(`[DriveTime Address API] Google Maps failed: ${data.status}, element: ${data.rows?.[0]?.elements?.[0]?.status}`);
        }
      } catch (googleError) {
        console.error("[DriveTime Address API] Google Maps API error:", googleError);
      }

      // Fallback: Return conservative default
      console.log(`[DriveTime Address API] Returning default fallback`);
      res.json({
        durationMinutes: 30,
        distanceKm: 20,
        source: 'default-fallback'
      });
    } catch (error: any) {
      console.error("Error calculating drive time from address:", error);
      res.status(500).json({ error: "Failed to calculate drive time" });
    }
  });

  // Public route: Lookup customer by email or phone
  app.get("/api/booking/customers/lookup", async (req, res) => {
    try {
      const { partnerId, contact } = req.query;
      
      if (!partnerId || !contact) {
        return res.status(400).json({ error: "Partner ID and contact required" });
      }

      const customers = await storage.getCustomers(partnerId as string);
      
      // Search by email or phone
      const contactLower = (contact as string).toLowerCase().trim();
      const matchedCustomer = customers.find(c => 
        c.email?.toLowerCase() === contactLower ||
        c.phone?.replace(/\D/g, '') === contactLower.replace(/\D/g, '')
      );

      if (matchedCustomer) {
        res.json({
          found: true,
          customer: {
            id: matchedCustomer.id,
            firstName: matchedCustomer.firstName,
            lastName: matchedCustomer.lastName,
            email: matchedCustomer.email,
            phone: matchedCustomer.phone,
            company: matchedCustomer.company
          }
        });
      } else {
        res.json({ found: false, customer: null });
      }
    } catch (error: any) {
      console.error("Error looking up customer:", error);
      res.status(500).json({ error: "Failed to lookup customer" });
    }
  });

  // Public route: Create new customer from booking form
  app.post("/api/booking/customers", async (req, res) => {
    try {
      const { partnerId, firstName, lastName, email, phone, company } = req.body;
      
      if (!partnerId || !firstName || !lastName || !email) {
        return res.status(400).json({ error: "Partner ID, first name, last name, and email required" });
      }

      // Check if partner allows new clients
      const settings = await storage.getPartnerSettings(partnerId);
      const bookingSettings = settings?.bookingSettings ? JSON.parse(settings.bookingSettings) : {};
      
      if (bookingSettings.requireExistingCustomer && !bookingSettings.allowNewClients) {
        return res.status(403).json({ error: "This business only accepts bookings from existing clients" });
      }

      // Check if customer already exists
      const customers = await storage.getCustomers(partnerId);
      const existingCustomer = customers.find(c => c.email?.toLowerCase() === email.toLowerCase());
      
      if (existingCustomer) {
        return res.json({
          created: false,
          customer: {
            id: existingCustomer.id,
            firstName: existingCustomer.firstName,
            lastName: existingCustomer.lastName,
            email: existingCustomer.email,
            phone: existingCustomer.phone,
            company: existingCustomer.company
          }
        });
      }

      // Create new customer
      const newCustomer = await storage.createCustomer({
        partnerId,
        firstName,
        lastName,
        email,
        phone: phone || null,
        company: company || null,
        category: null,
        notes: 'Created via online booking form'
      });

      res.status(201).json({
        created: true,
        customer: {
          id: newCustomer.id,
          firstName: newCustomer.firstName,
          lastName: newCustomer.lastName,
          email: newCustomer.email,
          phone: newCustomer.phone,
          company: newCustomer.company
        }
      });
    } catch (error: any) {
      console.error("Error creating customer:", error);
      res.status(500).json({ error: "Failed to create customer" });
    }
  });

  // Public route: Create booking
  app.post("/api/bookings", async (req, res) => {
    try {
      const {
        partnerId,
        customerId,
        newCustomer,
        address,
        latitude,
        longitude,
        appointmentDate,
        appointmentTime,
        assignedTo,
        products,
        totalValue,
        notes,
        specialInstructions,
        customAnswers
      } = req.body;
      
      console.log('[BOOKING] Received products:', JSON.stringify(products, null, 2));

      if (!partnerId || !address) {
        return res.status(400).json({ error: "Partner ID and address required" });
      }

      // Either customerId or newCustomer must be provided
      let finalCustomerId = customerId;
      
      if (!customerId && newCustomer) {
        // Create the new customer first
        const customer = await storage.createCustomer({
          partnerId,
          firstName: newCustomer.firstName,
          lastName: newCustomer.lastName,
          email: newCustomer.email,
          phone: newCustomer.phone || null,
          company: newCustomer.company || null,
          category: null,
          notes: 'Created via online booking form'
        });
        finalCustomerId = customer.id;
      }

      // Parse appointment date and time
      let appointmentDateTime: Date | undefined;
      if (appointmentDate && appointmentTime) {
        // Handle both 12-hour (e.g., "9:00 AM") and 24-hour (e.g., "09:00") formats
        let hours: number;
        let minutes: number;
        
        const timeMatch = appointmentTime.match(/(\d+):(\d+)\s*(AM|PM)?/i);
        if (timeMatch) {
          hours = parseInt(timeMatch[1], 10);
          minutes = parseInt(timeMatch[2], 10);
          const period = timeMatch[3]?.toUpperCase();
          
          // Convert 12-hour to 24-hour if AM/PM present
          if (period === 'PM' && hours !== 12) {
            hours += 12;
          } else if (period === 'AM' && hours === 12) {
            hours = 0;
          }
        } else {
          // Fallback: try simple split
          const parts = appointmentTime.split(':').map(Number);
          hours = parts[0] || 0;
          minutes = parts[1] || 0;
        }
        
        // Create date from the date string (YYYY-MM-DD format expected)
        appointmentDateTime = new Date(appointmentDate + 'T00:00:00');
        if (!isNaN(appointmentDateTime.getTime())) {
          appointmentDateTime.setHours(hours, minutes, 0, 0);
        } else {
          console.error('Invalid appointment date:', appointmentDate);
          appointmentDateTime = undefined;
        }
      }

      // Calculate estimated duration from selected products
      let estimatedDuration = 60; // Default 60 minutes
      if (products && Array.isArray(products) && products.length > 0) {
        // Sum up durations from products
        const allProducts = await storage.getProducts(partnerId);
        let totalDuration = 0;
        for (const selectedProduct of products) {
          const product = allProducts.find(p => p.id === selectedProduct.id);
          if (product) {
            // Use appointmentDuration from product, default to 60 if not set
            const productDuration = product.appointmentDuration || 60;
            const quantity = selectedProduct.quantity || 1;
            totalDuration += productDuration * quantity;
          }
        }
        if (totalDuration > 0) {
          estimatedDuration = totalDuration;
        }
      }

      // Create the job (without appointmentDate - will be stored in appointments table)
      const job = await storage.createJob({
        partnerId,
        customerId: finalCustomerId || undefined,
        address,
        latitude: latitude || undefined,
        longitude: longitude || undefined,
        status: 'booked',
        assignedTo: assignedTo || undefined,
        // appointmentDate removed - use appointments table instead
        estimatedDuration,
        totalValue: totalValue?.toString() || '0',
        notes: [notes, specialInstructions, customAnswers ? `Custom answers: ${JSON.stringify(customAnswers)}` : null]
          .filter(Boolean)
          .join('\n\n') || null
      });

      // Create appointment if appointmentDateTime is provided
      let appointment = null;
      if (appointmentDateTime) {
        // Log assignment for debugging
        console.log('[BOOKING CREATE] Creating appointment with assignment:', {
          appointmentDate: appointmentDateTime.toISOString(),
          assignedTo: assignedTo || 'NOT SET',
          assignedToType: typeof assignedTo,
          jobId: job.id,
          partnerId
        });
        
        appointment = await storage.createAppointment({
          jobId: job.id,
          partnerId,
          appointmentDate: appointmentDateTime,
          estimatedDuration,
          assignedTo: assignedTo || undefined,
          products: products ? JSON.stringify(products.map((p: any) => ({
            id: p.id,
            name: p.name,
            quantity: p.quantity,
            variationName: p.variationName,
            price: p.price,
            duration: p.duration
          }))) : undefined,
          notes: [notes, specialInstructions].filter(Boolean).join('\n\n') || null,
          status: 'scheduled',
        });

        if (appointment && partnerId) {
          try {
            const target = await getCalendarTargetForAppointment(partnerId, appointment, job);
            if (target) {
              const extras = await buildCalendarEventExtras(job, appointment);
              const eventId = await createCalendarEvent(target.userId, {
                appointment: { ...appointment, id: appointment.id },
                jobAddress: job.address,
                ...extras,
              }, { byPartnerId: target.byPartnerId });
              if (eventId) {
                await storage.updateAppointment(appointment.id, { googleCalendarEventId: eventId });
              }
            }
          } catch (syncErr) {
            console.error("Google Calendar sync after booking create:", syncErr);
          }
        }
        
        // Verify the appointment was created with correct assignment
        console.log('[BOOKING CREATE] Appointment created:', {
          appointmentId: appointment.appointmentId,
          storedAssignedTo: appointment.assignedTo || 'NOT SET',
          expectedAssignedTo: assignedTo || 'NOT SET',
          matches: appointment.assignedTo === assignedTo
        });
      }

      // Get customer details for activity log
      let customerName = 'Online Booking';
      let customerEmail = '';
      if (finalCustomerId) {
        const customer = await storage.getCustomer(finalCustomerId);
        if (customer) {
          customerName = `${customer.firstName} ${customer.lastName}`.trim() || 'Online Booking';
          customerEmail = customer.email || '';
        }
      } else if (newCustomer) {
        customerName = `${newCustomer.firstName} ${newCustomer.lastName}`.trim();
        customerEmail = newCustomer.email || '';
      }

      // Log activity: Booking Created via Online Form
      try {
        await storage.createActivity({
          partnerId,
          jobId: job.jobId,
          customerId: finalCustomerId || undefined,
          userId: 'online_booking_form', // Special identifier for public bookings
          userEmail: customerEmail,
          userName: customerName,
          action: "creation",
          category: "job",
          title: "Booking Created via Online Form",
          description: `New booking created by ${customerName} at ${address}`,
          metadata: JSON.stringify({
            jobId: job.jobId,
            address: job.address,
            status: job.status,
            customerId: finalCustomerId,
            totalValue: totalValue,
            appointmentDate: appointmentDateTime?.toISOString(),
            appointmentId: appointment?.appointmentId,
            source: 'online_booking_form',
            products: products?.map((p: any) => {
              const productData = { 
                id: p.id, 
                name: p.name, 
                quantity: p.quantity,
                variationName: p.variationName 
              };
              console.log('[BOOKING] Storing product in metadata:', productData);
              return productData;
            }),
          }),
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });
      } catch (activityError) {
        // Log but don't fail the booking if activity creation fails
        console.error("Failed to create activity for booking:", activityError);
      }

      res.status(201).json({
        success: true,
        message: "Booking created successfully",
        booking: {
          id: job.id,
          jobId: job.jobId,
          address: job.address,
          appointmentDate: appointment?.appointmentDate || null,
          appointmentId: appointment?.appointmentId || null,
          status: job.status
        }
      });
    } catch (error: any) {
      console.error("Error creating booking:", error);
      res.status(500).json({ error: "Failed to create booking" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
