require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { initBot } = require('./src/bot');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static files (Mini App frontend)
app.use(express.static(path.join(__dirname, 'public')));

// Make prisma available to routes
app.set('prisma', prisma);

// Initialize bot
const bot = initBot();
app.set('bot', bot);

// Routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/profiles', require('./src/routes/profiles'));
app.use('/api/swipe', require('./src/routes/swipe'));
app.use('/api/matches', require('./src/routes/matches'));
app.use('/api/webhook', require('./src/routes/webhook'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// SPA fallback — serve index.html for non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Business Tinder API running on port ${PORT}`);
});
