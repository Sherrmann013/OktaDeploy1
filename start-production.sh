#!/bin/bash

# Production startup script for Railway deployment
echo "🚀 Starting production deployment..."

# Setup database schema first
echo "📊 Setting up database schema..."
npm run db:push

# Check if schema setup was successful
if [ $? -eq 0 ]; then
    echo "✅ Database schema setup completed successfully"
else
    echo "❌ Database schema setup failed"
    exit 1
fi

# Start the application
echo "🎯 Starting application server..."
npm start