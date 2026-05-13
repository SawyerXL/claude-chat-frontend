import type { ChatSession } from '../types';

const SESSIONS_KEY = 'claude_sessions';

function getSessionsFromStorage(): ChatSession[] {
  try {
    const data = localStorage.getItem(SESSIONS_KEY);
    if (!data) return [];
    return JSON.parse(data) as ChatSession[];
  } catch {
    return [];
  }
}

function saveSessionsToStorage(sessions: ChatSession[]): void {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

export async function getSessions(): Promise<ChatSession[]> {
  return getSessionsFromStorage();
}

export async function saveSession(session: ChatSession): Promise<void> {
  const sessions = getSessionsFromStorage();
  const existingIndex = sessions.findIndex(s => s.id === session.id);
  
  if (existingIndex >= 0) {
    sessions[existingIndex] = session;
  } else {
    sessions.unshift(session);
  }
  
  saveSessionsToStorage(sessions);
}

export async function deleteSession(sessionId: string): Promise<void> {
  const sessions = getSessionsFromStorage();
  const filtered = sessions.filter(s => s.id !== sessionId);
  saveSessionsToStorage(filtered);
}