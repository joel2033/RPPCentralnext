# Overview

This is a full-stack SaaS platform for Real Property Photography (RPP) business management. The application provides a comprehensive solution for managing photography jobs, customers, products, orders, and the production workflow. It features a modern React frontend with a Node.js/Express backend, PostgreSQL database with Drizzle ORM, and Firebase integration for authentication and file storage.

# User Preferences

Preferred communication style: Simple, everyday language.

# Testing Credentials

## Editor Dashboard Login
- Email: May@maystudios.com
- Password: benjiman1993

## Partner Dashboard Login  
- Email: adamson652@gmail.com
- Password: benjiman1993

# Recent Changes

## 2025-10-13: Standalone Folder File Upload System - COMPLETED
- **Removed Order Requirement**: Folders created via "Add Content" button no longer require order selection
- **Tokenized Folder System**: Standalone folders use unique nanoid(10) tokens for Firebase organization
- **Firebase Path Structure**: `completed/{jobId}/folders/{token}/{folderPath}/` for order-independent folders
- **Backend Updates**: POST /api/jobs/:jobId/folders generates folderToken, creates Firebase placeholder at tokenized path
- **Storage Enhancement**: folderToken stored in firebaseUrl field of placeholder for retrieval
- **API Response**: GET /api/jobs/:jobId/folders now returns folderToken for each folder
- **UI Simplification**: Removed order dropdown from "Add Content" form - only folder name required
- **Path Sanitization**: Consistent sanitization between placeholder creation and file uploads using shared regex patterns
- **Schema Updates**: Made editorUploads.orderId nullable and added folderToken field to support order-independent uploads
- **Upload Flow Fixed**: FileUploadModal now accepts folderToken, skips order reservation when uploading to standalone folders
- **Backend Upload Logic**: POST /api/upload-firebase creates EditorUpload records with folderToken for standalone folder uploads
- **Storage Query Updated**: getUploadFolders() handles uploads with null orderId and uses folderToken field for retrieval
- **Database Migration**: Pushed schema changes to PostgreSQL database - orderId nullable, folderToken added
- **Complete Integration**: Files successfully upload to Firebase and display in frontend gallery for standalone folders
- **CRITICAL BUG FIX**: Fixed database persistence issue where EditorUpload records were not created after successful Firebase uploads
  - Root cause: createEditorUpload() was nested inside activity logging try-catch block with conditional checks (authHeader, partnerId)
  - Solution: Moved createEditorUpload() to execute immediately after successful Firebase upload (line 2741-2759 in routes.ts)
  - Ensures database records are ALWAYS created after successful uploads, regardless of activity logging authentication issues
  - Removed redundant `if (job)` guard since job existence is validated earlier (returns 404 if not found)
  - End-to-end testing confirms files now persist to database and display correctly in gallery

## 2025-08-03: Job Card + Google Maps Integration - COMPLETED
- **Jobs Management System**: Complete job creation, listing, and management with multi-tenant data isolation
- **Customer Management System**: Full customer creation modal matching mockup design with profile upload capability, search/filter functionality, and professional card-based layout
- **Orders Management System**: Professional table layout with status tabs (Pending, Shared, In Review, Completed, Cancelled), comprehensive create modal with supplier assignment
- **Products Management System**: Complete product catalog with creation modal, pricing management, and multi-tenant support
- **Multi-Tenant Integration**: All business objects (customers, jobs, orders, products) properly isolated by partnerId
- **Cross-Module Integration**: Customer selection integrated into Job and Order creation modals with real customer data
- **Search & Filter Systems**: Professional search and category filtering across customers with real-time results
- **API Endpoints**: Complete RESTful API coverage for all core business objects with proper validation
- **UI/UX Matching**: All interfaces match provided mockup designs with professional styling and responsive layouts
- **Real Data Flow**: End-to-end testing completed with authentic customer, job, order, and product data
- **Data Persistence Solution**: Implemented file-based storage persistence to maintain all data across server restarts and hot reloads
- **Production-Ready Foundation**: All core business modules working together with persistent storage and multi-tenant architecture
- **Job Card Page Implementation**: Complete job detail page with map section, content management tabs, customer info, appointments, billing, and activity log
- **NanoID Backend Tracking**: Every job gets unique system-assigned NanoID for internal file uploads, editor handovers, and activity tracking
- **Job Navigation**: Clickable job cards in Jobs list that navigate to detailed Job Card page using jobId route (/jobs/:jobId)
- **API Enhancement**: New /api/jobs/card/:jobId endpoint returns job data with linked customer information
- **Asset Management UI**: Content tabs for Photos, Floor Plans, Videos, Virtual Tours, and Other Files with upload placeholders
- **Google Maps Integration**: Fully functional interactive maps showing property locations on Job Card pages using Google Maps Embed API
- **Live Map Previews**: Real-time map updates in Create Job modal when addresses are entered - confirmed working
- **Responsive Map Component**: Reusable GoogleMapEmbed component with proper error handling and responsive iframe embedding
- **Production Ready**: Google Maps API key properly configured and maps loading successfully across all job addresses

## 2025-08-02: Multi-Tenant Partner Structure Implementation - COMPLETED
- **Complete Multi-Tenant Architecture**: Implemented partnerId-based data isolation for true multi-tenancy
- **Updated Role System**: Simplified to 3 roles - partner (owner), admin (team manager), photographer (field worker)
- **Partner Signup Flow**: Public signups automatically create partner accounts with unique partnerId generation
- **Team Management System**: Partners can invite admin/photographer team members via dedicated Team Members page
- **Firebase Backend Integration**: Full Firestore integration with user documents and pending invite collections
- **Invite Token System**: Secure team member onboarding with unique invite links and status tracking
- **Route-Based Permissions**: Updated authorization system for new role structure with partner-only settings access
- **Team Members UI**: Comprehensive interface for managing invites, viewing team status, and copying invite links
- **Complete Invite Flow**: Team members signing up via invite links correctly inherit role and partnerId from invites
- **API Endpoints**: /api/auth/signup (partners), /api/auth/complete-invite (team members), /api/team/invite (create invites), /api/team/invite-info (get invite details)
- **Frontend Integration**: Updated signup page detects invite tokens, pre-fills email, shows role info, and routes to correct backend endpoint
- **Data Validation**: All invite signups properly validate tokens, update invite status to "accepted", and create user documents with correct role/partnerId
- **UI Enhancement**: Signup page shows "Join Team" vs "Create Partner Account" based on invite presence, displays invited role to user
- **Complete Testing**: Verified end-to-end flow from invite creation → link sharing → team member signup with correct role inheritance

## 2025-08-02: Firebase Authentication Implementation
- Implemented Firebase Authentication with Email/Password login
- Added comprehensive role management system (client, photographer, editor, admin, licensee, master)
- Created login and signup pages with clean card layouts
- Implemented role-based route protection throughout the application
- Enhanced header with user information, role badges, and sign-out functionality
- Added AuthContext for centralized authentication state management
- Configured Firestore integration for user data storage with fallback handling
- Note: Current backend storage is in-memory only - data resets on server restart

## 2025-08-02: Major UI Enhancements and Job Management  
- Fixed job creation date validation issues with proper backend date handling
- Enhanced Jobs page to match mockup design with professional list view
- Added search and filter functionality for jobs and customers
- Improved Dashboard with proper upcoming appointments display
- Implemented status badges and color-coded indicators
- Added customer name resolution and proper date formatting

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript using Vite as the build tool
- **Styling**: TailwindCSS with shadcn/ui component library for consistent design
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **Authentication**: Firebase Auth with React Firebase Hooks
- **Layout**: Fixed sidebar navigation with responsive mobile drawer, header with search and notifications

## Backend Architecture
- **Runtime**: Node.js with Express.js framework using TypeScript
- **API Design**: RESTful API with structured route handlers
- **Storage Layer**: Abstract storage interface with in-memory implementation (MemStorage) for development
  - Note: Current implementation uses in-memory storage which resets on server restart
  - For production, this should be replaced with persistent database storage
- **Request Handling**: Express middleware for logging, JSON parsing, and error handling
- **Development**: Hot reloading with Vite integration in development mode

## Database Architecture
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Connection**: Neon Database serverless PostgreSQL
- **Schema**: Well-defined tables for users, customers, products, jobs, and orders with proper relationships
- **Migrations**: Drizzle Kit for schema management and migrations

## Authentication & Authorization
- **Provider**: Firebase Authentication
- **Methods**: Email/password authentication
- **Session Management**: Firebase Auth state persistence
- **Route Protection**: Auth state checks with loading states

## File Storage
- **Provider**: Firebase Storage
- **Use Cases**: Profile images, product images, job photos, and file uploads
- **Integration**: Direct Firebase SDK integration in the frontend

# External Dependencies

## Core Framework Dependencies
- **React Ecosystem**: React 18, React DOM, React Router (Wouter)
- **Build Tools**: Vite with TypeScript support, ESBuild for production builds
- **Styling**: TailwindCSS, PostCSS, Autoprefixer

## UI Component Libraries
- **shadcn/ui**: Complete component library based on Radix UI primitives
- **Radix UI**: Headless UI components for accessibility and functionality
- **Lucide React**: Icon library for consistent iconography
- **Class Variance Authority**: For component variant management

## Backend Dependencies
- **Express.js**: Web framework with middleware support
- **Drizzle ORM**: Type-safe ORM with PostgreSQL support
- **Neon Database**: Serverless PostgreSQL database hosting
- **Connect PG Simple**: PostgreSQL session store for Express

## Authentication & Database
- **Firebase**: Authentication, Firestore, and Storage services
- **React Firebase Hooks**: React hooks for Firebase integration
- **Drizzle Zod**: Schema validation integration

## Development Tools
- **TypeScript**: Type safety across the entire stack
- **TSX**: TypeScript execution for development server
- **Replit Plugins**: Development environment integration and error handling

## Utility Libraries
- **TanStack Query**: Server state management and caching
- **React Hook Form**: Form state management with validation
- **Date-fns**: Date manipulation and formatting
- **clsx & tailwind-merge**: Conditional CSS class handling