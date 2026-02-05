/**
 * Google Calendar integration: OAuth, token storage, and Calendar API (create/update/delete events, list busy).
 * Connections are stored in Firestore collection googleCalendarConnections keyed by userId (Firebase UID).
 * Each user (partner, admin, photographer) can connect their own calendar.
 */

import { randomBytes } from "node:crypto";
import { google } from "googleapis";
import { adminDb } from "./firebase-admin";
import type { Appointment } from "@shared/schema";

const COLLECTION = "googleCalendarConnections";
const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
];
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export interface GoogleCalendarConnection {
  id: string;
  userId: string; // Firebase UID - each user has their own connection
  partnerId: string;
  refreshToken: string;
  accessToken: string;
  accessTokenExpiry: number; // ms since epoch
  calendarId?: string | null; // default primary
  twoWaySyncEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const stateStore = new Map<
  string,
  { userId: string; partnerId: string; expiresAt: number }
>();

function getOAuth2Client(baseUrl?: string) {
  const rawId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const rawSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  const clientId = rawId?.replace(/^["']|["']$/g, "").trim();
  const clientSecret = rawSecret?.replace(/^["']|["']$/g, "").trim();
  const url = (baseUrl ?? process.env.BASE_URL ?? "").replace(/^["']|["']$/g, "").trim();
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CALENDAR_NOT_CONFIGURED");
  }
  if (!url) {
    throw new Error("GOOGLE_CALENDAR_BASE_URL_REQUIRED");
  }
  const redirectUri = `${url.replace(/\/$/, "")}/api/auth/google-calendar/callback`;
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

function docToConnection(
  doc: FirebaseFirestore.DocumentSnapshot
): GoogleCalendarConnection | null {
  const data = doc.data();
  if (!data) return null;
  return {
    id: doc.id,
    userId: data.userId ?? "",
    partnerId: data.partnerId,
    refreshToken: data.refreshToken,
    accessToken: data.accessToken,
    accessTokenExpiry: data.accessTokenExpiry?.toMillis?.() ?? data.accessTokenExpiry ?? 0,
    calendarId: data.calendarId ?? null,
    twoWaySyncEnabled: data.twoWaySyncEnabled === true,
    createdAt: data.createdAt?.toDate?.() ?? new Date(data.createdAt),
    updatedAt: data.updatedAt?.toDate?.() ?? new Date(data.updatedAt),
  };
}

/** Get connection for a specific user (Firebase UID). */
export async function getConnection(
  userId: string
): Promise<GoogleCalendarConnection | null> {
  const snapshot = await adminDb
    .collection(COLLECTION)
    .where("userId", "==", userId)
    .limit(1)
    .get();
  if (snapshot.empty) return null;
  return docToConnection(snapshot.docs[0]);
}

/** Legacy: get connection keyed only by partnerId (for existing docs before user-scoped connections). */
export async function getConnectionByPartnerId(
  partnerId: string
): Promise<GoogleCalendarConnection | null> {
  const snapshot = await adminDb
    .collection(COLLECTION)
    .where("partnerId", "==", partnerId)
    .limit(1)
    .get();
  if (snapshot.empty) return null;
  const conn = docToConnection(snapshot.docs[0]);
  if (!conn) return null;
  if (conn.userId) return conn;
  return { ...conn, userId: "" };
}

export async function saveConnection(
  userId: string,
  partnerId: string,
  data: {
    refreshToken: string;
    accessToken: string;
    accessTokenExpiry: number;
    calendarId?: string | null;
    twoWaySyncEnabled?: boolean;
  }
): Promise<GoogleCalendarConnection> {
  const existing = await getConnection(userId);
  const now = new Date();
  const payload = {
    userId,
    partnerId,
    refreshToken: data.refreshToken,
    accessToken: data.accessToken,
    accessTokenExpiry: data.accessTokenExpiry,
    calendarId: data.calendarId ?? null,
    twoWaySyncEnabled: data.twoWaySyncEnabled ?? false,
    updatedAt: now,
    ...(existing ? {} : { createdAt: now }),
  };
  if (existing) {
    await adminDb.collection(COLLECTION).doc(existing.id).update(payload);
    return { ...existing, ...payload, id: existing.id };
  }
  const ref = await adminDb.collection(COLLECTION).add(payload);
  const doc = await ref.get();
  return docToConnection(doc)!;
}

export async function deleteConnection(userId: string): Promise<boolean> {
  const existing = await getConnection(userId);
  if (!existing) return false;
  await adminDb.collection(COLLECTION).doc(existing.id).delete();
  return true;
}

export async function updateConnectionSettings(
  userId: string,
  settings: { twoWaySyncEnabled?: boolean }
): Promise<GoogleCalendarConnection | null> {
  const existing = await getConnection(userId);
  if (!existing) return null;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof settings.twoWaySyncEnabled === "boolean") {
    updates.twoWaySyncEnabled = settings.twoWaySyncEnabled;
  }
  await adminDb.collection(COLLECTION).doc(existing.id).update(updates);
  return getConnection(userId);
}

/** Generate OAuth URL and store state for callback. baseUrl can be derived from request when env BASE_URL is not set. */
export function getAuthUrl(userId: string, partnerId: string, baseUrl?: string): string {
  const oauth2 = getOAuth2Client(baseUrl);
  const state = randomBytes(24).toString("hex");
  stateStore.set(state, {
    userId,
    partnerId,
    expiresAt: Date.now() + STATE_TTL_MS,
  });
  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state,
  });
}

/** Exchange code for tokens and save connection. Returns userId and partnerId. */
export async function exchangeCodeForTokens(
  code: string,
  state: string
): Promise<{ userId: string; partnerId: string } | { error: string }> {
  const stored = stateStore.get(state);
  stateStore.delete(state);
  if (!stored || Date.now() > stored.expiresAt) {
    return { error: "Invalid or expired state" };
  }
  const oauth2 = getOAuth2Client();
  const { tokens } = await oauth2.getToken(code);
  if (!tokens.refresh_token) {
    return { error: "No refresh token received" };
  }
  const expiry = tokens.expiry_date ?? Date.now() + 3600 * 1000;
  await saveConnection(stored.userId, stored.partnerId, {
    refreshToken: tokens.refresh_token,
    accessToken: tokens.access_token!,
    accessTokenExpiry: expiry,
    twoWaySyncEnabled: false,
  });
  return { userId: stored.userId, partnerId: stored.partnerId };
}

/** Get valid connection with refreshed access token if needed. */
export async function getValidConnection(
  userId: string
): Promise<GoogleCalendarConnection | null> {
  const conn = await getConnection(userId);
  if (!conn) return null;
  return refreshConnectionIfNeeded(conn);
}

/** Legacy: get valid connection by partnerId (for docs stored before user-scoped connections). */
export async function getValidConnectionByPartnerId(
  partnerId: string
): Promise<GoogleCalendarConnection | null> {
  const conn = await getConnectionByPartnerId(partnerId);
  if (!conn) return null;
  return refreshConnectionIfNeeded(conn);
}

async function refreshConnectionIfNeeded(
  conn: GoogleCalendarConnection
): Promise<GoogleCalendarConnection> {
  const now = Date.now();
  if (conn.accessTokenExpiry > now + 60 * 1000) return conn;
  const oauth2 = getOAuth2Client();
  oauth2.setCredentials({
    refresh_token: conn.refreshToken,
  });
  const { credentials } = await oauth2.refreshAccessToken();
  const newExpiry = credentials.expiry_date ?? now + 3600 * 1000;
  await adminDb
    .collection(COLLECTION)
    .doc(conn.id)
    .update({
      accessToken: credentials.access_token,
      accessTokenExpiry: newExpiry,
      updatedAt: new Date(),
    });
  return (conn.userId ? getConnection(conn.userId) : getConnectionByPartnerId(conn.partnerId))!;
}

const calendarIdDefault = "primary";

function getCalendar(conn: GoogleCalendarConnection) {
  const oauth2 = getOAuth2Client();
  oauth2.setCredentials({
    refresh_token: conn.refreshToken,
    access_token: conn.accessToken,
    expiry_date: conn.accessTokenExpiry,
  });
  return google.calendar({ version: "v3", auth: oauth2 });
}

export interface SyncAppointmentPayload {
  appointment: Appointment & { id: string };
  jobAddress?: string;
  /** e.g. "Blake Dunn (Ray White RPG)" */
  customerName?: string;
  /** Formatted product lines, e.g. "(1) Starter\n(1) Video [40s Social Reel]" */
  productsDescription?: string;
  /** Full URL to the job in the app, e.g. "https://app.example.com/jobs/abc123" */
  jobLink?: string;
}

function buildEventDescription(payload: SyncAppointmentPayload): string {
  const parts: string[] = [];
  if (payload.customerName) {
    parts.push(`Customer: ${payload.customerName}`);
  }
  if (payload.productsDescription) {
    parts.push(`Products:\n${payload.productsDescription}`);
  }
  parts.push(`Notes: ${payload.appointment.notes ?? "-"}`);
  if (payload.jobLink) {
    parts.push(payload.jobLink);
  }
  return parts.join("\n\n");
}

/** Create a Google Calendar event for an appointment. Returns event id or null on failure. */
export async function createCalendarEvent(
  userIdOrPartnerId: string,
  payload: SyncAppointmentPayload,
  options?: { byPartnerId?: boolean }
): Promise<string | null> {
  const conn = options?.byPartnerId
    ? await getValidConnectionByPartnerId(userIdOrPartnerId)
    : await getValidConnection(userIdOrPartnerId);
  if (!conn) return null;
  const cal = getCalendar(conn);
  const calId = conn.calendarId || calendarIdDefault;
  const start = payload.appointment.appointmentDate instanceof Date
    ? payload.appointment.appointmentDate
    : new Date(payload.appointment.appointmentDate);
  const duration = payload.appointment.estimatedDuration ?? 60;
  const end = new Date(start.getTime() + duration * 60 * 1000);
  const description = buildEventDescription(payload);
  try {
    const res = await cal.events.insert({
      calendarId: calId,
      requestBody: {
        summary: payload.jobAddress ?? `Appointment ${payload.appointment.appointmentId}`,
        description,
        location: payload.jobAddress ?? undefined,
        start: { dateTime: start.toISOString(), timeZone: "UTC" },
        end: { dateTime: end.toISOString(), timeZone: "UTC" },
        extendedProperties: {
          private: { source: "rppcentral", appointmentId: payload.appointment.appointmentId },
        },
      },
    });
    return res.data.id ?? null;
  } catch (err) {
    console.error("[Google Calendar] createCalendarEvent error:", err);
    return null;
  }
}

/** Update an existing Google Calendar event. */
export async function updateCalendarEvent(
  userIdOrPartnerId: string,
  googleCalendarEventId: string,
  payload: SyncAppointmentPayload,
  options?: { byPartnerId?: boolean }
): Promise<boolean> {
  const conn = options?.byPartnerId
    ? await getValidConnectionByPartnerId(userIdOrPartnerId)
    : await getValidConnection(userIdOrPartnerId);
  if (!conn) return false;
  const cal = getCalendar(conn);
  const calId = conn.calendarId || calendarIdDefault;
  const start = payload.appointment.appointmentDate instanceof Date
    ? payload.appointment.appointmentDate
    : new Date(payload.appointment.appointmentDate);
  const duration = payload.appointment.estimatedDuration ?? 60;
  const end = new Date(start.getTime() + duration * 60 * 1000);
  const description = buildEventDescription(payload);
  try {
    await cal.events.patch({
      calendarId: calId,
      eventId: googleCalendarEventId,
      requestBody: {
        summary: payload.jobAddress ?? `Appointment ${payload.appointment.appointmentId}`,
        description,
        location: payload.jobAddress ?? undefined,
        start: { dateTime: start.toISOString(), timeZone: "UTC" },
        end: { dateTime: end.toISOString(), timeZone: "UTC" },
        extendedProperties: {
          private: { source: "rppcentral", appointmentId: payload.appointment.appointmentId },
        },
      },
    });
    return true;
  } catch (err) {
    console.error("[Google Calendar] updateCalendarEvent error:", err);
    return false;
  }
}

/** Delete a Google Calendar event. */
export async function deleteCalendarEvent(
  userIdOrPartnerId: string,
  googleCalendarEventId: string,
  options?: { byPartnerId?: boolean }
): Promise<boolean> {
  const conn = options?.byPartnerId
    ? await getValidConnectionByPartnerId(userIdOrPartnerId)
    : await getValidConnection(userIdOrPartnerId);
  if (!conn) return false;
  const cal = getCalendar(conn);
  const calId = conn.calendarId || calendarIdDefault;
  try {
    await cal.events.delete({ calendarId: calId, eventId: googleCalendarEventId });
    return true;
  } catch (err) {
    console.error("[Google Calendar] deleteCalendarEvent error:", err);
    return false;
  }
}

export interface BusyBlock {
  start: string; // ISO
  end: string;
  title?: string;
}

/** List events in range for two-way sync (busy blocks with optional titles). */
export async function listBusyBlocks(
  userIdOrPartnerId: string,
  start: Date,
  end: Date,
  options?: { byPartnerId?: boolean }
): Promise<BusyBlock[]> {
  const conn = options?.byPartnerId
    ? await getValidConnectionByPartnerId(userIdOrPartnerId)
    : await getValidConnection(userIdOrPartnerId);
  if (!conn || !conn.twoWaySyncEnabled) return [];
  const cal = getCalendar(conn);
  const calId = conn.calendarId || calendarIdDefault;
  try {
    const res = await cal.events.list({
      calendarId: calId,
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
    });
    const items = res.data.items ?? [];
    return items
      .filter((e) => e.start?.dateTime && e.end?.dateTime)
      .filter((e) => {
        const source = (e.extendedProperties as any)?.private?.source;
        return source !== "rppcentral";
      })
      .map((e) => ({
        start: e.start!.dateTime!,
        end: e.end!.dateTime!,
        title: e.summary ?? undefined,
      }));
  } catch (err) {
    console.error("[Google Calendar] listBusyBlocks error:", err);
    return [];
  }
}
