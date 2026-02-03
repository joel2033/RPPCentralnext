import type { Express } from "express";
import multer from "multer";
import { getStorage } from "firebase-admin/storage";
import { firestoreStorage } from "./firestore-storage";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// Use disk storage for large files to avoid memory issues
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tmpDir = path.join(os.tmpdir(), 'uploads');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    cb(null, tmpDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB - increased for video files
  },
});

export function registerFirebaseUploadRoute(app: Express) {
  app.post("/api/upload-firebase", (req, res, next) => {
    upload.any()(req, res, (err) => {
      if (err) {
        console.error("[upload-firebase] Multer error:", err);
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({
              error: "upload_failed",
              detail: `File too large. Maximum size: 500MB. Your file exceeds this limit.`
            });
          }
          return res.status(400).json({
            error: "upload_failed",
            detail: `Upload error: ${err.message}`
          });
        }
        return res.status(500).json({
          error: "upload_failed",
          detail: err.message || "Unknown upload error"
        });
      }
      next();
    });
  }, async (req, res) => {
    // Wrap in try-catch to ensure all errors are caught and returned as JSON
    try {
      const files = req.files as Express.Multer.File[] | undefined;
      const file = files?.[0];

      console.log('[upload-firebase] Request received', {
        hasFiles: !!files,
        filesCount: files?.length || 0,
        fileInfo: file ? {
          name: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
          hasPath: !!(file as any).path,
          path: (file as any).path
        } : null
      });

      if (!file) {
        console.error("[upload-firebase] ERROR: No file in request");
        return res.status(400).json({ error: "upload_failed", detail: "No file uploaded" });
      }

      const { jobId, orderNumber, folderPath: rawFolderPath, userId, uploadType, folderToken, editorFolderName: rawEditorFolderName } = req.body;

      // Detailed diagnostic logging
      console.log('[upload-firebase] INCOMING', {
        bucket: process.env.FIREBASE_STORAGE_BUCKET,
        hasPrivateKey: Boolean(process.env.FIREBASE_PRIVATE_KEY),
        hasClientEmail: Boolean(process.env.FIREBASE_CLIENT_EMAIL),
        jobId,
        uploadType,
        file: file ? { name: file.originalname, type: file.mimetype, size: file.size } : null,
        fieldNames: Object.keys(req.body || {})
      });

      if (!jobId) {
        console.error("[upload-firebase] ERROR: Missing jobId");
        return res.status(400).json({ error: "upload_failed", detail: "jobId is required" });
      }

      const bucketName = (process.env.FIREBASE_STORAGE_BUCKET || '').replace(/['"]/g, '').trim();
      if (!bucketName) {
        console.error("[upload-firebase] ERROR: FIREBASE_STORAGE_BUCKET not set");
        return res.status(500).json({ error: "upload_failed", detail: "Storage bucket not configured" });
      }

      // Process folderPath - distinguish between folder uploads and editor-only uploads
      let folderPath: string | null = null;
      const hasFolderPath = rawFolderPath && String(rawFolderPath).trim().length > 0;

      if (hasFolderPath) {
        folderPath = String(rawFolderPath).trim();

        // Normalize folder path: if it's a full path (contains completed/ or orders/),
        // extract just the relative portion after the jobId
        if (folderPath.includes('/')) {
          const completedMatch = folderPath.match(/^completed\/[^\/]+\/(.+)$/);
          const ordersMatch = folderPath.match(/^orders\/[^\/]+\/(.+)$/);

          if (completedMatch) {
            folderPath = completedMatch[1]; // Extract path after "completed/jobId/"
          } else if (ordersMatch) {
            folderPath = ordersMatch[1]; // Extract path after "orders/jobId/"
          }
          // If no match, keep folderPath as-is (might be a relative path with subfolders)
        }
      }
      // If no folderPath provided, keep it as null (editor-only uploads, not for JobCard display)
      
      // If folderToken is provided, look up the folder to get the correct folderPath and partnerFolderName
      let resolvedFolderPath: string | null = folderPath;
      let partnerFolderName: string | null = null;
      if (folderToken && jobId) {
        try {
          // Resolve job ID first
          const job = await firestoreStorage.getJobByJobId(jobId);
          if (job?.id) {
            // Use adminDb from firebase-admin to query folders collection
            const { adminDb } = await import('./firebase-admin');
            const foldersSnapshot = await adminDb.collection("folders")
              .where("jobId", "==", job.id)
              .where("folderToken", "==", folderToken)
              .limit(1)
              .get();
            
            if (!foldersSnapshot.empty) {
              const folderData = foldersSnapshot.docs[0].data();
              partnerFolderName = folderData.partnerFolderName || null;
              // Use the folder's path from the database to ensure consistency
              resolvedFolderPath = folderData.folderPath || folderPath;
              console.log('[upload-firebase] Found folder for token:', {
                folderToken,
                partnerFolderName,
                folderPath: folderData.folderPath,
                resolvedFolderPath
              });
            } else {
              console.warn('[upload-firebase] Folder not found for token:', folderToken);
            }
          }
        } catch (folderLookupError) {
          console.error('[upload-firebase] Error looking up folder:', folderLookupError);
        }
      }

      const safeName = file.originalname.replace(/\s+/g, '_');
      const ts = Date.now();
      const cleanOrder = (orderNumber || '').trim().replace(/^#/, '');

      console.log('[upload-firebase] PROCESSED VALUES', {
        userId,
        jobId,
        uploadType,
        rawFolderPath,
        normalizedFolderPath: folderPath,
        orderNumber: cleanOrder,
        fileName: safeName
      });

      // Determine storage path based on uploadType
      // 'client' = files uploaded by partner FOR editors to edit → orders/ folder (14-day TTL)
      // 'completed' = files uploaded BY editors as deliverables → completed/ folder (30-day TTL)
      let destPath: string;
      let expirationDays: number;
      let fileStatus: string;

      if (uploadType === 'client') {
        // Partner uploading files FOR editors to edit
        // Structure: orders/userId/jobId/orderNumber/[folderPath/]files/filename
        const userPath = userId ? `orders/${userId}` : 'orders';
        const basePath = cleanOrder ? `${userPath}/${jobId}/${cleanOrder}` : `${userPath}/${jobId}`;

        if (resolvedFolderPath) {
          // Upload to specific folder (JobCard folder upload)
          destPath = `${basePath}/${resolvedFolderPath}/${ts}_${safeName}`;
        } else {
          // Editor-only upload (Upload page) - no folder, goes to 'files' directory
          destPath = `${basePath}/files/${ts}_${safeName}`;
        }

        expirationDays = 14; // 14 days for source files
        fileStatus = 'for_editing';
      } else {
        // Editor uploading completed work (or default to completed for backward compatibility)
        // Structure: completed/jobId/[folderPath/]filename (no userId)
        const basePath = cleanOrder ? `completed/${jobId}/${cleanOrder}` : `completed/${jobId}`;

        if (resolvedFolderPath) {
          destPath = `${basePath}/${resolvedFolderPath}/${ts}_${safeName}`;
        } else {
          destPath = `${basePath}/files/${ts}_${safeName}`;
        }

        expirationDays = 30; // 30 days for completed deliverables
        fileStatus = 'completed';
      }

      console.log('[upload-firebase] FIREBASE STORAGE PATH', {
        destPath,
        folderPath: resolvedFolderPath || 'null (editor-only upload)',
        folderToken: folderToken || 'null',
        fileStatus,
        expirationDays
      });

      const bucket = getStorage().bucket(bucketName);

      // Check for existing files with the same name in the same folder and delete them
      // This ensures files are replaced rather than duplicated
      try {
        const job = await firestoreStorage.getJobByJobId(jobId);
        if (job?.id) {
          const { adminDb } = await import('./firebase-admin');
          
          // Build query for existing files with same originalName in the same folder
          let existingFilesQuery = adminDb.collection("editorUploads")
            .where("jobId", "==", job.id)
            .where("originalName", "==", file.originalname);
          
          // Handle folderPath matching - need to match null or the specific folder path
          if (resolvedFolderPath) {
            existingFilesQuery = existingFilesQuery.where("folderPath", "==", resolvedFolderPath);
          } else {
            // For files without a folder path (editor-only uploads), match null folderPath
            existingFilesQuery = existingFilesQuery.where("folderPath", "==", null);
          }
          
          const existingFilesSnapshot = await existingFilesQuery.get();
          
          if (!existingFilesSnapshot.empty) {
            console.log(`[upload-firebase] Found ${existingFilesSnapshot.docs.length} existing file(s) with same name "${file.originalname}" in folder "${resolvedFolderPath || 'null'}" - will replace`);
            
            // Delete each existing file
            for (const doc of existingFilesSnapshot.docs) {
              const existingFile = doc.data();
              const existingFileId = doc.id;
              
              try {
                // Delete from Firebase Storage first
                if (existingFile.firebaseUrl) {
                  const existingGcsFile = bucket.file(existingFile.firebaseUrl);
                  const [exists] = await existingGcsFile.exists();
                  if (exists) {
                    await existingGcsFile.delete();
                    console.log(`[upload-firebase] Deleted existing file from storage: ${existingFile.firebaseUrl}`);
                  } else {
                    console.log(`[upload-firebase] Existing file not found in storage (already deleted?): ${existingFile.firebaseUrl}`);
                  }
                }
                
                // Delete from Firestore
                await firestoreStorage.deleteEditorUpload(existingFileId);
                console.log(`[upload-firebase] Deleted existing file record from Firestore: ${existingFileId} (${existingFile.originalName})`);
              } catch (deleteError: any) {
                console.error(`[upload-firebase] Error deleting existing file ${existingFileId}:`, deleteError.message);
                // Continue with upload even if deletion fails - don't block the new upload
              }
            }
          }
        }
      } catch (duplicateCheckError: any) {
        console.error('[upload-firebase] Error checking for duplicate files:', duplicateCheckError.message);
        // Continue with upload even if duplicate check fails
      }

      const gcsFile = bucket.file(destPath);

      try {
        // Get file path from diskStorage (multer adds 'path' property when using diskStorage)
        const filePath = (file as Express.Multer.File & { path?: string }).path;
        
        if (!filePath) {
          throw new Error('File path not found. Disk storage may not be working correctly.');
        }

        if (!fs.existsSync(filePath)) {
          throw new Error(`Temporary file not found at path: ${filePath}`);
        }

        console.log(`[upload-firebase] File path: ${filePath}, size: ${file.size / 1024 / 1024}MB`);

        // Use resumable uploads for large files (>50MB) to avoid memory/timeout issues
        const useResumable = file.size > 50 * 1024 * 1024;
        
        if (useResumable) {
          console.log(`[upload-firebase] Using resumable upload for large file: ${file.size / 1024 / 1024}MB`);
          const stream = gcsFile.createWriteStream({
            metadata: { contentType: file.mimetype },
            resumable: true,
          });

          await new Promise<void>((resolve, reject) => {
            stream.on('error', (err) => {
              console.error('[upload-firebase] Stream error:', err);
              reject(err);
            });
            stream.on('finish', () => {
              console.log('[upload-firebase] Resumable upload completed');
              // Clean up temp file
              try {
                if (fs.existsSync(filePath)) {
                  fs.unlinkSync(filePath);
                  console.log('[upload-firebase] Temp file cleaned up');
                }
              } catch (cleanupErr) {
                console.error('[upload-firebase] Error cleaning up temp file:', cleanupErr);
              }
              resolve();
            });
            
            // Handle read stream errors
            const readStream = fs.createReadStream(filePath);
            readStream.on('error', (err) => {
              console.error('[upload-firebase] Read stream error:', err);
              reject(err);
            });
            
            readStream.pipe(stream);
          });
        } else {
          // For smaller files, read into buffer and upload
          const fileBuffer = fs.readFileSync(filePath);
          await gcsFile.save(fileBuffer, {
            resumable: false,
            metadata: { contentType: file.mimetype },
          });
          // Clean up temp file
          try {
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              console.log('[upload-firebase] Temp file cleaned up');
            }
          } catch (cleanupErr) {
            console.error('[upload-firebase] Error cleaning up temp file:', cleanupErr);
          }
        }
      } catch (saveError: any) {
        console.error('[upload-firebase] Error saving to Firebase Storage:', saveError);
        console.error('[upload-firebase] Error stack:', saveError?.stack);
        // Clean up temp file on error
        const filePath = (file as Express.Multer.File & { path?: string }).path;
        if (filePath && fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
            console.log('[upload-firebase] Temp file cleaned up after error');
          } catch (cleanupErr) {
            console.error('[upload-firebase] Error cleaning up temp file:', cleanupErr);
          }
        }
        throw new Error(`Failed to save file to storage: ${saveError.message || String(saveError)}`);
      }

      const [url] = await gcsFile.getSignedUrl({
        action: "read",
        expires: Date.now() + expirationDays * 24 * 60 * 60 * 1000,
      });

      // Persist lightweight record for realtime gallery listeners
      try {
        // Resolve internal job id for consistency with listing queries
        const job = jobId ? await firestoreStorage.getJobByJobId(jobId) : null;
        const expiresAt = new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000);

        // Resolve actual order ID from order number to ensure folder grouping consistency
        // cleanOrder is the order NUMBER without # (e.g., "00059"), but we need the order UUID
        // Order numbers in the database are stored WITH the # prefix (e.g., "#00059")
        let resolvedOrderId: string | null = null;
        if (cleanOrder && job?.partnerId) {
          try {
            // Try with # prefix first (how orders are stored in DB)
            let order = await firestoreStorage.getOrderByNumber(`#${cleanOrder}`, job.partnerId);
            if (!order) {
              // Fallback: try without # in case the order was stored differently
              order = await firestoreStorage.getOrderByNumber(cleanOrder, job.partnerId);
            }
            if (order?.id) {
              resolvedOrderId = order.id;
              console.log(`[upload-firebase] Resolved order number ${cleanOrder} to order ID ${order.id}`);
            } else {
              console.warn(`[upload-firebase] Could not find order for number ${cleanOrder}, using null`);
            }
          } catch (orderLookupErr) {
            console.error('[upload-firebase] Error looking up order by number:', orderLookupErr);
          }
        }

        // Determine the editor folder name to store
        // Priority: 1) Explicit editorFolderName from client, 2) partnerFolderName from folder document, 3) resolvedFolderPath
        const editorFolderNameToStore = rawEditorFolderName 
          ? String(rawEditorFolderName).trim() 
          : (partnerFolderName || resolvedFolderPath || null);
        
        await firestoreStorage.createEditorUpload({
          jobId: job?.id || jobId,
          orderId: resolvedOrderId,
          fileName: safeName,
          originalName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          firebaseUrl: destPath,
          downloadUrl: url,
          folderPath: resolvedFolderPath || null, // Use resolved folderPath (from folder document if folderToken exists)
          status: fileStatus,
          notes: null,
          folderToken: folderToken || null, // Use provided folderToken for standalone folders
          partnerFolderName: partnerFolderName, // Get from folder document if folderToken exists
          editorFolderName: editorFolderNameToStore, // Use explicit name from client or fallback
          expiresAt,
        } as any);
      } catch (persistErr) {
        console.error('[upload-firebase] WARN: failed to persist editorUploads record', persistErr);
      }

      console.log(`[upload-firebase] SUCCESS: Uploaded to ${destPath} (status: ${fileStatus}, folderPath: ${folderPath || 'null'}, expires in ${expirationDays} days)`);

      return res.json({
        path: destPath,
        url,
        fileName: safeName,
        folderPath,
        orderNumber: cleanOrder || undefined,
        status: fileStatus,
        createdAt: Date.now(),
        expiresAt: Date.now() + expirationDays * 24 * 60 * 60 * 1000
      });
    } catch (err: any) {
      console.error("[upload-firebase] ERROR:", err);
      console.error("[upload-firebase] ERROR stack:", err?.stack);
      console.error("[upload-firebase] ERROR details:", {
        name: err?.name,
        message: err?.message,
        code: err?.code,
        statusCode: err?.statusCode,
        response: err?.response
      });
      
      // Ensure response hasn't been sent yet
      if (res.headersSent) {
        console.error("[upload-firebase] Response already sent, cannot send error");
        return;
      }
      
      // Return detailed error for debugging (in production, you might want to hide some details)
      const errorDetail = err?.message || String(err);
      const errorCode = err?.code;
      
      try {
        return res.status(500).json({
          error: "upload_failed",
          detail: errorDetail,
          code: errorCode || undefined,
          // Include file info if available for debugging
          fileInfo: req.files?.[0] ? {
            name: req.files[0].originalname,
            size: req.files[0].size
          } : undefined
        });
      } catch (sendErr) {
        console.error("[upload-firebase] Failed to send error response:", sendErr);
      }
    }
  });
}


