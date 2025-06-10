#!/usr/bin/env node
// Ultra-simple build that preserves all custom configurations
import { build } from 'esbuild';
import { mkdir, writeFile, copyFile } from 'fs/promises';
import { resolve } from 'path';

async function simpleBuild() {
  console.log('=== SIMPLE BUILD START ===');
  const startTime = Date.now();
  
  // Create output directories matching your structure
  await mkdir('dist', { recursive: true });
  await mkdir('dist/public', { recursive: true });

  // Build client bundle to original structure
  await build({
    entryPoints: ['client/src/main.tsx'],
    bundle: true,
    outfile: 'dist/public/app.js',
    format: 'iife',
    target: 'es2017',
    minify: true,
    platform: 'browser',
    define: {
      'process.env.NODE_ENV': '"production"',
      'global': 'globalThis'
    },
    alias: {
      '@': resolve('./client/src'),
      '@shared': resolve('./shared'), 
      '@assets': resolve('./attached_assets'),
    },
    jsx: 'automatic',
    jsxImportSource: 'react',
    external: [],
    keepNames: false,
    sourcemap: false,
  });

  // Create HTML that matches server structure
  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vite + React + TS</title>
    <link rel="stylesheet" href="/assets/index.css">
  </head>
  <body>
    <div id="root"></div>
    <script src="/app.js"></script>
  </body>
</html>`;

  await writeFile('dist/public/index.html', html);
  
  // Copy original assets to build directory
  try {
    await copyFile('client/public/maze-logo.png', 'dist/public/maze-logo.png');
  } catch (err) {
    console.log('Warning: Could not copy maze-logo.png');
  }
  
  // Build server
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

  const elapsed = Date.now() - startTime;
  console.log(`✓ Build completed in ${elapsed}ms`);
  console.log('=== SIMPLE BUILD END ===');
}

simpleBuild().catch(console.error);