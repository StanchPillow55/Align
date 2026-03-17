export type HardOrSoft = "hard" | "soft";

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string | null;
  description?: string | null;
  isAllDay?: boolean;
}

export interface CandidateCommitment {
  title: string;
  source: string;
  hard_or_soft: HardOrSoft;
  earliest_start: string | null;
  latest_end: string | null;
  date_confidence: number;
  location: string | null;
  reason: string;
  confidence: number;
  notes: string;
}

export interface UserGoals {
  deepWorkHours: number;
  downtimeMinutes: number;
  gymBy?: string | null;
  prioritizeDeadline?: boolean;
  prioritizeSocial?: boolean;
}

export interface UserConstraints {
  maxCommuteMinutes: number;
  minBufferMinutes: number;
  dayEndsAt: string;
}

export type PlanBlockType =
  | "existing"
  | "proposed"
  | "buffer"
  | "deep_work"
  | "downtime"
  | "commute";

export interface PlanBlock {
  title: string;
  type: PlanBlockType;
  start: string;
  end: string;
  location: string | null;
  actionable: boolean;
}

export interface PlanOption {
  id: string;
  title: string;
  score: number;
  score_breakdown: {
    goal_alignment: number;
    deadline_safety: number;
    commute_burden: number;
    downtime_protection: number;
    flexibility: number;
  };
  summary: string;
  warnings: string[];
  blocks: PlanBlock[];
}

export interface PlanResponse {
  bestOptionId: string;
  options: PlanOption[];
}

export interface PlanExplanation {
  explanation: string;
  tradeoffs: string[];
  risks: string[];
}
