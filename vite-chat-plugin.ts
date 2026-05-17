import fs from 'node:fs';
import path from 'node:path';
import type { Plugin, Connect } from 'vite';

interface AppConfig {
  env: Record<string, string>;
}

function loadConfig(root: string): AppConfig {
  const configPath = path.resolve(root, 'config.json');
  if (!fs.existsSync(configPath)) {
    throw new Error(`config.json not found at ${configPath}`);
  }
  const raw = fs.readFileSync(configPath, 'utf-8');
  const parsed = JSON.parse(raw) as AppConfig;
  if (!parsed.env) throw new Error('config.json missing "env"');
  return parsed;
}

function ensureLogDir(root: string): string {
  const dir = path.resolve(root, 'logs');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function writeLog(logDir: string, entry: Record<string, unknown>) {
  const date = new Date();
  const day = date.toISOString().slice(0, 10);
  const file = path.join(logDir, `chat-${day}.log`);
  const line = JSON.stringify({ timestamp: date.toISOString(), ...entry }) + '\n';
  fs.appendFileSync(file, line, 'utf-8');
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

export default function chatApiPlugin(): Plugin {
  let config: AppConfig;
  let logDir: string;
  let projectRoot: string;

  return {
    name: 'chat-api-plugin',
    configResolved(resolved) {
      projectRoot = resolved.root;
      config = loadConfig(projectRoot);
      logDir = ensureLogDir(projectRoot);
      // eslint-disable-next-line no-console
      console.log(
        `[chat-api] config loaded: baseUrl=${config.env.ANTHROPIC_BASE_URL}, logs=${logDir}`,
      );
    },
    configureServer(server) {
      // 获取认证状态接口
      server.middlewares.use('/api/auth-status', async (req, res) => {
        if (req.method !== 'GET') {
          res.statusCode = 405;
          res.end('Method Not Allowed');
          return;
        }

        const token = config.env.ANTHROPIC_AUTH_TOKEN || '';
        const name = config.env.USER_NAME || '';
        const loggedIn = !!(token && name);

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ loggedIn, username: name }));
      });

      // 登出接口
      server.middlewares.use('/api/logout', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method Not Allowed');
          return;
        }

        const requestId = `logout-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        try {
          // 读取 config.json
          const configPath = path.resolve(projectRoot, 'config.json');
          const raw = fs.readFileSync(configPath, 'utf-8');
          const parsed = JSON.parse(raw) as AppConfig;

          // 仅清空 token，保留 USER_NAME
          parsed.env.ANTHROPIC_AUTH_TOKEN = '';
          fs.writeFileSync(configPath, JSON.stringify(parsed, null, 2), 'utf-8');

          // 同步更新内存中的 config
          config.env.ANTHROPIC_AUTH_TOKEN = '';

          writeLog(logDir, {
            requestId,
            type: 'logout',
            username: config.env.USER_NAME,
          });

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true }));
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          writeLog(logDir, { requestId, type: 'error', message });
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: '服务器错误' }));
        }
      });

      // 登录接口
      server.middlewares.use('/api/login', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method Not Allowed');
          return;
        }

        const requestId = `login-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        try {
          const body = (await readJson(req)) as { username?: string; password?: string };
          const { username, password } = body;

          if (!username || !password) {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: false, error: '请输入用户名和密码' }));
            return;
          }

          const baseUrl = config.env.ANTHROPIC_BASE_URL.replace(/\/$/, '');

          // Step 1: 登录获取 access_token
          writeLog(logDir, {
            requestId,
            type: 'login_request',
            username,
            baseUrl: `${baseUrl}/api/v1/auth/login`,
          });

          const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: username, password }),
          });

          const loginData = await loginRes.json() as { code?: number; data?: { access_token?: string }; message?: string };

          writeLog(logDir, {
            requestId,
            type: 'login_response',
            code: loginData.code,
            hasToken: !!loginData.data?.access_token,
          });

          if (loginData.code !== 0 || !loginData.data?.access_token) {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: false, error: loginData.message || '登录失败' }));
            return;
          }

          const accessToken = loginData.data.access_token;

          // Step 2: 获取 API Keys
          writeLog(logDir, {
            requestId,
            type: 'keys_request',
            baseUrl: `${baseUrl}/api/v1/keys`,
          });

          const keysRes = await fetch(`${baseUrl}/api/v1/keys?page=1&page_size=10&sort_by=created_at&sort_order=desc`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });

          const keysData = await keysRes.json() as { code?: number; data?: { items?: Array<{ key: string }> }; message?: string };

          writeLog(logDir, {
            requestId,
            type: 'keys_response',
            code: keysData.code,
            keyCount: keysData.data?.items?.length || 0,
          });

          if (keysData.code !== 0 || !keysData.data?.items?.length) {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: false, error: '未获取到 API Key' }));
            return;
          }

          const firstKey = keysData.data.items[0].key;

          // Step 3: 写入 config.json
          const configPath = path.resolve(projectRoot, 'config.json');
          const raw = fs.readFileSync(configPath, 'utf-8');
          const parsed = JSON.parse(raw) as AppConfig;
          parsed.env.ANTHROPIC_AUTH_TOKEN = firstKey;
          parsed.env.USER_NAME = username;
          fs.writeFileSync(configPath, JSON.stringify(parsed, null, 2), 'utf-8');

          // Step 4: 同步更新内存中的 config（关键！）
          config.env.ANTHROPIC_AUTH_TOKEN = firstKey;
          config.env.USER_NAME = username;

          writeLog(logDir, {
            requestId,
            type: 'config_updated',
            username,
            token: '***',
          });

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, username }));
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          writeLog(logDir, { requestId, type: 'error', message });
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: '服务器错误' }));
        }
      });

      // 聊天接口
      server.middlewares.use('/api/chat', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method Not Allowed');
          return;
        }
        const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        // 检查 token 是否为空
        const token = config.env.ANTHROPIC_AUTH_TOKEN;
        if (!token) {
          writeLog(logDir, { requestId, type: 'error', message: '未登录' });
          res.statusCode = 401;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: '未登录', requestId }));
          return;
        }

        try {
          const body = (await readJson(req)) as {
            model?: string;
            messages?: Array<{ role: string; content: string }>;
            system?: string;
            max_tokens?: number;
          };

          const payload = {
            model: body.model || 'claude-sonnet-4-6',
            max_tokens: body.max_tokens ?? 4096,
            messages: body.messages || [],
            ...(body.system ? { system: body.system } : {}),
          };

          const url = `${config.env.ANTHROPIC_BASE_URL.replace(/\/$/, '')}/v1/messages`;

          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01',
            Authorization: `Bearer ${config.env.ANTHROPIC_AUTH_TOKEN}`,
            'x-api-key': config.env.ANTHROPIC_AUTH_TOKEN,
          };
          if (config.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC) {
            headers['x-claude-code-disable-nonessential-traffic'] =
              config.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC;
          }
          if (config.env.CLAUDE_CODE_ATTRIBUTION_HEADER) {
            headers['x-claude-code-attribution'] =
              config.env.CLAUDE_CODE_ATTRIBUTION_HEADER;
          }

          writeLog(logDir, {
            requestId,
            type: 'request',
            url,
            method: 'POST',
            headers: { ...headers, Authorization: 'Bearer ***', 'x-api-key': '***' },
            body: payload,
          });

          const upstream = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
          });
          const text = await upstream.text();
          let json: unknown;
          try {
            json = JSON.parse(text);
          } catch {
            json = { raw: text };
          }

          writeLog(logDir, {
            requestId,
            type: 'response',
            status: upstream.status,
            ok: upstream.ok,
            body: json,
          });

          res.statusCode = upstream.status;
          res.setHeader('Content-Type', 'application/json');
          res.end(typeof json === 'string' ? json : JSON.stringify(json));
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          writeLog(logDir, { requestId, type: 'error', message });
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: message, requestId }));
        }
      });
    },
  };
}
