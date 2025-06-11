#!/bin/bash

# Health Check Script for Self-Hosted Security Dashboard
# This script monitors the application and database health

set -e

# Configuration
APP_URL="${APP_URL:-http://localhost:3000}"
DB_HOST="${PGHOST:-localhost}"
DB_PORT="${PGPORT:-5432}"
DB_NAME="${PGDATABASE:-security_dashboard}"
DB_USER="${PGUSER:-postgres}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[OK]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Health check results
OVERALL_STATUS=0

echo "Security Dashboard Health Check"
echo "==============================="
echo "Timestamp: $(date)"
echo ""

# Check application health endpoint
echo "1. Checking application health..."
if curl -sf "$APP_URL/api/health" > /dev/null 2>&1; then
    log "Application health endpoint responding"
else
    error "Application health endpoint not responding"
    OVERALL_STATUS=1
fi

# Check application main page
echo "2. Checking application accessibility..."
if curl -sf "$APP_URL" > /dev/null 2>&1; then
    log "Application main page accessible"
else
    error "Application main page not accessible"
    OVERALL_STATUS=1
fi

# Check database connectivity
echo "3. Checking database connectivity..."
if pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1; then
    log "Database connection successful"
else
    error "Database connection failed"
    OVERALL_STATUS=1
fi

# Check database table count
echo "4. Checking database tables..."
TABLE_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --no-password -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null || echo "0")

if [ "$TABLE_COUNT" -gt 0 ]; then
    log "Database contains $TABLE_COUNT tables"
else
    error "Database contains no tables"
    OVERALL_STATUS=1
fi

# Check disk space
echo "5. Checking disk space..."
DISK_USAGE=$(df -h . | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -lt 90 ]; then
    log "Disk usage: ${DISK_USAGE}%"
else
    warn "Disk usage high: ${DISK_USAGE}%"
fi

# Check memory usage
echo "6. Checking memory usage..."
MEMORY_USAGE=$(free | grep Mem | awk '{printf("%.0f", $3/$2 * 100.0)}')
if [ "$MEMORY_USAGE" -lt 90 ]; then
    log "Memory usage: ${MEMORY_USAGE}%"
else
    warn "Memory usage high: ${MEMORY_USAGE}%"
fi

# Check service status
echo "7. Checking service status..."
if systemctl is-active --quiet security-dashboard 2>/dev/null; then
    log "Security Dashboard service is running"
else
    error "Security Dashboard service is not running"
    OVERALL_STATUS=1
fi

# Check log files
echo "8. Checking log files..."
if [ -f "./logs/application.log" ]; then
    LOG_SIZE=$(du -h ./logs/application.log | cut -f1)
    log "Application log file exists (${LOG_SIZE})"
else
    warn "Application log file not found"
fi

# Check backup directory
echo "9. Checking backup directory..."
if [ -d "./backups" ]; then
    BACKUP_COUNT=$(ls -1 ./backups/dashboard_backup_*.sql.gz 2>/dev/null | wc -l)
    log "Backup directory exists with $BACKUP_COUNT backups"
else
    warn "Backup directory not found"
fi

# Check SSL certificate (if HTTPS is configured)
echo "10. Checking SSL certificate..."
if [ -f "/etc/nginx/ssl/cert.pem" ]; then
    CERT_EXPIRY=$(openssl x509 -enddate -noout -in /etc/nginx/ssl/cert.pem 2>/dev/null | cut -d= -f2)
    if [ $? -eq 0 ]; then
        log "SSL certificate valid until: $CERT_EXPIRY"
    else
        warn "SSL certificate check failed"
    fi
else
    warn "SSL certificate not found (HTTP mode)"
fi

echo ""
echo "==============================="
if [ $OVERALL_STATUS -eq 0 ]; then
    log "Overall health check: PASSED"
else
    error "Overall health check: FAILED"
fi

exit $OVERALL_STATUS