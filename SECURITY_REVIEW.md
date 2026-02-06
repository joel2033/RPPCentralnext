# Application Security Review

**Scope:** Defensive and adversarial review assuming a malicious authenticated user, compromised client, and manual API tampering.

**Date:** February 2025

---

## 1. Authentication and Authorization

### 1.1 Unauthenticated API endpoints (CRITICAL)

Several API routes do **not** require authentication. An attacker can call them without a valid Firebase ID token.

| Endpoint | Risk | Location |
|----------|------|----------|
| `GET /api/auth/user/:uid` | **IDOR:** Any user’s Firestore document (email, role, partnerId, etc.) can be fetched by guessing or enumerating UIDs. | `server/routes.ts` ~4322 |
| `GET /api/team/invites/:partnerId` | **Data isolation:** Pending team invites for any tenant can be listed by guessing partnerIds. | `server/routes.ts` ~4436 |
| `POST /api/upload-firebase` | **Unauthorized upload:** Files can be uploaded to Firebase using client-supplied `jobId`, `userId`, `folderPath`. No check that the caller owns the job or is the assigned editor. | `server/upload-firebase-route.ts` ~32 |
| `POST /api/products/upload-image` | **Unauthorized upload:** Product images can be uploaded to Firebase by anyone. | `server/routes.ts` ~4517 |
| `DELETE /api/cleanup/expired-orders-files` | **Privileged action:** Bulk deletion of expired order files can be triggered by anyone who can reach the server (e.g. if the app is on a public URL). | `server/routes.ts` ~13280 |

**Fix (high level):**

- **`/api/auth/user/:uid`:** Require authentication and ensure `req.user.uid === uid` (or allow only for same user). Do not return full user document to unauthenticated callers.
- **`/api/team/invites/:partnerId`:** Add `requireAuth` and enforce `req.user.partnerId === partnerId`.
- **`/api/upload-firebase`:** Add authentication (e.g. `requireAuth` or equivalent). Authorize by verifying the authenticated user is the job owner (partner) or the assigned editor for that job before writing to storage.
- **`/api/products/upload-image`:** Add `requireAuth` and scope uploads to `req.user.partnerId` (e.g. path or metadata).
- **`/api/cleanup/expired-orders-files`:** Restrict to internal/cron only: e.g. require a shared secret header, or bind to localhost and ensure the route is not exposed to the public internet. **Implemented:** Endpoint now requires `X-Cleanup-Secret` header (or Bearer token) equal to `CLEANUP_SECRET`; cron in `server/index.ts` sends this when set.

### 1.2 Authenticated routes – authorization (CHECKED)

- **Customers, Jobs, Orders, Appointments:** After loading the resource, the code checks `resource.partnerId === req.user.partnerId` (or equivalent). No IDOR found in the sampled routes.
- **Editor order download** (`GET /api/editor/orders/:orderNumber/download`): Requires auth, verifies role is editor, and uses `getOrdersForEditor(uid)` so only orders assigned to that editor are accessible.
- **Assign order** (`POST /api/team/assign-order`): Verifies order belongs to partner and editor is in partner’s partnerships.
- **OAuth callbacks (Google Calendar, Xero):** State parameter is validated (stored state, TTL); no CSRF/account-linkage issue found in the flow.

### 1.3 Master role and `viewingPartnerId` (BY DESIGN)

- `viewingPartnerId` is taken from the query string and used to scope data for master users. Only users with `role === 'master'` can use this (enforced in `requireAuth` and role checks).
- `/api/master/partners` is protected with `requireAuth` and `req.user?.role === 'master'`. No issue found; document that masters can view any tenant for support/franchisor use.

### 1.4 SSE / EventSource token in query (LOW)

- `requireAuthSSE` accepts the token via `req.query.token` because EventSource does not send custom headers. Token in URL can leak in Referer or server logs.
- **Mitigation:** Prefer short-lived tokens for SSE, ensure logs do not persist full URLs, and use a separate token for SSE if feasible (e.g. one-time use).

---

## 2. Data Isolation Between Users / Tenants

### 2.1 Tenant isolation (CHECKED)

- List endpoints use `req.user.partnerId` from the authenticated user (e.g. `getCustomers(partnerId)`, `getJobs(partnerId)`). No use of client-supplied partnerId for listing.
- Create/update flows that were checked inject `partnerId` from `req.user` (e.g. customers, orders, products) and/or verify resource ownership before update. No cross-tenant write found in the reviewed code.

### 2.2 Upload route and tenant isolation (CRITICAL)

- **`POST /api/upload-firebase`** does not authenticate the caller. It uses `userId`, `jobId`, `folderPath`, etc. from the request body. An attacker can:
  - Upload into another tenant’s path by supplying another user’s `userId` and a valid `jobId` (or arbitrary path segments).
  - Overwrite or fill storage for any tenant.
- **Fix:** Enforce authentication and server-side authorization: resolve the job, then ensure either `job.partnerId === req.user.partnerId` (partner) or the order is assigned to `req.user.uid` (editor). Derive storage paths from the authenticated user and authorized job/order only; do not trust `userId`/`folderPath` from the client for path construction beyond validated identifiers.

---

## 3. Exposed Secrets and Environment Variables

### 3.1 `.env.local` and secrets (CAUTION)

- **Checked:** `.env.local` is listed in `.gitignore` (and `*.env`), so it should not be committed.
- **Risk:** The file in the workspace contains high-value secrets (Firebase private key, SendGrid API key, Google Calendar and Xero client secrets, etc.). If it was ever committed, pushed, or copied into an unsafe location, all those secrets must be considered compromised and rotated.
- **Recommendation:**  
  - Never commit `.env.local` (or any file with real secrets).  
  - Use a secrets manager or CI env vars for production.  
  - If the repo was ever public or shared, rotate every secret that appears in `.env.local`.

### 3.2 Client-exposed config (BY DESIGN)

- Firebase client config and Google Maps API key are used via `import.meta.env.VITE_*`. These are expected to be public; restrict abuse with Firebase Security Rules, API key restrictions, and quotas.

### 3.3 Server env usage (CHECKED)

- Server uses `process.env` for secrets (e.g. Firebase Admin, SendGrid, OAuth clients). No evidence of logging or sending these values to the client.

---

## 4. File Upload and Storage

### 4.1 Unauthenticated and unauthorized upload (CRITICAL)

- See **§1.1** and **§2.2**: `/api/upload-firebase` and `/api/products/upload-image` must require authentication and authorize the caller before writing to storage.

### 4.2 Path and filename safety (MEDIUM)

- **`server/upload-firebase-route.ts`:**  
  - `folderPath` from the body is normalized with regex but not checked for path traversal (e.g. `..`).  
  - `safeName = file.originalname.replace(/\s+/g, '_')` does not remove path segments or other dangerous characters.
- **Risk:** A client could send `folderPath` or a filename containing `..` and potentially write outside the intended prefix (depending on how paths are combined and validated in Firebase Storage).
- **Fix:**  
  - Reject any path segment that is `"."`, `".."`, or contains `/` or `\`.  
  - Sanitize filename: allow only safe characters (e.g. alphanumeric, hyphen, underscore) and/or use a fixed name (e.g. timestamp + extension) and store original name in metadata only.

### 4.3 File type and size (CHECKED)

- Multer limits file size (e.g. 500MB in upload-firebase). MIME type is taken from the client and not re-validated; consider validating magic bytes for critical types if you need to prevent polyglot uploads.

---

## 5. Input Validation and Sanitization

### 5.1 Zod and schema (CHECKED)

- Auth/signup, team invite, partnership, assign-order, and several other handlers use Zod (or shared schema) to parse and validate `req.body`. This reduces arbitrary object injection for those endpoints.

### 5.2 Routes without body validation (MEDIUM)

- Many PATCH handlers (e.g. jobs, appointments, orders) apply `req.body` fields to updates without a single strict schema. That allows clients to send extra fields; storage layer may persist them if the DB accepts them.
- **Recommendation:** Use a single Zod (or similar) schema per PATCH that allows only the intended fields and types (e.g. `z.object({ status: z.string().optional(), ... }).strict()`).

### 5.3 Upload route (HIGH)

- `/api/upload-firebase` uses `jobId`, `userId`, `folderPath`, `orderNumber`, etc. from `req.body` without schema validation. Invalid or oversized values could cause unexpected behavior or logging noise.
- **Fix:** Validate and coerce all inputs (e.g. Zod), and derive authoritative identifiers (job, order, user) from the authenticated user and DB only.

---

## 6. Error Messages and Information Leakage

### 6.1 Sending `error.message` to the client (MEDIUM)

- Many catch blocks respond with `res.status(500).json({ error: "...", details: error.message })`. Internal errors (DB, Firebase, file paths, etc.) can be exposed to the client.
- **Example:** `server/routes.ts` (e.g. ~4336, ~4405, ~2456, ~2616, and many others).
- **Fix:** In production, do not send raw `error.message` or `error.stack` to the client. Log the full error server-side and return a generic message (e.g. “An error occurred”) or a stable error code. You already do `stack: process.env.NODE_ENV === 'development' ? error.stack : undefined` in some places; extend that pattern to `details` and other fields.

### 6.2 Upload route (MEDIUM)

- `server/upload-firebase-route.ts` returns `detail: errorDetail` and `code: errorCode` in 500 responses, which can leak internal state.
- **Fix:** In production, return a generic upload failure message and log the real error and code server-side only.

---

## 7. Abuse and Rate Limiting

### 7.1 No application-level rate limiting (MEDIUM)

- **Checked:** `express-rate-limit` appears only in the dependency tree (e.g. transitive); it is not used in `server/index.ts` or `server/routes.ts`.
- **Risk:** Without rate limiting, authentication, signup, invite, and upload endpoints are susceptible to brute force, enumeration, DoS, and spam (e.g. mass invites, storage fill).
- **Fix:** Add rate limiting (e.g. `express-rate-limit`) for:  
  - Auth endpoints (e.g. per-IP and per-uid after auth).  
  - Signup / invite / password reset (stricter per-IP).  
  - Upload endpoints (per-user or per-IP).  
  - Optional: global per-IP limit for the API.  
- **Cleanup endpoint:** Ensure only the cron runner (or internal network) can call it; see §1.1.

---

## 8. Summary Table

| Area | Status | Priority |
|------|--------|----------|
| Auth: unauthenticated endpoints | Issues found | P0 |
| Auth: authenticated routes | Checked, OK | - |
| Data isolation: tenant scoping | Checked, OK | - |
| Data isolation: upload route | Broken (no auth/authz) | P0 |
| Secrets / env | .gitignore OK; rotate if ever exposed | P1 |
| File upload: path/filename | Path traversal / sanitization | P1 |
| Input validation | Partial; PATCH and upload | P1–P2 |
| Error messages | Leaky in many routes | P2 |
| Rate limiting | Absent | P1 |

---

## 9. Recommended Fix Order

1. **P0:** Add authentication and authorization to `POST /api/upload-firebase` and restrict cleanup to internal/cron only.
2. **P0:** Add authentication (and where relevant, partnerId check) to `GET /api/auth/user/:uid`, `GET /api/team/invites/:partnerId`, and `POST /api/products/upload-image`.
3. **P1:** Harden upload path and filename handling (no `..`, safe names).
4. **P1:** Introduce rate limiting for auth, signup, invite, and upload.
5. **P1:** Confirm `.env.local` has never been committed; if it has, rotate all contained secrets.
6. **P2:** Replace client-facing `details: error.message` (and similar) with generic messages in production; log full errors server-side only.
7. **P2:** Add strict Zod (or equivalent) validation for PATCH bodies and upload body parameters.
