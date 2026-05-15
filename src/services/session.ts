import type { ChatSession } from '../types';

const SESSIONS_KEY = 'claude_sessions';
const USER_ID_KEY = 'claude_user_id';

function getUserId(): string {
  let userId = localStorage.getItem(USER_ID_KEY);
  if (!userId) {
    userId = 'user-' + Math.random().toString(36).substring(2, 10);
    localStorage.setItem(USER_ID_KEY, userId);
  }
  return userId;
}

function getSessionsFromStorage(): ChatSession[] {
  try {
    const data = localStorage.getItem(SESSIONS_KEY);
    if (!data) return [];
    return JSON.parse(data) as ChatSession[];
  } catch (err) {
    console.error('[session] Error loading local sessions:', err);
    return [];
  }
}

function saveSessionsToStorage(sessions: ChatSession[]): void {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
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

export async function getSessions(): Promise<ChatSession[]> {
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
  const local = getSessionsFromStorage();
  const filtered = local.filter(s => s.id !== sessionId);
  saveSessionsToStorage(filtered);

  try {
    await fetch(`/session-api/api/sessions/${sessionId}`, { method: 'DELETE' });
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