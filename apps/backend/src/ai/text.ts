/** Plain-text helpers for what the AI reads and quotes. */

interface PmNode {
  type?: string;
  text?: string;
  attrs?: { level?: number };
  content?: PmNode[];
}

/** Blocks that become one line of text. */
const LINES = new Set(['paragraph', 'heading', 'listItem', 'tableRow', 'blockquote', 'codeBlock']);
const INLINE = new Set(['paragraph', 'heading', 'codeBlock']);

/** All text under a node: inline text joined as is, blocks with a space, table cells with " | ". */
const flat = (n: PmNode): string =>
  n.text ?? (n.content ?? []).map(flat).join(n.type === 'tableRow' ? ' | ' : n.type && INLINE.has(n.type) ? '' : ' ');

/** ProseMirror JSON (the document editor's format) as text: headings marked with #, one block per line. */
export function proseText(node: unknown): string {
  const out: string[] = [];
  const walk = (n: PmNode): void => {
    if (n.type && LINES.has(n.type)) {
      const text = flat(n).replace(/\s+/g, ' ').trim();
      if (text) out.push(n.type === 'heading' ? `${'#'.repeat(n.attrs?.level ?? 1)} ${text}` : n.type === 'listItem' ? `- ${text}` : text);
      return;
    }
    n.content?.forEach(walk);
  };
  walk((node ?? {}) as PmNode);
  return out.join('\n');
}

/** Whitespace, quotes and dashes normalized, for verbatim-quote checks. */
export const normalize = (s: string) =>
  s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase();

/** Whether `quote` appears word for word in `source` (after normalization). */
export const quoteIn = (source: string, quote: string) => !!quote.trim() && normalize(source).includes(normalize(quote));

/** Cuts at a line boundary under `max` characters and says so. */
export function budget(text: string, max: number) {
  if (text.length <= max) return text;
  const cut = text.lastIndexOf('\n', max);
  return `${text.slice(0, cut > max / 2 ? cut : max)}\n[truncated]`;
}
