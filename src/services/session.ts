import type { ChatSession, ChatMessage } from '../types';

// SESSIONS_KEY 仅用于本地缓存（可选）
export const SESSIONS_KEY = 'claude_sessions';

// File cache configuration
const FILE_CACHE_THRESHOLD = 10 * 1024; // 10KB - cache files larger than this
const MAX_MESSAGES_FOR_API = 50; // Max messages to return for API call

// Sync Manager - handles cross-device and cross-tab synchronization
class SessionSyncManager {
  private syncInterval = 5000; // 5秒轮询
  private timer: number | null = null;
  private listeners: Set<() => void> = new Set();
  private lastKnownSessions: string = '';
  private recentlyDeletedIds: Set<string> = new Set();

  constructor() {
    this.setupStorageListener();
  }

  markDeleted(sessionId: string): void {
    this.recentlyDeletedIds.add(sessionId);
    setTimeout(() => this.recentlyDeletedIds.delete(sessionId), 30000);
  }

  private setupStorageListener(): void {
    window.addEventListener('storage', (e) => {
      if (e.key === 'claude_session_sync' && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          if (data.userId === getUserId()) {
            this.notifyListeners();
          }
        } catch {}
      }
    });
  }

  broadcast(): void {
    const userId = getUserId();
    if (!userId) return;
    localStorage.setItem('claude_session_sync', JSON.stringify({
      userId,
      timestamp: Date.now()
    }));
  }

  subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    this.listeners.forEach(cb => cb());
  }

  getUserId(): string {
    const userData = localStorage.getItem('claude_user');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        if (user?.id) return 'user_' + user.id;
      } catch {}
    }
    return '';
  }

  // Cache file content and return file reference
  async cacheFile(fileName: string, fileType: string, content: string): Promise<string | null> {
    const userId = this.getUserId();
    if (!userId) return null;

    const size = Buffer.byteLength(content, 'utf8');
    if (size < FILE_CACHE_THRESHOLD) {
      // File is small, don't cache
      return null;
    }

    try {
      const fileId = `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const hash = await this.computeHash(content);
      
      const res = await fetch('/session-api/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: fileId,
          user_id: userId,
          file_name: fileName,
          file_type: fileType,
          content,
          hash
        })
      });

      const json = await res.json();
      if (json.code === 0) {
        console.log(`[session] Cached file ${fileId} (${size} bytes)`);
        return fileId;
      }
    } catch (err) {
      console.error('[session] Failed to cache file:', err);
    }
    return null;
  }

  private async computeHash(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Convert attachments to file references
  async processAttachments(messages: ChatMessage[]): Promise<ChatMessage[]> {
    const processedMessages: ChatMessage[] = [];

    for (const msg of messages) {
      if (!msg.attachments || msg.attachments.length === 0) {
        processedMessages.push(msg);
        continue;
      }

      const processedAttachments: any[] = [];
      
      for (const att of msg.attachments) {
        // Try to cache the file
        const fileId = await this.cacheFile(att.name, att.type, att.content);
        
        if (fileId) {
          // Replace content with reference
          processedAttachments.push({
            name: att.name,
            type: att.type,
            fileId, // Reference to cached file instead of content
            isReference: true
          });
        } else {
          // Keep original content for small files
          processedAttachments.push(att);
        }
      }

      processedMessages.push({
        ...msg,
        attachments: processedAttachments
      });
    }

    return processedMessages;
  }

  async fetchSessions(): Promise<ChatSession[]> {
    const userId = this.getUserId();
    if (!userId) return [];

    try {
      const url = `/session-api/api/sessions?user_id=${encodeURIComponent(userId)}`;
      const res = await fetch(url);
      const json = await res.json();

      if (json.code === 0 && Array.isArray(json.data)) {
        const sessions = json.data.map((s: any) => ({
          id: s.id,
          title: s.title || 'New Chat',
          messages: s.messages || [],
          model: s.model,
          messageCount: s.message_count,
          createdAt: s.created_at,
          updatedAt: s.updated_at,
        }));

        return sessions.filter((s: ChatSession) => !this.recentlyDeletedIds.has(s.id));
      }
    } catch (err) {
      console.error('[session] Failed to fetch sessions:', err);
    }

    return [];
  }

  // Fetch session for API call (with truncated messages)
  async fetchSessionForApi(sessionId: string): Promise<ChatSession | null> {
    const userId = this.getUserId();
    if (!userId) return null;

    try {
      const url = `/session-api/api/sessions/${sessionId}?user_id=${encodeURIComponent(userId)}&for_api=true`;
      const res = await fetch(url);
      const json = await res.json();

      if (json.code === 0 && json.data) {
        const session = json.data;
        return {
          id: session.id,
          title: session.title || 'New Chat',
          messages: session.messages || [],
          model: session.model,
          createdAt: session.created_at,
          updatedAt: session.updated_at,
        };
      }
    } catch (err) {
      console.error('[session] Failed to fetch session for API:', err);
    }

    return null;
  }

  async saveSessionToServer(session: ChatSession): Promise<boolean> {
    const userId = this.getUserId();
    if (!userId) return false;

    try {
      // Process attachments before saving
      const processedMessages = await this.processAttachments(session.messages || []);

      const payload = {
        id: session.id,
        user_id: userId,
        title: session.title || 'New Chat',
        messages: processedMessages,
        model: session.model,
      };

      const res = await fetch('/session-api/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (json.code === 0) {
        this.broadcast();
        return true;
      } else {
        console.error('[session] Save failed:', json.error);
      }
    } catch (err) {
      console.error('[session] Save error:', err);
    }

    return false;
  }

  async deleteSessionFromServer(sessionId: string): Promise<void> {
    this.markDeleted(sessionId);
    const userId = this.getUserId();
    if (!userId) return;

    try {
      await fetch(`/session-api/api/sessions/${sessionId}?user_id=${encodeURIComponent(userId)}`, {
        method: 'DELETE'
      });
      this.broadcast();
    } catch (err) {
      console.error('[session] Delete error:', err);
    }
  }

  startPolling(callback: () => void): void {
    if (this.timer) return;

    const poll = async () => {
      try {
        const sessions = await this.fetchSessions();
        const currentHash = JSON.stringify(sessions.map(s => ({ id: s.id, updatedAt: s.updatedAt })));

        if (currentHash !== this.lastKnownSessions) {
          this.lastKnownSessions = currentHash;
          callback();
        }
      } catch (err) {
        console.error('[session] Poll error:', err);
      }
    };

    poll();
    this.timer = window.setInterval(poll, this.syncInterval);
  }

  stopPolling(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

// Singleton instance
const syncManager = new SessionSyncManager();

function getUserId(): string {
  return syncManager.getUserId();
}

export async function getSessions(): Promise<ChatSession[]> {
  return syncManager.fetchSessions();
}

export async function saveSession(session: ChatSession): Promise<void> {
  await syncManager.saveSessionToServer(session);
  window.dispatchEvent(new CustomEvent('sessions-updated'));
}

export async function deleteSession(sessionId: string): Promise<void> {
  await syncManager.deleteSessionFromServer(sessionId);
  window.dispatchEvent(new CustomEvent('sessions-updated'));
}

export function markSessionDeleted(sessionId: string): void {
  syncManager.markDeleted(sessionId);
}

export async function refreshSessionsFromServer(): Promise<ChatSession[]> {
  return getSessions();
}

export function startSessionSync(callback: () => void): () => void {
  syncManager.startPolling(callback);
  return () => syncManager.stopPolling();
}

export function subscribeToSessionChanges(callback: () => void): () => void {
  return syncManager.subscribe(callback);
}

// Fetch session for API call (with truncation)
export async function fetchSessionForApi(sessionId: string): Promise<ChatSession | null> {
  return syncManager.fetchSessionForApi(sessionId);
}

// Web Search
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
    if (json.code === 0 && json.data) return json.data;
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
    if (json.code === 0 && json.data) return json.data;
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
    if (json.code === 0 && json.data) return json.data;
    throw new Error(json.error || 'Sandbox execution failed');
  } catch (err) {
    console.error('[sandbox] Execution error:', err);
    throw err;
  }
}