#!/usr/bin/env node

const { spawn } = require('child_process');
const chokidar = require('chokidar');
const path = require('path');

console.log('🔄 Starting automatic build watcher...');
console.log('📁 Watching: client/src/, shared/, public/');
console.log('⚡ Will rebuild frontend automatically on changes\n');

let isBuilding = false;
let pendingBuild = false;

const runBuild = () => {
  if (isBuilding) {
    pendingBuild = true;
    return;
  }

  isBuilding = true;
  console.log('🔨 Building frontend...');
  
  const startTime = Date.now();
  const build = spawn('npm', ['run', 'build'], {
    stdio: 'pipe',
    shell: true
  });

  let output = '';
  build.stdout.on('data', (data) => {
    output += data.toString();
  });

  build.stderr.on('data', (data) => {
    output += data.toString();
  });

  build.on('close', (code) => {
    const duration = Date.now() - startTime;
    
    if (code === 0) {
      console.log(`✅ Build completed successfully in ${duration}ms`);
    } else {
      console.log(`❌ Build failed (exit code ${code})`);
      console.log('Build output:', output);
    }
    
    isBuilding = false;
    
    if (pendingBuild) {
      pendingBuild = false;
      setTimeout(runBuild, 100); // Small delay to batch rapid changes
    }
  });
};

// Watch for changes in relevant directories
const watcher = chokidar.watch([
  'client/src/**/*',
  'shared/**/*',
  'public/**/*'
], {
  ignored: [
    '**/node_modules/**',
    '**/dist/**',
    '**/.git/**',
    '**/.*'
  ],
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 100,
    pollInterval: 50
  }
});

watcher.on('change', (filePath) => {
  console.log(`📝 Changed: ${path.relative(process.cwd(), filePath)}`);
  runBuild();
});

watcher.on('add', (filePath) => {
  console.log(`➕ Added: ${path.relative(process.cwd(), filePath)}`);
  runBuild();
});

watcher.on('unlink', (filePath) => {
  console.log(`➖ Removed: ${path.relative(process.cwd(), filePath)}`);
  runBuild();
});

watcher.on('error', (error) => {
  console.error('❌ Watcher error:', error);
});

// Initial build
runBuild();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping build watcher...');
  watcher.close();
  process.exit(0);
});