import { NextRequest, NextResponse } from "next/server";
import { callNim } from "@/lib/nim";
import { buildPlanningUserPrompt, planningSystemPrompt } from "@/lib/prompts";
import type { CalendarEvent, CandidateCommitment, UserConstraints, UserGoals } from "@/lib/types";
import { extractJson } from "@/lib/json-utils";
import { rankAndFinalize, toOptionsArray } from "@/lib/scoring";

const DEFAULT_GOALS: UserGoals = {
  deepWorkHours: 2,
  downtimeMinutes: 30,
  gymBy: null,
  prioritizeDeadline: true,
  prioritizeSocial: false,
};

const DEFAULT_CONSTRAINTS: UserConstraints = {
  maxCommuteMinutes: 30,
  minBufferMinutes: 10,
  dayEndsAt: "22:00",
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      events,
      commitments,
      goals,
      constraints,
      currentDate,
      timezone,
    } = body as {
      events?: CalendarEvent[];
      commitments?: CandidateCommitment[];
      goals?: UserGoals;
      constraints?: UserConstraints;
      currentDate?: string;
      timezone?: string;
    };

    const resolvedGoals = goals ?? DEFAULT_GOALS;
    const resolvedConstraints = constraints ?? DEFAULT_CONSTRAINTS;

    const content = await callNim(
      planningSystemPrompt,
      buildPlanningUserPrompt(
        events ?? [],
        commitments ?? [],
        resolvedGoals,
        resolvedConstraints,
        currentDate ?? new Date().toISOString().split("T")[0],
        timezone ?? "UTC"
      ),
      4096
    );

    const parsed = extractJson(content);
    const rawOptions = toOptionsArray(parsed);
    const response = rankAndFinalize(rawOptions, resolvedGoals, resolvedConstraints);

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        bestOptionId: "",
        options: [],
        error: error instanceof Error ? error.message : "Unknown planning error",
      },
      { status: 500 }
    );
  }
}
