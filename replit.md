# Security Dashboard - Enterprise User Management System

## Overview

This is a comprehensive enterprise security management dashboard built with React, Express.js, and PostgreSQL. The application provides advanced user risk assessment, OKTA integration, KnowBe4 integration, and real-time monitoring capabilities with full self-hosting capabilities to ensure complete data sovereignty.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite (with ESBuild fallback for production)
- **UI Library**: Radix UI components with Tailwind CSS
- **State Management**: TanStack Query for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Styling**: Tailwind CSS with CSS custom properties for theming

### Backend Architecture
- **Runtime**: Node.js 20 with TypeScript
- **Framework**: Express.js with middleware for session management
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Session Storage**: PostgreSQL-based session store using connect-pg-simple
- **Authentication**: Multiple authentication strategies (OKTA SSO, local admin auth)

## Key Components

### Authentication System
- **Primary**: OKTA OAuth2/OpenID Connect integration for enterprise SSO
- **Fallback**: Local admin authentication (username: CW-Admin, password: YellowDr@g0nFly)
- **Session Management**: Secure session handling with PostgreSQL storage
- **Security**: HTTPS enforcement, secure cookies, CSRF protection

### User Management
- **CRUD Operations**: Complete user lifecycle management
- **OKTA Synchronization**: Bi-directional sync with OKTA directory
- **Employee Type Classification**: Automatic classification based on OKTA group membership
- **Group Management**: Sync and manage user groups from OKTA
- **Application Access**: Track and manage application assignments

### Security Assessment
- **KnowBe4 Integration**: Security awareness training data integration
- **Risk Scoring**: Phish-prone percentage and current risk scores
- **Training Campaigns**: Track completion status and policy acknowledgment
- **Phishing Campaign Stats**: Monitor user susceptibility to phishing attempts

### Data Synchronization
- **Bulk Sync**: Batch processing for large user bases
- **Real-time Updates**: Individual user synchronization on demand
- **Rate Limiting**: Respect OKTA API rate limits with intelligent delays
- **Error Handling**: Comprehensive error handling and retry logic

## Data Flow

### User Authentication Flow
1. User accesses application
2. Redirected to OKTA for authentication (if not logged in)
3. OKTA validates credentials and returns authorization code
4. Backend exchanges code for access token
5. User profile fetched from OKTA
6. Session established with PostgreSQL storage
7. User redirected to dashboard

### Data Synchronization Flow
1. Admin triggers sync operation
2. System fetches users from OKTA API
3. User groups retrieved for employee type classification
4. KnowBe4 data pulled for security metrics
5. Database updated with merged data
6. Real-time updates pushed to connected clients

### Security Assessment Flow
1. KnowBe4 API queried for user security data
2. Risk scores calculated based on training completion
3. Phishing susceptibility assessed from campaign data
4. Comprehensive security profile generated
5. Dashboard displays actionable insights

## External Dependencies

### Core Dependencies
- **Database**: PostgreSQL 15+ (Neon serverless compatible)
- **Authentication**: OKTA (OAuth2/OpenID Connect)
- **Security Training**: KnowBe4 API integration
- **Build Tools**: Vite, ESBuild, TypeScript
- **UI Components**: Radix UI, Tailwind CSS

### Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `OKTA_API_TOKEN`: OKTA API authentication token
- `OKTA_BASE_URL`: OKTA domain URL
- `KNOWBE4_API_KEY`: KnowBe4 API key
- `KNOWBE4_BASE_URL`: KnowBe4 API endpoint
- `SESSION_SECRET`: Session encryption secret
- `NODE_ENV`: Environment mode (production/development)

## Deployment Strategy

### Build Process
- **Development**: Vite dev server with hot module replacement
- **Production**: ESBuild for fast, reliable builds (fallback for Vite timeout issues)
- **Docker**: Multi-stage builds with production optimizations
- **Static Assets**: Optimized bundling with code splitting

### Self-Hosting Options
1. **Docker Compose**: Complete stack deployment with PostgreSQL
2. **Manual Installation**: Direct Node.js deployment
3. **Container Orchestration**: Kubernetes/Docker Swarm ready

### Security Considerations
- **Data Sovereignty**: All data remains within customer infrastructure
- **HTTPS Enforcement**: SSL/TLS termination at load balancer or nginx
- **Environment Isolation**: Separate staging and production environments
- **Backup Strategy**: Automated database backups with configurable retention

### Performance Optimizations
- **Database Indexing**: Optimized queries with proper indexes
- **Caching**: Session-based caching for frequently accessed data
- **Rate Limiting**: API rate limiting to prevent abuse
- **Connection Pooling**: Efficient database connection management

## Changelog

```
Changelog:
- June 18, 2025. Initial setup
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```