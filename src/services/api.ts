import type { ChatMessage } from '../types';

export interface ThinkingBlock {
  thinking: string;
}

export type StreamChunk = 
  | { type: 'text'; content: string }
  | { type: 'thinking'; thinking: string };

export interface ApiMessage {
  role: 'user' | 'assistant';
  content: string;
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
 * Send chat message (non-streaming)
 */
export async function sendChatMessage(
  messages: ChatMessage[],
  model: string,
): Promise<string> {
  const apiMessages: ApiMessage[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: apiMessages,
      max_tokens: 4096,
    } as ChatRequest),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  const data = (await response.json()) as ChatResponse;
  const textContent = data.content.find((c) => c.type === 'text');
  return textContent?.text || '';
}

/**
 * Send chat message with streaming SSE
 * Returns an async generator that yields text or thinking chunks
 * Supports abort via AbortController
 */
export async function* sendChatMessageStream(
  messages: ChatMessage[],
  model: string,
  signal?: AbortSignal,
): AsyncGenerator<StreamChunk, void, unknown> {
  const apiMessages: ApiMessage[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

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
    signal, // Pass abort signal
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
      // Check if aborted
      if (signal?.aborted) {
        reader.cancel();
        break;
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse SSE events
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