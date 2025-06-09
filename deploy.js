#!/usr/bin/env node
import { spawn } from 'child_process';
import { promises as fs } from 'fs';

console.log('🚀 Starting deployment with no-Vite build...');

// Run the no-Vite build process
const buildProcess = spawn('node', ['build-production.js'], { stdio: 'inherit' });

buildProcess.on('close', async (code) => {
  if (code !== 0) {
    console.error('❌ Build failed');
    process.exit(1);
  }
  
  console.log('✅ Build completed successfully');
  
  // Start production server
  console.log('🌐 Starting production server...');
  const server = spawn('node', ['dist/server.js'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      KNOWBE4_BASE_URL: 'https://us.api.knowbe4.com/v1',
      PORT: process.env.PORT || '5000'
    }
  });
  
  server.on('error', (err) => {
    console.error('❌ Server error:', err);
  });
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down...');
    server.kill('SIGINT');
    process.exit(0);
  });
});