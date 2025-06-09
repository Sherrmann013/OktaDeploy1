#!/usr/bin/env node
// Comprehensive build debugging script
import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const TIMEOUT_MS = 300000; // 5 minutes
const startTime = Date.now();

console.log('=== DEPLOYMENT BUILD DEBUGGING ===');
console.log('Start time:', new Date().toISOString());
console.log('Node version:', process.version);
console.log('Working directory:', process.cwd());
console.log('Available memory:', Math.round(process.memoryUsage().heapTotal / 1024 / 1024), 'MB');

// Function to log with timestamp
function log(message) {
  const elapsed = Date.now() - startTime;
  console.log(`[${elapsed}ms] ${message}`);
}

// Test original Vite build with timeout detection
async function testOriginalViteBuild() {
  log('Testing original Vite build...');
  
  // Restore original vite if it exists
  if (fs.existsSync('node_modules/.bin/vite-original')) {
    fs.renameSync('node_modules/.bin/vite', 'node_modules/.bin/vite-replacement');
    fs.renameSync('node_modules/.bin/vite-original', 'node_modules/.bin/vite');
  }
  
  return new Promise((resolve) => {
    const viteBuild = spawn('npx', ['vite', 'build'], {
      stdio: 'pipe',
      cwd: process.cwd()
    });
    
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    
    viteBuild.stdout.on('data', (data) => {
      stdout += data.toString();
      log('VITE STDOUT: ' + data.toString().trim());
    });
    
    viteBuild.stderr.on('data', (data) => {
      stderr += data.toString();
      log('VITE STDERR: ' + data.toString().trim());
    });
    
    // Set timeout
    const timeout = setTimeout(() => {
      timedOut = true;
      log('TIMEOUT: Vite build exceeded 5 minutes - KILLING PROCESS');
      viteBuild.kill('SIGKILL');
    }, TIMEOUT_MS);
    
    viteBuild.on('exit', (code, signal) => {
      clearTimeout(timeout);
      const elapsed = Date.now() - startTime;
      
      if (timedOut) {
        log(`VITE BUILD TIMED OUT after ${elapsed}ms`);
        log('This confirms the deployment timeout issue');
        resolve({ success: false, timedOut: true, code, signal, elapsed });
      } else {
        log(`VITE BUILD COMPLETED: code=${code}, signal=${signal}, elapsed=${elapsed}ms`);
        resolve({ success: code === 0, timedOut: false, code, signal, elapsed });
      }
    });
    
    viteBuild.on('error', (error) => {
      clearTimeout(timeout);
      log('VITE BUILD ERROR: ' + error.message);
      resolve({ success: false, error: error.message });
    });
  });
}

// Test replacement build
async function testReplacementBuild() {
  log('Testing replacement build...');
  
  // Ensure replacement is active
  if (fs.existsSync('node_modules/.bin/vite-replacement')) {
    if (fs.existsSync('node_modules/.bin/vite-original')) {
      fs.unlinkSync('node_modules/.bin/vite');
    }
    fs.renameSync('node_modules/.bin/vite-replacement', 'node_modules/.bin/vite');
  }
  
  const buildStart = Date.now();
  
  return new Promise((resolve) => {
    const build = spawn('npm', ['run', 'build'], {
      stdio: 'pipe',
      cwd: process.cwd()
    });
    
    let stdout = '';
    let stderr = '';
    
    build.stdout.on('data', (data) => {
      stdout += data.toString();
      log('BUILD STDOUT: ' + data.toString().trim());
    });
    
    build.stderr.on('data', (data) => {
      stderr += data.toString();
      log('BUILD STDERR: ' + data.toString().trim());
    });
    
    build.on('exit', (code) => {
      const elapsed = Date.now() - buildStart;
      log(`REPLACEMENT BUILD COMPLETED: code=${code}, elapsed=${elapsed}ms`);
      
      // Check output files
      const distExists = fs.existsSync('dist');
      const indexExists = fs.existsSync('dist/index.js');
      const publicExists = fs.existsSync('dist/public');
      const appExists = fs.existsSync('dist/public/app.js');
      
      resolve({ 
        success: code === 0, 
        elapsed, 
        files: { distExists, indexExists, publicExists, appExists }
      });
    });
  });
}

// Main debugging function
async function runBuildDebug() {
  try {
    // Clean previous builds
    if (fs.existsSync('dist')) {
      execSync('rm -rf dist');
      log('Cleaned previous build directory');
    }
    
    // Test original Vite (with timeout protection)
    log('=== TESTING ORIGINAL VITE BUILD ===');
    const originalResult = await testOriginalViteBuild();
    log('Original Vite Result:', JSON.stringify(originalResult, null, 2));
    
    // Clean for next test
    if (fs.existsSync('dist')) {
      execSync('rm -rf dist');
    }
    
    // Test replacement build
    log('=== TESTING REPLACEMENT BUILD ===');
    const replacementResult = await testReplacementBuild();
    log('Replacement Build Result:', JSON.stringify(replacementResult, null, 2));
    
    // Summary
    log('=== BUILD COMPARISON SUMMARY ===');
    log(`Original Vite: ${originalResult.success ? 'SUCCESS' : 'FAILED'} ${originalResult.timedOut ? '(TIMED OUT)' : ''}`);
    log(`Replacement: ${replacementResult.success ? 'SUCCESS' : 'FAILED'} (${replacementResult.elapsed}ms)`);
    
    if (originalResult.timedOut) {
      log('CONFIRMED: Original Vite build causes deployment timeouts');
      log('SOLUTION: Replacement build completes successfully');
    }
    
  } catch (error) {
    log('DEBUG ERROR: ' + error.message);
    process.exit(1);
  }
}

runBuildDebug();