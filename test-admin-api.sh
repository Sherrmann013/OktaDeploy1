#!/bin/bash

# Admin API Testing Script
# Provides quick testing capabilities for the Admin API system

set -e

# Configuration
ADMIN_API_KEY="${ADMIN_API_KEY:-admin_dev_key_12345}"
BASE_URL="${BASE_URL:-http://localhost:5000}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper function for API calls
call_admin_api() {
    local method=$1
    local endpoint=$2
    local data=$3
    
    echo -e "${BLUE}🔧 Calling: ${method} ${endpoint}${NC}"
    
    if [ -n "$data" ]; then
        curl -s -X "${method}" \
             -H "Authorization: Admin ${ADMIN_API_KEY}" \
             -H "Content-Type: application/json" \
             -d "${data}" \
             "${BASE_URL}${endpoint}"
    else
        curl -s -X "${method}" \
             -H "Authorization: Admin ${ADMIN_API_KEY}" \
             "${BASE_URL}${endpoint}"
    fi
}

# Test functions
test_ping() {
    echo -e "${YELLOW}=== Testing Admin API Connectivity ===${NC}"
    response=$(call_admin_api "GET" "/api/admin/ping")
    echo "$response" | jq '.'
    
    if echo "$response" | jq -e '.status == "success"' > /dev/null; then
        echo -e "${GREEN}✅ Ping test passed${NC}"
    else
        echo -e "${RED}❌ Ping test failed${NC}"
        return 1
    fi
}

test_health() {
    echo -e "${YELLOW}=== Testing System Health Check ===${NC}"
    response=$(call_admin_api "GET" "/api/admin/health")
    echo "$response" | jq '.'
    
    system_status=$(echo "$response" | jq -r '.data.summary.systemStatus')
    if [ "$system_status" = "healthy" ]; then
        echo -e "${GREEN}✅ System health check passed${NC}"
    else
        echo -e "${RED}❌ System health check failed - Status: $system_status${NC}"
        return 1
    fi
}

test_info() {
    echo -e "${YELLOW}=== Testing System Information ===${NC}"
    response=$(call_admin_api "GET" "/api/admin/info")
    echo "$response" | jq '.'
    
    if echo "$response" | jq -e '.status == "success"' > /dev/null; then
        echo -e "${GREEN}✅ System info test passed${NC}"
    else
        echo -e "${RED}❌ System info test failed${NC}"
        return 1
    fi
}

test_integration_deployment() {
    echo -e "${YELLOW}=== Testing Integration Deployment ===${NC}"
    
    local integration_config='{
        "integrationName": "test-integration-script",
        "version": "1.0.0",
        "description": "Test integration from bash script",
        "defaultConfig": {
            "enabled": true,
            "scriptTest": true
        }
    }'
    
    response=$(call_admin_api "POST" "/api/admin/integrations/deploy" "$integration_config")
    echo "$response" | jq '.'
    
    if echo "$response" | jq -e '.status == "success"' > /dev/null; then
        echo -e "${GREEN}✅ Integration deployment test passed${NC}"
    else
        echo -e "${RED}❌ Integration deployment test failed${NC}"
        return 1
    fi
}

test_migration() {
    echo -e "${YELLOW}=== Testing Database Migration ===${NC}"
    
    local migration_config='{
        "migrationId": "test_migration_script_v1.0.0",
        "description": "Test migration from bash script",
        "targetDatabases": "clients",
        "sqlStatements": [
            "-- Test comment from script",
            "SELECT 1 as script_test"
        ]
    }'
    
    response=$(call_admin_api "POST" "/api/admin/migrations/execute" "$migration_config")
    echo "$response" | jq '.'
    
    if echo "$response" | jq -e '.status == "success"' > /dev/null; then
        echo -e "${GREEN}✅ Migration test passed${NC}"
    else
        echo -e "${RED}❌ Migration test failed${NC}"
        return 1
    fi
}

test_logs() {
    echo -e "${YELLOW}=== Testing Admin Logs ===${NC}"
    response=$(call_admin_api "GET" "/api/admin/logs?limit=5")
    echo "$response" | jq '.'
    
    if echo "$response" | jq -e '.status == "success"' > /dev/null; then
        echo -e "${GREEN}✅ Admin logs test passed${NC}"
    else
        echo -e "${RED}❌ Admin logs test failed${NC}"
        return 1
    fi
}

# Error handling for invalid API key
test_auth_failure() {
    echo -e "${YELLOW}=== Testing Authentication Failure ===${NC}"
    
    # Temporarily use invalid key
    local original_key="$ADMIN_API_KEY"
    ADMIN_API_KEY="invalid_key"
    
    response=$(call_admin_api "GET" "/api/admin/ping" 2>/dev/null || echo '{"error":"auth_failed"}')
    echo "$response" | jq '.'
    
    # Restore original key
    ADMIN_API_KEY="$original_key"
    
    if echo "$response" | jq -e '.error' > /dev/null; then
        echo -e "${GREEN}✅ Authentication failure test passed${NC}"
    else
        echo -e "${RED}❌ Authentication failure test failed - Invalid key was accepted${NC}"
        return 1
    fi
}

# Main execution
main() {
    echo -e "${BLUE}🚀 Starting Admin API Test Suite${NC}"
    echo "Base URL: $BASE_URL"
    echo "Admin API Key: ${ADMIN_API_KEY:0:8}..."
    echo ""
    
    # Check dependencies
    if ! command -v jq &> /dev/null; then
        echo -e "${RED}❌ jq is required but not installed${NC}"
        exit 1
    fi
    
    if ! command -v curl &> /dev/null; then
        echo -e "${RED}❌ curl is required but not installed${NC}"
        exit 1
    fi
    
    # Run tests
    local tests=(
        "test_ping"
        "test_auth_failure"
        "test_health"
        "test_info"
        "test_integration_deployment"
        "test_migration"
        "test_logs"
    )
    
    local passed=0
    local failed=0
    
    for test in "${tests[@]}"; do
        echo ""
        if $test; then
            ((passed++))
        else
            ((failed++))
        fi
    done
    
    echo ""
    echo -e "${BLUE}=== Test Results ===${NC}"
    echo -e "Passed: ${GREEN}$passed${NC}"
    echo -e "Failed: ${RED}$failed${NC}"
    
    if [ $failed -eq 0 ]; then
        echo -e "${GREEN}🎉 All tests passed!${NC}"
        exit 0
    else
        echo -e "${RED}❌ Some tests failed${NC}"
        exit 1
    fi
}

# Command line options
case "${1:-all}" in
    "ping")
        test_ping
        ;;
    "health")
        test_health
        ;;
    "info")
        test_info
        ;;
    "deploy")
        test_integration_deployment
        ;;
    "migrate")
        test_migration
        ;;
    "logs")
        test_logs
        ;;
    "auth")
        test_auth_failure
        ;;
    "all")
        main
        ;;
    *)
        echo "Usage: $0 [ping|health|info|deploy|migrate|logs|auth|all]"
        echo ""
        echo "Examples:"
        echo "  $0 ping     # Test basic connectivity"
        echo "  $0 health   # Test system health"
        echo "  $0 all      # Run all tests"
        echo ""
        echo "Environment variables:"
        echo "  ADMIN_API_KEY - Admin API key (required)"
        echo "  BASE_URL      - Platform base URL (default: http://localhost:5000)"
        exit 1
        ;;
esac