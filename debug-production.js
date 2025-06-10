#!/usr/bin/env node
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3001;

// Serve static files from dist/public
app.use(express.static(path.join(__dirname, 'dist/public')));

// Handle SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/public/index.html'));
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Debug production server running on port ${PORT}`);
  console.log(`Visit: http://localhost:${PORT}`);
  console.log(`Open browser console to see React initialization logs`);
});

// Keep running until manually stopped
process.on('SIGINT', () => {
  console.log('\nShutting down debug server...');
  server.close();
  process.exit(0);
});