#!/bin/bash

# Deployment Script for Self-Hosted Security Dashboard
# This script handles the complete deployment process

set -e

# Configuration
APP_NAME="security-dashboard"
APP_USER="dashboard"
APP_DIR="/opt/security-dashboard"
SERVICE_NAME="security-dashboard"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    error "This script must be run as root"
fi

log "Starting deployment of Security Dashboard..."

# Create application user
if ! id "$APP_USER" &>/dev/null; then
    log "Creating application user: $APP_USER"
    useradd -r -s /bin/false -d "$APP_DIR" "$APP_USER"
else
    log "Application user already exists: $APP_USER"
fi

# Create application directory
log "Creating application directory: $APP_DIR"
mkdir -p "$APP_DIR"
mkdir -p "$APP_DIR/logs"
mkdir -p "$APP_DIR/uploads"
mkdir -p "$APP_DIR/backups"

# Copy application files
log "Copying application files..."
cp -r ./* "$APP_DIR/"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# Install Node.js dependencies
log "Installing Node.js dependencies..."
cd "$APP_DIR"
sudo -u "$APP_USER" npm ci --only=production

# Build the application
log "Building the application..."
sudo -u "$APP_USER" npm run build

# Create systemd service
log "Creating systemd service..."
cat > "/etc/systemd/system/$SERVICE_NAME.service" << EOF
[Unit]
Description=Security Dashboard
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
ExecStart=/usr/bin/node server/index.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$APP_DIR/logs $APP_DIR/uploads $APP_DIR/backups

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and enable service
log "Enabling and starting service..."
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl start "$SERVICE_NAME"

# Create backup cron job
log "Setting up automated backups..."
cat > "/etc/cron.d/$APP_NAME-backup" << EOF
# Automated backup for Security Dashboard
0 2 * * * $APP_USER $APP_DIR/scripts/backup.sh
EOF

# Create log rotation configuration
log "Setting up log rotation..."
cat > "/etc/logrotate.d/$APP_NAME" << EOF
$APP_DIR/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    copytruncate
}
EOF

# Check service status
sleep 5
if systemctl is-active --quiet "$SERVICE_NAME"; then
    log "✓ Service is running successfully"
    log "✓ Application URL: http://localhost:3000"
else
    error "Service failed to start. Check logs with: journalctl -u $SERVICE_NAME"
fi

log "Deployment completed successfully!"
log ""
log "Next steps:"
log "1. Configure your .env file in $APP_DIR"
log "2. Set up SSL certificates if using HTTPS"
log "3. Configure your reverse proxy (nginx/Apache)"
log "4. Test the application"
log ""
log "Service management commands:"
log "  Start:   systemctl start $SERVICE_NAME"
log "  Stop:    systemctl stop $SERVICE_NAME"
log "  Restart: systemctl restart $SERVICE_NAME"
log "  Status:  systemctl status $SERVICE_NAME"
log "  Logs:    journalctl -u $SERVICE_NAME -f"