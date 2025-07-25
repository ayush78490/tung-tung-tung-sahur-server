require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();

const allowedOrigins = [
  'https://tung-tung-tung-sahur-three.vercel.app',
  'http://localhost:3000' // For local development
];

// Middleware setup
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection with better error handling
const pool = new Pool({
  connectionString: process.env.NEON_CONNECTION_STRING,
  ssl: {
    rejectUnauthorized: false // Required for some Neon DB connections
  }
});

// Test database connection on startup
pool.connect()
  .then(() => console.log('Connected to PostgreSQL database'))
  .catch(err => console.error('Database connection error:', err));

// Helper function for validating wallet address
const isValidWallet = (wallet) => {
  return wallet && typeof wallet === 'string' && wallet.length >= 10;
};

// Get user score endpoint
app.get('/get-score', async (req, res) => {
  try {
    const { wallet } = req.query;
    
    if (!isValidWallet(wallet)) {
      return res.status(400).json({ 
        error: 'Invalid wallet address',
        details: 'Wallet address must be a valid string'
      });
    }

    const result = await pool.query(
      'SELECT score FROM users WHERE wallet_address = $1',
      [wallet]
    );
    
    if (result.rows.length > 0) {
      res.json({ 
        success: true,
        wallet, 
        score: result.rows[0].score 
      });
    } else {
      res.status(404).json({ 
        success: false,
        error: 'User not found',
        message: 'Starting from score 0'
      });
    }
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Update user score endpoint
app.post('/update-score', async (req, res) => {
  try {
    console.log('Received request body:', req.body); // Log incoming request
    
    const { wallet, score } = req.body;

    // Validate input
    if (!wallet) {
      return res.status(400).json({ 
        success: false,
        error: 'Validation Error',
        message: 'Wallet address is required',
        received: req.body
      });
    }

    if (typeof score !== 'number') {
      return res.status(400).json({ 
        success: false,
        error: 'Validation Error',
        message: 'Score must be a number',
        received: typeof score
      });
    }

    const result = await pool.query(
      `INSERT INTO users (wallet_address, score)
       VALUES ($1, $2)
       ON CONFLICT (wallet_address)
       DO UPDATE SET score = EXCLUDED.score
       RETURNING score`,
      [wallet, score]
    );

    res.json({ 
      success: true,
      wallet,
      newScore: result.rows[0].score
    });
    
  } catch (error) {
    console.error('Update score error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal Server Error',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Handle 404 for undefined routes
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    error: 'Endpoint not found' 
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    success: false,
    error: 'Internal server error' 
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});