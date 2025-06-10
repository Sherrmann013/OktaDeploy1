# Self-Hosting Guide

## Overview
This enterprise security management dashboard can be fully self-hosted to maintain complete control over your data privacy and security. This guide provides everything needed for deployment in your own infrastructure.

## Prerequisites
- Node.js 18+ 
- PostgreSQL 12+
- Docker (optional but recommended)
- HTTPS certificate for production

## Environment Configuration

### Required Environment Variables
Create a `.env` file with the following variables:

```bash
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/security_dashboard
PGHOST=localhost
PGPORT=5432
PGUSER=your_db_user
PGPASSWORD=your_db_password
PGDATABASE=security_dashboard

# Application Configuration
NODE_ENV=production
PORT=3000
SESSION_SECRET=your-super-secure-session-secret-here

# OKTA Integration (if using OKTA)
OKTA_API_TOKEN=your_okta_api_token
OKTA_BASE_URL=https://your-domain.okta.com

# KnowBe4 Integration (if using KnowBe4)
KNOWBE4_API_KEY=your_knowbe4_api_key
KNOWBE4_BASE_URL=https://api.knowbe4.com

# Security Settings
HTTPS_ONLY=true
SECURE_COOKIES=true
```

## Installation Methods

### Method 1: Docker Deployment (Recommended)

#### Docker Compose Setup
Create `docker-compose.yml`:

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@db:5432/security_dashboard
    depends_on:
      - db
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped

  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=security_dashboard
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    restart: unless-stopped
    ports:
      - "5432:5432"

volumes:
  postgres_data:
```

#### Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Build the application
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Change ownership
RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000

CMD ["npm", "start"]
```

### Method 2: Manual Installation

```bash
# Clone or extract the application
cd security-dashboard

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Set up database
npm run db:push

# Build the application
npm run build

# Start the application
npm start
```

## Database Setup

### PostgreSQL Installation
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# CentOS/RHEL
sudo yum install postgresql-server postgresql-contrib
sudo postgresql-setup initdb
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql
CREATE DATABASE security_dashboard;
CREATE USER dashboard_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE security_dashboard TO dashboard_user;
\q
```

### Database Migration
```bash
# Push schema to database
npm run db:push

# Verify database setup
npm run db:verify
```

## Security Considerations

### Network Security
- Deploy behind a reverse proxy (nginx/Apache)
- Use HTTPS certificates (Let's Encrypt recommended)
- Configure firewall rules to restrict access
- Use VPN for administrative access

### Application Security
- Change all default passwords and secrets
- Enable secure session management
- Configure CORS appropriately
- Set up regular security updates

### Data Privacy
- All user data remains in your infrastructure
- No data transmitted to external services (except configured integrations)
- Audit logs stored locally
- Full control over data retention policies

## Production Deployment

### Reverse Proxy Configuration (nginx)
```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### System Service (systemd)
Create `/etc/systemd/system/security-dashboard.service`:

```ini
[Unit]
Description=Security Dashboard
After=network.target

[Service]
Type=simple
User=dashboard
WorkingDirectory=/opt/security-dashboard
Environment=NODE_ENV=production
ExecStart=/usr/bin/node server/index.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

## Backup and Recovery

### Database Backup
```bash
# Daily backup script
#!/bin/bash
pg_dump -h localhost -U dashboard_user security_dashboard > /backups/dashboard_$(date +%Y%m%d).sql

# Automated backup with cron
0 2 * * * /path/to/backup-script.sh
```

### Application Backup
```bash
# Backup configuration and logs
tar -czf dashboard-backup-$(date +%Y%m%d).tar.gz \
    .env \
    logs/ \
    uploads/ \
    custom-configs/
```

## Monitoring and Maintenance

### Health Checks
- Application health endpoint: `/api/health`
- Database connectivity monitoring
- Log file rotation and monitoring
- Disk space and memory monitoring

### Updates
- Regular security updates for OS and dependencies
- Application updates through git or manual deployment
- Database migration handling

## Integration Configuration

### OKTA Self-Hosted Alternative
If you prefer not to use OKTA, consider:
- Active Directory integration
- LDAP authentication
- SAML SSO providers
- Custom authentication system

### KnowBe4 Alternative
For security training without external dependencies:
- Internal training modules
- Custom security awareness content
- Local training tracking system

## Troubleshooting

### Common Issues
1. Database connection errors - Check DATABASE_URL and PostgreSQL service
2. Permission issues - Verify file permissions and user ownership
3. Port conflicts - Ensure port 3000 is available
4. SSL certificate issues - Verify certificate paths and validity

### Log Locations
- Application logs: `./logs/application.log`
- Database logs: PostgreSQL log directory
- System logs: `/var/log/syslog` or `journalctl`

## Support and Maintenance

### Regular Maintenance Tasks
- Database cleanup and optimization
- Log file rotation
- Security updates
- Backup verification
- Performance monitoring

### Scaling Considerations
- Load balancer setup for multiple instances
- Database read replicas
- CDN for static assets
- Caching layer (Redis)

## Contact Information
For self-hosting support and customization, please contact your system administrator or the development team.