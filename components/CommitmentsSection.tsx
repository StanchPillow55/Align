"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { sampleCommitments, sampleCommitmentsText } from "@/lib/fixtures";
import type { CandidateCommitment } from "@/lib/types";

interface Props {
  currentDate: string;
  timezone: string;
  onCommitmentsChange: (commitments: CandidateCommitment[]) => void;
  onDemoChange?: (isDemo: boolean) => void;
}

function DemoBadge() {
  return (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border border-amber-200 dark:border-amber-700 leading-none">
      Demo
    </span>
  );
}

function fmtTime(iso: string | null): string {
  if (!iso) return "";
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

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 80 ? "bg-green-500" : pct >= 50 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground">{pct}%</span>
    </div>
  );
}

export function CommitmentsSection({
  currentDate,
  timezone,
  onCommitmentsChange,
  onDemoChange,
}: Props) {
  const [text, setText] = useState("");
  const [commitments, setCommitments] = useState<CandidateCommitment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);

  function update(next: CandidateCommitment[], demo = false) {
    setCommitments(next);
    onCommitmentsChange(next);
    setIsDemo(demo);
    onDemoChange?.(demo);
  }

  function loadFixtures() {
    setText(sampleCommitmentsText.trim());
    update(sampleCommitments, true);
  }

  async function handleExtract() {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: text, currentDate, timezone }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      update(data.commitments ?? [], false); // real extraction — exit demo mode
    } catch (e) {
      console.error("Extraction error:", e);
      setError("Extraction failed — check your connection, or load demo data.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          3–4 · Commitments
          {isDemo && <DemoBadge />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          rows={4}
          placeholder="Paste emails, Slack messages, texts, or anything with commitments…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={handleExtract}
            disabled={loading || !text.trim()}
            size="sm"
          >
            {loading ? "Extracting…" : "Extract Commitments"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={loadFixtures}
          >
            Load Demo Data
          </Button>
          {commitments.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {commitments.length} commitment{commitments.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {error && (
          <p className="text-sm text-destructive rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
            {error}
          </p>
        )}

        {commitments.length > 0 && (
          <div className="space-y-2">
            {commitments.map((c, i) => {
              const start = fmtTime(c.earliest_start);
              const end = fmtTime(c.latest_end);
              const hasWindow = start || end;

              return (
                <div
                  key={i}
                  className="rounded-lg border p-3 space-y-2 text-sm"
                >
                  {/* Row 1: title + badges + remove */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      <span className="font-medium">{c.title}</span>
                      <Badge
                        variant={
                          c.hard_or_soft === "hard" ? "destructive" : "secondary"
                        }
                        className="text-xs"
                      >
                        {c.hard_or_soft}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        via {c.source}
                      </span>
                    </div>
                    <button
                      onClick={() => update(commitments.filter((_, j) => j !== i))}
                      className="text-xs text-muted-foreground hover:text-destructive shrink-0"
                    >
                      remove
                    </button>
                  </div>

                  {/* Row 2: time window + confidence */}
                  <div className="flex items-center justify-between gap-2">
                    {hasWindow ? (
                      <p className="text-xs text-muted-foreground">
                        {start && `From ${start}`}
                        {start && end && " – "}
                        {end && `by ${end}`}
                      </p>
                    ) : (
                      <span />
                    )}
                    <ConfidenceBar value={c.confidence} />
                  </div>

                  {/* Row 3: location */}
                  {c.location && (
                    <p className="text-xs text-muted-foreground">
                      📍 {c.location}
                    </p>
                  )}

                  {/* Row 4: notes */}
                  {c.notes && (
                    <p className="text-xs text-muted-foreground italic border-t pt-1.5">
                      {c.notes}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
