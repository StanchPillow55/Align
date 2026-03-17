/**
 * Multi-stage JSON extractor.
 * Handles: <think> reasoning blocks, markdown code fences, bare arrays, and wrapped objects.
 */
export function extractJson(raw: string): unknown {
  // 0. Strip <think>...</think> chain-of-thought blocks (reasoning models)
  const withoutThinking = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // 0b. Fix duplicate top-level keys with empty arrays (model quirk)
  // e.g. {"key":[items],"key":[]} → {"key":[items]}
  const deduplicated = withoutThinking.replace(/,\s*"(\w+)"\s*:\s*\[\s*\](?=\s*})/g, "");

  // 1. Strip markdown code fences
  const stripped = deduplicated
    .replace(/^```(?:json)?\s*/im, "")
    .replace(/\s*```\s*$/m, "")
    .trim();

  // 2. Direct parse
  try {
    return JSON.parse(stripped);
  } catch {
    /* fall through */
  }

  // 3. Extract outermost [...] array
  const arrMatch = stripped.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try {
      return JSON.parse(arrMatch[0]);
    } catch {
      /* fall through */
    }
  }

  // 4. Extract outermost {...} object
  const objMatch = stripped.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      return JSON.parse(objMatch[0]);
    } catch {
      /* fall through */
    }
  }

  return null;
}
