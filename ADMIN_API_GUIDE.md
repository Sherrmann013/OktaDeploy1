# Admin API Management Guide

## Overview

The Admin API system provides secure remote management capabilities for both multi-tenant and distributed deployment architectures. This enables centralized control over multiple platform instances deployed across different AWS environments.

## Architecture Alignment

### Current Multi-Tenant Setup
- **Use Case**: Manage multiple clients within a single instance
- **Operations**: Health monitoring, integration deployment, database migrations
- **Access**: Direct localhost/internal access with admin API key

### Future Distributed Deployment Model
- **Use Case**: Manage independent MSP customer instances across AWS
- **Operations**: Same API endpoints work across all instances
- **Access**: Remote HTTPS calls to individual customer domains
- **Benefits**: Centralized management of distributed platforms

## Authentication

All Admin API endpoints require authentication via the `ADMIN_API_KEY` environment variable.

### Authentication Methods

**Header Authorization (Recommended):**
```bash
Authorization: Admin your_admin_api_key_here
```

**Query Parameter (Alternative):**
```bash
?admin_key=your_admin_api_key_here
```

### Example Authentication
```bash
curl -H "Authorization: Admin ${ADMIN_API_KEY}" \
  http://localhost:5000/api/admin/ping
```

## Available Endpoints

### 1. Connection Test
**GET** `/api/admin/ping`

Tests basic connectivity and authentication.

**Response:**
```json
{
  "status": "success",
  "message": "Admin API is accessible",
  "timestamp": "2025-08-20T19:33:02.754Z",
  "version": "1.0.0"
}
```

### 2. System Health Check
**GET** `/api/admin/health`

Comprehensive health assessment of MSP and all client databases.

**Response:**
```json
{
  "status": "success",
  "data": {
    "timestamp": "2025-08-20T19:33:03.319Z",
    "mspDatabase": {
      "status": "healthy",
      "clientCount": 2,
      "lastUpdated": "2025-08-20T19:33:03.350Z"
    },
    "clientDatabases": [
      {
        "clientId": 12,
        "clientName": "Maze",
        "status": "healthy",
        "integrationCount": 1,
        "userCount": 0,
        "lastActivity": "2025-08-18T19:38:01.314Z"
      }
    ],
    "summary": {
      "totalClients": 2,
      "healthyClients": 2,
      "totalIntegrations": 4,
      "systemStatus": "healthy"
    }
  }
}
```

### 3. System Information
**GET** `/api/admin/info`

Gathers basic system metrics and database connectivity status.

**Response:**
```json
{
  "status": "success",
  "data": {
    "version": "1.0.0",
    "environment": "development",
    "uptime": 8.838932431,
    "databases": {
      "msp": {
        "connected": true,
        "clientCount": 2
      },
      "clients": [
        {
          "id": 12,
          "name": "Maze",
          "connected": true,
          "integrationCount": 1
        }
      ]
    }
  }
}
```

### 4. Deploy Integration to Clients
**POST** `/api/admin/integrations/deploy`

Deploys new integrations or updates existing ones across all or specific clients.

**Request Body:**
```json
{
  "integrationName": "new-security-tool",
  "version": "2.1.0",
  "description": "Enhanced security monitoring integration",
  "defaultConfig": {
    "enabled": true,
    "alertThreshold": "medium",
    "reportingInterval": "daily"
  },
  "targetClients": [12, 13]  // Optional: if omitted, deploys to all
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "success": true,
    "results": [
      {
        "clientId": 12,
        "clientName": "Maze",
        "status": "success",
        "message": "Updated existing integration to v2.1.0"
      },
      {
        "clientId": 13,
        "clientName": "ClockWerk",
        "status": "success",
        "message": "Installed new integration v2.1.0"
      }
    ]
  }
}
```

### 5. Execute Database Migration
**POST** `/api/admin/migrations/execute`

Executes SQL migrations across MSP database, client databases, or both.

**Request Body:**
```json
{
  "migrationId": "add_new_feature_columns_v1.2.0",
  "description": "Add enhanced security tracking columns",
  "targetDatabases": "clients", // "msp", "clients", or "all"
  "sqlStatements": [
    "ALTER TABLE integrations ADD COLUMN security_level VARCHAR(20) DEFAULT 'standard'",
    "ALTER TABLE integrations ADD COLUMN last_security_scan TIMESTAMP"
  ],
  "rollbackStatements": [
    "ALTER TABLE integrations DROP COLUMN security_level",
    "ALTER TABLE integrations DROP COLUMN last_security_scan"
  ]
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "success": true,
    "results": [
      {
        "database": "Client: Maze",
        "status": "success",
        "message": "Executed 2 statements"
      },
      {
        "database": "Client: ClockWerk",
        "status": "success",
        "message": "Executed 2 statements"
      }
    ]
  }
}
```

### 6. Admin Operation Logs
**GET** `/api/admin/logs`

Retrieves recent admin operations for audit purposes.

**Query Parameters:**
- `limit`: Number of log entries to retrieve (default: 100)

## Distributed Deployment Usage

### AWS Multi-Instance Management

When each MSP customer has their own AWS instance, you can manage them all from a central location:

```bash
# Health check across all customer instances
curl -H "Authorization: Admin ${ADMIN_API_KEY}" \
  https://customer1.your-platform.com/api/admin/health

curl -H "Authorization: Admin ${ADMIN_API_KEY}" \
  https://customer2.your-platform.com/api/admin/health

# Deploy new integration to specific customer
curl -X POST "https://customer1.your-platform.com/api/admin/integrations/deploy" \
  -H "Authorization: Admin ${ADMIN_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "integrationName": "enhanced-monitoring",
    "version": "3.0.0",
    "description": "New monitoring capabilities"
  }'
```

### Automation Scripts

**Bash Script Example:**
```bash
#!/bin/bash

ADMIN_KEY="your_admin_api_key"
CUSTOMERS=("customer1.platform.com" "customer2.platform.com" "customer3.platform.com")

echo "Checking health across all customer instances..."
for customer in "${CUSTOMERS[@]}"; do
  echo "Checking $customer..."
  response=$(curl -s -H "Authorization: Admin $ADMIN_KEY" \
    "https://$customer/api/admin/health")
  
  status=$(echo $response | jq -r '.data.summary.systemStatus')
  echo "$customer: $status"
done
```

**Python Management Script Example:**
```python
import requests
import json

class PlatformManager:
    def __init__(self, admin_key):
        self.admin_key = admin_key
        self.headers = {"Authorization": f"Admin {admin_key}"}
    
    def check_health(self, instance_url):
        response = requests.get(f"{instance_url}/api/admin/health", 
                              headers=self.headers)
        return response.json()
    
    def deploy_integration(self, instance_url, integration_config):
        response = requests.post(f"{instance_url}/api/admin/integrations/deploy",
                               headers=self.headers,
                               json=integration_config)
        return response.json()
    
    def bulk_health_check(self, instances):
        results = {}
        for instance in instances:
            try:
                results[instance] = self.check_health(instance)
            except Exception as e:
                results[instance] = {"error": str(e)}
        return results

# Usage
manager = PlatformManager("your_admin_api_key")
instances = [
    "https://customer1.platform.com",
    "https://customer2.platform.com"
]

health_results = manager.bulk_health_check(instances)
print(json.dumps(health_results, indent=2))
```

## Security Considerations

### API Key Management
- **Rotation**: Regularly rotate admin API keys
- **Storage**: Store keys securely (environment variables, secret managers)
- **Access**: Limit admin key access to authorized personnel only
- **Monitoring**: Log all admin operations for audit trails

### Network Security
- **HTTPS Only**: Always use HTTPS in production deployments
- **IP Allowlisting**: Consider restricting admin API access by IP
- **Rate Limiting**: Implement rate limiting for admin endpoints
- **Monitoring**: Set up alerts for suspicious admin API activity

### Operational Security
- **Audit Logs**: All admin operations are logged with timestamps and IP addresses
- **Validation**: All inputs are validated before execution
- **Error Handling**: Detailed errors for debugging, generic errors for security
- **Rollback**: Database migrations should include rollback statements

## Error Handling

### Common Error Responses

**Missing API Key:**
```json
{
  "error": "Admin API key required",
  "code": "MISSING_ADMIN_KEY",
  "hint": "Provide key via Authorization: Admin <key> header or admin_key query parameter"
}
```

**Invalid API Key:**
```json
{
  "error": "Invalid admin API key",
  "code": "INVALID_ADMIN_KEY"
}
```

**Operation Failed:**
```json
{
  "status": "error",
  "message": "Integration deployment failed",
  "error": "Database connection timeout"
}
```

## Best Practices

### For Current Multi-Tenant Usage
1. Use health checks before deploying changes
2. Test migrations on staging before production
3. Monitor logs after bulk operations
4. Keep integration configs lightweight and flexible

### For Future Distributed Deployments
1. Implement instance discovery mechanisms
2. Use parallel processing for bulk operations
3. Set up monitoring dashboards for all instances
4. Plan for network partitions and timeouts
5. Implement retry logic with exponential backoff

## Monitoring and Alerting

### Key Metrics to Monitor
- API response times
- Failed authentication attempts
- Integration deployment success rates
- Database migration completion status
- System health trends across instances

### Recommended Alerting Rules
- Admin API authentication failures > 5 per hour
- System health status changes from "healthy"
- Integration deployment failures > 20%
- Database connectivity issues
- Unusual admin operation patterns

## Conclusion

The Admin API system provides a robust foundation for managing both current multi-tenant deployments and future distributed platform architectures. It aligns perfectly with the platform-as-a-product model where each MSP customer receives their own dedicated AWS instance while maintaining centralized management capabilities.

The API's design ensures seamless transition from multi-tenant to distributed deployments without requiring changes to management tooling or processes.