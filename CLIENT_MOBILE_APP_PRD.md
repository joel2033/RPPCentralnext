### Client-Facing Mobile App – Product Requirements Document (PRD)

## Document
- Project: Real Property Photography – Client Mobile App
- Platforms: iOS & Android (React Native recommended)
- Version: 1.0
- Status: Ready for Design
- Audience: Product, Design, Engineering

## Executive Summary
Build a customer mobile app to book appointments, review past jobs, communicate with assigned photographers, and receive real-time notifications about order progress. The app must be simple, fast, and secure, with a booking flow optimized for mobile.

## Objectives
- Let clients self-serve: discover availability, book, reschedule, and cancel.
- Provide job/order transparency: statuses, timelines, deliverables readiness.
- Enable direct communication with the assigned photographer (or support).
- Drive engagement with timely, relevant push notifications.
- Maintain multi-tenant isolation and role-based access.

## KPIs / Success Metrics
- Booking conversion rate ≥ 35% (from session to confirmed appointment)
- Reschedule/cancel self-serve ≥ 60% (reduced support load)
- ≥ 80% of clients enable push notifications
- App Store rating ≥ 4.6
- P95 cold start < 2.5s; P95 screen transition < 300ms

## Users & Personas
- Primary: Real estate agents, property managers, homeowners booking shoots.
- Secondary: Admin/Partner browsing read-only (optional, not required for v1).

## Scope (v1 Core)
- Auth: email/password (SSO optional), biometric unlock
- Booking: new appointment flow, reschedule/cancel
- Orders/Jobs: list and detail views (status, timeline, notes)
- Messaging: 1:1 thread with assigned photographer (or support)
- Notifications: push updates on order lifecycle
- Profile: business details, preferences, saved properties/addresses

## Non-Goals (v1)
- In-app payments and invoicing (optional in roadmap)
- File uploads
- Partner/admin management features
- Multi-language (can be roadmap)

## Feature Requirements

### 1) Authentication & Onboarding (P0)
- Email/password login; password reset
- Optional biometric unlock post-login
- Session persistence with secure token storage
- Role gate: only “client” role permitted
- First-run onboarding (notification permission, calendar permission optional)

Acceptance:
- Login/Logout works; protected routes enforced; errors surfaced clearly

### 2) Booking & Scheduling (P0)
- Service selection (product/catalog provided by partner)
- Address capture (auto-complete, map validation, saved addresses)
- Date/time slot selection (live availability)
- Appointment summary and confirmation
- Reschedule/cancel with policy guardrails
- Add notes/special access instructions
- Confirmation screen + email/push confirmation

Acceptance:
- Book flow completes with a single confirmation number
- Live availability respected; conflicts prevented
- Reschedule/cancel flows follow rules and log activity

### 3) Orders/Jobs History & Details (P0)
- Orders/Jobs list: current, upcoming, past; filter by status/date
- Job detail:
  - Status (e.g., pending, scheduled, in_progress, completed, delivered)
  - Appointment date/time, address, map link
  - Services purchased
  - Assigned photographer card (name, photo, message CTA)
  - Timeline (created, confirmed, in-progress, delivered)
  - Notes (partner or photographer notes shared to client)
  - Delivery info (when ready): delivery link + open in browser

Acceptance:
- Lists load quickly with pagination/infinite scroll
- Details show complete, accurate data; delivery link opens

### 4) Messaging (P1)
- Conversation list with unread counts
- Per-order thread with assigned photographer (or routing to support if unassigned)
- Text messages only in v1 (media in roadmap)
- Read receipts and timestamps
- Push notifications for new messages

Acceptance:
- Real-time message send/receive; unread counts accurate
- Push arrives within seconds; tapping deep-links to thread

### 5) Notifications (P0)
- Push notifications for:
  - Booking confirmed/changed/cancelled
  - Day-before reminder
  - Photographer on the way / arrived (if photographer triggers)
  - Order status updates (processing, delivered)
  - New message
- Notification Center screen: read/unread; filters; deep-linking

Acceptance:
- Opt-in prompt; per-event pushes; center shows history; deep-linking works

### 6) Profile & Settings (P1)
- Profile: name, company, email, phone
- Preferences: notifications on/off by type
- Saved addresses/properties
- Legal: terms, privacy
- Support: FAQs, contact support

Acceptance:
- Editable profile; preferences persist; support links functional

## Information Architecture / Navigation
- Bottom Tabs (recommended):
  - Home (Bookings/Upcoming)
  - Book (primary CTA)
  - Messages
  - Activity (Notifications)
  - Profile
- Deep links:
  - rpp://order/:id
  - rpp://message/:conversationId
  - rpp://book?serviceId=…

## Data & Backend Integration

### Core Entities
- Customer: id, name, email, phone, company, preferences
- Job/Order: id, orderNumber, customerId, status, appointmentDate, services[], address, assignedTo
- Conversation/Message: conversationId, participants, lastMessage, unreadCount; messages with senderId, content, timestamps
- Notification: id, type, title, body, jobId/orderId, read, createdAt
- Availability: serviceId, date, time slots
- Service/Product (if surfaced): id, name, duration, price

### API Requirements (representative)
- Auth: login, refresh, revoke
- Availability: GET /availability?serviceId&date
- Booking:
  - POST /orders (service, date/time, address, notes)
  - PATCH /orders/:id (reschedule/cancel)
- Jobs/Orders:
  - GET /orders?mine=true&status
  - GET /orders/:id
- Messages:
  - GET /conversations?mine=true
  - GET /conversations/:id/messages
  - POST /conversations/:id/messages
- Notifications:
  - GET /notifications
  - PATCH /notifications/:id/read
  - POST /devices/register (FCM/APNs token)

Security:
- Firebase Auth (JWT). Enforce tenant isolation via partnerId.
- Role: client-only access; only own orders/messages/notifications.

## UX & Design Requirements
- Mobile-first; 44px+ touch targets
- Clear status colors:
  - Scheduled (blue), In Progress (orange), Completed (green), Cancelled (red), Delivered (green/blue)
- Accessible palettes; WCAG AA contrast
- Skeletons for loading; helpful empty/error states
- Deep-link from notifications/messages to target screens
- Map integration for addresses; open native maps

## Performance & Reliability
- P95 cold start < 2.5s
- P95 API < 1.5s (cached < 500ms)
- Offline-first for lists (cache), queue reschedule/cancel/messages if feasible (optional P2)
- Crash-free sessions ≥ 99.8%

## Analytics & Telemetry
- Events:
  - auth_login_success/failure
  - booking_started/success/cancelled
  - order_viewed, message_sent, notification_opened
- Funnels: booking completion, notification opt-in
- Error logging with user consent (Sentry)

## Privacy & Security
- Token in secure storage; no PII in logs
- Biometric lock (optional toggle)
- GDPR/CCPA ready: privacy policy, data request path
- Device token registration/rotation handling

## Acceptance Criteria (Summary)
- End-to-end booking works (select service → find slot → confirm → confirm push)
- Orders list/detail accurate; delivery link opens
- Messaging works with push, unread counts correct
- Notifications arrive and deep-link to relevant screen
- Profile edit & preferences persist
- Role/tenant isolation enforced

## Roadmap (Post v1)
- Payments (Stripe/Apple Pay/Google Pay)
- Media attachments in messages
- In-app guidance/coachmarks
- Multi-language
- Calendar sync
- Rich delivery viewer

## Implementation Plan (High-Level)
- Phase 1 (3–5 weeks): Auth, Orders list/detail, Booking basic, Notifications (receive), Profile
- Phase 2 (3–4 weeks): Messaging, Reschedule/Cancel, Notification Center, Saved addresses
- Phase 3 (2–3 weeks): Polish, performance, analytics, QA, store submission

## Design Deliverables
- Design system (type, color, components)
- Screen mocks (all states: loading/empty/error)
- Prototypes for booking & messaging flows
- Redlines/specs for dev handoff

## Open Questions
1. Will services/products vary by tenant? If yes, is catalog fetched per partner?
2. Are rescheduling/cancellation policies tenant-specific (cutoffs/fees)?
3. Notifications: which channels besides push (email/SMS) should be shown as history?
4. Should clients message photographers directly or a shared “team” inbox by default?
5. Should we support guest booking (no login) in v1?


