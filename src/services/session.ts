import type { ChatSession } from '../types';

interface SessionsResponse {
  sessions: ChatSession[];
}

export async function getSessions(): Promise<ChatSession[]> {
  const response = await fetch('/api/sessions');
  if (!response.ok) {
    throw new Error(`Failed to load sessions: ${response.status}`);
  }
  const data = (await response.json()) as SessionsResponse;
  return data.sessions;
}

export async function saveSession(session: ChatSession): Promise<void> {
  const response = await fetch('/api/sessions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ session }),
  });
  if (!response.ok) {
    throw new Error(`Failed to save session: ${response.status}`);
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  const response = await fetch(`/api/sessions?id=${sessionId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Failed to delete session: ${response.status}`);
  }
}
