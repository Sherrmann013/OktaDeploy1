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
    <title>Maze User Management Dashboard</title>
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

      .bg-background {
        background-color: hsl(var(--background));
      }

      .bg-card {
        background-color: hsl(var(--card));
      }

      .text-card-foreground {
        color: hsl(var(--card-foreground));
      }

      .border-border {
        border-color: hsl(var(--border));
      }

      .bg-muted {
        background-color: hsl(var(--muted));
      }

      .text-muted-foreground {
        color: hsl(var(--muted-foreground));
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

      /* Status badges with proper dark mode */
      .status-active {
        background-color: rgb(220 252 231);
        color: rgb(22 101 52);
      }

      .status-suspended {
        background-color: rgb(254 249 195);
        color: rgb(133 77 14);
      }

      .status-deprovisioned {
        background-color: rgb(254 226 226);
        color: rgb(153 27 27);
      }

      .dark .status-active {
        background-color: hsl(123 46% 35%);
        color: hsl(0 0% 98%);
      }

      .dark .status-suspended {
        background-color: hsl(35 91% 48%);
        color: hsl(0 0% 98%);
      }

      .dark .status-deprovisioned {
        background-color: hsl(0 75% 55%);
        color: hsl(0 0% 98%);
      }

      /* Enhanced button styling for tabs */
      .bg-muted\/50 {
        background-color: hsla(var(--muted), 0.5);
      }

      /* Custom table header styling */
      .table-header {
        background-color: hsl(var(--muted));
        border-bottom: 1px solid hsl(var(--border));
      }

      .dark .table-header {
        background-color: hsl(215 20% 16%);
        border-bottom: 1px solid hsl(215 15% 25%);
      }

      /* Fix TabsList to show distinct buttons */
      [role="tablist"] {
        background-color: transparent !important;
        gap: 0.5rem;
      }

      [role="tab"] {
        background-color: hsl(var(--muted)) !important;
        border: 1px solid hsl(var(--border)) !important;
        border-radius: 0.375rem !important;
        margin: 0 !important;
      }

      [role="tab"][data-state="active"] {
        background-color: hsl(var(--card)) !important;
        color: hsl(var(--card-foreground)) !important;
        border-color: hsl(var(--primary)) !important;
      }

      /* Main content areas need darker backgrounds */
      .space-y-6 {
        background-color: hsl(var(--muted)/0.3);
        padding: 1rem;
        border-radius: 0.5rem;
      }

      /* Main Users page specific styling */
      
      /* Stats cards section - darker background */
      .bg-background.px-6.py-4 {
        background-color: hsl(var(--muted)/0.4) !important;
      }
      
      /* Individual table rows - darker backgrounds */
      .dark [data-state] tr,
      .dark tbody tr,
      .dark .table-row-light {
        background-color: hsl(215 20% 16%) !important;
        border: none !important;
      }
      
      /* Search and filter row - darker background */
      .flex.flex-col.gap-4.mb-6,
      .flex.justify-between.items-center.gap-4 {
        background-color: hsl(var(--muted)/0.5) !important;
        padding: 1rem !important;
        border-radius: 0.5rem !important;
        border: 1px solid hsl(var(--border)) !important;
      }
      
      /* Table header row - much darker background */
      thead tr,
      .table-header-row,
      th {
        background-color: hsl(215 25% 12%) !important;
        color: hsl(0 0% 98%) !important;
      }
      
      /* Table container overall */
      .flex-1.overflow-auto.bg-background {
        background-color: hsl(var(--muted)/0.3) !important;
        padding: 1rem !important;
        border-radius: 0.5rem !important;
      }
      
      /* UserTable card wrapper */
      .dark .UserTable [role="table"],
      .dark [data-table-container] {
        background-color: hsl(215 22% 18%) !important;
        border: 1px solid hsl(215 15% 25%) !important;
      }

      /* Remove white outlines from all interactive elements in dark mode */
      .dark button,
      .dark select,
      .dark input,
      .dark [role="combobox"],
      .dark [role="button"],
      .dark [data-state],
      .dark .theme-toggle {
        outline: none !important;
        box-shadow: none !important;
      }

      /* Remove border from theme toggle button specifically */
      .dark button[data-testid="theme-toggle"],
      .dark button:has(.lucide-sun),
      .dark button:has(.lucide-moon) {
        border: none !important;
      }

      .dark button:focus,
      .dark select:focus,
      .dark input:focus,
      .dark [role="combobox"]:focus,
      .dark [role="button"]:focus,
      .dark [data-state]:focus,
      .dark .theme-toggle:focus {
        outline: none !important;
        box-shadow: none !important;
        border-color: hsl(var(--primary)) !important;
      }

      .dark button:focus-visible,
      .dark select:focus-visible,
      .dark input:focus-visible,
      .dark [role="combobox"]:focus-visible,
      .dark [role="button"]:focus-visible {
        outline: 2px solid hsl(var(--primary)) !important;
        outline-offset: 2px !important;
        box-shadow: none !important;
      }

      /* Specific fixes for dialog and modal elements */
      .dark [role="dialog"],
      .dark [role="dialog"] *,
      .dark .dialog-content,
      .dark .dialog-content *,
      .dark [data-radix-dialog-content],
      .dark [data-radix-dialog-content] * {
        outline: none !important;
        box-shadow: none !important;
      }

      /* Column management dialog specific fixes */
      .dark [role="dialog"] button,
      .dark [role="dialog"] input,
      .dark [role="dialog"] [role="checkbox"],
      .dark .column-item,
      .dark .column-item * {
        outline: none !important;
        box-shadow: none !important;
        border-color: hsl(var(--border)) !important;
      }

      .dark [role="dialog"] button:focus,
      .dark [role="dialog"] input:focus,
      .dark [role="dialog"] [role="checkbox"]:focus {
        outline: none !important;
        box-shadow: none !important;
        border-color: hsl(var(--primary)) !important;
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