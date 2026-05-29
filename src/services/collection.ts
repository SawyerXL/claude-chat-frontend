import type { Collection } from '../types';

const COLLECTIONS_KEY = 'claude_collections';

export function getCollections(): Collection[] {
  try {
    const data = localStorage.getItem(COLLECTIONS_KEY);
    if (!data) return [];
    return JSON.parse(data) as Collection[];
  } catch {
    return [];
  }
}

export function saveCollections(collections: Collection[]): void {
  localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collections));
}

export function createCollection(name: string, icon: string = '📂', color: string = '#8b5cf6'): Collection {
  const now = Date.now();
  return {
    id: `collection-${now}`,
    name,
    icon,
    color,
    createdAt: now,
    updatedAt: now,
  };
}

export function updateCollection(collection: Collection): void {
  const collections = getCollections();
  const idx = collections.findIndex(c => c.id === collection.id);
  if (idx >= 0) {
    collections[idx] = { ...collection, updatedAt: Date.now() };
    saveCollections(collections);
  }
}

export function deleteCollection(collectionId: string): void {
  const collections = getCollections().filter(c => c.id !== collectionId);
  saveCollections(collections);
}

export function getSessionCollectionId(sessionId: string): string | null {
  try {
    const key = `claude_session_collection_${sessionId}`;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setSessionCollectionId(sessionId: string, collectionId: string | null): void {
  const key = `claude_session_collection_${sessionId}`;
  if (collectionId) {
    localStorage.setItem(key, collectionId);
  } else {
    localStorage.removeItem(key);
  }
}

export function getSessionsInCollection(collectionId: string): string[] {
  try {
    const key = `claude_collection_sessions_${collectionId}`;
    const data = localStorage.getItem(key);
    if (!data) return [];
    return JSON.parse(data) as string[];
  } catch {
    return [];
  }
}

export function addSessionToCollection(collectionId: string, sessionId: string): void {
  const sessions = getSessionsInCollection(collectionId);
  if (!sessions.includes(sessionId)) {
    sessions.push(sessionId);
    const key = `claude_collection_sessions_${collectionId}`;
    localStorage.setItem(key, JSON.stringify(sessions));
  }
  setSessionCollectionId(sessionId, collectionId);
}

export function removeSessionFromCollection(collectionId: string, sessionId: string): void {
  const sessions = getSessionsInCollection(collectionId).filter(id => id !== sessionId);
  const key = `claude_collection_sessions_${collectionId}`;
  localStorage.setItem(key, JSON.stringify(sessions));
  setSessionCollectionId(sessionId, null);
}

export function onSessionDeleted(sessionId: string): void {
  const collectionId = getSessionCollectionId(sessionId);
  if (collectionId) {
    removeSessionFromCollection(collectionId, sessionId);
  }
}