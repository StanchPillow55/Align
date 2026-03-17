"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CalendarSection } from "@/components/CalendarSection";
import { CommitmentsSection } from "@/components/CommitmentsSection";
import { getInsertableBlocks } from "@/lib/calendar";
import { SCORE_WEIGHTS } from "@/lib/scoring";
import type {
  CalendarEvent,
  CandidateCommitment,
  PlanExplanation,
  PlanOption,
  UserConstraints,
  UserGoals,
} from "@/lib/types";

const TODAY = new Date().toISOString().split("T")[0];
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

const FLOW_STEPS = [
  "Connect", "Load", "Paste", "Extract", "Goals", "Generate", "Apply",
];

const BLOCK_DOT: Record<string, string> = {
  existing:  "bg-zinc-400",
  proposed:  "bg-blue-500",
  deep_work: "bg-indigo-500",
  buffer:    "bg-zinc-300",
  downtime:  "bg-green-500",
  commute:   "bg-amber-500",
};

const BLOCK_TEXT: Record<string, string> = {
  existing:  "text-muted-foreground",
  proposed:  "text-blue-600 dark:text-blue-400 font-medium",
  deep_work: "text-indigo-600 dark:text-indigo-400 font-medium",
  buffer:    "text-muted-foreground italic",
  downtime:  "text-green-600 dark:text-green-400 italic",
  commute:   "text-amber-600 dark:text-amber-400",
};

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Polish helpers
// ---------------------------------------------------------------------------
function ErrorBox({ message }: { message: string }) {
  return (
    <p className="text-sm text-destructive rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
      {message}
    </p>
  );
}

function PlanSkeleton() {
  return (
    <div className="rounded-lg border px-3 py-2.5 space-y-2 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-3.5 bg-muted rounded w-1/2" />
        <div className="h-3.5 bg-muted rounded w-8" />
      </div>
      <div className="h-3 bg-muted rounded w-full" />
      <div className="h-3 bg-muted rounded w-4/5" />
    </div>
  );
}

function Preflight({
  hasEvents,
  hasCommitments,
}: {
  hasEvents: boolean;
  hasCommitments: boolean;
}) {
  const steps = [
    { done: hasEvents, label: "Load calendar events" },
    { done: hasCommitments, label: "Add commitments" },
    { done: false, label: "Click Generate Plan" },
  ];
  return (
    <div className="rounded-lg border border-dashed p-4 space-y-2.5">
      {steps.map(({ done, label }, i) => (
        <div key={i} className="flex items-center gap-2.5 text-sm">
          <span
            className={
              done
                ? "text-green-500 dark:text-green-400"
                : "text-muted-foreground/40"
            }
          >
            {done ? "✓" : "○"}
          </span>
          <span className={done ? "text-foreground" : "text-muted-foreground"}>
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Score analysis helpers
// ---------------------------------------------------------------------------
type DimKey = keyof PlanOption["score_breakdown"];

const DIMS: { key: DimKey; label: string }[] = [
  { key: "deadline_safety",     label: "Deadline" },
  { key: "goal_alignment",      label: "Goals" },
  { key: "commute_burden",      label: "Commute" },
  { key: "downtime_protection", label: "Downtime" },
  { key: "flexibility",         label: "Flexibility" },
];

const DIM_SHORT: Record<DimKey, string> = {
  deadline_safety:     "deadline safety",
  goal_alignment:      "goal alignment",
  commute_burden:      "commute",
  downtime_protection: "downtime",
  flexibility:         "flexibility",
};

function dimExplanation(key: DimKey, pct: number): string {
  switch (key) {
    case "deadline_safety":
      return pct >= 85 ? "All commitments placed"
           : pct >= 60 ? "Most deadlines covered"
           : "Deadline gaps present";
    case "goal_alignment":
      return pct >= 85 ? "All goals addressed"
           : pct >= 60 ? "Key goals covered"
           : "Goals partially met";
    case "commute_burden":
      return pct >= 85 ? "Minimal travel"
           : pct >= 60 ? "Manageable commute"
           : "Heavy travel load";
    case "downtime_protection":
      return pct >= 85 ? "Rest fully protected"
           : pct >= 60 ? "Adequate recovery"
           : "Limited downtime";
    case "flexibility":
      return pct >= 85 ? "High optionality"
           : pct >= 60 ? "Some slack retained"
           : "Tightly packed";
  }
}

function computeEdge(
  option: PlanOption,
  allOptions: PlanOption[]
): { rank: number; edgeText: string } {
  const sorted = [...allOptions].sort((a, b) => b.score - a.score);
  const rank = sorted.findIndex((o) => o.id === option.id) + 1;

  const others = allOptions.filter((o) => o.id !== option.id);
  if (others.length === 0) return { rank, edgeText: "Only option" };

  const leads: string[] = [];
  for (const { key } of DIMS) {
    const mine = option.score_breakdown[key];
    const best = Math.max(...others.map((o) => o.score_breakdown[key]));
    if (mine > best + 0.05) leads.push(DIM_SHORT[key]);
  }

  const edgeText =
    leads.length > 0
      ? `Leads in ${leads.join(", ")}`
      : rank === 1
      ? "Best overall balance"
      : "Competitive across dimensions";

  return { rank, edgeText };
}

function scoreColor(pct: number): string {
  return pct >= 75
    ? "text-green-600 dark:text-green-400"
    : pct >= 50
    ? "text-amber-600 dark:text-amber-400"
    : "text-red-500 dark:text-red-400";
}

// ---------------------------------------------------------------------------
// Score panel — shown in the expanded plan card
// ---------------------------------------------------------------------------
function ScoreDimBar({
  label,
  weight,
  value,
  explanation,
}: {
  label: string;
  weight: number;
  value: number;
  explanation: string;
}) {
  const pct = Math.round(value * 100);
  const barColor =
    pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-amber-400" : "bg-red-400";
  return (
    <div>
      <div className="flex items-center gap-2 text-xs">
        <span className="w-[4.5rem] shrink-0 text-foreground/70">
          {label}
          <span className="opacity-40 ml-1">{Math.round(weight * 100)}%</span>
        </span>
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span
          className={`w-6 text-right tabular-nums font-medium text-xs ${
            scoreColor(pct)
          }`}
        >
          {pct}
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground leading-none mt-0.5 pl-[4.75rem]">
        {explanation}
      </p>
    </div>
  );
}

function ScorePanel({
  option,
  allOptions,
}: {
  option: PlanOption;
  allOptions: PlanOption[];
}) {
  const { rank, edgeText } = computeEdge(option, allOptions);
  const totalPct = Math.round(option.score * 100);

  return (
    <div className="space-y-3 py-2.5 border-t border-b">
      {/* Total score + rank + edge */}
      <div className="flex items-baseline gap-2">
        <span
          className={`text-2xl font-bold tabular-nums leading-none ${
            scoreColor(totalPct)
          }`}
        >
          {totalPct}
        </span>
        <span className="text-xs text-muted-foreground">/100</span>
        <span className="text-xs font-semibold text-foreground/80">#{rank}</span>
        <span className="text-xs text-muted-foreground">·</span>
        <span className="text-xs text-foreground/70 flex-1">{edgeText}</span>
      </div>

      {/* Per-dimension bars with explanations */}
      <div className="space-y-2">
        {DIMS.map(({ key, label }) => (
          <ScoreDimBar
            key={key}
            label={label}
            weight={SCORE_WEIGHTS[key]}
            value={option.score_breakdown[key]}
            explanation={dimExplanation(
              key,
              Math.round(option.score_breakdown[key] * 100)
            )}
          />
        ))}
      </div>
    </div>
  );
}

export default function Page() {
  const [date, setDate] = useState(TODAY);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [commitments, setCommitments] = useState<CandidateCommitment[]>([]);

  const [goals, setGoals] = useState<UserGoals>({
    deepWorkHours: 2,
    downtimeMinutes: 30,
    gymBy: null,
    prioritizeDeadline: true,
    prioritizeSocial: false,
  });

  const [constraints, setConstraints] = useState<UserConstraints>({
    dayEndsAt: "21:00",
    maxCommuteMinutes: 30,
    minBufferMinutes: 15,
  });

  const [isDemoCalendar, setIsDemoCalendar] = useState(false);
  const [isDemoCommitments, setIsDemoCommitments] = useState(false);

  const [planOptions, setPlanOptions] = useState<PlanOption[]>([]);
  const [bestOptionId, setBestOptionId] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  const [applyLoading, setApplyLoading] = useState(false);
  const [applyResults, setApplyResults] = useState<
    { title: string; ok: boolean }[] | null
  >(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  // Explanation state keyed by plan id
  const [explanations, setExplanations] = useState<Record<string, PlanExplanation>>({})
  const [explainLoading, setExplainLoading] = useState<string | null>(null);
  const [explainError, setExplainError] = useState<string | null>(null);

  async function handleGeneratePlan() {
    setPlanLoading(true);
    setPlanError(null);
    setPlanOptions([]);
    setSelectedPlanId(null);
    setBestOptionId(null);
    setExpandedPlanId(null);
    setApplyResults(null);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          events: calendarEvents,
          commitments,
          goals,
          constraints,
          currentDate: date,
          timezone: TZ,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPlanOptions(data.options ?? []);
      setBestOptionId(data.bestOptionId ?? null);
      const first = data.bestOptionId ?? data.options?.[0]?.id ?? null;
      setSelectedPlanId(first);
      setExpandedPlanId(first);
    } catch (e) {
      console.error("Plan generation error:", e);
      setPlanError("Plan generation failed — check your connection and try again.");
    } finally {
      setPlanLoading(false);
    }
  }

  async function handleApply() {
    const plan = planOptions.find((p) => p.id === selectedPlanId);
    if (!plan || !accessToken) return;
    setApplyLoading(true);
    setApplyError(null);
    setApplyResults(null);
    try {
      const blocks = getInsertableBlocks(plan);
      const res = await fetch("/api/apply-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken, blocks }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setApplyResults(data.results ?? []);
    } catch (e) {
      console.error("Apply error:", e);
      setApplyError("Couldn't write to calendar — check your Google Calendar permissions.");
    } finally {
      setApplyLoading(false);
    }
  }

  async function handleExplain(option: PlanOption) {
    if (explanations[option.id]) return; // already fetched
    setExplainLoading(option.id);
    setExplainError(null);
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: option }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setExplanations((prev) => ({ ...prev, [option.id]: data }));
    } catch (e) {
      console.error("Explain error:", e);
      setExplainError("Couldn't generate explanation — try again.");
    } finally {
      setExplainLoading(null);
    }
  }

  const selectedPlan = planOptions.find((p) => p.id === selectedPlanId);
  const insertableCount = selectedPlan
    ? getInsertableBlocks(selectedPlan).length
    : 0;
  const appliedOk = applyResults?.filter((r) => r.ok).length ?? 0;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">

      {/* ── Header ── */}
      <header className="shrink-0 border-b px-5 py-2.5 flex items-center justify-between gap-4">
        <div className="shrink-0">
          <h1 className="text-base font-semibold tracking-tight leading-none">Align</h1>
          <p className="text-xs text-muted-foreground">
            Turn your calendar, inbox, and goals into a ranked daily schedule.
          </p>
        </div>

        {/* Flow steps */}
        <div className="hidden lg:flex items-center gap-0.5 text-xs text-muted-foreground overflow-x-auto">
          {FLOW_STEPS.map((step, i) => (
            <span key={step} className="flex items-center gap-0.5 shrink-0">
              {i > 0 && <span className="opacity-25 px-0.5">›</span>}
              <span className="bg-muted rounded px-1.5 py-0.5">
                <span className="opacity-50">{i + 1} </span>{step}
              </span>
            </span>
          ))}
        </div>

        {/* Demo Mode indicator */}
        {(isDemoCalendar || isDemoCommitments) && (
          <span className="shrink-0 flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border border-amber-200 dark:border-amber-700">
            ● Demo Mode
          </span>
        )}
      </header>

      {/* ── 3-column body ── */}
      <div className="flex-1 overflow-hidden grid grid-cols-3 divide-x min-h-0">

        {/* ──────────────────── LEFT: Calendar ──────────────────── */}
        <div className="overflow-y-auto p-4">
          <CalendarSection
            date={date}
            onDateChange={setDate}
            onEventsLoaded={setCalendarEvents}
            onTokenChange={setAccessToken}
            onDemoChange={setIsDemoCalendar}
          />
        </div>

        {/* ──────────────────── CENTER: Commitments + Goals ──────────────────── */}
        <div className="overflow-y-auto p-4 space-y-4">
          <CommitmentsSection
            currentDate={date}
            timezone={TZ}
            onCommitmentsChange={setCommitments}
            onDemoChange={setIsDemoCommitments}
          />

          {/* Goals & Constraints */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">5 · Goals &amp; Constraints</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Deep work (hrs)</label>
                  <Input
                    type="number" min={0} max={8} step={0.5}
                    value={goals.deepWorkHours}
                    className="h-8 text-sm"
                    onChange={(e) =>
                      setGoals({ ...goals, deepWorkHours: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Downtime (min)</label>
                  <Input
                    type="number" min={0} step={15}
                    value={goals.downtimeMinutes}
                    className="h-8 text-sm"
                    onChange={(e) =>
                      setGoals({ ...goals, downtimeMinutes: parseInt(e.target.value) || 0 })
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Gym by</label>
                  <Input
                    type="time"
                    value={goals.gymBy ?? ""}
                    className="h-8 text-sm"
                    onChange={(e) =>
                      setGoals({ ...goals, gymBy: e.target.value || null })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Day ends at</label>
                  <Input
                    type="time"
                    value={constraints.dayEndsAt}
                    className="h-8 text-sm"
                    onChange={(e) =>
                      setConstraints({ ...constraints, dayEndsAt: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Max commute (min)</label>
                  <Input
                    type="number" min={0}
                    value={constraints.maxCommuteMinutes}
                    className="h-8 text-sm"
                    onChange={(e) =>
                      setConstraints({
                        ...constraints,
                        maxCommuteMinutes: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Min buffer (min)</label>
                  <Input
                    type="number" min={0}
                    value={constraints.minBufferMinutes}
                    className="h-8 text-sm"
                    onChange={(e) =>
                      setConstraints({
                        ...constraints,
                        minBufferMinutes: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>

              <div className="flex gap-5">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={goals.prioritizeDeadline ?? false}
                    onChange={(e) =>
                      setGoals({ ...goals, prioritizeDeadline: e.target.checked })
                    }
                  />
                  Prioritize deadlines
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={goals.prioritizeSocial ?? false}
                    onChange={(e) =>
                      setGoals({ ...goals, prioritizeSocial: e.target.checked })
                    }
                  />
                  Prioritize social
                </label>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ──────────────────── RIGHT: Plans + Apply ──────────────────── */}
        <div className="overflow-y-auto p-4 space-y-4">

          {/* Generate header */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">6 · Schedule Options</p>
            <Button
              onClick={handleGeneratePlan}
              disabled={planLoading}
              size="sm"
            >
              {planLoading ? "Generating…" : "Generate Plan"}
            </Button>
          </div>

          {planError && <ErrorBox message={planError} />}

          {planLoading && (
            <div className="space-y-2">
              <PlanSkeleton />
              <PlanSkeleton />
              <PlanSkeleton />
            </div>
          )}

          {!planLoading && planOptions.length === 0 && !planError && (
            <Preflight
              hasEvents={calendarEvents.length > 0}
              hasCommitments={commitments.length > 0}
            />
          )}

          {/* Plan option cards */}
          <div className="space-y-2">
            {planOptions.map((option) => {
              const isSelected = selectedPlanId === option.id;
              const isExpanded = expandedPlanId === option.id;
              return (
                <div
                  key={option.id}
                  className={`rounded-lg border transition-colors ${
                    isSelected
                      ? "border-primary bg-primary/5 dark:bg-primary/10"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  {/* Always-visible header row */}
                  <button
                    className="w-full text-left px-3 py-2.5"
                    onClick={() => {
                      setSelectedPlanId(option.id);
                      setExpandedPlanId(isExpanded ? null : option.id);
                      setApplyResults(null);
                      setApplyError(null);
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">{option.title}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {option.id === bestOptionId && (
                          <Badge variant="secondary" className="text-xs h-5">Best</Badge>
                        )}
                        <span
                          className={`text-xs font-semibold tabular-nums ${
                            scoreColor(Math.round(option.score * 100))
                          }`}
                        >
                          {Math.round(option.score * 100)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {isExpanded ? "▲" : "▼"}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                      {option.summary}
                    </p>
                  </button>

                  {/* Expanded: breakdown + warnings + timeline */}
                  {isExpanded && (
                    <div className="px-3 pb-3 space-y-2">
                      <ScorePanel option={option} allOptions={planOptions} />

                      {option.warnings.length > 0 && (
                        <ul className="space-y-0.5">
                          {option.warnings.map((w, i) => (
                            <li
                              key={i}
                              className="text-xs text-amber-600 dark:text-amber-400"
                            >
                              ⚠ {w}
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* Why this plan? */}
                      {!explanations[option.id] && (
                        <div className="pt-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-xs h-7"
                            disabled={explainLoading === option.id}
                            onClick={() => handleExplain(option)}
                          >
                            {explainLoading === option.id
                              ? "Explaining…"
                              : "Why this plan?"}
                          </Button>
                          {explainError && explainLoading === null && (
                            <p className="text-xs text-destructive mt-1">{explainError}</p>
                          )}
                        </div>
                      )}

                      {explanations[option.id] && (
                        <div className="space-y-2 pt-1 border-t">
                          <p className="text-xs font-medium text-foreground/80">Why this plan?</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {explanations[option.id].explanation}
                          </p>
                          {explanations[option.id].tradeoffs.length > 0 && (
                            <div>
                              <p className="text-[11px] font-semibold text-foreground/60 uppercase tracking-wide mb-1">Tradeoffs</p>
                              <ul className="space-y-0.5">
                                {explanations[option.id].tradeoffs.map((t, i) => (
                                  <li key={i} className="text-xs text-muted-foreground">· {t}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {explanations[option.id].risks.length > 0 && (
                            <div>
                              <p className="text-[11px] font-semibold text-foreground/60 uppercase tracking-wide mb-1">Risks</p>
                              <ul className="space-y-0.5">
                                {explanations[option.id].risks.map((r, i) => (
                                  <li key={i} className="text-xs text-amber-600 dark:text-amber-400">⚠ {r}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      <ul className="space-y-1.5 pt-1">
                        {option.blocks.map((block, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs">
                            <span
                              className={`mt-[3px] w-2 h-2 rounded-full shrink-0 ${
                                BLOCK_DOT[block.type] ?? "bg-zinc-400"
                              }`}
                            />
                            <span className="text-muted-foreground w-[6.5rem] shrink-0 tabular-nums">
                              {fmtTime(block.start)}–{fmtTime(block.end)}
                            </span>
                            <span
                              className={`flex-1 ${
                                BLOCK_TEXT[block.type] ?? ""
                              }`}
                            >
                              {block.title}
                            </span>
                            {block.type === "proposed" && (
                              <Badge
                                variant="outline"
                                className="text-[10px] h-4 px-1 shrink-0"
                              >
                                new
                              </Badge>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Apply to Calendar */}
          {planOptions.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">7 · Apply to Calendar</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!selectedPlan ? (
                  <p className="text-sm text-muted-foreground">Select a plan option above.</p>
                ) : (
                  <>
                    <p className="text-sm">
                      Add{" "}
                      <strong>
                        {insertableCount} event{insertableCount !== 1 ? "s" : ""}
                      </strong>{" "}
                      from <strong>{selectedPlan.title}</strong> to Google Calendar.
                    </p>
                    <Button
                      onClick={handleApply}
                      disabled={applyLoading || !accessToken}
                      className="w-full"
                      size="sm"
                    >
                      {applyLoading
                        ? "Applying…"
                        : !accessToken
                        ? "Connect Calendar First"
                        : "Apply to Google Calendar"}
                    </Button>
                    {applyResults !== null && (
                      <p className="text-sm text-green-600 dark:text-green-400">
                        ✓ Added {appliedOk} of {applyResults.length} event
                        {applyResults.length !== 1 ? "s" : ""} to your calendar.
                      </p>
                    )}
                    {applyError && <ErrorBox message={applyError} />}
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
