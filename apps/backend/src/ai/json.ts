/**
 * Turns a model's text into JSON. Light repair only (code fences, prose around
 * the object); the schema validation that follows is what decides.
 */
export function parseModelJson(raw: string): unknown {
  const text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(text);
  } catch {
    const block = firstObject(text);
    if (!block) throw new Error('The model did not return JSON');
    return JSON.parse(block.replace(/,\s*([}\]])/g, '$1'));
  }
}

/** The first balanced {...} block, ignoring braces inside strings. */
function firstObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return text.slice(start, i + 1);
  }
  return null;
}
