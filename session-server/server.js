import express from 'express';
import pkg from 'pg';
const { Pool } = pkg;

const app = express();
app.use(express.json());

// Connect to PostgreSQL (Neon database)
const pool = new Pool({
  host: process.env.PG_HOST || 'ep-fragrant-bread-ampy8m1v.c-5.us-east-1.aws.neon.tech',
  port: parseInt(process.env.PG_PORT || '5432'),
  user: process.env.PG_USER || 'neondb_owner',
  password: process.env.PG_PASSWORD || 'npg_YDGTAMVZ32eS',
  database: process.env.PG_DATABASE || 'neondb',
  ssl: { rejectUnauthorized: false },  // Neon requires SSL
});

// Initialize sessions table
async function initTable() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        title VARCHAR(500),
        messages JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON chat_sessions(user_id);
    `);
    console.log('[Session] Table initialized, connected to Neon DB');
  } catch (err) {
    console.error('[Session] Init error:', err.message);
  } finally {
    client.release();
  }
}

// Get sessions for a user
app.get('/api/sessions', async (req, res) => {
  const userId = req.query.user_id;
  if (!userId) {
    return res.json({ code: 1, error: 'user_id required' });
  }

  try {
    const result = await pool.query(
      'SELECT id, user_id, title, messages, created_at, updated_at FROM chat_sessions WHERE user_id = $1 ORDER BY updated_at DESC',
      [userId]
    );
    res.json({ code: 0, data: result.rows });
  } catch (err) {
    console.error('[Session] Query error:', err);
    res.json({ code: 1, error: err.message });
  }
});

// Create or update session
app.post('/api/sessions', async (req, res) => {
  const { id, user_id, title, messages } = req.body;
  if (!user_id) {
    return res.json({ code: 1, error: 'user_id required' });
  }

  try {
    await pool.query(`
      INSERT INTO chat_sessions (id, user_id, title, messages, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        messages = EXCLUDED.messages,
        updated_at = NOW()
    `, [id, user_id, title || '', JSON.stringify(messages || [])]);

    res.json({ code: 0, data: { id, user_id } });
  } catch (err) {
    console.error('[Session] Insert error:', err);
    res.json({ code: 1, error: err.message });
  }
});

// Delete session
app.delete('/api/sessions/:id', async (req, res) => {
  const { id } = req.params;
  const userId = req.query.user_id;

  try {
    if (userId) {
      await pool.query('DELETE FROM chat_sessions WHERE id = $1 AND user_id = $2', [id, userId]);
    } else {
      await pool.query('DELETE FROM chat_sessions WHERE id = $1', [id]);
    }
    res.json({ code: 0, data: { deleted: id } });
  } catch (err) {
    console.error('[Session] Delete error:', err);
    res.json({ code: 1, error: err.message });
  }
});

// Get single session
app.get('/api/sessions/:id', async (req, res) => {
  const { id } = req.params;
  const userId = req.query.user_id;

  try {
    const result = await pool.query(
      'SELECT * FROM chat_sessions WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    if (result.rows.length > 0) {
      res.json({ code: 0, data: result.rows[0] });
    } else {
      res.json({ code: 1, error: 'Session not found' });
    }
  } catch (err) {
    res.json({ code: 1, error: err.message });
  }
});

const PORT = 3102;
initTable().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Session] Server running on port ${PORT}`);
  });
});