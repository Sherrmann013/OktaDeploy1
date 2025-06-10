#!/usr/bin/env node
// Test production server on different port
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3002;

// Serve static files from dist/public
app.use(express.static(path.join(__dirname, 'dist/public')));

// Serve the app for all routes (SPA routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/public/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Production test server running on port ${PORT}`);
  console.log(`Visit: http://localhost:${PORT}`);
});