import type { ChatSession } from '../types';


const SESSIONS_KEY = 'claude_sessions';

function getSessionsFromStorage(): ChatSession[] {
  try {
    const data = localStorage.getItem(SESSIONS_KEY);
    if (!data) {
      console.log('[session] No sessions in localStorage');
      return [];
    }
    const sessions = JSON.parse(data) as ChatSession[];
    console.log('[session] Loaded sessions from localStorage:', sessions.length);
    return sessions;
  } catch (err) {
    console.error('[session] Error loading sessions:', err);
    return [];
  }
}

function saveSessionsToStorage(sessions: ChatSession[]): void {
  console.log('[session] Saving sessions to localStorage:', sessions.length);
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

export async function getSessions(): Promise<ChatSession[]> {
  return getSessionsFromStorage();
}

export async function saveSession(session: ChatSession): Promise<void> {
  console.log('[session] saveSession called:', session.title);
  const sessions = getSessionsFromStorage();
  const existingIndex = sessions.findIndex(s => s.id === session.id);
  
  if (existingIndex >= 0) {
    sessions[existingIndex] = session;
    console.log('[session] Updated existing session');
  } else {
    sessions.unshift(session);
    console.log('[session] Added new session');
 main
  }
  
  saveSessionsToStorage(sessions);
}

export async function deleteSession(sessionId: string): Promise<void> {

  console.log('[session] deleteSession called:', sessionId);
  const sessions = getSessionsFromStorage();
  const filtered = sessions.filter(s => s.id !== sessionId);
  saveSessionsToStorage(filtered);
}
main
