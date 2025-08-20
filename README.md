# Enterprise Security Management Platform

A comprehensive multi-tenant enterprise security management platform designed for Managed Service Providers (MSPs). Features complete database isolation, enterprise-grade security integrations, and remote management capabilities.

## Features

- **Multi-Tenant Architecture**: Complete client isolation with separate databases
- **Enterprise Integrations**: OKTA, KnowBe4, Jira, SentinelOne, and more
- **Admin API System**: Remote management across distributed deployments
- **Self-Hosting Ready**: Docker containerization and deployment guides
- **Security First**: Role-based access control and audit logging

## Quick Start

### Development Setup

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd msp-security-platform
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

## Deployment Options

### Option 1: Railway (Recommended)
- Connect GitHub repository to Railway
- Add PostgreSQL service
- Configure environment variables
- Deploy automatically

### Option 2: Docker Deployment
```bash
docker-compose up -d
```

### Option 3: AWS EC2
- Use provided deployment scripts
- Configure Nginx reverse proxy
- Set up SSL certificates

## Environment Variables

Required environment variables:

```bash
# Database
DATABASE_URL=postgresql://user:password@host:port/dbname

# Authentication
JWT_SECRET=your-jwt-secret-here
ADMIN_API_KEY=your-admin-api-key

# Integration API Keys
OKTA_DOMAIN=your-okta-domain.okta.com
OKTA_TOKEN=your-okta-api-token
KNOWBE4_API_KEY=your-knowbe4-key
JIRA_API_KEY=your-jira-key
```

## Architecture

- **Frontend**: React with TypeScript, Tailwind CSS
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Multi-Database**: Separate databases per client for complete isolation

## Admin API

The platform includes a comprehensive Admin API for remote management:

```bash
# Health check
curl -H "Authorization: Admin YOUR_KEY" https://your-instance.com/api/admin/health

# Deploy integration
curl -X POST -H "Authorization: Admin YOUR_KEY" \
  https://your-instance.com/api/admin/integrations/deploy \
  -d '{"integrationName": "new-tool", "version": "1.0.0"}'
```

## Documentation

- [Admin API Guide](ADMIN_API_GUIDE.md)
- [Self-Hosting Guide](SELF_HOSTING_GUIDE.md)
- [Integration Development](docs/integrations.md)

## License

This project is proprietary software. All rights reserved.