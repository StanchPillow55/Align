import type { CalendarEvent, CandidateCommitment, UserConstraints, UserGoals } from "./types";

/** Returns an ISO string for today at the given local hours/minutes. */
function todayAt(hours: number, minutes = 0): string {
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

export const sampleCalendarEvents: CalendarEvent[] = [
  {
    id: "fixture-class-1",
    title: "CS Lecture",
    start: todayAt(13, 30),
    end: todayAt(14, 45),
    location: "SJSU Engr 189",
  },
  {
    id: "fixture-team-1",
    title: "Project Team Meeting",
    start: todayAt(17, 0),
    end: todayAt(17, 30),
    location: "Zoom",
  },
];

export const sampleCommitmentsText = `
Discord: dinner at 7 tonight downtown?
Email: recruiter coffee chat around 4:30 PM if you're free.
Slack: can you hop on for 20 mins before 5 to review the slides?
Text: gym before 6 or you'll skip it again.
Assignment due tonight by 11:59 PM.
`;

export const sampleCommitments: CandidateCommitment[] = [
  {
    title: "Recruiter Coffee Chat",
    source: "email",
    hard_or_soft: "soft",
    earliest_start: todayAt(16, 30),
    latest_end: todayAt(17, 0),
    date_confidence: 0.88,
    location: "Cafe near campus",
    reason: "Potential networking opportunity",
    confidence: 0.91,
    notes: "Flexible if user is free",
  },
  {
    title: "Dinner Downtown",
    source: "discord",
    hard_or_soft: "soft",
    earliest_start: todayAt(19, 0),
    latest_end: todayAt(20, 30),
    date_confidence: 0.9,
    location: "Downtown San Jose",
    reason: "Social commitment",
    confidence: 0.87,
    notes: "Adds commute burden",
  },
  {
    title: "Assignment Due",
    source: "task",
    hard_or_soft: "hard",
    earliest_start: null,
    latest_end: todayAt(23, 59),
    date_confidence: 1,
    location: null,
    reason: "Deadline tonight",
    confidence: 1,
    notes: "Needs protected work time before midnight",
  },
];

export const sampleGoals: UserGoals = {
  deepWorkHours: 2,
  downtimeMinutes: 30,
  gymBy: "18:00",
  prioritizeDeadline: true,
  prioritizeSocial: false,
};

export const sampleConstraints: UserConstraints = {
  maxCommuteMinutes: 45,
  minBufferMinutes: 15,
  dayEndsAt: "21:30",
};
