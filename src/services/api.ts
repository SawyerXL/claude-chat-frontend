import type { ChatMessage, ModelSettings } from '../types';
import { formatMemoryForContext } from './memory';
import { generateSkillsSystemPrompt } from '../skills/registry';

export interface ThinkingBlock {
  thinking: string;
}

export type StreamChunk =
  | { type: 'text'; content: string }
  | { type: 'thinking'; thinking: string };

export type ApiContent = string | Array<{
  type: 'text' | 'image';
  text?: string;
  source?: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}>;

export interface ApiMessage {
  role: 'user' | 'assistant';
  content: ApiContent;
}

export interface ChatRequest {
  model: string;
  messages: ApiMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
}

export interface ChatResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{
    type: string;
    text?: string;
    thinking?: string;
  }>;
  model: string;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Convert ChatMessage to API format with images/attachments
 */
function toApiMessage(m: ChatMessage): ApiMessage {
  if (!m.attachments || m.attachments.length === 0) {
    return { role: m.role, content: m.content };
  }

  const content: ApiContent = [];

  if (m.content.trim()) {
    content.push({ type: 'text', text: m.content });
  }

  for (const att of m.attachments) {
    if (att.type.startsWith('image/')) {
      const base64Data = att.content.split(',')[1] || att.content;
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: att.type,
          data: base64Data,
        },
      });
    } else {
      // For non-image files, include as text block with content
      content.push({
        type: 'text',
        text: `[File: ${att.name}]\n\`\`\`\n${att.content}\n\`\`\``,
      });
    }
  }

  return { role: m.role, content };
}

const CUSTOM_INSTRUCTIONS_KEY = 'claude_custom_instructions';

function loadCustomInstructions(): { background: string; preferences: string } {
  try {
    const stored = localStorage.getItem(CUSTOM_INSTRUCTIONS_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return { background: '', preferences: '' };
}

/**
 * Send chat message with streaming SSE
 */
export async function* sendChatMessageStream(
  messages: ChatMessage[],
  model: string,
  signal?: AbortSignal,
  settings?: Partial<ModelSettings>,
): AsyncGenerator<StreamChunk, void, unknown> {
  // Load custom instructions and memory
  const customInstructions = loadCustomInstructions();
  const memoryContext = formatMemoryForContext();
  const skillsContext = generateSkillsSystemPrompt();
  let apiMessages: ApiMessage[] = messages.map(toApiMessage);

  // Prepend system message with model info
  const modelDisplayName = model.replace('claude-', '');
  const systemPrompt = `[System Info] You are running on model: ${modelDisplayName}. When user asks what model you are, respond with: "当前模型: ${modelDisplayName}"${memoryContext ? '\n\n' + memoryContext : ''}${skillsContext}`;

  // Prepend memory context to first user message
  if (memoryContext) {
    const firstUserIndex = apiMessages.findIndex(m => m.role === 'user');
    if (firstUserIndex >= 0) {
      const firstUser = apiMessages[firstUserIndex];
      const originalContent = typeof firstUser.content === 'string' ? firstUser.content : '';
      apiMessages[firstUserIndex] = {
        ...firstUser,
        content: `${systemPrompt}\n\n[User Request]\n${originalContent}`,
      };
    }
  } else {
    apiMessages.unshift({
      role: 'user' as const,
      content: systemPrompt,
    });
  }

  // Prepend custom instructions to first user message
  if (customInstructions.background || customInstructions.preferences) {
    const instructionParts = [];
    if (customInstructions.background) {
      instructionParts.push(`Background:\n${customInstructions.background}`);
    }
    if (customInstructions.preferences) {
      instructionParts.push(`Preferences:\n${customInstructions.preferences}`);
    }
    const instructionText = instructionParts.join('\n\n');

    // Find first user message and prepend instructions
    const firstUserIndex = apiMessages.findIndex(m => m.role === 'user');
    if (firstUserIndex >= 0) {
      const firstUser = apiMessages[firstUserIndex];
      const originalContent = typeof firstUser.content === 'string' ? firstUser.content : '';
      apiMessages[firstUserIndex] = {
        ...firstUser,
        content: `[System Instructions]\n${instructionText}\n\n[User Request]\n${originalContent}`,
      };
    }
  }

  // Load settings from localStorage if not provided
  const modelSettings: ModelSettings = settings || JSON.parse(localStorage.getItem('claude_model_settings') || '{"temperature":0.7,"topP":0.9,"topK":40,"maxTokens":4096}');

  // Newer Claude 4 models (opus-4-6, opus-4-7, sonnet-4-6) don't support temperature parameter
  const newModelsNoTemp = ['claude-opus-4-7', 'claude-opus-4-6', 'claude-sonnet-4-6'];
  const useTempParams = !newModelsNoTemp.includes(model);

  // Build request body - only include temperature/top_p for older models
  // opus-4-7 requires thinking.type: "adaptive", other models use "enabled"
  const thinkingType = model === 'claude-opus-4-7' ? 'adaptive' : 'enabled';
  const requestBody: ChatRequest & { stream?: boolean; thinking?: { type: string; budget_tokens?: number }; output_config?: { effort?: string } } = {
    model,
    messages: apiMessages,
    // max_tokens must be > thinking.budget_tokens (8000), ensure at least 10000
    max_tokens: Math.max(modelSettings.maxTokens || 16000, 10000),
    stream: true,
    // 启用扩展思考（Claude 4 模型支持）
    thinking: thinkingType === 'enabled' ? {
      type: 'enabled',
      budget_tokens: 8000,
    } : undefined,
    ...(thinkingType === 'adaptive' ? { output_config: { effort: 'medium' } } : {}),
  };

  if (useTempParams) {
    // Only add temperature if not 0.7 (default) to minimize params
    if (modelSettings.temperature !== undefined && modelSettings.temperature !== 0.7) {
      requestBody.temperature = modelSettings.temperature;
    }
    if (modelSettings.topP !== undefined && modelSettings.topP !== 0.9) {
      requestBody.top_p = modelSettings.topP;
    }
    if (modelSettings.topK !== undefined && modelSettings.topK !== 40) {
      requestBody.top_k = modelSettings.topK;
    }
  }

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': localStorage.getItem('claude_api_key') || '',
    },
    body: JSON.stringify(requestBody),
    signal,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  const isSSE = contentType.includes('text/event-stream');

  if (!isSSE) {
    const json = (await response.json()) as ChatResponse;
    if (Array.isArray(json?.content)) {
      for (const block of json.content) {
        if (block.type === 'thinking' && typeof block.thinking === 'string') {
          yield { type: 'thinking', thinking: block.thinking };
        } else if (block.type === 'text' && typeof block.text === 'string') {
          yield { type: 'text', content: block.text };
        }
      }
    }
    return;
  }

  if (!response.body) {
    throw new Error('Response body is null');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (signal?.aborted) {
        reader.cancel();
        throw new DOMException('Aborted', 'AbortError');
      }

      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      while (buffer.includes('\nevent:') || buffer.includes('\ndata:')) {
        const eventMatch = buffer.match(/^event: ([^\n]+)\ndata: (.+?)\n\n/s);

        if (eventMatch) {
          const eventType = eventMatch[1];
          const jsonStr = eventMatch[2];
          buffer = buffer.slice(eventMatch[0].length);

          if (eventType === 'content_block_delta') {
            try {
              const json = JSON.parse(jsonStr);
              if (json.delta?.type === 'text_delta') {
                yield { type: 'text', content: json.delta.text };
              } else if (json.delta?.type === 'thinking_delta') {
                yield { type: 'thinking', thinking: json.delta.thinking };
              }
            } catch {
              // Skip malformed JSON
            }
          }
        } else {
          break;
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Already released
    }
  }
}