import { build } from 'esbuild';
import { copyFile, mkdir, readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';

console.log('🔨 Building without Vite...');

// Clean and setup dist directory
await mkdir('dist/public', { recursive: true });

// Create HTML template with esbuild bundles
const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>User Management Dashboard</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/main.js"></script>
  </body>
</html>`;

// Build client with esbuild
try {
  await build({
    entryPoints: ['client/src/main.tsx'],
    bundle: true,
    outfile: 'dist/public/main.js',
    format: 'esm',
    target: 'es2020',
    minify: true,
    define: {
      'process.env.NODE_ENV': '"production"',
    },
    loader: {
      '.tsx': 'tsx',
      '.ts': 'ts',
      '.jsx': 'jsx',
      '.js': 'js',
    },
    alias: {
      '@': resolve('./client/src'),
      '@shared': resolve('./shared'),
      '@assets': resolve('./attached_assets'),
    },
    external: ['react', 'react-dom'],
    banner: {
      js: `
import React from 'https://esm.sh/react@18';
import ReactDOM from 'https://esm.sh/react-dom@18/client';
window.React = React;
window.ReactDOM = ReactDOM;
      `.trim()
    }
  });
  console.log('✅ Client bundle built');
} catch (err) {
  console.error('❌ Client build failed:', err);
  process.exit(1);
}

// Build server
try {
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
  console.log('✅ Server bundle built');
} catch (err) {
  console.error('❌ Server build failed:', err);
  process.exit(1);
}

// Write HTML file
await writeFile('dist/public/index.html', htmlTemplate);

// Copy environment files
await copyFile('.env.production', 'dist/.env.production');

console.log('🎉 Build complete without Vite!');