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
  const key = Object.keys(PRICING_PER_MILLION).find((k) => model.startsWith(k)) ?? 'gpt-4o';
  const rate = PRICING_PER_MILLION[key];
  return (promptTokens * rate.input + completionTokens * rate.output) / 1_000_000;
};

export default getOpenAI;
