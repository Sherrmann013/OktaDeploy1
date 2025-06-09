#!/bin/bash
set -e

echo "Starting production build..."

# Clean previous builds
rm -rf dist
mkdir -p dist/public

# Set environment variables
export NODE_ENV=production
export KNOWBE4_BASE_URL="https://us.api.knowbe4.com/v1"

# Build server with esbuild (fast, reliable)
echo "Building server..."
npx esbuild server/index.ts \
  --platform=node \
  --packages=external \
  --bundle \
  --format=esm \
  --outfile=dist/index.js \
  --target=node20 \
  --minify

# Build client with esbuild (bypass Vite completely)
echo "Building client..."
npx esbuild client/src/main.tsx \
  --bundle \
  --outfile=dist/public/app.js \
  --format=esm \
  --target=es2020 \
  --minify \
  --external:react \
  --external:react-dom \
  --alias:@=./client/src \
  --alias:@shared=./shared \
  --alias:@assets=./attached_assets

# Create production HTML
cat > dist/public/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>User Management Dashboard</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
    <div id="root">Loading...</div>
    <script type="module">
        import React from 'https://esm.sh/react@18.3.1';
        import { createRoot } from 'https://esm.sh/react-dom@18.3.1/client';
        window.React = React;
        window.ReactDOM = { createRoot };
        import('./app.js');
    </script>
</body>
</html>
EOF

# Copy environment configuration
cp .env.production dist/ 2>/dev/null || echo "NODE_ENV=production" > dist/.env.production
echo "KNOWBE4_BASE_URL=https://us.api.knowbe4.com/v1" >> dist/.env.production

echo "Production build complete - no Vite timeouts!"
echo "Files ready in ./dist/"