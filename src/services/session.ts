import type { ChatSession } from '../types';

const SESSIONS_KEY = 'claude_sessions';

// 获取当前登录用户的 ID（从登录服务保存的用户信息中获取）
function getUserId(): string {
  // 首先尝试从登录服务获取用户 ID
  const userData = localStorage.getItem('claude_user');
  if (userData) {
    try {
      const user = JSON.parse(userData);
      if (user?.id) {
        return 'user_' + user.id;
      }
      if (user?.email) {
        return 'user_' + user.email.replace(/[^a-zA-Z0-9]/g, '_');
      }
    } catch {
      // 解析失败
    }
  }
  
  // 如果没有登录用户，返回空字符串（让服务器处理）
  return '';
}

function getSessionsFromStorage(): ChatSession[] {
  // 本地存储现在按用户隔离
  const userId = getUserId();
  if (!userId) return [];
  
  const storageKey = `${SESSIONS_KEY}_${userId}`;
  try {
    const data = localStorage.getItem(storageKey);
    if (!data) return [];
    return JSON.parse(data) as ChatSession[];
  } catch (err) {
    console.error('[session] Error loading sessions:', err);
    return [];
  }
}

function saveSessionsToStorage(sessions: ChatSession[]): void {
  const userId = getUserId();
  if (!userId) return;
  
  const storageKey = `${SESSIONS_KEY}_${userId}`;
  localStorage.setItem(storageKey, JSON.stringify(sessions));
}

function mergeSessions(local: ChatSession[], remote: ChatSession[]): ChatSession[] {
  const merged = new Map<string, ChatSession>();

  // Add all remote sessions
  for (const s of remote) {
    merged.set(s.id, s);
  }

  // Merge local sessions (local takes precedence for same ID, but update timestamp)
  for (const s of local) {
    const existing = merged.get(s.id);
    if (existing) {
      // Use the one with the latest update
      merged.set(s.id, new Date(s.updatedAt) > new Date(existing.updatedAt) ? s : existing);
    } else {
      merged.set(s.id, s);
    }
  }

  return Array.from(merged.values()).sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

// 获取本地会话（快速，不走网络）
export function getSessionsLocal(): ChatSession[] {
  return getSessionsFromStorage();
}

// 异步刷新服务器会话（不阻塞，返回合并结果）
export async function refreshSessionsFromServer(): Promise<ChatSession[]> {
  const userId = getUserId();
  const local = getSessionsFromStorage();

  try {
    const res = await fetch(`/session-api/api/sessions?user_id=${encodeURIComponent(userId)}`);
    const json = await res.json();

    if (json.code === 0 && Array.isArray(json.data)) {
      const merged = mergeSessions(local, json.data);
      saveSessionsToStorage(merged);
      return merged;
    }
  } catch (err) {
    console.error('[session] Failed to fetch from server, using local:', err);
  }

  return local;
}

// 兼容旧接口，内部使用快速版本
export async function getSessions(): Promise<ChatSession[]> {
  // 先返回本地数据（快速），后台再刷新服务器数据
  const local = getSessionsFromStorage();
  
  // 异步刷新（不等待）
  refreshSessionsFromServer().catch(() => {});
  
  return local;
}

export async function saveSession(session: ChatSession): Promise<void> {
  const userId = getUserId();
  const local = getSessionsFromStorage();
  const existingIndex = local.findIndex(s => s.id === session.id);

  if (existingIndex >= 0) {
    local[existingIndex] = session;
  } else {
    local.unshift(session);
  }
  saveSessionsToStorage(local);

  try {
    const payload = {
      ...session,
      user_id: userId,
    };
    const res = await fetch('/session-api/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (json.code === 0) {
      console.log('[session] Synced to server');
    } else {
      console.error('[session] Server sync failed:', json.error);
    }
  } catch (err) {
    console.error('[session] Failed to sync to server:', err);
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  const userId = getUserId();
  const storageKey = `${SESSIONS_KEY}_${userId}`;
  const local = getSessionsFromStorage();
  const filtered = local.filter(s => s.id !== sessionId);
  localStorage.setItem(storageKey, JSON.stringify(filtered));

  try {
    await fetch(`/session-api/api/sessions/${sessionId}?user_id=${encodeURIComponent(userId)}`, { method: 'DELETE' });
    console.log('[session] Deleted from server');
  } catch (err) {
    console.error('[session] Failed to delete from server:', err);
  }
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  count: number;
  source: string;
}

export async function searchWeb(query: string): Promise<SearchResponse | null> {
  try {
    const res = await fetch(`/session-api/api/search?q=${encodeURIComponent(query)}`);
    const json = await res.json();
    if (json.code === 0 && json.data) {
      return json.data;
    }
    throw new Error(json.error || 'Search failed');
  } catch (err) {
    console.error('[session] Search error:', err);
    throw err;
  }
}

export async function fetchCitation(url: string): Promise<{ url: string; text: string } | null> {
  try {
    const res = await fetch(`/session-api/api/search/citation?url=${encodeURIComponent(url)}`);
    const json = await res.json();
    if (json.code === 0 && json.data) {
      return json.data;
    }
    throw new Error(json.error || 'Failed to fetch citation');
  } catch (err) {
    console.error('[session] Citation error:', err);
    throw err;
  }
}

export async function executeSandbox(code: string, format: string, filename?: string): Promise<{
  buffer: string;
  mimeType: string;
  filename: string;
} | null> {
  try {
    const res = await fetch('/session-api/api/sandbox/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, format, filename }),
    });
    const json = await res.json();
    if (json.code === 0 && json.data) {
      return json.data;
    }
    throw new Error(json.error || 'Sandbox execution failed');
  } catch (err) {
    console.error('[sandbox] Execution error:', err);
    throw err;
  }
}