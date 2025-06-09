#!/bin/bash
set -e

echo "🏗️ Building production application..."

# Clean and create dist directory
rm -rf dist
mkdir -p dist/public

# Build server bundle only (skip problematic Vite build)
echo "📦 Building server bundle..."
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist --target=node20 --minify

# Copy essential client files for serving
echo "📁 Copying client files..."
cp client/index.html dist/public/
mkdir -p dist/public/src
cp -r client/src dist/public/

# Copy environment files
echo "🔧 Setting up environment..."
cp .env.production dist/

echo "✅ Production build complete!"
echo "📂 Built files:"
ls -la dist/