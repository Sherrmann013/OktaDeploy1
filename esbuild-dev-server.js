import { build, context } from 'esbuild';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const isDev = process.env.NODE_ENV !== 'production';

// HTML template that works without Vite
const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>User Management Dashboard</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script type="importmap">
    {
      "imports": {
        "react": "https://esm.sh/react@18.3.1",
        "react-dom": "https://esm.sh/react-dom@18.3.1",
        "react-dom/client": "https://esm.sh/react-dom@18.3.1/client"
      }
    }
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/client.js"></script>
  </body>
</html>`;

// Build configuration
const buildOptions = {
  entryPoints: ['client/src/main.tsx'],
  bundle: true,
  outfile: 'dist/public/client.js',
  format: 'esm',
  target: 'es2020',
  minify: !isDev,
  sourcemap: isDev,
  define: {
    'process.env.NODE_ENV': `"${process.env.NODE_ENV || 'development'}"`,
  },
  loader: {
    '.tsx': 'tsx',
    '.ts': 'ts',
    '.jsx': 'jsx',
    '.js': 'js',
    '.css': 'css',
    '.png': 'file',
    '.jpg': 'file',
    '.jpeg': 'file',
    '.gif': 'file',
    '.svg': 'file',
  },
  alias: {
    '@': resolve('./client/src'),
    '@shared': resolve('./shared'),
    '@assets': resolve('./attached_assets'),
  },
  external: ['react', 'react-dom', 'react-dom/client'],
};

if (isDev) {
  // Development with watch mode
  const ctx = await context(buildOptions);
  await ctx.watch();
  console.log('🔥 ESBuild watching for changes...');
  
  // Keep process alive
  process.on('SIGINT', async () => {
    await ctx.dispose();
    process.exit(0);
  });
} else {
  // Production build
  await build(buildOptions);
  console.log('✅ Client build complete');
}

// Write HTML file
writeFileSync('dist/public/index.html', htmlTemplate);
console.log('📄 HTML template written');