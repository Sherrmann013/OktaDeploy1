#!/usr/bin/env node
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

const PORT = process.env.PORT || 3000;

console.log('🚀 Starting production deployment...');

// Set required environment variables
process.env.NODE_ENV = 'production';
process.env.KNOWBE4_BASE_URL = process.env.KNOWBE4_BASE_URL || 'https://us.api.knowbe4.com/v1';

console.log('✅ Environment variables configured');
console.log(`   - NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`   - KNOWBE4_BASE_URL: ${process.env.KNOWBE4_BASE_URL}`);

// Create dist directory structure
await fs.mkdir('dist/public', { recursive: true });

// Build server bundle
console.log('🔨 Building server bundle...');
const serverBuild = spawn('npx', [
  'esbuild', 
  'server/index.ts',
  '--platform=node',
  '--packages=external',
  '--bundle',
  '--format=esm',
  '--outdir=dist',
  '--target=node20',
  '--minify'
], { stdio: 'inherit' });

await new Promise((resolve, reject) => {
  serverBuild.on('close', (code) => {
    if (code === 0) {
      console.log('✅ Server bundle built successfully');
      resolve();
    } else {
      reject(new Error(`Server build failed with code ${code}`));
    }
  });
});

// Copy essential files for production
console.log('📁 Copying essential files...');
await fs.copyFile('client/index.html', 'dist/public/index.html');
await fs.copyFile('.env.production', 'dist/.env.production');

// Start production server
console.log(`🌐 Starting production server on port ${PORT}...`);
const server = spawn('node', ['dist/index.js'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PORT: PORT,
    NODE_ENV: 'production',
    KNOWBE4_BASE_URL: 'https://us.api.knowbe4.com/v1'
  }
});

server.on('error', (err) => {
  console.error('❌ Production server error:', err);
  process.exit(1);
});

server.on('close', (code) => {
  console.log(`🛑 Production server stopped with code ${code}`);
  process.exit(code);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down production server...');
  server.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down production server...');
  server.kill('SIGTERM');
});