import type { ChatMessage } from '../types';

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

/**
 * Send chat message with streaming SSE
 */
export async function* sendChatMessageStream(
  messages: ChatMessage[],
  model: string,
  signal?: AbortSignal,
): AsyncGenerator<StreamChunk, void, unknown> {
  const apiMessages: ApiMessage[] = messages.map(toApiMessage);

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: apiMessages,
      max_tokens: 4096,
      stream: true,
    } as ChatRequest & { stream?: boolean }),
    signal,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  if (!response.body) {
    throw new Error('Response body is null');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      if (signal?.aborted) {
        reader.cancel();
        break;
      }

      const { done, value } = await reader.read();
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