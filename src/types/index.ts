export interface Attachment {
  name: string;
  type: string;
  content: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thinking?: string;
  timestamp: number;
  attachments?: Attachment[];
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  model: string;
  createdAt: number;
  updatedAt: number;
  projectId?: string;
  pinned?: boolean;      // 置顶会话
  starred?: boolean;     // 星标会话
  archived?: boolean;   // 归档会话
}

export interface ModelOption {
  id: string;
  name: string;
  description: string;
  badge?: string;
}

export interface ModelSettings {
  temperature: number;  // 0.0 - 1.0
  topP: number;        // 0.0 - 1.0
  topK: number;        // 1 - 100
  maxTokens: number;   // 1 - 8192
}

export const DEFAULT_MODEL_SETTINGS: ModelSettings = {
  temperature: 0.7,
  topP: 0.9,
  topK: 40,
  maxTokens: 4096,
};

export interface Artifact {
  id: string;
  type: 'react' | 'html' | 'svg' | 'python' | 'html-react' | '_generative' | 'notebook' | 'table';
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

export interface PromptTemplate {
  id: string;
  name: string;
  content: string;
  icon: string;
  category: string;
  createdAt: number;
  updatedAt: number;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'document' | 'coding' | 'design' | 'analysis' | 'tools';
  activationKeywords: string[];
  systemPrompt: string;
  capabilities: string[];
  requiresFileUpload?: boolean;
  isOfficial?: boolean;
}

export interface Collection {
  id: string;
  name: string;
  icon: string;
  color: string;
  createdAt: number;
  updatedAt: number;
}
