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
- **Database Migration Complete:** Successfully migrated site access users from in-memory state to PostgreSQL with persistent storage
- **Site Access Database Schema:** Created siteAccessUsers table with proper CRUD API endpoints for permanent user management
- **User Interface Updates:** Changed admin access level badges from red to green, removed avatar initials from user names in table format
- **Test Data Restoration:** Populated database with 20 realistic enterprise users across departments (IT Security: 8, IT: 5, HR: 3, Legal: 2, Executive: 1) and 5 site access users
- **API Integration:** Updated admin frontend to use database mutations instead of local state for all site access operations
- **Application Startup Fixed:** Resolved critical startup errors by implementing lazy initialization for OKTA and KnowBe4 services
- **Development Environment Setup:** Added default environment variables for local development without breaking production functionality
- **Service Error Handling:** Made external API services (OKTA, KnowBe4) optional to allow app to run without credentials
- **Production Build Preserved:** Maintaining production build mode as dev mode loses critical styling and functionality
- **Local Admin Authentication Confirmed:** CW-Admin login working properly with full dashboard access
- **Code Cleanup Complete:** Removed all copy/demo documentation files (CARBON_COPY, EXACT_DEMO, etc.) and fixed corrupted React components with duplicate function declarations - all LSP diagnostics resolved
- **Automatic Build Watcher Added:** Created intelligent file watcher system that automatically rebuilds frontend when changes are detected in client/src/, shared/, or public/ directories
- **Integrations Database Implementation:** Created comprehensive integrations management system with PostgreSQL storage for all 6 security integrations (OKTA, KnowBe4, SentinelOne, Addigy, Microsoft, Jira)
- **Dynamic API Key Configuration:** Implemented specialized configuration interface supporting different API key requirements: OKTA (4 keys: Read only, User management, Group/apps management, Super Admin), KnowBe4 (1 API key), SentinelOne (2 keys: Read only, Full access), Addigy/Microsoft/Jira (1 API key each)
- **Integration Configuration Modal:** Added comprehensive configuration dialog with status management (Connected/Pending/Disconnected) and secure API key storage with appropriate field validation
- **OKTA App Mappings System:** Created comprehensive app-to-group mapping system with database persistence (appMappings table), full CRUD API endpoints, and intuitive admin interface for managing application-to-OKTA-group relationships (Zoom→MTX-SG-ZOOM-USER, Slack→MTX-SG-SLACK-USER, Microsoft 365→MTX-SG-MICROSOFT-E3)
- **Referenceable App Mappings:** Implemented lookup endpoint (/api/app-mappings/lookup/:appName) enabling other components to dynamically retrieve OKTA group names for user creation workflows, ensuring consistent group assignments across the platform
- **Role-Based Access Control Implementation:** Created comprehensive access control system with Admin and Standard user levels, protected routes, dynamic sidebar visibility, and ProtectedRoute component for page-level security
- **Sign Out Functionality:** Added sign out button to user dropdown with proper session destruction, audit logging, and complete logout that prevents automatic re-authentication
- **Test User Credentials:** Added test standard user account (test-user/test123) for testing role-based access controls alongside existing admin account (CW-Admin/YellowDr@g0nFly)
- **Logo Customization Implementation:** Created complete logo upload system in Admin → Layout tab with inline image preview, "Customize Logo" button positioning, and real-time sidebar updates when custom logos are uploaded
- **Dashboard Tab Implementation:** Created comprehensive dashboard customization system with 2x2 grid layout, drag and drop card reordering, and "Add Integration" functionality that allows admins to add/remove app cards using existing integrations from the database
- **Layout Customization Tabs:** Added 5-tab system (Logo, Dashboard, New User, Profile, Monitoring) with Logo as the first tab containing the logo customization functionality, and removed all "Coming Soon" placeholder sections for a cleaner interface
- **Dashboard Cards Database Synchronization COMPLETE:** Successfully resolved admin layout page showing hardcoded card names instead of database values. Fixed React import issues, implemented proper API triggers, and achieved full synchronization between admin layout drag-and-drop interface and main dashboard display. Dashboard cards now properly display database names (KnowBe4 Security Training, SentinelOne, Device Management, Jira Service Management) with real-time updates when reordered in admin interface.
- **Dashboard Card Drag-and-Drop Persistence COMPLETE:** Successfully resolved all issues preventing database persistence of dashboard layout changes. Fixed critical Express route ordering issue where `/api/dashboard-cards/:id` was intercepting `/api/dashboard-cards/positions` requests. Implemented proper bulk update endpoint with detailed logging, removed hardcoded fallback data, and fixed TypeScript typing issues. Dashboard card reordering now saves immediately to PostgreSQL database and persists across page refreshes with full bi-directional synchronization between admin layout interface and main dashboard display. All position changes are audited and logged.
- **Subtle Micro-Interactions for Drag-and-Drop IMPLEMENTED:** Enhanced dashboard card drag-and-drop with sophisticated visual feedback including custom drag shadows with rotation and opacity effects, smooth scale and color transitions for dragged items, drop zone highlighting with "Drop here" messaging, hover states with subtle scaling and shadow effects, animated icon scaling and color changes during drag operations, and drag handle indicators that appear on hover. All animations use hardware acceleration and smooth easing curves for professional feel.
- **Logo Text Customization IMPLEMENTED:** Added complete logo text editing functionality in Admin → Layout → Logo section. Users can now customize the text displayed under the logo in the sidebar (previously hardcoded as "Powered by ClockWerk.it"). Includes real-time input field, database persistence via layout settings API, and immediate sidebar updates when text is changed. Default text maintained for backward compatibility.
- **Dashboard Layout Cards Enhanced IMPLEMENTED:** Upgraded dashboard layout cards with integration logos instead of text initials, added edit buttons alongside remove buttons for direct integration configuration access, and implemented proper type mapping between dashboard card types and integration logos (device_management→addigy, knowbe4→knowbe4, etc.). Cards now maintain visual consistency with the integrations section and provide seamless configuration workflows.
- **Unified Integration Management IMPLEMENTED:** Dashboard layout "Add Integration" now pulls from the same database integrations as the main integrations tab, ensuring single source of truth. Added "Custom Card" option exclusively to dashboard layout (not main integrations) for flexibility while maintaining consistency. Custom cards get purple plus icon and are stored with type "custom" for proper visual distinction.
- **New User Layout Section IMPLEMENTED:** Created comprehensive New User creation interface in Admin → Layout → New User tab with form preview showing all user fields (basic information, organizational details, OKTA groups, application access), customization options with checkboxes for required fields and default behaviors, and functional "Create User" button that opens the existing CreateUserModal component for full user creation workflow.
- **Password Field Configuration COMPLETE:** Made password field selectable in New User layout with comprehensive generation customization including word count, target length, symbol/number inclusion toggles, and informational text explaining the built-in word library system. Removed cluttered word list and symbol inputs per user feedback, replaced with clean explanation of password generation logic.
- **Visual Password Component Builder IMPLEMENTED:** Created drag-and-drop password component system with movable parts (Words, Numbers, Symbols) that users can arrange like building blocks. Components display as colored interactive pills with grip handles for dragging, X buttons for removal, and + buttons to add new components. Live preview shows password structure as (words)+(numbers)+(symbols) format. Fixed missing GripVertical icon import that was preventing page loading.
- **Password Component Dropdowns COMPLETE:** Added configurable amount selectors to each password component with Words supporting 1-3 options and Numbers/Symbols supporting 1-4 options. Each component displays its count in a small dropdown (borderless, transparent background) and updates the live preview to show exact amounts like (2 words)+(3 numbers)+(1 symbols). Components maintain full drag-and-drop functionality with quantity control.

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
- **Dropdown Styling:** All Select/dropdown components must have explicit background colors (bg-white dark:bg-gray-800) and borders to prevent transparency issues

## Development Guidelines
- **Data Integrity:** Always use authentic data sources, never synthetic/mock data
- **Self-Hosting Focus:** All components must work in air-gapped environments
- **Enterprise Security:** Implement proper session management, authentication, and data protection
- **Documentation:** Maintain comprehensive deployment and configuration guides
- **Dropdown Components:** Use CustomSelect components from @/components/ui/custom-select instead of regular Select components to prevent transparency issues. All dropdowns must have explicit bg-white dark:bg-gray-800 backgrounds and proper borders.