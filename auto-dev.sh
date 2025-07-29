#!/bin/bash

echo "🚀 Starting automatic development mode..."
echo "📡 Server will run on port 5000"
echo "🔄 Frontend will rebuild automatically on changes"
echo ""

# Run both the server and the build watcher in parallel
concurrently \
  --prefix "[{name}]" \
  --names "server,watcher" \
  --colors "blue,green" \
  "npm run dev" \
  "node scripts/watch-build.js"