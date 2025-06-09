# Production Deployment Fix

## Issues Identified:
1. Production deployment missing KNOWBE4_BASE_URL environment variable
2. Complex Vite build process times out in production
3. 404 errors due to routing issues in production environment

## Solutions Applied:
1. Set KNOWBE4_BASE_URL=https://us.api.knowbe4.com/v1 in environment
2. Created streamlined production build using esbuild (completes in 19ms vs timeout)
3. Fixed authentication imports and routing issues

## Files Modified:
- server/knowbe4-service.ts: Added environment variable support for base URL
- Authentication system: Fixed imports and graceful 401 handling
- Build process: Created working production bundle

## Environment Variables Required:
- KNOWBE4_API_KEY (exists)
- KNOWBE4_BASE_URL=https://us.api.knowbe4.com/v1 (needs to be set in production)
- OKTA_DOMAIN (exists)
- OKTA_API_TOKEN (exists)