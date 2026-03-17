import { NextRequest, NextResponse } from "next/server";
import { callNim } from "@/lib/nim";
import { buildExtractionUserPrompt, extractionSystemPrompt } from "@/lib/prompts";
import type { CandidateCommitment, HardOrSoft } from "@/lib/types";
import { extractJson } from "@/lib/json-utils";

// ---------------------------------------------------------------------------
// Normalization — coerce raw LLM output into valid CandidateCommitment[]
// ---------------------------------------------------------------------------
function clamp(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function normalizeCommitment(raw: unknown): CandidateCommitment | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;

  const title = typeof r.title === "string" ? r.title.trim() : "";
  if (!title) return null; // skip untitled items

  const hardOrSoft: HardOrSoft = r.hard_or_soft === "hard" ? "hard" : "soft";

  return {
    title,
    source: typeof r.source === "string" && r.source ? r.source : "unknown",
    hard_or_soft: hardOrSoft,
    earliest_start:
      typeof r.earliest_start === "string" && r.earliest_start
        ? r.earliest_start
        : null,
    latest_end:
      typeof r.latest_end === "string" && r.latest_end ? r.latest_end : null,
    date_confidence:
      typeof r.date_confidence === "number" ? clamp(r.date_confidence) : 0.5,
    location:
      typeof r.location === "string" && r.location ? r.location : null,
    reason: typeof r.reason === "string" ? r.reason : "",
    confidence:
      typeof r.confidence === "number" ? clamp(r.confidence) : 0.5,
    notes: typeof r.notes === "string" ? r.notes : "",
  };
}

function toCommitmentArray(parsed: unknown): CandidateCommitment[] {
  let items: unknown[];

  if (Array.isArray(parsed)) {
    // Model returned a bare array
    items = parsed;
  } else if (parsed && typeof parsed === "object") {
    // Model returned { commitments: [...] } or any wrapper object
    const values = Object.values(parsed as Record<string, unknown>);
    const found = values.find(Array.isArray);
    items = Array.isArray(found) ? found : [];
  } else {
    items = [];
  }

  return items
    .map(normalizeCommitment)
    .filter((c): c is CandidateCommitment => c !== null);
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rawText, currentDate, timezone } = body as {
      rawText?: string;
      currentDate?: string;
      timezone?: string;
    };

    if (!rawText?.trim()) {
      return NextResponse.json({ commitments: [] });
    }

    const rawContent = await callNim(
      extractionSystemPrompt,
      buildExtractionUserPrompt(
        rawText,
        currentDate ?? new Date().toISOString().split("T")[0],
        timezone ?? "UTC"
      ),
      1024
    );

    // Fix model-specific JSON quirks before parsing:
    // 1. Duplicate top-level key: {"commitments":[items],"commitments":[]} → remove trailing empty duplicate
    // 2. Missing opening brace: },{"source" or },"title" → insert missing {
    const content = rawContent
      .replace(/\],\s*"commitments"\s*:\s*\[\s*\]/g, "]")
      .replace(/},\s*"(title|source|hard_or_soft|earliest_start|latest_end|date_confidence|location|reason|confidence|notes)"\s*:/g,
        (_, key) => `},{"${key}":`);
    

    const parsed = extractJson(content);
    const commitments = toCommitmentArray(parsed);
    return NextResponse.json({ commitments });
  } catch (error) {
    return NextResponse.json(
      { commitments: [], error: error instanceof Error ? error.message : "Unknown extract error" },
      { status: 500 }
    );
  }
}
