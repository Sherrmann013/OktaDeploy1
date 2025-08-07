# Enterprise Security Management Dashboard

## Overview
This project is a comprehensive React-based multi-tenant enterprise security management platform designed for Managed Service Providers (MSPs) requiring complete data sovereignty through self-hosting. Its primary purpose is to provide MSPs with centralized client management and isolated security dashboards for each client organization while maintaining complete data separation for security compliance. The platform features a dual-database architecture: an MSP database for client management and completely isolated client databases ensuring zero data mixing. The dashboard includes robust authentication, OKTA integration, client onboarding workflows, and comprehensive security monitoring capabilities. The business vision is to empower MSPs with a secure, scalable, and compliant solution for managing multiple client security postures with enterprise-grade isolation.

## User Preferences
- **Data Security Priority:** Self-hosting required due to sensitive enterprise data requirements
- **Realistic Test Data:** Preference for authentic enterprise structure over generic placeholders
- **Complete Solutions:** User prefers comprehensive implementations over incremental changes
- **Dropdown Styling:** All Select/dropdown components must have explicit background colors (bg-white dark:bg-gray-800) and borders to prevent transparency issues
- **Development Process:** When changes aren't visible, always check if development server is serving production build from /dist. Solution: run `npm run build` and restart workflow to rebuild with latest changes.
- **Performance Optimization:** Implemented comprehensive query caching and polling optimizations to reduce CPU usage.
- **CRITICAL FIX:** Removed ALL excessive console.log statements throughout the entire client-side codebase that were causing browser tab crashes and F12 console performance issues. The application now runs without debug logging noise.
- **CRITICAL RULE - MOVE COMPONENTS AS IS:** When moving components or sections (especially admin sections), NEVER modify, recreate, or take shortcuts. Move the code EXACTLY AS IS without any changes. Any attempt to "improve" or recreate during a move operation will break functionality.
- **AS IS RULE CONSISTENCY LESSON:** If the rule works for complex cases, it MUST be applied to simple cases. No exceptions based on perceived simplicity.

## System Architecture
The dashboard is built with a React frontend (TypeScript, Tailwind CSS, Wouter) and an Express.js backend (TypeScript, PostgreSQL).

**Authentication:**
- Dual system supporting local admin and OKTA SSO (OAuth2 flow).
- Secure server-side session management.

**Multi-Database Architecture:**
- **MSP Database:** Contains client management (clients table), MSP users (msp_users), client access controls (client_access), and MSP-level audit logs (msp_audit_logs). No client-specific data stored here.
- **Client Database Isolation:** Each client organization gets completely separate PostgreSQL database containing users table, integrations, layout settings, dashboard cards, audit logs, and app mappings. Complete infrastructure-level separation ensures zero data mixing between clients.
- **Dynamic Connection Routing:** Multi-database manager handles dynamic connections to correct client database based on context with separate database instances.
- **Security Compliance:** Maximum data isolation through separate database instances ensures sensitive client data never crosses organizational boundaries, meeting the highest security compliance requirements for enterprise MSP deployments.

**Self-Hosting Package:**
- Docker containerization with `docker-compose`.
- PostgreSQL database with automated backup/restore.
- Nginx reverse proxy with SSL support.
- Automated system health checks and alerts.

**UI/UX and Features:**
- **Admin Interface:** Customizable dashboard layout with drag-and-drop card reordering and persistence.
- **Logo Customization:** Allows uploading custom logos and text for the sidebar, including background color control and text visibility toggle.
- **New User Workflow:** Customizable new user creation form with configurable fields and password generation settings.
- **Role-Based Access Control:** Admin and Standard user levels with protected routes and dynamic sidebar visibility.
- **Integration Configuration Modal:** Provides status management (Connected/Pending/Disconnected) and secure API key storage.
- **Visual Design:** Dark theme with purple sidebar and orange branding.
- **Component Reusability:** Employs comprehensive UI components (select, dialog, popover, command, sheet, checkbox, form) for consistent styling and functionality.
- **Dynamic Content:** Dashboard cards display database names and are synchronized bi-directionally with the admin layout page.
- **Field Configuration Persistence:** Department and Employee Type field settings properly load from and save to the database, persisting across page refreshes and available to CreateUserModal.
- **Department and Employee Type Integration:** Successfully integrated Department, Employee Type, and dynamic Apps system from Admin interface into CreateUserModal.
- **Modularization:** Admin sections (Site Access, Integrations, Apps, Audit Logs) have been extracted into dedicated components for better organization and maintainability. Dashboard and Users pages also modularized.
- **Audit Logs Enhancement:** Comprehensive filtering and sorting capabilities (newest-first, search, filter by action/user/resource/time), export functionality (CSV/JSON), and pagination controls.
- **Integrations Page Redesign:** Redesigned admin integrations interface with "Active Integrations" and "Available Integrations" sections, direct add/remove buttons, and enhanced logo support for various integration types.
- **Multi-Tenant Architecture Transformation:** Successfully transformed from single-tenant to multi-tenant MSP architecture for security compliance with complete database separation and client-specific API endpoints ensuring true multi-tenant data isolation.

## External Dependencies
- **OKTA:** Integrated for enterprise user authentication via OAuth2 and user/group management.
- **KnowBe4:** Integrated as a security training platform.
- **SentinelOne:** Integrated for endpoint security management.
- **Addigy:** Integrated for device management.
- **Microsoft:** Integrated for Microsoft services.
- **Jira:** Integrated for service management.
- **PostgreSQL:** Primary database for persistent data storage.
- **Docker:** Containerization platform for deployment.
- **Nginx:** Used as a reverse proxy for self-hosting.