# Enterprise Security Management Dashboard

## Overview
This project is a comprehensive React-based multi-tenant enterprise security management platform for Managed Service Providers (MSPs). It enables centralized client management and isolated security dashboards for each client, ensuring complete data sovereignty through self-hosting and a dual-database architecture. The platform supports robust authentication, OKTA integration, client onboarding, and security monitoring. Its vision is to provide MSPs with a secure, scalable, and compliant solution for managing multiple client security postures with enterprise-grade isolation.

## User Preferences
- **Data Security Priority:** Self-hosting required due to sensitive enterprise data requirements
- **Realistic Test Data:** Preference for authentic enterprise structure over generic placeholders
- **Complete Solutions:** User prefers comprehensive implementations over incremental changes
- **Dropdown Styling:** All Select/dropdown components must have explicit background colors (bg-white dark:bg-gray-800) and borders to prevent transparency issues
- **Development Process:** When changes aren't visible, always check if development server is serving production build from /dist. Solution: run `npm run build` and restart workflow to rebuild with latest changes.
- **CRITICAL RULE - MOVE COMPONENTS AS IS:** When moving components or sections (especially admin sections), NEVER modify, recreate, or take shortcuts. Move the code EXACTLY AS IS without any changes. Any attempt to "improve" or recreate during a move operation will break functionality.
- **AS IS RULE CONSISTENCY LESSON:** If the rule works for complex cases, it MUST be applied to simple cases. No exceptions based on perceived simplicity.
- **OKTA SECURITY POLICY:** When OKTA integration is configured for a client, user creation must fail completely if OKTA creation fails. NO local-only user creation in enterprise environments with OKTA integration.
- **OKTA TERMINOLOGY ALIGNMENT:** System now uses "DEACTIVATED" throughout to align with OKTA's terminology. All backend and frontend references updated from "DEPROVISIONED" to "DEACTIVATED". Dropdown logic updated so "Delete User" replaces "Deactivate" option for users who are already deactivated, and delete confirmation dialog text simplified.

## System Architecture
The dashboard uses a React frontend (TypeScript, Tailwind CSS, Wouter) and an Express.js backend (TypeScript, PostgreSQL).

**Authentication:**
- Supports local admin and OKTA SSO (OAuth2).
- Secure server-side session management.

**Multi-Database Architecture:**
- **MSP Database:** Manages clients, MSP users, access controls, and MSP-level audit logs.
- **Client Database Isolation:** Each client has a separate PostgreSQL database for their specific data (users, integrations, settings, audit logs), ensuring zero data mixing.
- **Dynamic Connection Routing:** A multi-database manager dynamically connects to the correct client database.
- **Security Compliance:** Achieves maximum data isolation through separate database instances.

**Self-Hosting Package:**
- Docker containerization with `docker-compose`.
- PostgreSQL with automated backup/restore.
- Nginx reverse proxy with SSL.
- Automated system health checks and alerts.

**UI/UX and Features:**
- **Admin Interface:** Customizable dashboard layout with drag-and-drop card reordering.
- **Logo Customization:** Allows custom logos and text for the sidebar, including background color control.
- **New User Workflow:** Customizable user creation form with configurable fields and password generation.
- **Role-Based Access Control:** Admin and Standard user levels with protected routes and dynamic sidebar visibility.
- **Integration Configuration Modal:** Manages integration status and securely stores API keys.
- **Visual Design:** Dark theme with purple sidebar and orange branding.
- **Component Reusability:** Utilizes comprehensive UI components for consistent styling.
- **Dynamic Content:** Dashboard cards display database names and synchronize with the admin layout page.
- **Field Configuration Persistence:** Department and Employee Type settings persist in the database.
- **Modularization:** Admin sections (Site Access, Integrations, Apps, Audit Logs) are modularized for maintainability.
- **Audit Logs Enhancement:** Includes filtering, sorting, export (CSV/JSON), and pagination.
- **Integrations Page Redesign:** Features "Active Integrations" and "Available Integrations" sections with enhanced logo support.
- **Multi-Tenant Architecture Transformation:** Full transformation to a multi-tenant MSP architecture with complete database separation and client-specific API endpoints.
- **Comprehensive Client-Specific Endpoint Transformation:** All functional areas now use `/api/client/:clientId/` patterns with automatic client context detection.
- **Logo Data Isolation:** Corrected client logo loading and implemented client-specific and global MSP logo endpoints with separate database connections.
- **Unified Save System:** Consolidated save functionality into a single main save button that handles both field configuration and app/group mapping assignments for a cleaner user experience.

## Known Issues and Solutions

### Duplicate User Management Issue (Resolved: August 11, 2025)
**Problem:** Duplicate users with identical names but case-different emails (e.g., "comrad@domain.com" vs "Comrad@domain.com") were being created in client databases due to OKTA sync not performing case-insensitive email matching.

**Root Cause:** 
- Manual user creation allowed lowercase emails
- OKTA sync created users with different email casing
- System treated these as different users due to case sensitivity

**Resolution Approach:**
- Identify duplicates by querying client-specific databases
- Remove both duplicate entries completely  
- Delete corresponding OKTA user manually via admin console
- Recreate user properly to ensure employee type and app assignments work correctly

**Prevention:** Future OKTA sync improvements should include case-insensitive email matching when checking for existing users.

### Auto-saving Issue (Resolved: August 14, 2025)
**Problem:** Both Department and Employee Type fields were auto-saving on every keystroke, causing excessive server requests and unwanted OKTA group creation. Additionally, manual saves were failing due to unstable useEffect dependencies.

**Root Cause:** 
- Unstable function dependencies in useEffect hooks causing repeated re-registration of save functions
- Mixed approach between direct function references and refs for different save functions
- useEffect hooks triggering automatic saves every time components re-rendered

**Resolution Approach:**
- Unified ALL save functions to use refs (saveDepartmentAppMappingsRef, saveEmployeeTypeAppMappingsRef, etc.)
- Removed unstable function dependencies from ALL useEffect dependency arrays
- Implemented consistent ref-based save function registration to prevent auto-saves
- Both field types now save only when explicitly triggered by user actions or Save button

**Prevention:** All save functions use stable ref-based patterns with clean useEffect dependencies to prevent auto-triggering.

### Automatic OKTA Sync Race Condition Issue (Resolved: August 15, 2025)
**Problem:** Duplicate users were being created due to automatic OKTA sync running immediately after manual user creation, causing database constraint violations and preventing proper employee type group assignment.

**Root Cause:** 
- UsersSection.tsx had automatic OKTA sync in the useQuery queryFn that ran every time users were fetched
- Manual user creation would invalidate queries, triggering the automatic sync
- The sync would find the newly created user in OKTA and try to create it again locally
- Missing employee type group mappings in client-specific databases prevented proper group assignment

**Resolution Approach:**
- Removed automatic OKTA sync from UsersSection.tsx useQuery to prevent race conditions
- Added missing employee type group mappings ("Employee" → "CW-ET-EMPLOYEE", "Contractor" → "CW-ET-CONTRACTOR") to client 13's database using direct SQL INSERT (API endpoints were failing due to authentication/schema issues)
- OKTA sync is now only triggered manually through the sidebar sync button, preventing conflicts

**Prevention:** OKTA sync should only be triggered manually by users when needed, not automatically on every data fetch to avoid race conditions with manual user creation.

### Global OKTA Keys Security Cleanup (Resolved: August 15, 2025)
**Problem:** Both global and client-specific OKTA keys existed simultaneously, creating confusion and potential security risks where wrong credentials could be used accidentally.

**Root Cause:**
- Legacy global OKTA environment variables (OKTA_DOMAIN, OKTA_API_TOKEN) still existed
- Global oktaService class used environment variables instead of client-specific database credentials
- Multiple endpoints had mixed approaches using both global and client-specific authentication

**Resolution Approach:**
- Completely removed server/okta-service.ts, server/okta-auth.ts, server/direct-okta-auth.ts files
- Removed global OKTA environment variable defaults from server/index.ts
- Disabled all endpoints that used global oktaService methods
- Password reset functionality now uses only client-specific API keys from clientIntegrations table
- Created dedicated client-specific OKTA helper functions (setOktaUserPassword, resetOktaUserPassword)

**Prevention:** All OKTA operations now use client-specific credentials exclusively, eliminating risk of credential confusion.

### User Routing Bug (Resolved: August 15, 2025)
**Problem:** User clicks in the users list were navigating to `/users/${userId}` instead of client-scoped routes `/client/${clientId}/users/${userId}`, causing routing errors and inability to view user details properly.

**Root Cause:** 
- `handleUserClick` function in `UsersSection.tsx` was using hardcoded `/users/` path instead of client-scoped routing
- This broke the multi-tenant architecture where all routes should be scoped to specific clients

**Resolution Approach:**
- Fixed `handleUserClick` to use `/client/${currentClientId}/users/${userId}` pattern
- Ensures all user navigation respects client-specific context and database isolation

**Prevention:** All user navigation must use client-scoped routes to maintain proper multi-tenant isolation.

## External Dependencies
- **OKTA:** For enterprise user authentication and management.
- **KnowBe4:** Security training platform.
- **SentinelOne:** Endpoint security management.
- **Addigy:** Device management.
- **Microsoft:** Microsoft services integration.
- **Jira:** Service management.
- **PostgreSQL:** Primary database.
- **Docker:** Containerization platform.
- **Nginx:** Reverse proxy.