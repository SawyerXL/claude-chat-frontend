export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  model: string;
  createdAt: number;
  updatedAt: number;
  projectId?: string;
}

export interface ModelOption {
  id: string;
  name: string;
  description: string;
  badge?: string;
}

export interface Artifact {
  id: string;
  type: 'react' | 'html' | 'svg' | 'python' | 'html-react' | '_generative' | 'notebook';
  title: string;
  content: string;
  language?: string;
  code?: string;
  createdAt: number;
}

export interface Project {
  id: string;
  name: string;
  icon: string;
  color: string;
  createdAt: number;
  updatedAt: number;
}
