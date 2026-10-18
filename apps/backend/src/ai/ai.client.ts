import { createHash } from 'crypto';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI, { APIConnectionError, APIError } from 'openai';
import { AiRunStatus } from '@prisma/client';
import { z } from 'zod';
import { AiRunService } from './ai-run.service';
import { CAPABILITIES, CapabilityName, ModelRole } from './capabilities';
import { BASE_RULES, Prompt, promptVersion } from './prompts/base';
import { parseModelJson } from './json';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

/** Who and what an AI call is about (stored on the AI run). */
export interface CallMeta {
  projectId?: string | null;
  userId?: string | null;
  subjectType?: string;
  subjectId?: string;
  /** Complete this run (created when a background job was queued) instead of recording a new one. */
  runId?: string;
}

/** The answer failed validation twice: nothing is stored as if it were valid. */
export class AiRejectedError extends Error {
  constructor(readonly errors: string[], readonly runId: string, readonly partial?: unknown) {
    super(`The AI answer was rejected: ${errors.slice(0, 3).join('; ')}`);
  }
}

const DEFAULT_MODELS: Record<ModelRole, string> = {
  main: 'nvidia/nemotron-3-super-120b-a12b',
  fallback: 'openai/gpt-oss-20b',
  embed: 'nvidia/nemotron-3-embed-1b',
  ocr: 'nvidia/nemotron-parse-2.0',
  vision: 'meta/llama-3.2-90b-vision-instruct',
};
const ENV_NAMES: Record<ModelRole, string> = { main: 'AI_MODEL_MAIN', fallback: 'AI_MODEL_FALLBACK', embed: 'AI_MODEL_EMBED', ocr: 'AI_MODEL_OCR', vision: 'AI_MODEL_VISION' };
const EMBED_BATCH = 32;

const sha256 = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
/** Rate limits, timeouts, network and server errors are worth retrying; other 4xx are not. */
const transient = (e: unknown) => e instanceof APIConnectionError || (e instanceof APIError && (e.status === 429 || (e.status ?? 0) >= 500));
const authError = (e: unknown) => e instanceof APIError && (e.status === 401 || e.status === 403);
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

interface Completion { text: string; model: string; tokensIn: number; tokensOut: number }

/**
 * The only way the application talks to a model (NVIDIA Build, OpenAI-compatible).
 * Per capability: models with fallback, timeout, transient-only retries with
 * backoff, JSON mode and reasoning switch. Every call is recorded as an AI run.
 */
@Injectable()
export class AiClient {
  private readonly logger = new Logger(AiClient.name);
  private readonly client: OpenAI | null;
  readonly models: Record<ModelRole, string>;

  constructor(config: ConfigService, private readonly runs: AiRunService) {
    const key = config.get<string>('NVIDIA_API_KEY');
    const enabled = config.get<string>('AI_ENABLED') !== 'false' && !!key;
    this.client = enabled
      ? new OpenAI({ apiKey: key, baseURL: config.get<string>('AI_BASE_URL') || 'https://integrate.api.nvidia.com/v1', maxRetries: 0 })
      : null;
    this.models = Object.fromEntries(
      (Object.keys(DEFAULT_MODELS) as ModelRole[]).map(r => [r, config.get<string>(ENV_NAMES[r]) || DEFAULT_MODELS[r]]),
    ) as Record<ModelRole, string>;
  }

  get enabled() {
    return !!this.client;
  }

  /**
   * JSON answer validated against `schema`, then by `check` (semantic rules:
   * real control IDs, verbatim quotes...). On failure the model gets one more
   * attempt with the exact errors; if it fails again the run is REJECTED.
   */
  async generateStructured<S extends z.ZodType>(
    capability: CapabilityName,
    prompt: Prompt,
    input: string,
    schema: S,
    meta: CallMeta = {},
    check: (value: z.infer<S>) => string[] = () => [],
  ): Promise<{ value: z.infer<S>; runId: string; model: string }> {
    const system = `${BASE_RULES}\n\n${prompt.system}\n\nReturn only one JSON object that matches this JSON Schema, with no text before or after it:\n${JSON.stringify(z.toJSONSchema(schema))}`;
    const messages: OpenAI.ChatCompletionMessageParam[] = [{ role: 'system', content: system }, { role: 'user', content: input }];
    const subject = this.subject(capability, prompt, messages, meta);
    const started = Date.now();
    const usage = { tokensIn: 0, tokensOut: 0 };
    let model = '';
    let errors: string[] = [];
    let partial: z.infer<S> | undefined;

    try {
      for (let attempt = 1; attempt <= 2; attempt++) {
        const r = await this.complete(capability, messages);
        model = r.model;
        usage.tokensIn += r.tokensIn;
        usage.tokensOut += r.tokensOut;
        errors = [];
        let parsed: unknown;
        try {
          parsed = parseModelJson(r.text);
        } catch (e) {
          errors = [message(e)];
        }
        if (!errors.length) {
          const result = schema.safeParse(parsed);
          if (!result.success) errors = result.error.issues.map(i => `${i.path.join('.') || 'answer'}: ${i.message}`);
          else {
            partial = result.data;
            errors = check(result.data);
            if (!errors.length) {
              const run = await this.save(subject, meta, { status: AiRunStatus.SUCCEEDED, model, output: result.data, validation: { attempts: attempt, errors: [] }, latencyMs: Date.now() - started, ...usage });
              return { value: result.data, runId: run.id, model };
            }
          }
        }
        messages.push({ role: 'assistant', content: r.text }, { role: 'user', content: `Your answer has these problems:\n- ${errors.join('\n- ')}\nReturn the corrected JSON object only.` });
      }
    } catch (e) {
      if (e instanceof ServiceUnavailableException) throw e;
      await this.save(subject, meta, { status: AiRunStatus.FAILED, model, error: message(e), latencyMs: Date.now() - started, ...usage });
      throw new ServiceUnavailableException('The AI assistant is not available right now');
    }
    const run = await this.save(subject, meta, { status: AiRunStatus.REJECTED, model, output: partial, validation: { attempts: 2, errors }, latencyMs: Date.now() - started, ...usage });
    throw new AiRejectedError(errors, run.id, partial);
  }

  /** Plain text answer (e.g. a rewritten paragraph). */
  async generateText(capability: CapabilityName, prompt: Prompt, messages: ChatMessage[], meta: CallMeta = {}) {
    const all = this.withSystem(prompt, messages);
    const subject = this.subject(capability, prompt, all, meta);
    const started = Date.now();
    try {
      const r = await this.complete(capability, all);
      const run = await this.save(subject, meta, { status: AiRunStatus.SUCCEEDED, model: r.model, output: { text: r.text }, latencyMs: Date.now() - started, tokensIn: r.tokensIn, tokensOut: r.tokensOut });
      return { text: r.text, runId: run.id, model: r.model };
    } catch (e) {
      await this.save(subject, meta, { status: AiRunStatus.FAILED, error: message(e), latencyMs: Date.now() - started });
      throw new ServiceUnavailableException('The AI assistant is not available right now');
    }
  }

  /**
   * Streams the answer as it is written. The run is recorded when the stream
   * ends; the generator's return value carries its id and the full text.
   */
  async *stream(capability: CapabilityName, prompt: Prompt, messages: ChatMessage[], meta: CallMeta = {}): AsyncGenerator<string, { runId: string; text: string; model: string }> {
    const cap = CAPABILITIES[capability];
    const all = this.withSystem(prompt, messages);
    const subject = this.subject(capability, prompt, all, meta);
    const started = Date.now();
    const model = this.models[cap.models[0]];
    let text = '';
    try {
      const stream = await this.api().chat.completions.create(
        { ...this.body(capability, model, all), stream: true, stream_options: { include_usage: true } },
        { timeout: cap.timeoutMs },
      );
      let usage: OpenAI.CompletionUsage | undefined;
      for await (const chunk of stream) {
        usage = chunk.usage ?? usage;
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          text += delta;
          yield delta;
        }
      }
      const run = await this.save(subject, meta, { status: AiRunStatus.SUCCEEDED, model, output: { text }, latencyMs: Date.now() - started, tokensIn: usage?.prompt_tokens, tokensOut: usage?.completion_tokens });
      return { runId: run.id, text, model };
    } catch (e) {
      await this.save(subject, meta, { status: AiRunStatus.FAILED, model, output: text ? { text } : undefined, error: message(e), latencyMs: Date.now() - started });
      throw new ServiceUnavailableException('The AI assistant is not available right now');
    }
  }

  /** Embeddings for retrieval: "passage" for indexed content, "query" for questions. */
  async embed(texts: string[], inputType: 'query' | 'passage', meta: CallMeta = {}): Promise<number[][]> {
    const model = this.models.embed;
    const vectors: number[][] = [];
    const started = Date.now();
    let tokens = 0;
    for (let i = 0; i < texts.length; i += EMBED_BATCH) {
      const batch = texts.slice(i, i + EMBED_BATCH);
      const r = await this.withRetries(2, () =>
        this.api().embeddings.create({ model, input: batch, encoding_format: 'float', ...({ input_type: inputType, truncate: 'END' } as object) }, { timeout: 30_000 }),
      );
      vectors.push(...r.data.sort((a, b) => a.index - b.index).map(d => d.embedding));
      tokens += r.usage?.prompt_tokens ?? 0;
    }
    await this.runs.record(
      { capability: 'embedding', promptVersion: `embed-${inputType}`, inputHash: sha256(texts), projectId: meta.projectId, userId: meta.userId, subjectType: meta.subjectType, subjectId: meta.subjectId },
      { status: AiRunStatus.SUCCEEDED, model, output: { count: vectors.length }, tokensIn: tokens, latencyMs: Date.now() - started },
    );
    return vectors;
  }

  // ─── Internals ─────────────────────────────────────────────────

  /** Tries each model of the capability in order, each with its own transient-error retries. */
  private async complete(capability: CapabilityName, messages: OpenAI.ChatCompletionMessageParam[]): Promise<Completion> {
    const cap = CAPABILITIES[capability];
    let last: unknown;
    for (const role of cap.models) {
      const model = this.models[role];
      try {
        const r = await this.withRetries(cap.retries, () => this.api().chat.completions.create(this.body(capability, model, messages), { timeout: cap.timeoutMs }));
        const text = r.choices[0]?.message?.content ?? '';
        if (!text.trim()) throw new Error('The model returned an empty answer');
        return { text, model: r.model || model, tokensIn: r.usage?.prompt_tokens ?? 0, tokensOut: r.usage?.completion_tokens ?? 0 };
      } catch (e) {
        last = e;
        if (authError(e)) break;
        this.logger.warn(`${capability}: ${model} failed (${message(e)}), trying the next model`);
      }
    }
    throw last;
  }

  private body(capability: CapabilityName, model: string, messages: OpenAI.ChatCompletionMessageParam[]): OpenAI.ChatCompletionCreateParamsNonStreaming {
    const cap = CAPABILITIES[capability];
    return {
      model,
      messages,
      temperature: cap.temperature,
      max_tokens: cap.maxTokens,
      ...(cap.json && { response_format: { type: 'json_object' as const } }),
      // NVIDIA chat templates: reasoning on or off (ignored by models without it).
      ...({ chat_template_kwargs: { enable_thinking: cap.thinking } } as object),
    };
  }

  private async withRetries<T>(retries: number, fn: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await fn();
      } catch (e) {
        if (attempt >= retries || !transient(e)) throw e;
        const retryAfter = Number(e instanceof APIError ? e.headers?.get('retry-after') : NaN);
        await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 20) * 1000 : 2 ** attempt * 1000 + Math.random() * 500);
      }
    }
  }

  private api() {
    if (!this.client) throw new ServiceUnavailableException('The AI assistant is not configured (NVIDIA_API_KEY)');
    return this.client;
  }

  private withSystem(prompt: Prompt, messages: ChatMessage[]): OpenAI.ChatCompletionMessageParam[] {
    return [{ role: 'system', content: `${BASE_RULES}\n\n${prompt.system}` }, ...messages];
  }

  private subject(capability: CapabilityName, prompt: Prompt, messages: OpenAI.ChatCompletionMessageParam[], meta: CallMeta) {
    return {
      capability,
      promptVersion: promptVersion(prompt),
      inputHash: sha256(messages),
      projectId: meta.projectId,
      userId: meta.userId,
      subjectType: meta.subjectType,
      subjectId: meta.subjectId,
    };
  }

  private save(subject: ReturnType<AiClient['subject']>, meta: CallMeta, result: Parameters<AiRunService['finish']>[1]) {
    return meta.runId ? this.runs.finish(meta.runId, result) : this.runs.record(subject, result);
  }
}
