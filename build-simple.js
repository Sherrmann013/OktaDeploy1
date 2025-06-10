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
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
      tailwind.config = {
        darkMode: 'class',
        theme: {
          extend: {}
        }
      }
    </script>
    <style>
      :root {
        --background: 0 0% 100%;
        --foreground: 20 14.3% 4.1%;
        --muted: 60 4.8% 95.9%;
        --muted-foreground: 25 5.3% 44.7%;
        --card: 0 0% 100%;
        --card-foreground: 20 14.3% 4.1%;
        --border: 20 5.9% 90%;
        --primary: 207 90% 54%;
        --primary-foreground: 211 100% 99%;
        --secondary: 60 4.8% 95.9%;
        --secondary-foreground: 24 9.8% 10%;
        --accent: 60 4.8% 95.9%;
        --accent-foreground: 24 9.8% 10%;
        --destructive: 0 84.2% 60.2%;
        --destructive-foreground: 60 9.1% 97.8%;
        --ring: 20 14.3% 4.1%;
        --radius: 0.5rem;
      }

      .dark {
        --background: 215 25% 16%;
        --foreground: 0 0% 98%;
        --muted: 215 20% 20%;
        --muted-foreground: 0 0% 85%;
        --card: 215 22% 18%;
        --card-foreground: 0 0% 98%;
        --border: 215 15% 25%;
        --primary: 207 90% 58%;
        --primary-foreground: 0 0% 100%;
        --secondary: 215 15% 25%;
        --secondary-foreground: 0 0% 98%;
        --accent: 215 15% 25%;
        --accent-foreground: 0 0% 98%;
        --destructive: 0 75% 55%;
        --destructive-foreground: 0 0% 98%;
        --ring: 207 90% 58%;
      }

      body {
        background-color: hsl(var(--background));
        color: hsl(var(--foreground));
        font-family: system-ui, -apple-system, sans-serif;
      }

      .table-row-light {
        background-color: #f8f9fa;
      }

      .table-row-light:hover {
        background-color: #f1f3f4;
      }

      .dark .table-row-light {
        background-color: hsl(215 22% 18%);
      }

      .dark .table-row-light:hover {
        background-color: hsl(215 20% 20%);
      }
    </style>
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