import type { Express } from "express";
import multer from "multer";
import { getStorage } from "firebase-admin/storage";
import { firestoreStorage } from "./firestore-storage";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
});

export function registerFirebaseUploadRoute(app: Express) {
  app.post("/api/upload-firebase", upload.any(), async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[] | undefined;
      const file = files?.[0];

      if (!file) {
        console.error("[upload-firebase] ERROR: No file in request");
        return res.status(400).json({ error: "upload_failed", detail: "No file uploaded" });
      }

      const { jobId, orderNumber, folderPath: rawFolderPath, userId, uploadType } = req.body;

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

      const folderPath = (rawFolderPath && String(rawFolderPath).trim().length > 0) ? String(rawFolderPath).trim() : "Photos";
      const safeName = file.originalname.replace(/\s+/g, '_');
      const ts = Date.now();
      const cleanOrder = (orderNumber || '').trim().replace(/^#/, '');

      // Determine storage path based on uploadType
      // 'client' = files uploaded by partner FOR editors to edit → orders/ folder (14-day TTL)
      // 'completed' = files uploaded BY editors as deliverables → completed/ folder (30-day TTL)
      let destPath: string;
      let expirationDays: number;
      let fileStatus: string;

      if (uploadType === 'client') {
        // Partner uploading files FOR editors to edit
        const basePath = cleanOrder ? `orders/${jobId}/${cleanOrder}` : `orders/${jobId}`;
        destPath = `${basePath}/${folderPath}/${ts}_${safeName}`;
        expirationDays = 14; // 14 days for source files
        fileStatus = 'for_editing';
      } else {
        // Editor uploading completed work (or default to completed for backward compatibility)
        const basePath = cleanOrder ? `completed/${jobId}/${cleanOrder}` : `completed/${jobId}`;
        destPath = `${basePath}/${folderPath}/${ts}_${safeName}`;
        expirationDays = 30; // 30 days for completed deliverables
        fileStatus = 'completed';
      }

      const bucket = getStorage().bucket(bucketName);
      const gcsFile = bucket.file(destPath);

      await gcsFile.save(file.buffer, {
        resumable: false,
        metadata: { contentType: file.mimetype },
      });

      const [url] = await gcsFile.getSignedUrl({
        action: "read",
        expires: Date.now() + expirationDays * 24 * 60 * 60 * 1000,
      });

      // Persist lightweight record for realtime gallery listeners
      try {
        // Resolve internal job id for consistency with listing queries
        const job = jobId ? await firestoreStorage.getJobByJobId(jobId) : null;
        const expiresAt = new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000);

        await firestoreStorage.createEditorUpload({
          jobId: job?.id || jobId,
          orderId: cleanOrder ? cleanOrder : null,
          fileName: safeName,
          originalName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          firebaseUrl: destPath,
          downloadUrl: url,
          folderPath,
          status: fileStatus,
          notes: null,
          folderToken: null,
          partnerFolderName: null,
          editorFolderName: folderPath,
          expiresAt,
        } as any);
      } catch (persistErr) {
        console.error('[upload-firebase] WARN: failed to persist editorUploads record', persistErr);
      }

      console.log(`[upload-firebase] Uploaded: ${destPath} (status: ${fileStatus}, expires in ${expirationDays} days)`);

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
      return res.status(500).json({
        error: "upload_failed",
        detail: err?.message || String(err),
      });
    }
  });
}


