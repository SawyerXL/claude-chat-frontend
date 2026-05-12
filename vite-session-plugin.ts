import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { promisify } from 'node:util';
import type { Plugin, Connect } from 'vite';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  model: string;
  createdAt: number;
  updatedAt: number;
}

interface SessionsData {
  sessions: ChatSession[];
}

function ensureDataDir(root: string): string {
  const dir = path.resolve(root, 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function loadSessions(dataDir: string): Promise<SessionsData> {
  const filePath = path.join(dataDir, 'sessions.json.gz');
  if (!fs.existsSync(filePath)) {
    return { sessions: [] };
  }
  try {
    const compressed = fs.readFileSync(filePath);
    const decompressed = await gunzip(compressed);
    return JSON.parse(decompressed.toString('utf-8')) as SessionsData;
  } catch (err) {
    console.error('[session-api] Failed to load sessions:', err);
    return { sessions: [] };
  }
}

async function saveSessions(dataDir: string, data: SessionsData): Promise<void> {
  const filePath = path.join(dataDir, 'sessions.json.gz');
  const json = JSON.stringify(data, null, 2);
  const compressed = await gzip(Buffer.from(json, 'utf-8'));
  fs.writeFileSync(filePath, compressed);
}

async function readJson(req: Connect.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf-8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

export default function sessionApiPlugin(): Plugin {
  let dataDir: string;
  let projectRoot: string;

  return {
    name: 'session-api-plugin',
    configResolved(resolved) {
      projectRoot = resolved.root;
      dataDir = ensureDataDir(projectRoot);
      console.log(`[session-api] data directory: ${dataDir}`);
    },
    configureServer(server) {
      server.middlewares.use('/api/sessions', async (req, res) => {
        try {
          if (req.method === 'GET') {
            const data = await loadSessions(dataDir);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
          } else if (req.method === 'POST') {
            const body = (await readJson(req)) as { session: ChatSession };
            const data = await loadSessions(dataDir);
            const existingIndex = data.sessions.findIndex(s => s.id === body.session.id);
            if (existingIndex >= 0) {
              data.sessions[existingIndex] = body.session;
            } else {
              data.sessions.unshift(body.session);
            }
            await saveSessions(dataDir, data);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true }));
          } else if (req.method === 'DELETE') {
            const url = new URL(req.url || '', `http://${req.headers.host}`);
            const sessionId = url.searchParams.get('id');
            if (!sessionId) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Missing session id' }));
              return;
            }
            const data = await loadSessions(dataDir);
            data.sessions = data.sessions.filter(s => s.id !== sessionId);
            await saveSessions(dataDir, data);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true }));
          } else {
            res.statusCode = 405;
            res.end('Method Not Allowed');
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error('[session-api] Error:', message);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: message }));
        }
      });
    },
  };
}
