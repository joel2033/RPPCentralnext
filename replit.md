# Overview

This is a full-stack SaaS platform for Real Property Photography (RPP) business management. The application provides a comprehensive solution for managing photography jobs, customers, products, orders, and the production workflow. It features a modern React frontend with a Node.js/Express backend, PostgreSQL database with Drizzle ORM, and Firebase integration for authentication and file storage.

# User Preferences

Preferred communication style: Simple, everyday language.

# Recent Changes

## 2025-08-03: Complete Foundation Modules Implementation - COMPLETED
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