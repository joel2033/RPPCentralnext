import dotenv from "dotenv";
// Load .env.local first (override), then .env
dotenv.config({ path: ".env.local" });
dotenv.config();
import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import cron from "node-cron";
import { registerRoutes } from "./routes";
import { registerFirebaseUploadRoute } from "./upload-firebase-route";
import { setupVite, serveStatic, log } from "./vite";
import type { ListenOptions } from "net";

const app = express();
app.use(cors());
// Increase payload size limit for image uploads (base64 encoding makes images ~33% larger)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Health check endpoint
  app.get('/health', (_req, res) => res.json({ ok: true }));

  // Register simple Firebase upload endpoint BEFORE other routes so it takes precedence
  registerFirebaseUploadRoute(app);

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const defaultPort = parseInt(process.env.PORT || "5000", 10);
  const listenOptions: ListenOptions & { reusePort?: boolean } = {
    port: defaultPort,
    host: "0.0.0.0",
  };

  const applyPlatformSocketOptions = () => {
    if (process.platform === "linux") {
      listenOptions.reusePort = true;
    } else {
      delete listenOptions.reusePort;
    }
  };

  const startServer = (portToUse: number) => {
    listenOptions.port = portToUse;
    applyPlatformSocketOptions();

    server.listen(listenOptions, () => {
      log(`serving on port ${portToUse}`);

      // Setup daily cleanup job for expired order files
      // Runs every day at 2:00 AM
      cron.schedule('0 2 * * *', async () => {
        try {
          log('[CRON] Starting scheduled cleanup of expired order files', 'cleanup');

          const response = await fetch(`http://localhost:${portToUse}/api/cleanup/expired-orders-files`, {
            method: 'DELETE',
          });

          const result = await response.json();

          if (response.ok) {
            log(`[CRON] Cleanup completed: ${result.deletedCount} files deleted, ${result.errorCount} errors`, 'cleanup');
          } else {
            log(`[CRON] Cleanup failed: ${result.error || 'Unknown error'}`, 'cleanup');
          }
        } catch (error: any) {
          log(`[CRON] Cleanup error: ${error.message}`, 'cleanup');
        }
      });

      log('Scheduled daily cleanup job at 2:00 AM', 'cleanup');
    });
  };

  let hasRetriedPort = false;

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE" && !process.env.PORT && !hasRetriedPort) {
      hasRetriedPort = true;
      const fallbackPort = (listenOptions.port || defaultPort) + 1;
      log(`Port ${listenOptions.port} is in use. Retrying on port ${fallbackPort}…`);

      if (server.listening) {
        server.close(() => {
          startServer(fallbackPort);
        });
      } else {
        startServer(fallbackPort);
      }
      return;
    }

    throw err;
  });

  startServer(defaultPort);
})();
