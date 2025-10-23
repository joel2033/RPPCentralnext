# Overview

This project is a full-stack SaaS platform for Real Property Photography (RPP) businesses. It provides a comprehensive solution for managing photography jobs, customers, products, orders, and the entire production workflow. The platform aims to streamline operations for RPP businesses through efficient job and customer management, order processing, and product catalog maintenance. Key capabilities include multi-tenant support, secure authentication, and integration with external services. The ultimate goal is to deliver a robust, scalable, and user-friendly system tailored to the RPP industry, enhancing operational efficiency and client satisfaction.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend
- **Framework**: React 18 with TypeScript, using Vite.
- **Styling**: TailwindCSS with shadcn/ui.
- **Routing**: Wouter.
- **State Management**: TanStack Query (React Query).
- **Authentication**: Firebase Auth with React Firebase Hooks.
- **Layout**: Fixed sidebar navigation, responsive mobile drawer, header for search and notifications.
- **UI/UX Decisions**: Professional, card-based layouts, comprehensive modals, status badges, and color-coded indicators. Google Maps integration for job locations.

## Backend
- **Runtime**: Node.js with Express.js (TypeScript).
- **API Design**: RESTful API.
- **Storage Layer**: Abstract storage interface (currently in-memory `MemStorage`, designed for persistent database).
- **Request Handling**: Express middleware for logging, JSON parsing, and error handling.

## Database
- **ORM**: Drizzle ORM with PostgreSQL dialect.
- **Connection**: Neon Database serverless PostgreSQL.
- **Schema**: Tables for users, customers, products, jobs, orders with multi-tenancy (`partnerId`), Firebase integration (`folderToken`), and accounting integration fields.
- **Migrations**: Drizzle Kit.

## Authentication & Authorization
- **Provider**: Firebase Authentication (Email/Password).
- **Session Management**: Firebase Auth state persistence.
- **Role Management**: Comprehensive role system (partner, admin, photographer).
- **Authorization**: Role-based route protection and multi-tenant data isolation using `partnerId`.
- **Team Management**: Partner signup, team member invitation system, and management interface.

## File Storage
- **Provider**: Firebase Storage.
- **Use Cases**: Profile images, product images, business logos, job cover images, completed deliverables, general file uploads.
- **Integration**: Direct Firebase SDK integration for organizing files with job-specific and tokenized folder structures.
- **Hardcoded Business Logo**: RPP logo (`/assets/rpp-logo.png`) is permanently set; no upload functionality.
- **Cover Images**: Optional job cover images stored in `cover-images/`. Thumbnails (400x400px, 80% quality) generated client-side and stored in `cover-images/thumbnails/`.

## System Design Choices
- **Multi-Tenancy**: `partnerId`-based data isolation for customers, jobs, orders, and products.
- **Job Management**: Complete job creation, listing, and detailed management with unique NanoIDs and optional cover images.
- **Order-Independent File Uploads**: Standalone folder creation and file uploads supported without an associated order.
- **Accounting Integration Foundation**: UI and database schema for future integration with accounting software (e.g., Xero).
- **Multi-Step Order Creation**: Redesigned "Upload to Editors" modal with a 3-step wizard (Job/Supplier selection → Service selection → Per-service configuration). Includes live cost calculations.
- **Order Status Flow**: Two-step acceptance workflow: "pending" upon creation, then "processing" once accepted by editor.
- **Order Numbering**: Sequential order numbers starting from #00001, automatically incremented.
- **Delivery Preview System**: Dual-access model for job delivery pages: public access via `deliveryToken` and authenticated partner preview via `jobId`. Smart routing detects auth state for previews.
- **Messaging System**: Bidirectional, order-aware messaging between partners and editors.
    - **Conversation Types**: Order-specific and general conversations.
    - **Automatic Creation**: Conversations auto-created upon editor partnership acceptance.
    - **Manual Initiation**: Both partners and editors can initiate new conversations.
    - **Role-Adaptive UI**: Adapts contact dropdowns and message alignment based on user role.
    - **Message Notifications**: Unread counts displayed in notification bell. Polls every 8 seconds.
    - **Optimistic Updates**: TanStack Query optimistic updates for mark-as-read functionality.
    - **Notification System**: Automatic notification creation when messages are sent (editor→partner, partner→editor).
    - **Notification Filtering Fix (October 23, 2025)**: Fixed notification badge count issues by changing `getNotificationsForUser` and `markAllNotificationsRead` functions (server/storage.ts lines 1459, 1483) to filter by `recipientId` only, removing the problematic `partnerId` filter. The double-filter was causing editors to see incorrect notification counts and partners to not see notification badges. Now both dashboards correctly display notification badges based on the recipient's Firebase UID.
    - **Unread Count Bug Fixes (October 23, 2025)**: Fixed a systemic bug where `partnerId` comparison was used to determine user role, but editors ALSO have a `partnerId` field (their assigned partner), causing incorrect role identification. This resulted in editors seeing unread badges when THEY sent messages instead of when they RECEIVED messages. Fixed in 4 locations:
        - **Partner Dashboard (Backend)**: Fixed sender role identification in message creation (server/routes.ts line 5838). Changed `isPartner` logic from `conversation.partnerId === partnerId` to `conversation.editorId !== uid`. Now partner dashboards correctly show unread badges when editors send messages.
        - **Editor Unread Count (Backend)**: Fixed `getUnreadMessageCount` function (server/storage.ts line 2407) to check `conv.editorId === userId` instead of comparing partnerId values. Ensures editors only see unread counts when partners send them messages.
        - **Badge Display (Frontend)**: Fixed `getOtherParticipant` function (client/src/pages/Messages.tsx line 417) to use `conversation.editorId === currentUserId` for role detection. Displays correct unread counts for conversation badges.
        - **Mark-as-Read (Backend)**: Fixed PATCH `/api/conversations/:id/read` endpoint (server/routes.ts line 5945) to determine role via `conversation.editorId === uid`. Ensures mark-as-read clears the correct unread count field.
        - **Optimistic Update (Frontend)**: Fixed `markAsReadMutation` (client/src/pages/Messages.tsx line 215) to clear the correct unread count when editor clicks conversation.
    - **Storage**: Conversations and messages in PostgreSQL, partnerships in Firestore.

# External Dependencies

## Core Framework
- **React Ecosystem**: React 18.
- **Build Tools**: Vite, TypeScript.
- **Styling**: TailwindCSS.

## UI Component Libraries
- **shadcn/ui**: Component library.
- **Radix UI**: Headless UI components.
- **Lucide React**: Icon library.

## Backend
- **Express.js**: Web framework.
- **Drizzle ORM**: For PostgreSQL.
- **Neon Database**: Serverless PostgreSQL.
- **Connect PG Simple**: PostgreSQL session store.

## Authentication & Database
- **Firebase**: Authentication, Firestore, and Storage.
- **React Firebase Hooks**: React integration for Firebase.

## Utility Libraries
- **TanStack Query**: Server state management.
- **React Hook Form**: Form management.
- **Date-fns**: Date manipulation.
- **NanoID**: Unique ID generation.
- **Google Maps Embed API**: Interactive maps.