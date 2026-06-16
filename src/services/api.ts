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
 * Detect image media type from base64 data by inspecting magic bytes.
 * Required because the browser's File.type is sometimes wrong (e.g. clipboard
 * paste / drag-drop reports image/png for a JPEG), and Anthropic upstream
 * validates that media_type matches the actual bytes — mismatches return 400.
 */
function detectImageMediaType(base64: string): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | null {
  try {
    const slice = base64.slice(0, 24);
    const bytes = Uint8Array.from(atob(slice), (c) => c.charCodeAt(0));

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
      return 'image/png';
    }
    // JPEG: FF D8 FF
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return 'image/jpeg';
    }
    // GIF: 47 49 46 38
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
      return 'image/gif';
    }
    // WebP: 52 49 46 46 ?? ?? ?? ?? 57 45 42 50
    if (
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
    ) {
      return 'image/webp';
    }
    return null;
  } catch {
    return null;
  }
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
    // Safety check for undefined/null content
    const attContent = typeof att.content === 'string' ? att.content : '';

    if (att.type.startsWith('image/') && attContent) {
      const base64Data = attContent.split(',')[1] || attContent;
      // Trust magic bytes over att.type (which may be wrong from clipboard / drag-drop)
      const detected = detectImageMediaType(base64Data);
      const mediaType = detected ?? (att.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp');
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: mediaType,
          data: base64Data,
        },
      });
    } else if (attContent) {
      // For non-image files or files without image MIME, include as text block
      content.push({
        type: 'text',
        text: `[File: ${att.name}]\n\`\`\`\n${attContent}\n\`\`\``,
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

  // Claude 4 models (Opus 4.8, Sonnet 4.6, Haiku 4.5, Fable 5) don't support temperature parameter
  const modelsNoTemp = ['claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-6', 'claude-opus-4', 'claude-sonnet-4', 'claude-haiku-4'];
  const useTempParams = !modelsNoTemp.includes(model);

  // Build request body - enable extended thinking
  // Reduced budget_tokens to keep responses under Cloudflare's 100s proxy timeout
  const thinkingEnabled = model.includes('opus') ? {
    type: 'enabled' as const,
    budget_tokens: 4000,
  } : { type: 'enabled' as const, budget_tokens: 2000 };

  const requestBody: ChatRequest & { stream?: boolean; thinking?: { type: string; budget_tokens?: number }; output_config?: { effort?: string } } = {
    model,
    messages: apiMessages,
    max_tokens: Math.max(modelSettings.maxTokens || 8000, 8000),
    stream: true,
    thinking: thinkingEnabled,
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

  // Check for user-provided API key first, then fall back to system key
  const userApiKey = localStorage.getItem('user_api_key');
  const systemApiKey = localStorage.getItem('claude_api_key') || '';
  const apiKeyToUse = userApiKey || systemApiKey;

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKeyToUse,
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
  // Cloudflare 100s proxy timeout workaround: abort if no chunk for STREAM_IDLE_MS
  const STREAM_IDLE_MS = 90_000;
  let lastReadTime = Date.now();

  try {
    while (true) {
      // Check for client-side abort
      if (signal?.aborted) {
        reader.cancel();
        throw new DOMException('Aborted', 'AbortError');
      }

      // Idle timeout: if no data received for STREAM_IDLE_MS, abort gracefully
      if (Date.now() - lastReadTime > STREAM_IDLE_MS) {
        reader.cancel();
        throw new Error('响应超时（90秒未收到新内容）。这通常是因为上下文过长或上游处理慢，建议：1) 重试；2) 开启新会话减少历史；3) 切换更短回复。');
      }

      const readPromise = reader.read();
      const timeoutPromise = new Promise<{ done: boolean; value: undefined }>((resolve) => {
        setTimeout(() => resolve({ done: false, value: undefined as any }), STREAM_IDLE_MS);
      });
      const { done, value } = await Promise.race([readPromise, timeoutPromise]);

      if (done) break;
      if (value === undefined) {
        // Idle timeout fired while waiting for next chunk
        reader.cancel();
        throw new Error('响应超时（90秒未收到新内容）。这通常是因为上下文过长或上游处理慢，建议：1) 重试；2) 开启新会话减少历史；3) 切换更短回复。');
      }

      lastReadTime = Date.now();
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