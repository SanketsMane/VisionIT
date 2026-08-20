import OpenAI from 'openai';
import { env } from './env';
import { logger } from './logger';

let client: OpenAI | null = null;

/**
 * Lazily constructed so the API boots without an OpenAI key — AI endpoints
 * then fail with a clear 503 while the rest of the platform keeps working.
 */
export const getOpenAI = (): OpenAI | null => {
  if (!env.OPENAI_API_KEY) return null;
  if (!client) {
    client = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
      maxRetries: 2,
      timeout: 60_000,
    });
    logger.info(`🤖 OpenAI client ready (model: ${env.OPENAI_MODEL})`);
  }
  return client;
};

/**
 * Published per-1M-token prices used to attribute a rupee cost to each call.
 * Unknown models fall back to the gpt-4o rate so spend is never silently zero.
 */
const PRICING_PER_MILLION: Record<string, { input: number; output: number }> = {
  // Longest prefix wins in the lookup below, so the -mini/-nano entries must be
  // able to out-match their parent.
  'gpt-5-nano': { input: 0.05, output: 0.4 },
  'gpt-5-mini': { input: 0.25, output: 2 },
  'gpt-5': { input: 1.25, output: 10 },
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4.1': { input: 2, output: 8 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
  'gpt-4.1-nano': { input: 0.1, output: 0.4 },
  'gpt-4-turbo': { input: 10, output: 30 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
};

export const estimateCostUsd = (
  model: string,
  promptTokens: number,
  completionTokens: number,
): number => {
  // Longest match, not first: 'gpt-5-mini' must not be priced as 'gpt-5'.
  const key =
    Object.keys(PRICING_PER_MILLION)
      .filter((k) => model.startsWith(k))
      .sort((a, b) => b.length - a.length)[0] ?? 'gpt-4o';
  const rate = PRICING_PER_MILLION[key];
  return (promptTokens * rate.input + completionTokens * rate.output) / 1_000_000;
};

/**
 * Reasoning models (the gpt-5 and o-series families) take a different shape of
 * request from the chat models.
 *
 * Two differences bite in practice, and both were confirmed against the live
 * API rather than assumed:
 *
 *   - They reject any `temperature` other than the default, and reject
 *     `max_tokens` outright in favour of `max_completion_tokens`.
 *   - Reasoning tokens are *billed and counted as completion tokens*, so they
 *     eat the same budget. Asked for a short email under a 300-token cap,
 *     gpt-5 spent the entire allowance thinking and returned truncated,
 *     unparsable JSON. The budget therefore needs real headroom, and the
 *     effort is pinned low because drafting an email is a writing task, not a
 *     reasoning one.
 */
export const isReasoningModel = (model: string): boolean =>
  /^(gpt-5|o1|o3|o4)/.test(model);

export interface CompletionTuning {
  temperature?: number;
  max_tokens?: number;
  max_completion_tokens?: number;
  reasoning_effort?: 'low' | 'medium' | 'high';
}

/** Builds the model-appropriate knobs for one completion. */
export const completionTuning = (
  model: string,
  temperature: number,
  maxTokens: number,
): CompletionTuning =>
  isReasoningModel(model)
    ? {
        // Headroom so the visible answer survives the thinking that precedes it.
        max_completion_tokens: Math.max(maxTokens * 4, 4000),
        reasoning_effort: 'low',
      }
    : { temperature, max_tokens: maxTokens };

export default getOpenAI;
