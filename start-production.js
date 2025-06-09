#!/usr/bin/env node
// Production server startup script with proper port configuration
import { spawn } from 'child_process';
import { existsSync } from 'fs';

const PORT = process.env.PORT || 5000;
const PRODUCTION_PORT = process.env.NODE_ENV === 'production' ? PORT : 3000;

console.log('Starting production server...');

// Verify build exists
if (!existsSync('dist/index.js')) {
  console.error('Production build not found. Run ./production-build.sh first.');
  process.exit(1);
}

// Start production server with proper environment
const env = {
  ...process.env,
  NODE_ENV: 'production',
  PORT: PRODUCTION_PORT,
  KNOWBE4_BASE_URL: process.env.KNOWBE4_BASE_URL || 'https://us.api.knowbe4.com/v1'
};

console.log(`Environment configured:`);
console.log(`- PORT: ${PRODUCTION_PORT}`);
console.log(`- KNOWBE4_BASE_URL: ${env.KNOWBE4_BASE_URL}`);
console.log(`- NODE_ENV: ${env.NODE_ENV}`);

const server = spawn('node', ['dist/index.js'], {
  env,
  cwd: process.cwd(),
  stdio: 'inherit'
});

server.on('error', (error) => {
  console.error('Server failed to start:', error.message);
  process.exit(1);
});

server.on('exit', (code) => {
  console.log(`Server exited with code ${code}`);
  process.exit(code);
});

process.on('SIGINT', () => {
  console.log('Shutting down production server...');
  server.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('Shutting down production server...');
  server.kill('SIGTERM');
});