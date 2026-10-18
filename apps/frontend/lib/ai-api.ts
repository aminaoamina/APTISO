import apiClient from './api-client';

export interface Suggestion {
  answer: string;
  missing: string[];
  /** Each part of the answer with the words of the project data it comes from. */
  sources: { label: string; quote: string }[];
  run_id: string | null;
}

export interface ImproveResult {
  run_id: string;
  /** Numbers, dates or control IDs the rewrite contains but the original did not. */
  added_facts: string[];
}

/** Reads a Server-Sent Events body as it arrives (axios exposes the partial text while downloading). */
function sseReader(onEvent: (event: string, data: unknown) => void) {
  let seen = 0;
  return (text: string) => {
    let end: number;
    while ((end = text.indexOf('\n\n', seen)) !== -1) {
      const block = text.slice(seen, end);
      seen = end + 2;
      const event = /^event: (.*)$/m.exec(block)?.[1];
      const data = /^data: (.*)$/m.exec(block)?.[1];
      if (event && data) onEvent(event, JSON.parse(data));
    }
  };
}

export const aiApi = {
  suggest: async (projectId: string, templateCode: string, questionKey: string, answers: Record<string, string>): Promise<Suggestion> =>
    (await apiClient.post(`/projects/${projectId}/ai/wizard/suggest`, { templateCode, questionKey, answers }, { timeout: 90_000 })).data,

  /** Rewrites `text`, calling `onText` with the text so far as it streams. */
  improve: async (projectId: string, documentId: string, text: string, instruction: string, onText: (sofar: string) => void): Promise<ImproveResult> => {
    let sofar = '';
    let done: ImproveResult | null = null;
    let failure: string | null = null;
    const read = sseReader((event, data) => {
      if (event === 'delta') onText((sofar += (data as { text: string }).text));
      else if (event === 'done') done = data as ImproveResult;
      else if (event === 'error') failure = (data as { message: string }).message;
    });
    await apiClient.post(`/projects/${projectId}/ai/improve`, { documentId, text, instruction }, {
      responseType: 'text',
      timeout: 130_000,
      onDownloadProgress: (e) => read(String((e.event?.target as XMLHttpRequest | undefined)?.responseText ?? '')),
    }).then((r) => read(String(r.data)));
    if (failure || !done) throw new Error(failure ?? 'The AI assistant stopped unexpectedly');
    return done;
  },

  /** Records what the person did with a proposal (the AI never applies it itself). */
  decide: async (projectId: string, runId: string, outcome: 'ACCEPTED' | 'DISMISSED') =>
    apiClient.post(`/projects/${projectId}/ai/decisions`, { runId, outcome }).catch(() => undefined),
};

export interface ReviewFinding {
  id: string;
  type: 'missing' | 'contradiction' | 'vague';
  ref: string;
  ref_title: string | null;
  quote: string | null;
  explanation: string;
  suggestion: string;
  severity: 'high' | 'medium' | 'low';
  state: 'OPEN' | 'ACCEPTED' | 'DISMISSED';
}

export interface DocumentReview {
  id: string;
  status: 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED';
  error: string | null;
  created_at: string;
  completed_at: string | null;
  /** The document changed after this review. */
  outdated: boolean;
  findings: ReviewFinding[];
}

export const reviewApi = {
  latest: async (projectId: string, documentId: string): Promise<DocumentReview | null> =>
    (await apiClient.get(`/projects/${projectId}/documents/${documentId}/ai-review`)).data.review,
  start: async (projectId: string, documentId: string): Promise<DocumentReview | null> =>
    (await apiClient.post(`/projects/${projectId}/documents/${documentId}/ai-review`)).data.review,
  decide: async (projectId: string, findingId: string, state: ReviewFinding['state']) =>
    apiClient.patch(`/projects/${projectId}/ai-review/findings/${findingId}`, { state }),
};

export interface ChatCitation {
  id: string;
  kind: 'source' | 'fact';
  source_type: string;
  source_id: string | null;
  title: string;
  section: string | null;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export const chatApi = {
  /** Streams the companion's answer; resolves with the citations that point to real sources. */
  ask: async (projectId: string, message: string, history: ChatTurn[], onText: (sofar: string) => void): Promise<ChatCitation[]> => {
    let sofar = '';
    let citations: ChatCitation[] = [];
    let finished = false;
    let failure: string | null = null;
    const read = sseReader((event, data) => {
      if (event === 'delta') onText((sofar += (data as { text: string }).text));
      else if (event === 'citations') citations = data as ChatCitation[];
      else if (event === 'done') finished = true;
      else if (event === 'error') failure = (data as { message: string }).message;
    });
    await apiClient.post(`/projects/${projectId}/ai/chat`, { message, history }, {
      responseType: 'text',
      timeout: 130_000,
      onDownloadProgress: (e) => read(String((e.event?.target as XMLHttpRequest | undefined)?.responseText ?? '')),
    }).then((r) => read(String(r.data)));
    if (failure || !finished) throw new Error(failure ?? 'The AI assistant stopped unexpectedly');
    return citations;
  },
};
