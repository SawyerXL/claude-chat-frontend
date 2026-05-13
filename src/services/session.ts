import type { ChatSession } from '../types';

const ENDPOINT = '/api/sessions';

export async function getSessions(): Promise<ChatSession[]> {
  const response = await fetch(ENDPOINT);
  if (!response.ok) {
    throw new Error(`Failed to load sessions: ${response.status}`);
  }
  const data = (await response.json()) as { sessions: ChatSession[] };
  const list = data.sessions ?? [];
  return list.slice().sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveSession(session: ChatSession): Promise<void> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session }),
  });
  if (!response.ok) {
    throw new Error(`Failed to save session: ${response.status}`);
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  const response = await fetch(`${ENDPOINT}?id=${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Failed to delete session: ${response.status}`);
  }
}
