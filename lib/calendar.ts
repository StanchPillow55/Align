import type { CalendarEvent, PlanOption } from "./types";

type GoogleCalendarEvent = {
  id?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};

export function normalizeGoogleEvents(items: GoogleCalendarEvent[] = []): CalendarEvent[] {
  return items.map((item, index) => {
    const isAllDay = !!item.start?.date && !item.start?.dateTime;
    const start = item.start?.dateTime ?? item.start?.date ?? "";
    const end = item.end?.dateTime ?? item.end?.date ?? start;

    return {
      id: item.id ?? `google-${index}`,
      title: item.summary ?? "Untitled Event",
      start,
      end,
      location: item.location ?? null,
      description: item.description ?? null,
      isAllDay,
    };
  });
}

export function getInsertableBlocks(plan: PlanOption) {
  return plan.blocks.filter(
    (block) => block.actionable && block.type !== "existing"
  );
}
