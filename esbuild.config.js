import { build } from 'esbuild';
import { resolve } from 'path';

// Build client bundle
await build({
  entryPoints: ['client/src/main.tsx'],
  bundle: true,
  outdir: 'dist/public',
  format: 'esm',
  target: 'es2020',
  minify: true,
  sourcemap: false,
  splitting: true,
  metafile: true,
  define: {
    'process.env.NODE_ENV': '"production"',
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
  external: [],
}).then(() => {
  console.log('✅ Client build complete');
}).catch((err) => {
  console.error('❌ Client build failed:', err);
  process.exit(1);
});

// Build server bundle
await build({
  entryPoints: ['server/index.ts'],
  bundle: true,
  outdir: 'dist',
  format: 'esm',
  platform: 'node',
  target: 'node20',
  minify: true,
  packages: 'external',
}).then(() => {
  console.log('✅ Server build complete');
}).catch((err) => {
  console.error('❌ Server build failed:', err);
  process.exit(1);
});