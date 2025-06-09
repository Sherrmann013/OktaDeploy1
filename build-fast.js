#!/usr/bin/env node
// Fast build script that replaces the slow Vite build
import { build } from 'esbuild';
import { mkdir, copyFile, writeFile } from 'fs/promises';
import { resolve } from 'path';

async function fastBuild() {
  console.log('Fast build starting...');
  
  // Create output directories
  await mkdir('dist/public', { recursive: true });

  // Build server bundle with esbuild (fast)
  await build({
    entryPoints: ['server/index.ts'],
    bundle: true,
    outfile: 'dist/index.js',
    format: 'esm',
    platform: 'node',
    target: 'node20',
    minify: true,
    packages: 'external',
  });

  // Create minimal HTML for production
  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Dashboard</title>
<script src="https://cdn.tailwindcss.com"></script></head>
<body><div id="root">Loading...</div>
<script type="module">
import React from 'https://esm.sh/react@18';
import {createRoot} from 'https://esm.sh/react-dom@18/client';
import('./app.js');
</script></body></html>`;

  // Build client bundle (minimal, fast)
  await build({
    entryPoints: ['client/src/main.tsx'],
    bundle: true,
    outfile: 'dist/public/app.js',
    format: 'esm',
    target: 'es2020',
    minify: true,
    external: ['react', 'react-dom', 'react-dom/client'],
    alias: {
      '@': resolve('./client/src'),
      '@shared': resolve('./shared'),
      '@assets': resolve('./attached_assets'),
    },
  });

  // Write files
  await writeFile('dist/public/index.html', html);
  await copyFile('.env.production', 'dist/.env.production').catch(() => {});
  
  console.log('Fast build complete');
}

fastBuild().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});