# Security Dashboard - Self-Hosting Package

A comprehensive enterprise security management dashboard with advanced user risk assessment, OKTA integration, and real-time monitoring capabilities. This package provides everything needed for secure self-hosting in your own infrastructure.

## 🔒 Data Privacy & Security

This self-hosting package ensures complete data sovereignty:
- All user data remains within your infrastructure
- No external data transmission except configured integrations
- Full control over data retention and privacy policies
- Enterprise-grade security controls and audit capabilities

## 🚀 Quick Start

### Option 1: Docker Deployment (Recommended)

```bash
# Clone or extract the application
git clone <repository> security-dashboard
cd security-dashboard

# Configure environment
cp .env.production .env
# Edit .env with your configuration

# Deploy with Docker Compose
docker-compose up -d

# Access the application
open http://localhost:3000
```

### Option 2: Manual Installation

```bash
# Install dependencies
npm install

# Configure environment
cp .env.production .env
# Edit .env with your configuration

# Set up database
npm run db:push

# Build and start
npm run build
npm start
```

### Option 3: System Service Deployment

```bash
# Run automated deployment script (requires root)
sudo ./scripts/deploy.sh

# Check service status
sudo systemctl status security-dashboard
```

## 📋 Prerequisites

- **Node.js**: 18.0 or higher
- **PostgreSQL**: 12.0 or higher
- **System**: Linux/macOS/Windows with Docker support
- **Memory**: Minimum 2GB RAM recommended
- **Storage**: 10GB minimum for application and backups

## ⚙️ Configuration

### Environment Variables

Edit `.env` file with your configuration:

```bash
# Application
NODE_ENV=production
PORT=3000
SESSION_SECRET=your-secure-session-secret

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/security_dashboard
PGHOST=localhost
PGPORT=5432
PGUSER=dashboard_user
PGPASSWORD=your_secure_password
PGDATABASE=security_dashboard

# Security
HTTPS_ONLY=true
SECURE_COOKIES=true

# Optional Integrations
OKTA_API_TOKEN=your_okta_token
OKTA_BASE_URL=https://your-domain.okta.com
KNOWBE4_API_KEY=your_knowbe4_key
KNOWBE4_BASE_URL=https://api.knowbe4.com
```

### Database Setup

```bash
# Create PostgreSQL database
sudo -u postgres createdb security_dashboard
sudo -u postgres createuser dashboard_user
sudo -u postgres psql -c "ALTER USER dashboard_user WITH PASSWORD 'secure_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE security_dashboard TO dashboard_user;"

# Initialize schema
npm run db:push
```

## 🏗️ Architecture

### Application Components

- **Frontend**: React with TypeScript and Tailwind CSS
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Multiple options (OKTA, local, LDAP)
- **Security**: Built-in security headers and CSRF protection

### Directory Structure

```
security-dashboard/
├── client/                 # React frontend application
├── server/                 # Express.js backend
├── shared/                 # Shared schemas and types
├── scripts/                # Deployment and maintenance scripts
├── docker-compose.yml      # Docker deployment configuration
├── Dockerfile             # Container build configuration
├── nginx.conf             # Reverse proxy configuration
└── SELF_HOSTING_GUIDE.md  # Detailed deployment guide
```

## 🔧 Maintenance

### Backup Management

```bash
# Create manual backup
./scripts/backup.sh

# Restore from backup
./scripts/restore.sh /path/to/backup.sql.gz

# Automated backups run daily at 2 AM via cron
```

### Health Monitoring

```bash
# Run health check
./scripts/health-check.sh

# Check service logs
journalctl -u security-dashboard -f

# Monitor application logs
tail -f logs/application.log
```

### Service Management

```bash
# Start service
sudo systemctl start security-dashboard

# Stop service
sudo systemctl stop security-dashboard

# Restart service
sudo systemctl restart security-dashboard

# Check status
sudo systemctl status security-dashboard
```

## 🌐 Production Deployment

### HTTPS Configuration

1. Obtain SSL certificates (Let's Encrypt recommended):
```bash
sudo certbot certonly --standalone -d your-domain.com
```

2. Configure nginx with SSL:
```bash
# Copy SSL certificates to nginx directory
sudo mkdir -p /etc/nginx/ssl
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem /etc/nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem /etc/nginx/ssl/key.pem
```

3. Start nginx reverse proxy:
```bash
docker-compose up nginx -d
```

### Firewall Configuration

```bash
# Allow HTTP and HTTPS
sudo ufw allow 80
sudo ufw allow 443

# Restrict PostgreSQL access
sudo ufw allow from 127.0.0.1 to any port 5432
```

### Performance Optimization

- Enable gzip compression (included in nginx.conf)
- Configure PostgreSQL performance settings
- Set up application-level caching
- Monitor resource usage regularly

## 🔌 Integration Options

### OKTA Integration

The application supports full OKTA integration for:
- User authentication and authorization
- Group management and synchronization
- Automated user provisioning
- Single Sign-On (SSO)

### KnowBe4 Integration

Security training integration includes:
- Training completion tracking
- Phishing simulation results
- Security awareness scoring
- Automated reporting

### Alternative Authentication

For environments without OKTA:
- Local user authentication
- LDAP/Active Directory integration
- SAML SSO providers
- Custom authentication systems

## 📊 Monitoring & Analytics

### Built-in Monitoring

- Application health endpoints
- Database performance metrics
- User activity tracking
- Security event logging
- System resource monitoring

### Alerting

Configure alerts for:
- Service downtime
- Database connectivity issues
- High resource usage
- Security incidents
- Backup failures

## 🔒 Security Features

### Data Protection

- All data encrypted in transit and at rest
- Secure session management
- CSRF protection
- XSS prevention
- SQL injection protection

### Access Control

- Role-based access control (RBAC)
- Multi-factor authentication support
- Session timeout management
- Audit logging for all actions

### Compliance

- GDPR compliance features
- SOC 2 security controls
- Regular security assessments
- Data retention policies

## 🆘 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check PostgreSQL service status
   - Verify database credentials
   - Ensure database exists

2. **Application Won't Start**
   - Check Node.js version (18+)
   - Verify environment variables
   - Review application logs

3. **OKTA Integration Issues**
   - Verify API token permissions
   - Check OKTA base URL
   - Review OKTA service logs

### Getting Help

1. Check application logs: `tail -f logs/application.log`
2. Review service status: `systemctl status security-dashboard`
3. Run health check: `./scripts/health-check.sh`
4. Check database connectivity: `pg_isready -h localhost -p 5432`

## 📦 Backup & Recovery

### Automated Backups

- Daily database backups at 2 AM
- 30-day retention policy (configurable)
- Compressed backup files
- Automatic cleanup of old backups

### Disaster Recovery

1. **Database Recovery**:
   ```bash
   ./scripts/restore.sh /path/to/backup.sql.gz
   ```

2. **Full System Recovery**:
   - Restore application files
   - Restore database from backup
   - Reconfigure environment variables
   - Restart services

## 🔄 Updates & Maintenance

### Application Updates

```bash
# Stop the service
sudo systemctl stop security-dashboard

# Backup current installation
tar -czf backup-$(date +%Y%m%d).tar.gz /opt/security-dashboard

# Deploy new version
# ... update application files ...

# Run database migrations if needed
npm run db:push

# Restart service
sudo systemctl start security-dashboard
```

### Security Updates

- Regular dependency updates
- Security patch management
- Vulnerability assessments
- Penetration testing

## 📄 License & Support

This self-hosting package provides complete enterprise security management capabilities with full data sovereignty and privacy protection. All components are included for immediate deployment in production environments.

For additional customization or enterprise support, contact your development team or system administrator.