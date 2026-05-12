import type { ChatSession } from '../types';

interface ConversationRow {
  id: string;
  title: string;
  messages: string;
  model: string;
  created_at: string;
  updated_at: string;
}

function getAuthToken(): string | null {
  return localStorage.getItem('claude_auth_token');
}

export async function getSessions(): Promise<ChatSession[]> {
  const token = getAuthToken();
  if (!token) return [];

  const response = await fetch('/chat-api/conversations', {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      // Unauthorized - clear token and return empty
      localStorage.removeItem('claude_auth_token');
      return [];
    }
    throw new Error(`Failed to load sessions: ${response.status}`);
  }

  const data = (await response.json()) as { conversations: ConversationRow[] };
  return data.conversations.map(conv => ({
    id: conv.id,
    title: conv.title || 'New chat',
    messages: typeof conv.messages === 'string' ? JSON.parse(conv.messages) : (conv.messages || []),
    model: conv.model || 'sonnet-4-6',
    createdAt: new Date(conv.created_at).getTime(),
    updatedAt: new Date(conv.updated_at).getTime(),
  }));
}

export async function saveSession(session: ChatSession): Promise<void> {
  const token = getAuthToken();
  if (!token) return;

  const response = await fetch('/chat-api/conversations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      id: session.id,
      title: session.title,
      messages: session.messages,
      model: session.model,
      created_at: new Date(session.createdAt).toISOString(),
      updated_at: new Date(session.updatedAt).toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to save session: ${response.status}`);
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  const token = getAuthToken();
  if (!token) return;

  const response = await fetch(`/chat-api/conversations/${sessionId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to delete session: ${response.status}`);
  }
}
