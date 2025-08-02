# Overview

This is a full-stack SaaS platform for Real Property Photography (RPP) business management. The application provides a comprehensive solution for managing photography jobs, customers, products, orders, and the production workflow. It features a modern React frontend with a Node.js/Express backend, PostgreSQL database with Drizzle ORM, and Firebase integration for authentication and file storage.

# User Preferences

Preferred communication style: Simple, everyday language.

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