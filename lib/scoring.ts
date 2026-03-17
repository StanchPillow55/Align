import type {
  PlanBlock,
  PlanBlockType,
  PlanOption,
  PlanResponse,
  UserConstraints,
  UserGoals,
} from "./types";

// ---------------------------------------------------------------------------
// Scoring weights — sum = 1.0
// deadline_safety carries the most weight: missing a hard commitment is worst.
// ---------------------------------------------------------------------------
export const SCORE_WEIGHTS = {
  goal_alignment: 0.25,
  deadline_safety: 0.30,
  commute_burden: 0.15,
  downtime_protection: 0.15,
  flexibility: 0.15,
} as const;

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/** Compute final weighted score from a score_breakdown object. */
export function computeScore(bd: PlanOption["score_breakdown"]): number {
  return (
    bd.goal_alignment * SCORE_WEIGHTS.goal_alignment +
    bd.deadline_safety * SCORE_WEIGHTS.deadline_safety +
    bd.commute_burden * SCORE_WEIGHTS.commute_burden +
    bd.downtime_protection * SCORE_WEIGHTS.downtime_protection +
    bd.flexibility * SCORE_WEIGHTS.flexibility
  );
}

// ---------------------------------------------------------------------------
// Warning detection — rules-based, applied after normalization
// ---------------------------------------------------------------------------
function durationMin(b: PlanBlock): number {
  const s = new Date(b.start).getTime();
  const e = new Date(b.end).getTime();
  return isNaN(s) || isNaN(e) ? 0 : Math.max(0, (e - s) / 60_000);
}

export function deriveWarnings(
  blocks: PlanBlock[],
  goals: UserGoals,
  constraints: UserConstraints
): string[] {
  const warnings: string[] = [];

  // 1. Overload — non-rest active blocks exceed 9 h
  const activeMin = blocks
    .filter((b) => b.type !== "downtime" && b.type !== "buffer")
    .reduce((sum, b) => sum + durationMin(b), 0);
  if (activeMin > 9 * 60) {
    warnings.push(
      `Schedule overloaded: ${(activeMin / 60).toFixed(1)}h of active blocks (recommended limit ~9h).`
    );
  }

  // 2. Context switching — 3+ consecutive different non-buffer block types
  let switchRun = 0;
  for (let i = 1; i < blocks.length; i++) {
    const prev = blocks[i - 1];
    const cur = blocks[i];
    if (
      prev.type !== "buffer" &&
      cur.type !== "buffer" &&
      prev.type !== cur.type
    ) {
      switchRun++;
      if (switchRun >= 3) {
        warnings.push(
          "High context switching: 3+ consecutive block type changes without buffer blocks."
        );
        break;
      }
    } else {
      switchRun = 0;
    }
  }

  // 3. Downtime goal — scheduled < 50 % of target
  const downtimeMin = blocks
    .filter((b) => b.type === "downtime")
    .reduce((sum, b) => sum + durationMin(b), 0);
  if (goals.downtimeMinutes > 0 && downtimeMin < goals.downtimeMinutes * 0.5) {
    warnings.push(
      `Downtime goal at risk: ${Math.round(downtimeMin)}min scheduled vs ${goals.downtimeMinutes}min goal.`
    );
  }

  // 4. Deep work goal — scheduled < 50 % of target
  const deepMin = blocks
    .filter((b) => b.type === "deep_work")
    .reduce((sum, b) => sum + durationMin(b), 0);
  const deepGoalMin = goals.deepWorkHours * 60;
  if (deepGoalMin > 0 && deepMin < deepGoalMin * 0.5) {
    warnings.push(
      `Deep work goal at risk: ${Math.round(deepMin)}min scheduled vs ${deepGoalMin}min goal.`
    );
  }

  // 5. Commute exceeds user limit
  const commuteMin = blocks
    .filter((b) => b.type === "commute")
    .reduce((sum, b) => sum + durationMin(b), 0);
  if (commuteMin > constraints.maxCommuteMinutes) {
    warnings.push(
      `Commute burden: ${Math.round(commuteMin)}min total commute exceeds ${constraints.maxCommuteMinutes}min limit.`
    );
  }

  return warnings;
}

// ---------------------------------------------------------------------------
// Normalization — coerce raw LLM output into typed PlanOption / PlanBlock
// ---------------------------------------------------------------------------
const VALID_BLOCK_TYPES: PlanBlockType[] = [
  "existing",
  "proposed",
  "buffer",
  "deep_work",
  "downtime",
  "commute",
];

function normalizeBlock(raw: unknown): PlanBlock | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;

  const title = typeof r.title === "string" ? r.title.trim() : "";
  if (!title) return null;

  const start = typeof r.start === "string" ? r.start : "";
  const end = typeof r.end === "string" ? r.end : "";
  if (!start || !end) return null;

  const type: PlanBlockType = VALID_BLOCK_TYPES.includes(
    r.type as PlanBlockType
  )
    ? (r.type as PlanBlockType)
    : "proposed";

  return {
    title,
    type,
    start,
    end,
    location:
      typeof r.location === "string" && r.location ? r.location : null,
    actionable: typeof r.actionable === "boolean" ? r.actionable : true,
  };
}

function normalizeBreakdown(raw: unknown): PlanOption["score_breakdown"] {
  const r =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const n = (v: unknown) => (typeof v === "number" ? clamp01(v) : 0.5);
  return {
    goal_alignment: n(r.goal_alignment),
    deadline_safety: n(r.deadline_safety),
    commute_burden: n(r.commute_burden),
    downtime_protection: n(r.downtime_protection),
    flexibility: n(r.flexibility),
  };
}

function normalizeOption(raw: unknown, idx: number): PlanOption | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;

  const id =
    typeof r.id === "string" && r.id.trim() ? r.id.trim() : `option-${idx + 1}`;
  const title =
    typeof r.title === "string" && r.title.trim()
      ? r.title.trim()
      : `Plan ${idx + 1}`;

  const score_breakdown = normalizeBreakdown(r.score_breakdown);
  // Always recompute from breakdown using our weights — don't trust the model's arithmetic.
  const score = Math.round(computeScore(score_breakdown) * 100) / 100;

  const summary = typeof r.summary === "string" ? r.summary : "";
  const warnings = Array.isArray(r.warnings)
    ? r.warnings.filter((w): w is string => typeof w === "string")
    : [];
  const blocks = Array.isArray(r.blocks)
    ? r.blocks.map(normalizeBlock).filter((b): b is PlanBlock => b !== null)
    : [];

  return { id, title, score, score_breakdown, summary, warnings, blocks };
}

/** Extract options array from whatever shape the model returned. */
export function toOptionsArray(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") {
    const r = parsed as Record<string, unknown>;
    if (Array.isArray(r.options)) return r.options;
    const found = Object.values(r).find(Array.isArray);
    if (Array.isArray(found)) return found;
  }
  return [];
}

// ---------------------------------------------------------------------------
// Final ranking — normalize, merge warnings, sort descending, pick best
// ---------------------------------------------------------------------------
export function rankAndFinalize(
  rawOptions: unknown[],
  goals: UserGoals,
  constraints: UserConstraints
): PlanResponse {
  const options = rawOptions
    .map((o, i) => normalizeOption(o, i))
    .filter((o): o is PlanOption => o !== null)
    .map((opt) => {
      const derived = deriveWarnings(opt.blocks, goals, constraints);
      // Merge model-provided warnings with rule-derived ones (deduplicate).
      const allWarnings = [...new Set([...opt.warnings, ...derived])];
      return { ...opt, warnings: allWarnings };
    });

  // Sort descending by score.
  options.sort((a, b) => b.score - a.score);

  const bestOptionId = options[0]?.id ?? "";
  return { bestOptionId, options };
}
