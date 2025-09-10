# PLC Configuration Builder

## Overview

This is a full-stack web application for building and managing PLC (Programmable Logic Controller) configuration files. The application provides a user-friendly interface for creating configuration files that map PLC registers to OPC UA registers, with support for multiple PLCs and different data types. Users can manually configure address mappings or import them from CSV/TXT files, then export the complete configuration as JSON files.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Components**: Radix UI primitives with shadcn/ui component library for consistent design
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode support)
- **State Management**: React hooks for local state, TanStack Query for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Internationalization**: Custom translation system supporting English and Japanese languages
- **File Processing**: PapaParse for CSV file parsing and processing

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Session Storage**: Connect-pg-simple for PostgreSQL session storage
- **API Design**: RESTful API endpoints for PLC configuration management
- **Data Validation**: Zod schemas for runtime type checking and validation
- **Development**: Hot module replacement with Vite in development mode

### Data Storage Design
- **Primary Database**: PostgreSQL with Neon serverless driver
- **Schema**: Two main tables - users and plc_configurations
- **Configuration Storage**: JSON blob storage for complex PLC configuration data
- **Fallback Storage**: In-memory storage implementation for development/testing

### Authentication & Authorization
- **Session Management**: Express sessions with PostgreSQL storage
- **User Model**: Simple username/password authentication system
- **Access Control**: Basic user-based access to PLC configurations

### Core Features
- **Configuration Builder**: Interactive form-based configuration creation
- **File Import**: CSV/TXT file upload and parsing for address mappings
- **Data Validation**: Comprehensive validation for IP addresses, URLs, and configuration data
- **Export Functionality**: JSON export of complete PLC configurations
- **Multi-language Support**: English and Japanese interface translations
- **Responsive Design**: Mobile-friendly interface with collapsible sidebar

## External Dependencies

### Database Services
- **Neon Database**: Serverless PostgreSQL hosting via `@neondatabase/serverless`
- **Drizzle Kit**: Database migrations and schema management tool

### UI/UX Libraries
- **Radix UI**: Comprehensive set of accessible UI primitives
- **Lucide React**: Icon library for consistent iconography
- **Tailwind CSS**: Utility-first CSS framework with custom design tokens

### Data Processing
- **PapaParse**: CSV parsing library for file import functionality
- **Zod**: TypeScript-first schema validation library
- **date-fns**: Date manipulation and formatting utilities

### Development Tools
- **Vite**: Fast build tool with HMR and TypeScript support
- **TanStack Query**: Data fetching and caching library
- **Replit Integration**: Development environment integration tools

### Build & Deployment
- **ESBuild**: JavaScript bundler for production builds
- **TypeScript**: Static type checking across the entire codebase
- **PostCSS**: CSS processing with Tailwind CSS and Autoprefixer