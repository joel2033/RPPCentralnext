import type { Response } from "express";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Send a safe error response: log full error server-side, return generic message in production.
 * In development, optionally include details for debugging.
 */
export function sendSafeError(
  res: Response,
  status: number,
  userMessage: string,
  err?: unknown
): void {
  if (err !== undefined && err !== null) {
    console.error("[safeError]", userMessage, err);
  }
  const payload: { error: string; details?: string; code?: string } = {
    error: userMessage,
  };
  if (!isProduction && err instanceof Error) {
    payload.details = err.message;
    if (err instanceof Error && "code" in err) {
      payload.code = String((err as Error & { code?: string }).code);
    }
  }
  res.status(status).json(payload);
}
