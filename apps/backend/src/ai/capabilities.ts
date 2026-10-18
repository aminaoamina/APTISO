/**
 * What each AI feature asks of the model. Features name a capability, never a
 * model: models come from the environment (AI_MODEL_*), so they can change
 * without code changes.
 */
export type ModelRole = 'main' | 'fallback' | 'embed' | 'ocr' | 'vision';

export interface Capability {
  /** Models tried in order; each gets `retries` extra attempts on transient errors. */
  models: ModelRole[];
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  retries: number;
  json: boolean;
  /** Reasoning ("thinking") costs ~4x the latency: only where quality needs it. */
  thinking: boolean;
}

const fast = { models: ['main', 'fallback'] as ModelRole[], thinking: false };

export const CAPABILITIES = {
  health: { ...fast, temperature: 0, maxTokens: 20, timeoutMs: 20_000, retries: 0, json: false },
  wizard_suggest: { ...fast, temperature: 0.2, maxTokens: 800, timeoutMs: 25_000, retries: 1, json: true },
  paragraph_improve: { ...fast, temperature: 0.3, maxTokens: 1200, timeoutMs: 30_000, retries: 0, json: false },
  companion_chat: { ...fast, temperature: 0.3, maxTokens: 1500, timeoutMs: 45_000, retries: 0, json: false },
  document_review: { models: ['main', 'fallback'], temperature: 0.1, maxTokens: 4000, timeoutMs: 120_000, retries: 2, json: true, thinking: true },
  evidence_analyze: { models: ['main', 'fallback'], temperature: 0.1, maxTokens: 1500, timeoutMs: 120_000, retries: 2, json: true, thinking: false },
  next_actions: { ...fast, temperature: 0.2, maxTokens: 800, timeoutMs: 25_000, retries: 1, json: true },
} satisfies Record<string, Capability>;

export type CapabilityName = keyof typeof CAPABILITIES;
