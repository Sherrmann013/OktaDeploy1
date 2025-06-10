#!/usr/bin/env node
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3001;

// Serve static files
app.use(express.static(path.join(__dirname, 'dist/public')));

// Handle SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/public/index.html'));
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Production server running on port ${PORT}`);
  console.log(`📱 Test at: http://localhost:${PORT}`);
  
  // Auto-shutdown after 30 seconds
  setTimeout(() => {
    console.log('🔄 Shutting down test server...');
    server.close();
  }, 30000);
});