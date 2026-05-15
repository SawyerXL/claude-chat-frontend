const MEMORY_KEY = 'claude_memory';

export interface MemoryEntry {
  id: string;
  fact: string;
  createdAt: number;
  updatedAt: number;
  category?: string;
}

export interface Memory {
  entries: MemoryEntry[];
  lastSync: number;
}

function loadMemory(): Memory {
  try {
    const stored = localStorage.getItem(MEMORY_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return { entries: [], lastSync: 0 };
}

function saveMemory(memory: Memory) {
  localStorage.setItem(MEMORY_KEY, JSON.stringify(memory));
}

export function getMemory(): Memory {
  return loadMemory();
}

export function addMemory(fact: string, category?: string): MemoryEntry {
  const memory = loadMemory();
  const entry: MemoryEntry = {
    id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    fact,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    category,
  };
  memory.entries.push(entry);
  memory.lastSync = Date.now();
  saveMemory(memory);
  return entry;
}

export function updateMemory(id: string, fact: string): boolean {
  const memory = loadMemory();
  const entry = memory.entries.find(e => e.id === id);
  if (entry) {
    entry.fact = fact;
    entry.updatedAt = Date.now();
    memory.lastSync = Date.now();
    saveMemory(memory);
    return true;
  }
  return false;
}

export function deleteMemory(id: string): boolean {
  const memory = loadMemory();
  const index = memory.entries.findIndex(e => e.id === id);
  if (index >= 0) {
    memory.entries.splice(index, 1);
    memory.lastSync = Date.now();
    saveMemory(memory);
    return true;
  }
  return false;
}

export function clearMemory(): void {
  saveMemory({ entries: [], lastSync: Date.now() });
}

// Format memory for API context
export function formatMemoryForContext(): string {
  const memory = loadMemory();
  if (memory.entries.length === 0) return '';

  const facts = memory.entries
    .map(e => `- ${e.fact}`)
    .join('\n');

  return `\n[Known facts about the user]\n${facts}\n`;
}