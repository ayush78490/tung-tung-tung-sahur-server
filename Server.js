require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// database connection 
const pool = new Pool({
  connectionString: process.env.NEON_CONNECTION_STRING,
  ssl: true
});

// fetch the score of the connected bhosdu
app.get('/get-score', async (req, res) => {
  try {
    const { wallet } = req.query;
    const result = await pool.query(
      'SELECT score FROM users WHERE wallet_address = $1',
      [wallet]
    );
    
    if (result.rows.length > 0) {
      res.json({ wallet, score: result.rows[0].score });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// update the score of the connected bhosdu
app.post('/update-score', async (req, res) => {
  try {
    const { wallet, score } = req.body;

    console.log('[BACKEND] Received wallet:', wallet);
    console.log('[BACKEND] Received score:', score);

    if (!wallet || score === undefined) {
      return res.status(400).json({ error: 'Missing wallet or score' });
    }

    await pool.query(
      `INSERT INTO users (wallet_address, score)
       VALUES ($1, $2)
       ON CONFLICT (wallet_address)
       DO UPDATE SET score = EXCLUDED.score`,
      [wallet, score]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('[BACKEND] DB error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});