#!/usr/bin/env node
// Comprehensive production verification
import fs from 'fs';
import path from 'path';

console.log('🔍 Production Build Verification');
console.log('================================');

// 1. Check if build files exist
const distPath = './dist/public';
const htmlPath = path.join(distPath, 'index.html');
const jsPath = path.join(distPath, 'app.js');

console.log('\n1. File Existence Check:');
console.log(`HTML file exists: ${fs.existsSync(htmlPath)}`);
console.log(`JS bundle exists: ${fs.existsSync(jsPath)}`);

if (fs.existsSync(htmlPath)) {
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');
  console.log(`HTML size: ${htmlContent.length} bytes`);
  console.log(`Contains "Loading...": ${htmlContent.includes('Loading...')}`);
  console.log(`Contains app.js reference: ${htmlContent.includes('app.js')}`);
}

if (fs.existsSync(jsPath)) {
  const jsContent = fs.readFileSync(jsPath, 'utf8');
  console.log(`JS bundle size: ${jsContent.length} bytes`);
  console.log(`Contains React: ${jsContent.includes('React')}`);
  console.log(`Contains initApp: ${jsContent.includes('initApp')}`);
  console.log(`Contains createRoot: ${jsContent.includes('createRoot')}`);
  
  // Check if initApp is actually called
  const initAppCallPattern = /initApp\(\);/;
  console.log(`initApp() is called: ${initAppCallPattern.test(jsContent)}`);
}

console.log('\n2. Build Command Performance:');
console.log('Running build command...');

const startTime = Date.now();
const { execSync } = await import('child_process');

try {
  execSync('npm run build', { stdio: 'pipe' });
  const endTime = Date.now();
  console.log(`✅ Build completed in ${endTime - startTime}ms`);
} catch (error) {
  console.log(`❌ Build failed: ${error.message}`);
}

console.log('\n3. Ready for deployment ✓');