# Enterprise Security Management Dashboard

## Overview
This project is a comprehensive React-based enterprise security management dashboard designed for organizations requiring complete data sovereignty through self-hosting. Its primary purpose is to provide enterprise security teams with centralized user management, security monitoring, and compliance tracking capabilities while maintaining full control over sensitive data. The dashboard features robust authentication mechanisms, including local admin and OKTA integration, and is deployed via Docker for easy self-hosting. The business vision is to empower organizations with a secure, controllable, and comprehensive solution for managing their security posture, leveraging real-world enterprise structures for effective management.

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

**Database Schema:**
- **Users Table:** Stores user profiles, integrated with OKTA.
- **Employee Types:** Classifications (EMPLOYEE, CONTRACTOR, INTERN, PART_TIME).
- **Organizational Structure:** Manages manager relationships and department hierarchies.
- **Integrations Management:** Stores configurations for 6 security integrations (OKTA, KnowBe4, SentinelOne, Addigy, Microsoft, Jira) with dynamic API key configuration.
- **App Mappings:** Manages OKTA application-to-group mappings for consistent user provisioning.
- **Layout Settings:** Persists dashboard card configurations, logo customization, and new user form settings.

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