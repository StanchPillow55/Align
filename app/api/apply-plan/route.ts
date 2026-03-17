import { NextRequest, NextResponse } from "next/server";
import type { PlanBlock } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const { accessToken, blocks } = await req.json();

    const results = await Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      blocks.map(async (block: PlanBlock) => {
        const res = await fetch(
          "https://www.googleapis.com/calendar/v3/calendars/primary/events",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              summary: block.title,
              location: block.location ?? undefined,
              start: { dateTime: block.start },
              end: { dateTime: block.end },
            }),
          }
        );

        if (!res.ok) {
          return {
            title: block.title,
            ok: false,
            error: await res.text(),
          };
        }

        return {
          title: block.title,
          ok: true,
          event: await res.json(),
        };
      })
    );

    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown apply-plan error" },
      { status: 500 }
    );
  }
}
