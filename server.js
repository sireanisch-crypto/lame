const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware - Fix CORS
app.use(cors({
  origin: ['https://blade-management-frontend.vercel.app', 'https://lame-inob.onrender.com', 'http://localhost:10000'],
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Add a specific route handler for root path
app.get('/', (req, res) => {
  res.status(200).json({ 
    message: 'Blade Management API is running',
    version: '1.0.0',
    endpoints: {
      data: '/api/data',
      inventory: '/api/inventory',
      logs: '/api/logs',
      'machine-blades': '/api/machine-blades',
      'blade-assignments': '/api/blade-assignments',
      'machine-status': '/api/machine-status',  // Add this line
      reset: '/api/reset'
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

// API Routes
app.use('/api', require('./routes/api'));

// Catch-all handler for debugging
app.use((req, res) => {
  console.log('Unhandled request:', req.method, req.url);
  res.status(404).json({ message: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});