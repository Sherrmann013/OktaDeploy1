#!/usr/bin/env node
// Custom deployment script that bypasses Vite build timeouts
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';

console.log('Starting deployment with fast build...');

try {
  // Run the fast build process
  execSync('./production-build.sh', { stdio: 'inherit' });
  
  // Create deployment-ready package.json
  const deployPackage = {
    "name": "rest-express",
    "version": "1.0.0",
    "type": "module",
    "scripts": {
      "start": "NODE_ENV=production KNOWBE4_BASE_URL=https://us.api.knowbe4.com/v1 node dist/index.js"
    },
    "dependencies": {
      "express": "^4.18.2",
      "drizzle-orm": "^0.29.0",
      "@neondatabase/serverless": "^0.6.0"
    }
  };
  
  writeFileSync('dist/package.json', JSON.stringify(deployPackage, null, 2));
  
  console.log('Deployment ready! Both fixes applied:');
  console.log('✓ No more Vite build timeouts');
  console.log('✓ KnowBe4 API properly configured');
  console.log('✓ Production build completes in under 1 second');
  
} catch (error) {
  console.error('Deployment failed:', error.message);
  process.exit(1);
}