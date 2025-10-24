# Overview

This project is a full-stack SaaS platform designed for Real Property Photography (RPP) businesses. Its primary goal is to provide a comprehensive solution for managing photography jobs, customers, products, and orders, thereby streamlining the entire production workflow. The platform supports multi-tenancy, secure authentication, and integrates with external services to offer a robust, scalable, and user-friendly system. It aims to enhance operational efficiency and client satisfaction within the RPP industry.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend
- **Framework**: React 18 with TypeScript, powered by Vite.
- **Styling**: TailwindCSS, complemented by shadcn/ui.
- **Routing**: Wouter.
- **State Management**: TanStack Query (React Query).
- **Authentication**: Firebase Auth, integrated via React Firebase Hooks.
- **UI/UX Decisions**: Features professional, card-based layouts, comprehensive modals, status badges, color-coded indicators, and Google Maps integration for job locations. Navigation includes a fixed sidebar, responsive mobile drawer, and a header for search and notifications.

## Backend
- **Runtime**: Node.js with Express.js (TypeScript).
- **API Design**: RESTful API.
- **Storage Layer**: Abstract `IStorage` interface, currently implemented by `FirestoreStorage`.
- **Request Handling**: Express middleware for logging, JSON parsing, and error handling.

## Database
- **Primary Database**: Firebase Firestore (real-time NoSQL database), actively migrating from PostgreSQL.
- **Schema**: Collections for users, customers, products, jobs, orders, notifications, messages, and conversations, all supporting multi-tenancy (`partnerId`) and real-time updates.
- **Storage Implementation**: `FirestoreStorage` class provides full CRUD operations using Firebase Admin SDK, with real-time listeners for instant UI updates.

## Authentication & Authorization
- **Provider**: Firebase Authentication (Email/Password).
- **Session Management**: Firebase Auth state persistence.
- **Role Management**: Comprehensive role system (partner, admin, photographer) with role-based route protection.
- **Authorization**: Multi-tenant data isolation using `partnerId`.
- **Team Management**: Supports partner signup, team member invitations, and management.

## File Storage
- **Provider**: Firebase Storage.
- **Use Cases**: Stores profile images, product images, business logos, job cover images, and general file uploads.
- **Integration**: Direct Firebase SDK integration for structured file organization based on jobs and tokenized folder structures.

## System Design Choices
- **Multi-Tenancy**: Data isolation based on `partnerId` across core entities like customers, jobs, orders, and products.
- **Job Management**: Full lifecycle management for jobs, including creation, listing, and detailed views, using unique NanoIDs.
- **Order-Independent File Uploads**: Allows standalone folder creation and file uploads.
- **Accounting Integration Foundation**: UI and database schema designed for future accounting software integration.
- **Multi-Step Order Creation**: A wizard-based approach for order creation, including live cost calculations.
- **Order Status Flow**: A two-step acceptance workflow: "pending" to "processing".
- **Order Numbering**: Automatic sequential order numbering.
- **Delivery Preview System**: Dual-access model for job delivery pages, using `deliveryToken` for public access and `jobId` for authenticated partner previews.
- **Messaging System**: Bidirectional, order-aware messaging between partners and editors with real-time updates.
    - **Conversation Types**: Supports both order-specific and general conversations.
    - **Automatic Creation**: Conversations are auto-created upon editor partnership acceptance.
    - **Manual Initiation**: Both partners and editors can initiate new conversations.
    - **Role-Adaptive UI**: UI adapts contact displays and message alignment based on the user's role.
    - **Real-time Notifications**: Unread counts and notifications are updated instantly via Firestore listeners.

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

## Authentication & Database
- **Firebase**: Authentication, Firestore, and Storage.
- **React Firebase Hooks**: React integration for Firebase.

## Utility Libraries
- **TanStack Query**: Server state management.
- **React Hook Form**: Form management.
- **Date-fns**: Date manipulation.
- **NanoID**: Unique ID generation.
- **Google Maps Embed API**: Interactive maps.