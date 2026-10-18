import apiClient from './api-client';
import type { EvidenceTarget } from './api';

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

export interface ChatConversation {
  id: string;
  title: string;
  updated_at: string;
}

export interface ChatConversationDetail {
  id: string;
  title: string;
  messages: (ChatTurn & { citations: ChatCitation[] | null })[];
}

export const chatApi = {
  /**
   * Streams the companion's answer in a conversation (a new one when conversationId is null);
   * onConversation gets its id first; resolves with the citations that point to real sources.
   */
  ask: async (
    projectId: string,
    message: string,
    conversationId: string | null,
    onText: (sofar: string) => void,
    onConversation: (id: string) => void,
  ): Promise<ChatCitation[]> => {
    let sofar = '';
    let citations: ChatCitation[] = [];
    let finished = false;
    let failure: string | null = null;
    const read = sseReader((event, data) => {
      if (event === 'conversation') onConversation((data as { id: string }).id);
      else if (event === 'delta') onText((sofar += (data as { text: string }).text));
      else if (event === 'citations') citations = data as ChatCitation[];
      else if (event === 'done') finished = true;
      else if (event === 'error') failure = (data as { message: string }).message;
    });
    await apiClient.post(`/projects/${projectId}/ai/chat`, { message, ...(conversationId && { conversation_id: conversationId }) }, {
      responseType: 'text',
      timeout: 130_000,
      onDownloadProgress: (e) => read(String((e.event?.target as XMLHttpRequest | undefined)?.responseText ?? '')),
    }).then((r) => read(String(r.data)));
    if (failure || !finished) throw new Error(failure ?? 'The AI assistant stopped unexpectedly');
    return citations;
  },

  conversations: async (projectId: string): Promise<ChatConversation[]> =>
    (await apiClient.get(`/projects/${projectId}/ai/conversations`)).data,

  conversation: async (projectId: string, id: string): Promise<ChatConversationDetail> =>
    (await apiClient.get(`/projects/${projectId}/ai/conversations/${id}`)).data,

  deleteConversation: async (projectId: string, id: string) =>
    (await apiClient.delete(`/projects/${projectId}/ai/conversations/${id}`)).data,
};

export interface EvidenceAnalysis {
  status: 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED';
  error: string | null;
  note: string | null;
  summary: string | null;
  document_type: string | null;
  pages: number | null;
  ocr_pages: number | null;
  suggestions: {
    ref: string;
    title: string;
    reason: string;
    confidence: 'likely' | 'possible';
    /** What "Link" does; null when the control is not in the Statement of Applicability yet. */
    target: EvidenceTarget | null;
    linked: boolean;
  }[];
  expiry: { date: string; quote: string; applied: boolean } | null;
}

export const evidenceAnalysisApi = {
  get: async (projectId: string, evidenceId: string): Promise<EvidenceAnalysis | null> =>
    (await apiClient.get(`/projects/${projectId}/evidence/${evidenceId}/analysis`)).data.analysis,
  retry: async (projectId: string, evidenceId: string): Promise<EvidenceAnalysis | null> =>
    (await apiClient.post(`/projects/${projectId}/evidence/${evidenceId}/analysis`)).data.analysis,
};

export interface NextAction {
  id: string;
  title: string;
  /** Why it matters now (from the AI); null when the list is in the fixed order. */
  why: string | null;
  href: string;
  due: string | null;
  overdue: boolean;
}

export const nextActionsApi = {
  get: async (projectId: string): Promise<{ actions: NextAction[]; ranked_by: 'ai' | 'rules' }> =>
    (await apiClient.get(`/projects/${projectId}/ai/next-actions`, { timeout: 40_000 })).data,
};
