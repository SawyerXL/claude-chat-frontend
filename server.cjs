const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const vm = require('vm');
const https = require('https');
const http = require('http');

// Helper function for HTTP/HTTPS requests with redirect following
function fetchUrl(url, options = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const reqOptions = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Claude-WebSearch/1.0)',
        'Accept': options.accept || 'application/json, text/html, */*',
        ...options.headers,
      },
      timeout: 15000,
    };

    const req = lib.get(url, reqOptions, (res) => {
      // Handle 202 Accepted (DDG async response) - wait for data
      if (res.statusCode === 202) {
        console.log('[session-api] Received 202, waiting for data...');
      }

      // Follow redirects (but not for 202)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && res.statusCode !== 202) {
        console.log('[session-api] Redirecting to:', res.headers.location);
        fetchUrl(res.headers.location, options).then(resolve).catch(reject);
        return;
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

const app = express();
const PORT = 3102;

// PostgreSQL connection - Neon cloud database (same as sub2api)
const pool = new Pool({
  host: 'ep-fragrant-bread-ampy8m1v.c-5.us-east-1.aws.neon.tech',
  port: 5432,
  database: 'neondb',
  user: 'neondb_owner',
  password: 'npg_YDGTAMVZ32eS',
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Initialize table
pool.query(`
  CREATE TABLE IF NOT EXISTS chat_sessions (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(255) DEFAULT 'New Chat',
    messages JSONB DEFAULT '[]',
    model VARCHAR(64) DEFAULT 'sonnet-4-6',
    user_id VARCHAR(64) DEFAULT 'anonymous',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )
`).then(() => console.log('[session-api] Table ready')).catch(e => console.log('Table might already exist:', e.message));

// Get all sessions
app.get('/api/sessions', async (req, res) => {
  try {
    const userId = req.query.user_id || 'anonymous';
    const result = await pool.query(
      'SELECT id, title, messages, model, user_id, created_at, updated_at FROM chat_sessions WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 50',
      [userId]
    );
    const sessions = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      messages: typeof row.messages === 'string' ? JSON.parse(row.messages) : row.messages,
      model: row.model,
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
    }));
    res.json({ code: 0, data: sessions });
  } catch (err) {
    console.error('[session-api] Get sessions error:', err.message);
    res.json({ code: 1, error: err.message });
  }
});

// Save session
app.post('/api/sessions', async (req, res) => {
  try {
    const { id, title, messages, model, user_id } = req.body;
    if (!id) {
      return res.json({ code: 1, error: 'Missing session id' });
    }
    await pool.query(
      `INSERT INTO chat_sessions (id, title, messages, model, user_id, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (id) DO UPDATE SET
       title = EXCLUDED.title,
       messages = EXCLUDED.messages,
       model = EXCLUDED.model,
       user_id = COALESCE(EXCLUDED.user_id, 'anonymous'),
       updated_at = NOW()`,
      [id, title || 'New Chat', JSON.stringify(messages || []), model || 'sonnet-4-6', user_id || 'anonymous']
    );
    res.json({ code: 0, message: 'Session saved' });
  } catch (err) {
    console.error('[session-api] Save session error:', err.message);
    res.json({ code: 1, error: err.message });
  }
});

// Delete session
app.delete('/api/sessions/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM chat_sessions WHERE id = $1', [req.params.id]);
    res.json({ code: 0, message: 'Session deleted' });
  } catch (err) {
    console.error('[session-api] Delete session error:', err.message);
    res.json({ code: 1, error: err.message });
  }
});

// Code sandbox - execute JS code and return generated file
app.post('/api/sandbox/execute', async (req, res) => {
  try {
    const { code, format, filename } = req.body;
    if (!code || !format) {
      return res.json({ code: 1, error: 'Missing code or format' });
    }

    const XLSX = require('xlsx');
    const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');
    const pptxgen = require('pptxgenjs');
    const fs = require('fs');
    const path = require('path');

    const mimeTypes = {
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      pdf: 'application/pdf',
    };

    let defaultFilename = `generated_${Date.now()}.${format}`;

    // Sandbox context with proxy for sandbox.result
    const sandboxBase = {
      XLSX,
      docx: { Document, Packer, Paragraph, TextRun, HeadingLevel },
      pptxgen,
      console: {
        log: (...args) => console.log('[sandbox]', ...args),
        error: (...args) => console.error('[sandbox]', ...args),
      },
      __result: null,
      __outputFile: null,
    };

    // Override writeFile to capture the output path
    const origWriteFile = XLSX.writeFile.bind(XLSX);
    XLSX.writeFile = function(wb, fname, options) {
      sandboxBase.__outputFile = path.resolve('/tmp', fname.replace(/.*[\/\\]/, ''));
      return origWriteFile(wb, sandboxBase.__outputFile, options);
    };

    // Override for pptxgen writeFile
    const origPptxWrite = pptxgen.prototype.writeFile;
    pptxgen.prototype.writeFile = function(fname, options) {
      sandboxBase.__outputFile = path.resolve('/tmp', fname.replace(/.*[\/\\]/, ''));
      return origPptxWrite.call(this, sandboxBase.__outputFile, options);
    };

    // Proxy: sandbox.result reads/writes __result
    const sandboxProxy = new Proxy(sandboxBase, {
      get(target, prop) {
        if (prop === 'result') return target.__result;
        return target[prop];
      },
      set(target, prop, value) {
        if (prop === 'result') {
          target.__result = value;
          return true;
        }
        target[prop] = value;
        return true;
      }
    });

    // Wrap code in async IIFE
    const wrappedCode = '(async()=>{' + code + '\n})()';

    const script = new vm.Script(wrappedCode, { filename: 'sandbox.js' });
    const context = vm.createContext({
      XLSX: sandboxBase.XLSX,
      docx: sandboxBase.docx,
      pptxgen: sandboxBase.pptxgen,
      console: sandboxBase.console,
      sandbox: sandboxProxy,
    });

    let maybePromise;
    try {
      maybePromise = script.runInContext(context);
    } catch (execErr) {
      return res.json({ code: 1, error: `Execution error: ${execErr.message}` });
    }

    // Wait for async execution
    if (maybePromise && typeof maybePromise.then === 'function') {
      await maybePromise;
    }
    // Also handle if result itself was a promise
    if (sandboxBase.__result && typeof sandboxBase.__result.then === 'function') {
      sandboxBase.__result = await sandboxBase.__result;
    }

    // Get result buffer
    let buffer = null;
    if (sandboxBase.__result && Buffer.isBuffer(sandboxBase.__result)) {
      buffer = sandboxBase.__result;
    } else if (sandboxBase.__outputFile && fs.existsSync(sandboxBase.__outputFile)) {
      buffer = fs.readFileSync(sandboxBase.__outputFile);
      try { fs.unlinkSync(sandboxBase.__outputFile); } catch (e) {}
    }

    if (!buffer) {
      return res.json({ code: 1, error: `No result generated. Set sandbox.result = Buffer from generated file. Use docx.Packer.toBuffer(doc), XLSX.writeFile(wb, 'out.xlsx'), or pptxgen.writeFile('out.pptx').` });
    }

    res.json({
      code: 0,
      data: {
        buffer: buffer.toString('base64'),
        mimeType: mimeTypes[format] || 'application/octet-stream',
        filename: filename || defaultFilename,
      }
    });
  } catch (err) {
    console.error('[session-api] Sandbox error:', err.message);
    res.json({ code: 1, error: err.message });
  }
});

// Web search via DuckDuckGo + HTML fallback
app.get('/api/search', async (req, res) => {
  const query = req.query.q || '';
  if (!query) {
    return res.json({ code: 1, error: 'Query parameter "q" is required' });
  }

  try {
    const results = [];

    // Try 1: DuckDuckGo Instant Answer API (for well-known topics)
    const apiUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`;
    const apiResponse = await fetchUrl(apiUrl);

    if (apiResponse.data && apiResponse.data.length > 10) {
      try {
        const parsed = JSON.parse(apiResponse.data);

        // Add abstract as first result
        if (parsed.AbstractText) {
          results.push({
            title: parsed.Heading || query,
            url: parsed.AbstractURL || '',
            snippet: parsed.AbstractText.substring(0, 300)
          });
        }

        // Add related topics
        if (parsed.RelatedTopics && parsed.RelatedTopics.length > 0) {
          for (const topic of parsed.RelatedTopics.slice(0, 5)) {
            if (topic.Text && topic.FirstURL) {
              results.push({
                title: topic.Text.split(' - ')[0] || 'Related',
                url: topic.FirstURL,
                snippet: topic.Text.substring(0, 200)
              });
            }
          }
        }
      } catch (e) {
        console.log('[session-api] Failed to parse DDG API response');
      }
    }

    // Try 2: HTML scrape if no results from API
    if (results.length === 0) {
      const htmlUrl = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
      const htmlResponse = await fetchUrl(htmlUrl, { accept: 'text/html' });

      if (htmlResponse.data && htmlResponse.data.length > 100) {
        // Extract URLs from uddg parameters
        const seen = new Set();
        const uddgRegex = /uddg=([^&"]+)/gi;
        let match;
        while ((match = uddgRegex.exec(htmlResponse.data)) !== null && results.length < 8) {
          const url = decodeURIComponent(match[1]);
          if (url.startsWith('http') && !url.includes('duckduckgo') && !seen.has(url)) {
            seen.add(url);
            const domain = url.match(/https?:\/\/([^\/]+)/)?.[1] || url;
            results.push({
              title: domain.replace('www.', ''),
              url: url,
              snippet: ''
            });
          }
        }

        // Extract titles from links
        if (results.length < 3) {
          const linkRegex = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([^<]{10,80})<\/a>/gi;
          while ((match = linkRegex.exec(htmlResponse.data)) !== null && results.length < 8) {
            const url = match[1];
            const title = match[2].replace(/<[^>]+>/g, '').trim();
            if (!url.includes('duckduckgo') && !seen.has(url) && title.length > 10) {
              seen.add(url);
              results.push({ title, url, snippet: '' });
            }
          }
        }
      }
    }

    res.json({
      code: 0,
      data: {
        query,
        results: results.slice(0, 10),
        count: results.length,
        source: results.length > 0 ? 'duckduckgo' : 'none'
      }
    });
  } catch (err) {
    console.error('[session-api] Search error:', err.message);
    res.json({ code: 1, error: err.message });
  }
});

// Get full page content for citation
app.get('/api/search/citation', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.json({ code: 1, error: 'URL parameter required' });
  }

  try {
    const response = await fetchUrl(url, { accept: 'text/html' });
    if (!response.data || response.data.length < 100) {
      return res.json({ code: 1, error: 'Failed to fetch page' });
    }

    // Extract main content (simple text extraction)
    let text = response.data
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Limit to first 5000 chars
    text = text.substring(0, 5000);

    res.json({ code: 0, data: { url, text } });
  } catch (err) {
    res.json({ code: 1, error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[session-api] Server running on port ${PORT}, connected to Neon PostgreSQL`);
});