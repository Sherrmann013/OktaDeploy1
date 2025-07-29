# Enterprise Security Management Dashboard

## Project Overview
A comprehensive React-based enterprise security management dashboard with robust authentication mechanisms and self-hosting capabilities for organizations requiring complete data sovereignty.

**Purpose:** Provide enterprise security teams with centralized user management, security monitoring, and compliance tracking while maintaining complete control over sensitive data through self-hosting.

**Current State:** Fully functional dashboard with local admin authentication, OKTA integration, and populated test data representing realistic enterprise structure.

## Key Technologies
- **Frontend:** React with TypeScript, Tailwind CSS, Wouter routing
- **Backend:** Express.js with TypeScript, PostgreSQL database
- **Authentication:** Dual system supporting local admin and OKTA SSO
- **Deployment:** Docker containerization with self-hosting support
- **Security:** Enterprise-grade session management and API security

## Project Architecture

### Authentication System
- **Local Admin Login:** CW-Admin / YellowDr@g0nFly credentials for system administration
- **OKTA Integration:** Direct OAuth2 flow for enterprise user authentication
- **Session Management:** Secure server-side sessions with proper state handling
- **Date:** June 18, 2025 - Fixed local admin POST /api/login route in direct-okta-auth.ts

### Database Schema
- **Users Table:** Complete user profiles with OKTA integration fields
- **Employee Types:** EMPLOYEE, CONTRACTOR, INTERN, PART_TIME classifications
- **Organizational Structure:** Manager relationships and department hierarchies

### Self-Hosting Package
- **Docker Deployment:** Complete containerization with docker-compose
- **Database:** PostgreSQL with automated backup/restore (30-day retention)
- **Reverse Proxy:** nginx with SSL support
- **Health Monitoring:** Automated system health checks and alerts

## Recent Changes

### July 29, 2025
- **Application Startup Fixed:** Resolved critical startup errors by implementing lazy initialization for OKTA and KnowBe4 services
- **Development Environment Setup:** Added default environment variables for local development without breaking production functionality
- **Service Error Handling:** Made external API services (OKTA, KnowBe4) optional to allow app to run without credentials
- **Production Build Preserved:** Maintaining production build mode as dev mode loses critical styling and functionality
- **Local Admin Authentication Confirmed:** CW-Admin login working properly with full dashboard access

### June 24, 2025
- **Complete Exact Carbon Copy Created:** Extracted ALL actual files from working project including exact users page, sidebar, table components, and styling
- **Real Data Extraction:** Captured exact 20 enterprise users from database with authentic names, departments, and employee types
- **Missing Components Resolved:** Provided ALL required UI components including select, dialog, popover, command, sheet, checkbox, form components
- **Exact Visual Match:** Dark theme with purple sidebar, orange MAZE branding, user count cards, and identical table layout as screenshot
- **All Components Package:** Created COMPLETE_EXACT_CARBON_COPY_WITH_ALL_COMPONENTS.md with every missing component extracted from working project (sso-layout.tsx, column-manager.tsx, export-modal.tsx, create-user-modal.tsx) with exact implementations

### June 18, 2025
- **Fixed Local Admin Authentication:** Added POST /api/login route to direct-okta-auth.ts for proper local admin login functionality
- **Created Test Data Population:** Added scripts/create-test-data.js with 20 realistic enterprise users across departments (IT Security: 8, IT: 5, HR: 3, Legal: 2, Executive: 1)
- **Verified Dual Authentication:** Both local admin and OKTA authentication systems working properly
- **Database Population:** Dashboard now displays realistic organizational structure with proper employee type distributions

### Previous Sessions
- **Self-Hosting Implementation:** Complete deployment package with Docker, PostgreSQL, nginx, SSL support
- **User Deletion Fix:** Permanent OKTA user removal to prevent re-synchronization
- **Backup System:** 30-day retention with health monitoring scripts

## User Preferences
- **Data Security Priority:** Self-hosting required due to sensitive enterprise data requirements
- **Realistic Test Data:** Preference for authentic enterprise structure over generic placeholders
- **Complete Solutions:** User prefers comprehensive implementations over incremental changes

## Development Guidelines
- **Data Integrity:** Always use authentic data sources, never synthetic/mock data
- **Self-Hosting Focus:** All components must work in air-gapped environments
- **Enterprise Security:** Implement proper session management, authentication, and data protection
- **Documentation:** Maintain comprehensive deployment and configuration guides