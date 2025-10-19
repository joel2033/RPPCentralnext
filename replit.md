# Overview

This project is a full-stack SaaS platform designed for Real Property Photography (RPP) businesses. It offers a comprehensive solution for managing photography jobs, customers, products, orders, and the entire production workflow. The platform aims to streamline operations for RPP businesses, providing tools for efficient job and customer management, order processing, and product catalog maintenance. Its key capabilities include multi-tenant support for multiple partners, secure authentication, and integration with external services for enhanced functionality. The ultimate goal is to provide a robust, scalable, and user-friendly system that addresses the specific needs of the RPP industry, improving operational efficiency and client satisfaction.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript, using Vite as the build tool.
- **Styling**: TailwindCSS with shadcn/ui for consistent design.
- **Routing**: Wouter for client-side routing.
- **State Management**: TanStack Query (React Query) for server state management.
- **Authentication**: Firebase Auth with React Firebase Hooks.
- **Layout**: Fixed sidebar navigation with responsive mobile drawer and a header for search and notifications.
- **UI/UX Decisions**: Focus on professional, card-based layouts for listings (customers, jobs), comprehensive modals for creation, status badges, and color-coded indicators for improved readability and user experience. Google Maps integration for job locations provides visual context.

## Backend Architecture
- **Runtime**: Node.js with Express.js framework using TypeScript.
- **API Design**: RESTful API with structured route handlers.
- **Storage Layer**: Abstract storage interface, currently using in-memory `MemStorage` for development, designed for future replacement with persistent database storage.
- **Request Handling**: Express middleware for logging, JSON parsing, and error handling.
- **Development**: Hot reloading with Vite integration.

## Database Architecture
- **ORM**: Drizzle ORM with PostgreSQL dialect.
- **Connection**: Neon Database serverless PostgreSQL.
- **Schema**: Well-defined tables for users, customers, products, jobs, and orders with proper relationships. Includes fields for multi-tenancy (`partnerId`), Firebase integration (`folderToken`), and accounting integration.
- **Migrations**: Drizzle Kit for schema management and migrations.

## Authentication & Authorization
- **Provider**: Firebase Authentication, supporting Email/Password login.
- **Session Management**: Firebase Auth state persistence.
- **Role Management**: Comprehensive role system (partner, admin, photographer).
- **Authorization**: Role-based route protection and multi-tenant data isolation using `partnerId`.
- **Team Management**: Partner signup flow, team member invitation system with secure tokens, and an interface for managing team members.

## File Storage
- **Provider**: Firebase Storage.
- **Use Cases**: Profile images, product images, job cover images, completed deliverables with subfolder organization, and general file uploads.
- **Integration**: Direct Firebase SDK integration in the frontend and backend logic for organizing files with job-specific and tokenized folder structures.
- **Cover Images**: Jobs can have optional cover images uploaded during creation, stored in Firebase Storage under `cover-images/` path. Displayed as placeholder (🏠 emoji) when not set, and as the actual image when uploaded.

## System Design Choices
- **Multi-Tenancy**: Implemented `partnerId`-based data isolation across all core business objects (customers, jobs, orders, products) to support multiple independent businesses.
- **Job Management**: Complete job creation, listing, and detailed management with unique NanoIDs for tracking. Includes optional cover image upload for each job to help visually identify properties.
- **Order-Independent File Uploads**: Standalone folder creation and file uploads are supported, not requiring an associated order.
- **Accounting Integration Foundation**: UI and database schema updates in place to support future integration with accounting software like Xero. The Create Customer modal includes dropdowns for selecting accounting integration (Xero) and matching contacts.
- **Multi-Step Order Creation**: "Upload to Editors" modal redesigned with Figma-based 3-step wizard flow: Job/Supplier selection → Service selection grid → Per-service configuration (files, quantity, instructions, export types). Includes Order Summary sidebar with live cost calculations and terms acceptance. Note: File uploads currently send filenames only - actual binary file upload requires backend FormData API endpoint and Firebase Storage integration.
- **Order Status Flow**: Orders follow a two-step acceptance workflow:
  1. Partners create orders via "Upload to Editors" - initial status is "pending"
  2. Assigned editors must "accept" the order before processing begins
  3. Upon acceptance, status changes to "processing" and `dateAccepted` is set
  4. This ensures editors explicitly confirm they can handle the work before beginning
- **Order Numbering**: Sequential order numbers starting from #00001, automatically incremented based on the highest existing order (not gap-filling).

# External Dependencies

## Core Framework Dependencies
- **React Ecosystem**: React 18, React DOM.
- **Build Tools**: Vite, TypeScript, ESBuild.
- **Styling**: TailwindCSS, PostCSS, Autoprefixer.

## UI Component Libraries
- **shadcn/ui**: Component library built on Radix UI.
- **Radix UI**: Headless UI components.
- **Lucide React**: Icon library.
- **Class Variance Authority**: For component variant management.

## Backend Dependencies
- **Express.js**: Web framework.
- **Drizzle ORM**: Type-safe ORM for PostgreSQL.
- **Neon Database**: Serverless PostgreSQL.
- **Connect PG Simple**: PostgreSQL session store for Express.

## Authentication & Database
- **Firebase**: Authentication, Firestore, and Storage.
- **React Firebase Hooks**: React integration for Firebase.
- **Drizzle Zod**: Schema validation.

## Utility Libraries
- **TanStack Query**: Server state management and caching.
- **React Hook Form**: Form management and validation.
- **Date-fns**: Date manipulation.
- **clsx & tailwind-merge**: Conditional CSS class handling.
- **NanoID**: For generating unique IDs.
- **Google Maps Embed API**: For displaying interactive maps.