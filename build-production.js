#!/usr/bin/env node
import { build } from 'esbuild';
import { mkdir, copyFile, writeFile } from 'fs/promises';
import { resolve } from 'path';

console.log('Building production application...');

// Clean and create directories
await mkdir('dist/public', { recursive: true });

// HTML template for production
const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>User Management Dashboard</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { font-family: system-ui, -apple-system, sans-serif; }
        .loading { display: flex; align-items: center; justify-content: center; height: 100vh; }
    </style>
</head>
<body>
    <div id="root">
        <div class="loading">
            <div>Loading application...</div>
        </div>
    </div>
    <script type="module">
        import React from 'https://esm.sh/react@18.3.1';
        import { createRoot } from 'https://esm.sh/react-dom@18.3.1/client';
        window.React = React;
        window.ReactDOM = { createRoot };
    </script>
    <script type="module" src="/app.js"></script>
</body>
</html>`;

// Build client application
try {
    await build({
        entryPoints: ['client/src/main.tsx'],
        bundle: true,
        outfile: 'dist/public/app.js',
        format: 'esm',
        target: 'es2020',
        minify: true,
        treeShaking: true,
        define: {
            'process.env.NODE_ENV': '"production"',
            'global': 'globalThis',
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
        external: ['react', 'react-dom', 'react-dom/client'],
        banner: {
            js: '// Production build'
        }
    });
    console.log('Client bundle created successfully');
} catch (error) {
    console.error('Client build failed:', error);
    process.exit(1);
}

// Build server
try {
    await build({
        entryPoints: ['server/index.ts'],
        bundle: true,
        outfile: 'dist/server.js',
        format: 'esm',
        platform: 'node',
        target: 'node20',
        minify: true,
        packages: 'external',
        banner: {
            js: '// Production server'
        }
    });
    console.log('Server bundle created successfully');
} catch (error) {
    console.error('Server build failed:', error);
    process.exit(1);
}

// Write production files
await writeFile('dist/public/index.html', htmlTemplate);
await copyFile('.env.production', 'dist/.env.production');

console.log('Production build completed successfully');
console.log('Files ready for deployment in ./dist/');