require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();

// Middleware setup
app.use(cors());
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
    const { wallet, score } = req.body;

    console.log('[BACKEND] Update request:', { wallet, score });

    // Input validation
    if (!isValidWallet(wallet)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid wallet address' 
      });
    }

    if (typeof score !== 'number' || score < 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid score value',
        details: 'Score must be a positive number'
      });
    }

    // Database operation
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
      newScore: result.rows[0].score,
      message: 'Score updated successfully'
    });

  } catch (error) {
    console.error('[BACKEND] Error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      details: error.message 
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