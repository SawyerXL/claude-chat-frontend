/**
 * Usage Stats Service
 * Tracks token usage and calculates estimated costs
 */

interface SessionUsage {
  sessionId: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheCreationTokens: number;
  totalCacheReadTokens: number;
  totalEstimatedCost: number;
  messageCount: number;
  lastUpdated: number;
}

// Model pricing per 1M tokens (in USD)
const MODEL_PRICING: Record<string, {
  input: number;      // per token
  output: number;     // per token
  cacheCreation?: number;
  cacheRead?: number;
}> = {
  'claude-3-7-sonnet-20250219': {
    input: 3e-6,
    output: 1.5e-5,
    cacheCreation: 3.75e-6,
    cacheRead: 3e-7,
  },
  'claude-4-sonnet-20250514': {
    input: 3e-6,
    output: 1.5e-5,
    cacheCreation: 3.75e-6,
    cacheRead: 3e-7,
  },
  'claude-4-opus-20250514': {
    input: 1.5e-5,
    output: 7.5e-5,
    cacheCreation: 1.875e-5,
    cacheRead: 1.5e-6,
  },
  'claude-4-haiku-20250514': {
    input: 8e-7,
    output: 4e-6,
    cacheCreation: 1e-7,
    cacheRead: 1e-8,
  },
  'claude-sonnet-4-6': {
    input: 3e-6,
    output: 1.5e-5,
    cacheCreation: 3.75e-6,
    cacheRead: 3e-7,
  },
  'claude-opus-4-7': {
    input: 1.5e-5,
    output: 7.5e-5,
    cacheCreation: 1.875e-5,
    cacheRead: 1.5e-6,
  },
  'claude-haiku-3': {
    input: 2.5e-7,
    output: 1.25e-6,
    cacheCreation: 3e-7,
    cacheRead: 3e-8,
  },
  'claude-3-opus': {
    input: 1.5e-5,
    output: 7.5e-5,
    cacheCreation: 1.875e-5,
    cacheRead: 1.5e-6,
  },
  'claude-3-sonnet': {
    input: 3e-6,
    output: 1.5e-5,
    cacheCreation: 3.75e-6,
    cacheRead: 3e-7,
  },
};

// Default pricing for unknown models
const DEFAULT_PRICING = {
  input: 3e-6,
  output: 1.5e-5,
};

/**
 * Get pricing for a model
 */
export function getModelPricing(modelId: string): {
  input: number;
  output: number;
  cacheCreation?: number;
  cacheRead?: number;
} {
  // Normalize model ID
  const normalized = normalizeModelId(modelId);
  return MODEL_PRICING[normalized] || DEFAULT_PRICING;
}

/**
 * Normalize model ID for lookup
 */
function normalizeModelId(modelId: string): string {
  const lower = modelId.toLowerCase();
  if (lower.includes('sonnet-4-6') || lower.includes('claude-sonnet-4-20250514')) return 'claude-sonnet-4-6';
  if (lower.includes('opus-4-7') || lower.includes('claude-opus-4-20250514')) return 'claude-opus-4-7';
  if (lower.includes('opus-4-6') || lower.includes('claude-opus-4-20250514')) return 'claude-4-opus-20250514';
  if (lower.includes('haiku-4') || lower.includes('haiku-20250514')) return 'claude-4-haiku-20250514';
  if (lower.includes('sonnet-4')) return 'claude-4-sonnet-20250514';
  if (lower.includes('3-7-sonnet') || lower.includes('sonnet-3-7')) return 'claude-3-7-sonnet-20250219';
  if (lower.includes('3-haiku') || lower.includes('haiku-3')) return 'claude-haiku-3';
  if (lower.includes('3-opus')) return 'claude-3-opus';
  if (lower.includes('3-sonnet') && !lower.includes('3-7')) return 'claude-3-sonnet';
  return modelId;
}

/**
 * Calculate estimated cost for token usage
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  cacheCreationTokens = 0,
  cacheReadTokens = 0,
  modelId = 'claude-sonnet-4-6'
): number {
  const pricing = getModelPricing(modelId);

  const inputCost = inputTokens * pricing.input;
  const outputCost = outputTokens * pricing.output;
  const cacheCreationCost = (cacheCreationTokens || 0) * (pricing.cacheCreation ?? pricing.input * 0.5);
  const cacheReadCost = (cacheReadTokens || 0) * (pricing.cacheRead ?? pricing.input * 0.1);

  return inputCost + outputCost + cacheCreationCost + cacheReadCost;
}

/**
 * Format cost for display
 */
export function formatCost(cost: number): string {
  if (cost < 0.001) return `$${(cost * 1000).toFixed(4)}`;
  if (cost < 0.01) return `$${(cost * 1000).toFixed(2)}`;
  if (cost < 1) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

/**
 * Format token count for display
 */
export function formatTokens(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(2)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
}

/**
 * Session usage manager
 */
class UsageManager {
  private sessionUsage: Map<string, SessionUsage> = new Map();
  private globalStats: { input: number; output: number; cost: number } = { input: 0, output: 0, cost: 0 };

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem('usage_stats');
      if (stored) {
        const data = JSON.parse(stored);
        this.globalStats = data.global || { input: 0, output: 0, cost: 0 };
      }
    } catch {
      // Ignore parse errors
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem('usage_stats', JSON.stringify({
        global: this.globalStats,
      }));
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Record usage for a message
   */
  recordUsage(
    sessionId: string,
    inputTokens: number,
    outputTokens: number,
    cacheCreationTokens = 0,
    cacheReadTokens = 0,
    model = 'claude-sonnet-4-6'
  ) {
    const cost = calculateCost(inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens, model);

    // Update global stats
    this.globalStats.input += inputTokens;
    this.globalStats.output += outputTokens;
    this.globalStats.cost += cost;

    // Update session stats
    let session = this.sessionUsage.get(sessionId);
    if (!session) {
      session = {
        sessionId,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCacheCreationTokens: 0,
        totalCacheReadTokens: 0,
        totalEstimatedCost: 0,
        messageCount: 0,
        lastUpdated: Date.now(),
      };
    }

    session.totalInputTokens += inputTokens;
    session.totalOutputTokens += outputTokens;
    session.totalCacheCreationTokens += cacheCreationTokens;
    session.totalCacheReadTokens += cacheReadTokens;
    session.totalEstimatedCost += cost;
    session.messageCount += 1;
    session.lastUpdated = Date.now();
    this.sessionUsage.set(sessionId, session);

    this.saveToStorage();
  }

  /**
   * Get session usage
   */
  getSessionUsage(sessionId: string): SessionUsage | null {
    return this.sessionUsage.get(sessionId) || null;
  }

  /**
   * Get global stats
   */
  getGlobalStats(): { input: number; output: number; cost: number } {
    return { ...this.globalStats };
  }

  /**
   * Estimate tokens from message text (rough approximation)
   * Claude uses ~4 chars per token for English, ~2 for Chinese
   */
  estimateTokens(text: string): number {
    // Rough estimation: 1 token ≈ 4 chars for English, ~2 for CJK
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 2 + otherChars / 4);
  }

  /**
   * Clear all usage stats
   */
  clearStats() {
    this.sessionUsage.clear();
    this.globalStats = { input: 0, output: 0, cost: 0 };
    localStorage.removeItem('usage_stats');
  }
}

// Export singleton
export const usageManager = new UsageManager();