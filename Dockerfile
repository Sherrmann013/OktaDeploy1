# Use Node.js LTS version
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Keep devDependencies for drizzle-kit database setup
# RUN npm prune --production

# Note: Database setup will happen automatically when app starts

# Expose port (Railway will assign dynamically)
EXPOSE $PORT

# Health check (use Railway's dynamic port)
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:$PORT/health || exit 1

# Start the application (skip db setup to avoid hanging)
CMD ["npm", "start"]