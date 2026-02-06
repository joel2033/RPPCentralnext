/**
 * Xero integration: OAuth, token storage, and connection management.
 * Connections are stored in Firestore collection xeroConnections keyed by partnerId.
 * One Xero connection per partner/studio.
 */

import { randomBytes } from "node:crypto";
import { adminDb } from "./firebase-admin";

const COLLECTION = "xeroConnections";
const SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "accounting.transactions",
  "accounting.contacts",
  "accounting.settings.read",
  "accounting.reports.read",
].join(" ");
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const XERO_AUTH_URL = "https://login.xero.com/identity/connect/authorize";
const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
const XERO_CONNECTIONS_URL = "https://api.xero.com/connections";

export interface XeroConnection {
  id: string;
  partnerId: string;
  refreshToken: string;
  accessToken: string;
  accessTokenExpiry: number; // ms since epoch
  tenantId: string | null;
  tenantName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const stateStore = new Map<
  string,
  { partnerId: string; expiresAt: number }
>();

function getConfig(baseUrl?: string) {
  const rawId = process.env.XERO_CLIENT_ID;
  const rawSecret = process.env.XERO_CLIENT_SECRET;
  const clientId = rawId?.replace(/^["']|["']$/g, "").trim();
  const clientSecret = rawSecret?.replace(/^["']|["']$/g, "").trim();
  const url = (baseUrl ?? process.env.BASE_URL ?? "").replace(/^["']|["']$/g, "").trim();
  if (!clientId || !clientSecret) {
    throw new Error("XERO_NOT_CONFIGURED");
  }
  if (!url) {
    throw new Error("XERO_BASE_URL_REQUIRED");
  }
  const redirectUri = `${url.replace(/\/$/, "")}/api/auth/xero/callback`;
  return { clientId, clientSecret, redirectUri };
}

function docToConnection(
  doc: FirebaseFirestore.DocumentSnapshot
): XeroConnection | null {
  const data = doc.data();
  if (!data) return null;
  return {
    id: doc.id,
    partnerId: data.partnerId ?? "",
    refreshToken: data.refreshToken ?? "",
    accessToken: data.accessToken ?? "",
    accessTokenExpiry: data.accessTokenExpiry?.toMillis?.() ?? data.accessTokenExpiry ?? 0,
    tenantId: data.tenantId ?? null,
    tenantName: data.tenantName ?? null,
    createdAt: data.createdAt?.toDate?.() ?? new Date(data.createdAt),
    updatedAt: data.updatedAt?.toDate?.() ?? new Date(data.updatedAt),
  };
}

/** Get connection for a partner. */
export async function getConnection(
  partnerId: string
): Promise<XeroConnection | null> {
  const snapshot = await adminDb
    .collection(COLLECTION)
    .where("partnerId", "==", partnerId)
    .limit(1)
    .get();
  if (snapshot.empty) return null;
  return docToConnection(snapshot.docs[0]);
}

export async function saveConnection(
  partnerId: string,
  data: {
    refreshToken: string;
    accessToken: string;
    accessTokenExpiry: number;
    tenantId: string | null;
    tenantName: string | null;
  }
): Promise<XeroConnection> {
  const existing = await getConnection(partnerId);
  const now = new Date();
  const payload = {
    partnerId,
    refreshToken: data.refreshToken,
    accessToken: data.accessToken,
    accessTokenExpiry: data.accessTokenExpiry,
    tenantId: data.tenantId ?? null,
    tenantName: data.tenantName ?? null,
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

export async function deleteConnection(partnerId: string): Promise<boolean> {
  const existing = await getConnection(partnerId);
  if (!existing) return false;
  await adminDb.collection(COLLECTION).doc(existing.id).delete();
  return true;
}

/** Generate OAuth URL and store state for callback. */
export function getAuthUrl(partnerId: string, baseUrl?: string): string {
  const { clientId, redirectUri } = getConfig(baseUrl);
  const state = randomBytes(24).toString("hex");
  stateStore.set(state, {
    partnerId,
    expiresAt: Date.now() + STATE_TTL_MS,
  });
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: SCOPES,
    state,
  });
  return `${XERO_AUTH_URL}?${params.toString()}`;
}

/** Fetch tenant connections from Xero API. */
async function fetchConnections(accessToken: string): Promise<Array<{ tenantId: string; tenantName: string; tenantType: string }>> {
  const res = await fetch(XERO_CONNECTIONS_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Xero connections API error: ${res.status}`);
  }
  const data = (await res.json()) as Array<{ tenantId: string; tenantName: string; tenantType: string }>;
  return data ?? [];
}

/** Exchange code for tokens and save connection. Returns partnerId. */
export async function exchangeCodeForTokens(
  code: string,
  state: string
): Promise<{ partnerId: string } | { error: string }> {
  const stored = stateStore.get(state);
  stateStore.delete(state);
  if (!stored || Date.now() > stored.expiresAt) {
    return { error: "Invalid or expired state" };
  }
  const { clientId, clientSecret, redirectUri } = getConfig();
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const tokenRes = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }).toString(),
  });
  if (!tokenRes.ok) {
    const errBody = await tokenRes.text();
    console.error("[Xero] token exchange error:", tokenRes.status, errBody);
    return { error: "Token exchange failed" };
  }
  const tokenData = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };
  const refreshToken = tokenData.refresh_token;
  if (!refreshToken) {
    return { error: "No refresh token received" };
  }
  const expiresIn = tokenData.expires_in ?? 1800; // 30 min default
  const accessTokenExpiry = Date.now() + expiresIn * 1000;
  // Fetch connections to get tenant info (pick first ORGANISATION)
  const connections = await fetchConnections(tokenData.access_token);
  const org = connections.find((c) => c.tenantType === "ORGANISATION") ?? connections[0];
  const tenantId = org?.tenantId ?? null;
  const tenantName = org?.tenantName ?? null;
  await saveConnection(stored.partnerId, {
    refreshToken,
    accessToken: tokenData.access_token,
    accessTokenExpiry,
    tenantId,
    tenantName,
  });
  return { partnerId: stored.partnerId };
}

/** Refresh access token and update connection. */
async function refreshConnectionIfNeeded(
  conn: XeroConnection
): Promise<XeroConnection> {
  const now = Date.now();
  if (conn.accessTokenExpiry > now + 60 * 1000) return conn;
  const { clientId, clientSecret } = getConfig();
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const tokenRes = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: conn.refreshToken,
    }).toString(),
  });
  if (!tokenRes.ok) {
    const errBody = await tokenRes.text();
    console.error("[Xero] token refresh error:", tokenRes.status, errBody);
    throw new Error("Token refresh failed");
  }
  const tokenData = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };
  const expiresIn = tokenData.expires_in ?? 1800;
  const newExpiry = Date.now() + expiresIn * 1000;
  const newRefreshToken = tokenData.refresh_token ?? conn.refreshToken;
  await adminDb
    .collection(COLLECTION)
    .doc(conn.id)
    .update({
      accessToken: tokenData.access_token,
      refreshToken: newRefreshToken,
      accessTokenExpiry: newExpiry,
      updatedAt: new Date(),
    });
  return (await getConnection(conn.partnerId))!;
}

/** Get valid connection with refreshed access token if needed. */
export async function getValidConnection(
  partnerId: string
): Promise<XeroConnection | null> {
  const conn = await getConnection(partnerId);
  if (!conn) return null;
  try {
    return await refreshConnectionIfNeeded(conn);
  } catch {
    return null;
  }
}

const XERO_API_BASE = "https://api.xero.com/api.xro/2.0";

async function xeroApiGet(
  partnerId: string,
  path: string,
  params?: Record<string, string>
): Promise<any> {
  const conn = await getValidConnection(partnerId);
  if (!conn || !conn.tenantId) throw new Error("XERO_NOT_CONNECTED");
  const url = new URL(`${XERO_API_BASE}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${conn.accessToken}`,
      "xero-tenant-id": conn.tenantId,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("[Xero] API error:", res.status, path, text);
    throw new Error(`Xero API error: ${res.status}`);
  }
  return res.json();
}

async function xeroApiPost(
  partnerId: string,
  path: string,
  body: object
): Promise<any> {
  const conn = await getValidConnection(partnerId);
  if (!conn || !conn.tenantId) throw new Error("XERO_NOT_CONNECTED");
  const res = await fetch(`${XERO_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${conn.accessToken}`,
      "xero-tenant-id": conn.tenantId,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("[Xero] API POST error:", res.status, path, text);
    throw new Error(`Xero API error: ${res.status}`);
  }
  return res.json();
}

/** Get a single invoice as JSON from Xero (for reading/updating). */
export async function getInvoice(
  partnerId: string,
  invoiceId: string
): Promise<any> {
  const data = await xeroApiGet(partnerId, `/Invoices/${encodeURIComponent(invoiceId)}`);
  const invoices = data.Invoices ?? [];
  const invoice = invoices[0];
  if (!invoice) throw new Error("Invoice not found");
  return invoice;
}

/** Get a single invoice as PDF from Xero. Returns the raw PDF buffer. */
export async function getInvoicePdf(
  partnerId: string,
  invoiceId: string
): Promise<ArrayBuffer> {
  const conn = await getValidConnection(partnerId);
  if (!conn || !conn.tenantId) throw new Error("XERO_NOT_CONNECTED");
  const res = await fetch(`${XERO_API_BASE}/Invoices/${encodeURIComponent(invoiceId)}`, {
    headers: {
      Authorization: `Bearer ${conn.accessToken}`,
      "xero-tenant-id": conn.tenantId,
      Accept: "application/pdf",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("[Xero] getInvoicePdf error:", res.status, invoiceId, text);
    throw new Error(`Xero API error: ${res.status}`);
  }
  return res.arrayBuffer();
}

/** List Xero contacts for dropdown. */
export async function listContacts(partnerId: string): Promise<Array<{ contactId: string; name: string }>> {
  const data = await xeroApiGet(partnerId, "/Contacts", { page: "1", pageSize: "500" });
  const contacts = data.Contacts ?? [];
  return contacts.map((c: any) => ({
    contactId: c.ContactID,
    name: c.Name ?? (`${c.FirstName ?? ""} ${c.LastName ?? ""}`.trim() || "Unnamed"),
  }));
}

/** List Xero accounts (sales/revenue) for product mapping. */
export async function listAccounts(partnerId: string): Promise<Array<{ accountCode: string; name: string }>> {
  const data = await xeroApiGet(partnerId, "/Accounts");
  const salesTypes = ["REVENUE", "SALES", "OTHERINCOME"];
  const accounts = (data.Accounts ?? []).filter(
    (a: any) => salesTypes.includes(a.Type) && a.Status !== "ARCHIVED"
  );
  return accounts.map((a: any) => ({
    accountCode: a.Code,
    name: `${a.Code} - ${a.Name}`,
  }));
}

/** List Xero tax rates for product mapping. */
export async function listTaxRates(partnerId: string): Promise<Array<{ taxType: string; name: string }>> {
  const data = await xeroApiGet(partnerId, "/TaxRates");
  const rates = (data.TaxRates ?? []).filter((t: any) => t.Status === "ACTIVE" || !t.Status);
  return rates.map((t: any) => ({
    taxType: t.TaxType ?? t.Name,
    name: t.Name ?? t.TaxType ?? "Tax",
  }));
}

export interface CreateInvoiceLineItem {
  description: string;
  quantity: number;
  unitAmount: number;
  accountCode: string;
  taxType: string;
}

export interface CreateInvoicePayload {
  contactId: string;
  lineItems: CreateInvoiceLineItem[];
  date: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  status: "DRAFT" | "AUTHORISED";
  reference?: string;
}

/** Parsed Profit and Loss summary for display (all from Xero P&L report). */
export interface ProfitAndLossSummary {
  totalIncome: number;
  totalExpenses: number;
  /** Operating expenses: from "Total Operating Expenses" or "Total Expenses" in P&L. */
  operatingExpenses: number;
  netProfit: number;
  fromDate: string;
  toDate: string;
}

/** Parse one cell value; handles negatives and accounting format (1,234.56) or (1234.56). */
function parseOneCellValue(v: unknown): number | null {
  if (v == null) return null;
  let s = String(v).replace(/,/g, "").trim();
  const isAccountingNegative = /^\([^)]*\)$/.test(s);
  if (isAccountingNegative) s = s.replace(/^\(|\)$/g, "").trim();
  const n = parseFloat(s);
  if (Number.isNaN(n)) return null;
  return isAccountingNegative ? -Math.abs(n) : n;
}

/** Parse numeric value from cells; prefers first value column (index 1) for current period, then any numeric cell. */
function parseCellNumber(cells: any[]): number | null {
  if (!Array.isArray(cells)) return null;
  const fromFirst = parseOneCellValue(cells[1]?.Value);
  if (fromFirst !== null) return fromFirst;
  for (let i = 2; i < cells.length; i++) {
    const n = parseOneCellValue(cells[i]?.Value);
    if (n !== null) return n;
  }
  for (let i = cells.length - 1; i >= 0; i--) {
    const n = parseOneCellValue(cells[i]?.Value);
    if (n !== null) return n;
  }
  return null;
}

/** True if the row label looks like Net Profit / Net Loss. */
function isNetProfitRow(firstCellValue: string, rowTitle?: string): boolean {
  const t = (rowTitle ?? "").trim();
  const label = firstCellValue.toLowerCase();
  if (/^net\s+profit$/i.test(firstCellValue) || /^net\s+profit\s*\(/i.test(firstCellValue)) return true;
  if (/^net\s+loss$/i.test(firstCellValue)) return true;
  if (label.includes("net profit") || label.includes("net loss")) return true;
  if (/^net\s+profit$/i.test(t) || t.includes("net profit")) return true;
  return false;
}

function parseProfitAndLossRows(
  rows: any[],
  values: {
    totalIncome?: number;
    totalExpenses?: number;
    totalOperatingExpenses?: number;
    netProfit?: number;
  }
): void {
  if (!Array.isArray(rows)) return;
  for (const row of rows) {
    const cells = row.Cells ?? [];
    const firstCellValue = (cells[0]?.Value ?? "").toString().trim();
    const rowTitle = (row.Title ?? "").toString().trim();
    const secondCellValue = parseOneCellValue(cells[1]?.Value);
    const anyCellNumber = parseCellNumber(cells);

    if (row.RowType === "SummaryRow") {
      if (firstCellValue === "Total Trading Income" && secondCellValue !== null) values.totalIncome = secondCellValue;
      else if (
        (firstCellValue === "Total Income" || firstCellValue === "Revenue" || firstCellValue === "Total Revenue") &&
        secondCellValue !== null &&
        values.totalIncome === undefined
      )
        values.totalIncome = secondCellValue;
      else if (firstCellValue === "Total Expenses" && secondCellValue !== null)
        values.totalExpenses = secondCellValue;
      else if (
        (firstCellValue === "Total Operating Expenses" || firstCellValue === "Operating Expenses") &&
        secondCellValue !== null
      )
        values.totalOperatingExpenses = secondCellValue;
      else if (isNetProfitRow(firstCellValue, rowTitle) && anyCellNumber !== null)
        values.netProfit = anyCellNumber;
    } else if (isNetProfitRow(firstCellValue, rowTitle) && anyCellNumber !== null) {
      values.netProfit = anyCellNumber;
    }
    if (row.Rows && Array.isArray(row.Rows)) parseProfitAndLossRows(row.Rows, values);
  }
}

export interface MonthlyRevenueEntry {
  month: string;
  revenue: number;
  revenueLastYear?: number;
}

/** Extract period labels from Header row cells (index 1 onward). */
function extractPeriodLabels(rows: any[]): string[] {
  if (!Array.isArray(rows)) return [];
  for (const row of rows) {
    if (row.RowType === "Header") {
      const cells = row.Cells ?? [];
      const labels: string[] = [];
      for (let i = 1; i < cells.length; i++) {
        const v = (cells[i]?.Value ?? "").toString().trim();
        if (v) labels.push(v);
      }
      return labels;
    }
    if (row.Rows) {
      const nested = extractPeriodLabels(row.Rows);
      if (nested.length > 0) return nested;
    }
  }
  return [];
}

/** Row labels for revenue in Xero P&L (region-dependent). Prefer "Trading Income" (sales) over "Total Income". */
function isRevenueRow(label: string): boolean {
  const lower = label.toLowerCase();
  return (
    lower === "total trading income" ||
    lower === "total income" ||
    lower === "revenue" ||
    lower === "total revenue" ||
    lower.includes("trading income")
  );
}

function isTradingIncomeRow(label: string): boolean {
  const lower = label.toLowerCase();
  return lower.includes("trading income");
}

function extractRevenueValuesFromCells(cells: any[]): number[] {
  const values: number[] = [];
  for (let i = 1; i < (cells ?? []).length; i++) {
    const n = parseOneCellValue(cells[i]?.Value);
    values.push(n ?? 0);
  }
  return values;
}

/** Collect all SummaryRow labels and first value (for debugging Xero P&L structure). */
function collectAllSummaryRows(rows: any[]): Array<{ label: string; firstValue: number }> {
  const out: Array<{ label: string; firstValue: number }> = [];
  function walk(r: any[]) {
    if (!Array.isArray(r)) return;
    for (const row of r) {
      if (row.RowType === "SummaryRow") {
        const cells = row.Cells ?? [];
        const label = ((cells[0]?.Value ?? "") || (row.Title ?? "")).toString().trim() || "(no label)";
        const vals = extractRevenueValuesFromCells(cells);
        if (vals.length > 0) out.push({ label, firstValue: vals[0] ?? 0 });
      }
      if (row.Rows) walk(row.Rows);
    }
  }
  walk(rows);
  return out;
}

/** Extract revenue values from all period columns. Prefers Trading Income (sales) over Total Income. */
function extractTotalIncomeByPeriod(rows: any[]): number[] {
  const candidates: { label: string; values: number[] }[] = [];
  function collect(rowsInner: any[]) {
    if (!Array.isArray(rowsInner)) return;
    for (const row of rowsInner) {
      if (row.RowType === "SummaryRow") {
        const cells = row.Cells ?? [];
        const first = (cells[0]?.Value ?? "").toString().trim();
        if (isRevenueRow(first)) {
          const vals = extractRevenueValuesFromCells(cells);
          // Only use rows with per-period data (2+ columns). Single-value rows are often totals/YTD.
          if (vals.length >= 2) candidates.push({ label: first, values: vals });
        }
      }
      if (row.Rows) collect(row.Rows);
    }
  }
  collect(rows);
  // Prefer "Trading Income" (sales) over "Total Income" (can include other income)
  const tradingIncome = candidates.find((c) => isTradingIncomeRow(c.label) && c.values.length > 0);
  if (tradingIncome) return tradingIncome.values;
  const totalIncome = candidates.find((c) => c.label.toLowerCase() === "total income" && c.values.length > 0);
  if (totalIncome) return totalIncome.values;
  const other = candidates.find((c) => c.values.length > 0);
  return other?.values ?? [];
}

/** Shorten Xero period label (e.g. "28 Feb 25") to "Feb" for chart. */
function shortMonthLabel(full: string): string {
  const m = full.match(/(\w{3})\s*\d{2,4}?$/i) || full.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i);
  return m ? m[1] : full;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Get Profit and Loss with monthly breakdown for dashboard chart. Fetches each month separately to ensure per-month (not cumulative) revenue. */
export async function getProfitAndLossMonthly(
  partnerId: string,
  options?: { debug?: boolean }
): Promise<{ monthlyData: MonthlyRevenueEntry[]; thisMonth: number; debug?: { summaryRows: Array<{ label: string; firstValue: number }> } }> {
  const now = new Date();
  const monthlyData: MonthlyRevenueEntry[] = [];
  let thisMonth = 0;

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const dLastYear = new Date(now.getFullYear() - 1, now.getMonth() - i, 1);
    const fromStr = d.toISOString().slice(0, 10);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const toStr = lastDay.toISOString().slice(0, 10);
    const fromStrLY = dLastYear.toISOString().slice(0, 10);
    const toStrLY = new Date(dLastYear.getFullYear(), dLastYear.getMonth() + 1, 0).toISOString().slice(0, 10);
    let revenue = 0;
    let revenueLastYear = 0;
    try {
      const pl = await getProfitAndLoss(partnerId, fromStr, toStr, { standardLayout: true });
      revenue = pl.totalIncome;
      if (i === 0) thisMonth = revenue;
    } catch {}
    try {
      const plLY = await getProfitAndLoss(partnerId, fromStrLY, toStrLY, { standardLayout: true });
      revenueLastYear = plLY.totalIncome;
    } catch {}
    monthlyData.push({ month: MONTH_NAMES[d.getMonth()], revenue, revenueLastYear });
  }

  const result: { monthlyData: MonthlyRevenueEntry[]; thisMonth: number; debug?: { summaryRows: Array<{ label: string; firstValue: number }> } } = {
    monthlyData,
    thisMonth,
  };
  if (options?.debug) {
    result.debug = { summaryRows: monthlyData.map((m) => ({ label: m.month, firstValue: m.revenue })) };
  }
  return result;
}

/** Get Profit and Loss report from Xero for a date range. Returns structured summary. */
export async function getProfitAndLoss(
  partnerId: string,
  fromDate: string,
  toDate: string,
  options?: { periods?: number; timeframe?: string; standardLayout?: boolean }
): Promise<ProfitAndLossSummary> {
  const params: Record<string, string> = {
    fromDate,
    toDate,
    standardLayout: (options?.standardLayout !== false).toString(),
  };
  if (options?.periods != null) params.periods = String(options.periods);
  if (options?.timeframe) params.timeframe = options.timeframe;
  const data = await xeroApiGet(partnerId, "/Reports/ProfitAndLoss", params);
  const report = data.Reports?.[0];
  const rows = report?.Rows ?? [];
  const values: {
    totalIncome?: number;
    totalExpenses?: number;
    totalOperatingExpenses?: number;
    netProfit?: number;
  } = {};
  parseProfitAndLossRows(rows, values);
  const totalExpenses = values.totalExpenses ?? 0;
  const operatingExpenses =
    values.totalOperatingExpenses ?? totalExpenses;
  const totalIncome = values.totalIncome ?? 0;
  const netProfit =
    values.netProfit ??
    (totalIncome - totalExpenses);
  return {
    totalIncome,
    totalExpenses,
    operatingExpenses,
    netProfit,
    fromDate,
    toDate,
  };
}

/** Executive summary report row. */
export interface ExecutiveSummaryRow {
  label: string;
  value: string | number;
}

/**
 * Get count of sales (ACCREC) invoices in a date range for average order calculation.
 * Used with P&L total income to compute average order = totalIncome / count.
 */
export async function getInvoiceCount(
  partnerId: string,
  fromDate: string,
  toDate: string
): Promise<number> {
  const [y1, m1, d1] = fromDate.split("-").map(Number);
  const [y2, m2, d2] = toDate.split("-").map(Number);
  const fromDt = `DateTime(${y1},${m1},${d1})`;
  const toDt = `DateTime(${y2},${m2},${d2})`;
  const where = `Type=="ACCREC" AND Date>=${fromDt} AND Date<=${toDt}`;
  let count = 0;
  let page = 1;
  const pageSize = 100;
  while (true) {
    const data = await xeroApiGet(partnerId, "/Invoices", {
      where,
      summaryOnly: "true",
      page: String(page),
      pageSize: String(pageSize),
    });
    const invoices = data.Invoices ?? [];
    count += invoices.length;
    if (invoices.length < pageSize) break;
    page++;
  }
  return count;
}

/** Get Executive Summary from Xero (monthly totals and business ratios). */
export async function getExecutiveSummary(
  partnerId: string,
  date?: string
): Promise<{ date: string; rows: ExecutiveSummaryRow[] }> {
  const params: Record<string, string> = date ? { date } : {};
  const data = await xeroApiGet(partnerId, "/Reports/ExecutiveSummary", params);
  const report = data.Reports?.[0];
  const rows: ExecutiveSummaryRow[] = [];
  if (report?.Rows && Array.isArray(report.Rows)) {
    for (const row of report.Rows) {
      const cells = row.Cells ?? [];
      const label = (cells[0]?.Value ?? "").toString().trim();
      const value = cells[1]?.Value;
      if (label && value !== undefined && value !== null) rows.push({ label, value: String(value).replace(/,/g, "") });
    }
  }
  const reportDate = report?.ReportDate ?? new Date().toISOString().slice(0, 10);
  return { date: reportDate, rows };
}

/** Create ACCREC (sales) invoice in Xero. */
export async function createInvoice(
  partnerId: string,
  payload: CreateInvoicePayload
): Promise<{ invoiceId: string; invoiceNumber: string }> {
  const lineItems = payload.lineItems.map((item) => ({
    Description: item.description,
    Quantity: item.quantity,
    UnitAmount: item.unitAmount,
    AccountCode: item.accountCode,
    TaxType: item.taxType,
  }));
  const dateStr = (d: string) => `${d}T00:00:00`;
  const body = {
    Type: "ACCREC",
    Contact: { ContactID: payload.contactId },
    DateString: dateStr(payload.date),
    DueDateString: dateStr(payload.dueDate),
    Status: payload.status,
    LineAmountTypes: "Exclusive",
    LineItems: lineItems,
    ...(payload.reference && { Reference: payload.reference }),
  };
  const data = await xeroApiPost(partnerId, "/Invoices", { Invoices: [body] });
  const invoices = data.Invoices ?? [];
  const invoice = invoices[0];
  if (!invoice || !invoice.InvoiceID) {
    const errs = data.Elements?.[0]?.ValidationErrors ?? [];
    throw new Error(errs.length ? errs.map((e: any) => e.Message).join("; ") : "Failed to create invoice");
  }
  return {
    invoiceId: invoice.InvoiceID,
    invoiceNumber: invoice.InvoiceNumber ?? invoice.InvoiceID,
  };
}

/** Update an existing Xero invoice with new line items (replaces all line items). Only DRAFT/SUBMITTED can be fully edited; AUTHORISED/PAID allow LineItems updates. */
export async function updateInvoice(
  partnerId: string,
  invoiceId: string,
  lineItems: CreateInvoiceLineItem[]
): Promise<{ invoiceId: string; invoiceNumber: string }> {
  const existing = await getInvoice(partnerId, invoiceId);
  const status = existing.Status ?? "DRAFT";
  if (status === "DELETED" || status === "VOIDED") {
    throw new Error("Cannot update a deleted or voided invoice");
  }
  const newLineItems = lineItems.map((item) => ({
    Description: item.description,
    Quantity: item.quantity,
    UnitAmount: item.unitAmount,
    AccountCode: item.accountCode,
    TaxType: item.taxType,
  }));
  const body = {
    InvoiceID: invoiceId,
    Contact: existing.Contact,
    DateString: existing.DateString,
    DueDateString: existing.DueDateString,
    Status: status,
    LineAmountTypes: existing.LineAmountTypes ?? "Exclusive",
    LineItems: newLineItems,
    ...(existing.Reference != null && { Reference: existing.Reference }),
  };
  const data = await xeroApiPost(partnerId, `/Invoices/${encodeURIComponent(invoiceId)}`, {
    Invoices: [body],
  });
  const invoices = data.Invoices ?? [];
  const invoice = invoices[0];
  if (!invoice || !invoice.InvoiceID) {
    const errs = invoice?.ValidationErrors ?? data.Elements?.[0]?.ValidationErrors ?? [];
    throw new Error(errs.length ? errs.map((e: any) => e.Message).join("; ") : "Failed to update invoice");
  }
  return {
    invoiceId: invoice.InvoiceID,
    invoiceNumber: invoice.InvoiceNumber ?? invoice.InvoiceID,
  };
}
