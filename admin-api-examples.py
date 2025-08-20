#!/usr/bin/env python3
"""
Admin API Management Examples
Demonstrates remote management capabilities for distributed MSP platform deployments
"""

import requests
import json
import os
from typing import List, Dict, Optional
import argparse

class PlatformAdminManager:
    """
    Admin API management class for distributed MSP platform instances
    """
    
    def __init__(self, admin_key: str):
        self.admin_key = admin_key
        self.headers = {
            "Authorization": f"Admin {admin_key}",
            "Content-Type": "application/json"
        }
    
    def ping(self, instance_url: str) -> Dict:
        """Test connectivity to a platform instance"""
        try:
            response = requests.get(f"{instance_url}/api/admin/ping", 
                                  headers=self.headers, timeout=10)
            response.raise_for_status()
            return {"status": "success", "data": response.json()}
        except Exception as e:
            return {"status": "error", "error": str(e)}
    
    def health_check(self, instance_url: str) -> Dict:
        """Get comprehensive health status of a platform instance"""
        try:
            response = requests.get(f"{instance_url}/api/admin/health", 
                                  headers=self.headers, timeout=30)
            response.raise_for_status()
            return {"status": "success", "data": response.json()}
        except Exception as e:
            return {"status": "error", "error": str(e)}
    
    def system_info(self, instance_url: str) -> Dict:
        """Get system information and database status"""
        try:
            response = requests.get(f"{instance_url}/api/admin/info", 
                                  headers=self.headers, timeout=15)
            response.raise_for_status()
            return {"status": "success", "data": response.json()}
        except Exception as e:
            return {"status": "error", "error": str(e)}
    
    def deploy_integration(self, instance_url: str, integration_config: Dict) -> Dict:
        """Deploy or update an integration on a platform instance"""
        try:
            response = requests.post(f"{instance_url}/api/admin/integrations/deploy",
                                   headers=self.headers,
                                   json=integration_config,
                                   timeout=60)
            response.raise_for_status()
            return {"status": "success", "data": response.json()}
        except Exception as e:
            return {"status": "error", "error": str(e)}
    
    def execute_migration(self, instance_url: str, migration_config: Dict) -> Dict:
        """Execute a database migration on a platform instance"""
        try:
            response = requests.post(f"{instance_url}/api/admin/migrations/execute",
                                   headers=self.headers,
                                   json=migration_config,
                                   timeout=120)
            response.raise_for_status()
            return {"status": "success", "data": response.json()}
        except Exception as e:
            return {"status": "error", "error": str(e)}
    
    def bulk_health_check(self, instance_urls: List[str]) -> Dict[str, Dict]:
        """Perform health checks across multiple platform instances"""
        results = {}
        for url in instance_urls:
            print(f"Checking health for {url}...")
            results[url] = self.health_check(url)
        return results
    
    def bulk_deploy_integration(self, instance_urls: List[str], integration_config: Dict) -> Dict[str, Dict]:
        """Deploy integration across multiple platform instances"""
        results = {}
        for url in instance_urls:
            print(f"Deploying integration to {url}...")
            results[url] = self.deploy_integration(url, integration_config)
        return results

def main():
    parser = argparse.ArgumentParser(description='Admin API Management Tool')
    parser.add_argument('--admin-key', required=True, help='Admin API key')
    parser.add_argument('--instance', required=True, help='Platform instance URL')
    parser.add_argument('--action', required=True, 
                       choices=['ping', 'health', 'info', 'deploy', 'migrate'],
                       help='Action to perform')
    parser.add_argument('--config-file', help='JSON config file for deploy/migrate actions')
    
    args = parser.parse_args()
    
    manager = PlatformAdminManager(args.admin_key)
    
    if args.action == 'ping':
        result = manager.ping(args.instance)
        print(json.dumps(result, indent=2))
    
    elif args.action == 'health':
        result = manager.health_check(args.instance)
        print(json.dumps(result, indent=2))
    
    elif args.action == 'info':
        result = manager.system_info(args.instance)
        print(json.dumps(result, indent=2))
    
    elif args.action == 'deploy':
        if not args.config_file:
            print("--config-file required for deploy action")
            return
        with open(args.config_file, 'r') as f:
            config = json.load(f)
        result = manager.deploy_integration(args.instance, config)
        print(json.dumps(result, indent=2))
    
    elif args.action == 'migrate':
        if not args.config_file:
            print("--config-file required for migrate action")
            return
        with open(args.config_file, 'r') as f:
            config = json.load(f)
        result = manager.execute_migration(args.instance, config)
        print(json.dumps(result, indent=2))

# Example usage demonstrations
def demo_scenarios():
    """
    Example scenarios for distributed MSP platform management
    """
    admin_key = os.getenv("ADMIN_API_KEY", "your_admin_key_here")
    manager = PlatformAdminManager(admin_key)
    
    # Example customer instances (would be real URLs in production)
    customer_instances = [
        "https://acme-corp.msplatform.com",
        "https://techstart-inc.msplatform.com", 
        "https://globalservices.msplatform.com"
    ]
    
    print("=== Multi-Instance Health Check ===")
    health_results = manager.bulk_health_check(customer_instances)
    for instance, result in health_results.items():
        if result["status"] == "success":
            system_status = result["data"]["data"]["summary"]["systemStatus"]
            client_count = result["data"]["data"]["summary"]["totalClients"]
            print(f"{instance}: {system_status} ({client_count} clients)")
        else:
            print(f"{instance}: ERROR - {result['error']}")
    
    print("\n=== Integration Deployment Example ===")
    integration_config = {
        "integrationName": "enhanced-security-monitoring",
        "version": "2.1.0",
        "description": "Enhanced security monitoring with AI threat detection",
        "defaultConfig": {
            "enabled": True,
            "aiThreatDetection": True,
            "alertThreshold": "medium",
            "reportingInterval": "hourly"
        }
    }
    
    deploy_results = manager.bulk_deploy_integration(customer_instances, integration_config)
    for instance, result in deploy_results.items():
        if result["status"] == "success":
            success_count = len([r for r in result["data"]["data"]["results"] if r["status"] == "success"])
            total_count = len(result["data"]["data"]["results"])
            print(f"{instance}: {success_count}/{total_count} clients updated")
        else:
            print(f"{instance}: DEPLOYMENT FAILED - {result['error']}")
    
    print("\n=== Migration Example ===")
    migration_config = {
        "migrationId": "security_enhancement_v2.1.0",
        "description": "Add enhanced security tracking tables",
        "targetDatabases": "clients",
        "sqlStatements": [
            "ALTER TABLE integrations ADD COLUMN IF NOT EXISTS security_score INTEGER DEFAULT 100",
            "ALTER TABLE integrations ADD COLUMN IF NOT EXISTS last_security_scan TIMESTAMP",
            "CREATE INDEX IF NOT EXISTS idx_integrations_security_score ON integrations(security_score)"
        ],
        "rollbackStatements": [
            "ALTER TABLE integrations DROP COLUMN IF EXISTS security_score",
            "ALTER TABLE integrations DROP COLUMN IF EXISTS last_security_scan",
            "DROP INDEX IF EXISTS idx_integrations_security_score"
        ]
    }
    
    # Execute migration on first instance as example
    migration_result = manager.execute_migration(customer_instances[0], migration_config)
    if migration_result["status"] == "success":
        success_count = len([r for r in migration_result["data"]["data"]["results"] if r["status"] == "success"])
        total_count = len(migration_result["data"]["data"]["results"])
        print(f"Migration executed: {success_count}/{total_count} databases updated")
    else:
        print(f"Migration failed: {migration_result['error']}")

if __name__ == "__main__":
    # Check if running as command line tool or demo
    if len(os.sys.argv) > 1:
        main()
    else:
        print("Running demonstration scenarios...")
        demo_scenarios()