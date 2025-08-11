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
- **COMPREHENSIVE CLIENT-SPECIFIC ENDPOINT TRANSFORMATION (COMPLETED):** Systematically removed all remaining global endpoints and transformed them to client-specific routing for complete data isolation. All functional areas now use `/api/client/:clientId/` patterns with automatic client context detection from URL routing. Build size reduced from 287.1kb to 267.8kb through comprehensive code cleanup.
- **LOGO DATA ISOLATION FIX (COMPLETED - January 2025):** Fixed JavaScript errors preventing client logo pages from loading by correcting useQuery enabled conditions. Updated database storage methods to filter by clientId context (MSP uses clientId: 0, clients use specific IDs). Both global MSP and client-specific logo endpoints properly implemented with separate database connections. Fixed client database schema structure to include file_name, mime_type, file_size columns. Logo uploads now work correctly with complete data isolation.
- **MSP ROUTING UPDATE (January 2025):** Changed primary landing page from `/` to `/msp` for better URL structure. Root path now redirects to `/msp`. Fixed MSP logo loading issue by updating sidebar logic to properly fetch logos on both routes. MSP dashboard now accessible via clean `/msp` URL.
- **TERMINOLOGY CLARIFICATION (January 2025):** Updated all "Groups" references to "Email Groups" throughout the interface for clarity. This includes field labels, column headers, configuration sections, and supporting text to clearly indicate these are email distribution groups.
- **CLIENT DATA SAVE PERSISTENCE BUG RESOLVED (January 2025):** Fixed critical issue where client card edits appeared to save successfully but didn't persist after page refresh. Root causes: (1) Missing database columns (display_name, company_name, identity_provider, notes), (2) Duplicate route registration causing conflicts, (3) Aggressive React Query caching (5-minute staleTime) preventing UI updates even after cache invalidation. All client data edits now save and persist correctly with immediate UI feedback.
- **AUTO-SAVE MECHANISM DISABLED (January 2025):** Completely resolved hidden auto-save issue where department and employee type mappings were saving automatically without user consent. Problem: useEffect hooks in SelectFieldConfig.tsx were auto-registering save functions that bypassed manual-save protection by passing `true` parameter. Solution: Disabled all four auto-registration useEffect hooks, ensuring mappings only save when users explicitly click individual save buttons. Manual-save requirement now properly enforced.
- **COMPREHENSIVE SAVE BUTTON FIX (January 2025):** Completely resolved save button functionality with comprehensive architectural solution. Issues: (1) Auto-saves were bypassing user intent, (2) Save button appeared but couldn't detect changes, (3) React Query aggressive polling caused excessive API calls, (4) DELETE operations failing silently when removing mappings. Solution: Implemented direct state tracking system, manual save trigger architecture, disabled auto-registration hooks, added proper React Query caching (5-minute staleTime, disabled auto-refetch), enhanced DELETE error handling, replaced cache invalidation with targeted refetch. Save buttons now work correctly for both adding and removing mappings without unwanted auto-saves or performance issues.

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