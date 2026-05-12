import type { ChatMessage } from '../types';

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
 * Returns an async generator that yields text chunks
 */
export async function* sendChatMessageStream(
  messages: ChatMessage[],
  model: string,
): AsyncGenerator<string, void, unknown> {
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
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse SSE events
      // Each event is formatted as: "event: type\ndata: {...}\n\n"
      while (buffer.includes('\nevent:') || buffer.includes('\ndata:')) {
        const eventMatch = buffer.match(/^event: ([^\n]+)\ndata: (.+?)\n\n/s);
        const dataMatch = buffer.match(/^data: (.+?)\n\n/s);

        if (eventMatch) {
          const eventType = eventMatch[1];
          const jsonStr = eventMatch[2];
          buffer = buffer.slice(eventMatch[0].length);

          if (eventType === 'content_block_delta') {
            try {
              const json = JSON.parse(jsonStr);
              if (json.delta?.type === 'text_delta') {
                yield json.delta.text;
              }
            } catch {
              // Skip malformed JSON
            }
          }
        } else if (dataMatch && !buffer.startsWith('event:')) {
          // Handle data without event (rare)
          const jsonStr = dataMatch[1];
          buffer = buffer.slice(dataMatch[0].length);
          try {
            const json = JSON.parse(jsonStr);
            if (json.delta?.type === 'text_delta') {
              yield json.delta.text;
            }
          } catch {
            // Skip
          }
        } else {
          // No more complete events
          break;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
