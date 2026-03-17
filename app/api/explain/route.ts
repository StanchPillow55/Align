import { NextRequest, NextResponse } from "next/server";
import { callNim } from "@/lib/nim";
import { buildExplanationUserPrompt, explanationSystemPrompt } from "@/lib/prompts";
import type { PlanExplanation, PlanOption } from "@/lib/types";
import { extractJson } from "@/lib/json-utils";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { plan } = body as { plan?: PlanOption };

    if (!plan) {
      return NextResponse.json(
        { error: "Missing plan in request body" },
        { status: 400 }
      );
    }

    const content = await callNim(
      explanationSystemPrompt,
      buildExplanationUserPrompt(plan),
      2048
    );

    const parsed = extractJson(content) as Partial<PlanExplanation>;

    const response: PlanExplanation = {
      explanation: typeof parsed.explanation === "string" ? parsed.explanation : "",
      tradeoffs: Array.isArray(parsed.tradeoffs) ? parsed.tradeoffs : [],
      risks: Array.isArray(parsed.risks) ? parsed.risks : [],
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown explanation error" },
      { status: 500 }
    );
  }
}
