# Enterprise Security Management Dashboard

## Overview  
This project is a comprehensive React-based multi-tenant enterprise security management platform designed for Managed Service Providers (MSPs) requiring complete data sovereignty through self-hosting. Its primary purpose is to provide MSPs with centralized client management and isolated security dashboards for each client organization while maintaining complete data separation for security compliance. The platform features a dual-database architecture: an MSP database for client management and completely isolated client databases ensuring zero data mixing. The dashboard includes robust authentication, OKTA integration, client onboarding workflows, and comprehensive security monitoring capabilities. The business vision is to empower MSPs with a secure, scalable, and compliant solution for managing multiple client security postures with enterprise-grade isolation.

## User Preferences
- **Data Security Priority:** Self-hosting required due to sensitive enterprise data requirements
- **Realistic Test Data:** Preference for authentic enterprise structure over generic placeholders
- **Complete Solutions:** User prefers comprehensive implementations over incremental changes
- **Dropdown Styling:** All Select/dropdown components must have explicit background colors (bg-white dark:bg-gray-800) and borders to prevent transparency issues
- **Development Process:** When changes aren't visible, always check if development server is serving production build from /dist. Solution: run `npm run build` and restart workflow to rebuild with latest changes.
- **Performance Optimization:** Implemented comprehensive query caching and polling optimizations (August 5, 2025) to reduce CPU usage from 15-80% to minimal levels by:
  • Removing aggressive refetch intervals (was polling every 5-10 seconds)
  • Setting intelligent cache durations (2-15 minutes based on data volatility)
  • Disabling window focus refetching across all queries
  • Implementing conditional query loading based on active tabs
  • Adding React.lazy() for heavy components (CreateUserModal, NewUserConfigSection)
  • Adding Suspense fallbacks to reduce initial bundle size
  • **CRITICAL FIX (August 5, 2025):** Removed ALL excessive console.log statements throughout the entire client-side codebase that were causing browser tab crashes and F12 console performance issues. The application now runs without debug logging noise.

## System Architecture
The dashboard is built with a React frontend (TypeScript, Tailwind CSS, Wouter) and an Express.js backend (TypeScript, PostgreSQL).

**Authentication:**
- Dual system supporting local admin (CW-Admin / YellowDr@g0nFly) and OKTA SSO (OAuth2 flow).
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
- **Logo Customization:** Allows uploading custom logos and text for the sidebar.
- **New User Workflow:** Customizable new user creation form with configurable fields and password generation settings (words, numbers, symbols with quantity control).
- **Role-Based Access Control:** Admin and Standard user levels with protected routes and dynamic sidebar visibility.
- **Integration Configuration Modal:** Provides status management (Connected/Pending/Disconnected) and secure API key storage.
- **Visual Design:** Dark theme with purple sidebar and orange branding, consistent with provided screenshots.
- **Component Reusability:** Employs comprehensive UI components (select, dialog, popover, command, sheet, checkbox, form) for consistent styling and functionality.
- **Dynamic Content:** Dashboard cards now display database names and are synchronized bi-directionally with the admin layout page.
- **Field Configuration Persistence:** Fixed Department and Employee Type field settings to properly load from and save to the database. Removed conditional query enabling that prevented these settings from loading outside the Layout > New User tab. Settings now persist across page refreshes and are available to CreateUserModal (resolved July 31, 2025).
- **Department and Employee Type Integration:** Successfully integrated Department, Employee Type, and dynamic Apps system from Admin interface into CreateUserModal. Department appears right of Job Title, Employee Type right of Manager in 2-column layouts. Apps replaced with dynamic dropdown system linked to database. All field configurations now sync between Admin and CreateUserModal (completed August 1, 2025).
- **Logo Customization Enhancement (August 5, 2025):** Added comprehensive logo background color control in Admin > Layout > Logo section with color picker interface, hex input field, real-time preview, and sidebar integration. Also implemented logo text visibility toggle allowing users to show/hide the text below the logo. Both settings persist in database with proper audit logging.
- **CRITICAL RULE - MOVE COMPONENTS AS IS (August 6, 2025):** When moving components or sections (especially admin sections), NEVER modify, recreate, or take shortcuts. Move the code EXACTLY AS IS without any changes. Any attempt to "improve" or recreate during a move operation will break functionality. This rule was established after multiple failed attempts where recreated components lost critical functionality, styling, and integration points. ALWAYS copy the exact code, then make modifications separately if needed.
- **AS IS RULE CONSISTENCY LESSON (August 6, 2025):** Applied AS IS rule correctly for Layout section (large, complex) but violated it for Site Access (small, simple). This inconsistency demonstrates that component size is IRRELEVANT - the rule must be applied uniformly. Layout succeeded because code was moved exactly as-is. Site Access failed because it was recreated from scratch, losing table structure and styling. LESSON: If the rule works for complex cases, it MUST be applied to simple cases. No exceptions based on perceived simplicity.
- **Layout Tab Reordering (August 6, 2025):** Moved "New User" tab to first position in Layout section and renamed to "New User Template". Default tab changed from "logo" to "new-user" for better user workflow. Tab order is now: New User Template, Logo, Dashboard, Profile, Monitoring.
- **Site Access Section Modularization (August 6, 2025):** Successfully extracted Site Access functionality from admin.tsx into dedicated SiteAccessSection component structure following the LayoutSection pattern. Created client/src/components/admin/site-access/SiteAccessSection.tsx and index.ts for proper modular organization. All functionality preserved including user management dialogs, table display, and CRUD operations. CRITICAL LESSON: Initially violated AS IS rule by recreating component with simplified structure, causing loss of proper table layout and styling. Corrected by restoring exact original code with proper Table components, toast notifications, and apiRequest integration.
- **Integrations Section Modularization (August 6, 2025):** Successfully extracted Integrations functionality from admin.tsx into dedicated IntegrationsSection component. Removed 150+ lines of integration-related code from admin.tsx including all mutations, state management, dialogs, and UI components. All integration status management, API key configuration, and CRUD operations properly preserved.
- **Apps Section Modularization (August 6, 2025):** Successfully extracted Apps (OKTA Application Mappings) functionality from admin.tsx into dedicated AppsSection component. Removed all app mapping related queries, mutations, state, functions, and dialogs from admin.tsx. All app mapping CRUD operations, bulk creation, editing, and deletion functionality properly preserved.
- **Audit Logs Section Modularization (August 6, 2025):** Successfully extracted Audit Logs functionality from admin.tsx into dedicated AuditLogsSection component. Removed AuditLog interface and query from admin.tsx. All audit log table rendering, action color coding, pagination display, and data formatting properly preserved.
- **Audit Logs Enhancement (August 6, 2025):** Added comprehensive filtering and sorting capabilities to AuditLogsSection. Features include: newest-first sorting by timestamp, search across all fields (user, action, resource, details), filter by action type (CREATE, UPDATE, DELETE, LOGIN), filter by user email, filter by resource type, time-based filtering (today, yesterday, last 7 days, last 30 days), results summary showing filtered/total counts, clear filters functionality, and responsive filter UI with proper dark mode support.
- **Audit Logs Export & Pagination (August 6, 2025):** Added export functionality (CSV/JSON formats) with proper formatting and date-stamped filenames. Added pagination controls (50/100/200 entries display limit). Fixed duplicate actions in dropdown filter and resolved JavaScript filtering errors. Enhanced results summary with filtered vs total counts display.
- **Audit Logs Export & Display Enhancement (August 6, 2025):** Added export functionality for CSV and JSON formats that export filtered results with all log fields. Fixed action dropdown duplicates by using Array.from(). Added display limit controls (50/100/200 events) with improved results summary showing "X of Y filtered results (Z total)". Export includes proper CSV escaping and ISO timestamp formatting. Display controls allow viewing more events without performance impact.
- **Dashboard and Users Pages Modularization (August 6, 2025):** Successfully extracted Dashboard and Users page functionality following strict AS IS rule. Created client/src/components/dashboard/DashboardSection.tsx and client/src/components/users/UsersSection.tsx components. All functionality preserved including dashboard cards, user management, OKTA sync, filtering, export capabilities, and column management. This was successful on the third attempt after strictly following the AS IS rule - moving code exactly as written without modifications, improvements, or shortcuts. Both pages now properly use modular components while maintaining all original functionality.
- **Integrations Page Redesign (August 6, 2025):** Completely redesigned admin integrations interface by removing modal overlay and splitting into "Active Integrations" and "Available Integrations" sections. Added direct "Add Integration" buttons on available integrations and "Remove" (X icon) buttons on active integrations for immediate deletion. Enhanced logo support with custom SVG designs for all integration types including ScreenConnect, Ninja One, Zendesk, Mesh AI, Abnormal Security, Arctic Wolf, Microsoft Defender, and Hexnode. This provides a much cleaner, more intuitive interface for integration management without modal dialogs.
- **CRITICAL ARCHITECTURAL TRANSFORMATION (August 6, 2025):** Successfully transformed from single-tenant to multi-tenant MSP architecture for security compliance. Implemented complete database separation with MSP database (client management, MSP users, access controls) and isolated client databases (users, integrations, audit logs). Created multi-database connection manager, MSP storage layer, client storage layer, and MSP dashboard (/msp route). Added MSP navigation link (Building2 icon) in sidebar. Sample clients created: TechCorp Solutions, MedBridge Healthcare, RetailMax Group, StartupHub Inc, FinanceFirst Bank. Each client now has completely isolated database ensuring zero data mixing for security compliance.

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
```