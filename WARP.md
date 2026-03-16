# Align – Goal-Aware Daily Planning Agent

## Overview
Align reads today's Google Calendar, accepts pasted candidate commitments from email/chat, asks the user for goals and constraints, proposes 2–3 schedule options with tradeoff explanations, and optionally writes the chosen plan back to Google Calendar.

## Stack
- **Framework:** Next.js (App Router) + TypeScript
- **AI:** NVIDIA NIM API (`/v1/chat/completions`) with Nemotron for extraction, ranking, and explanation
- **Calendar:** Google Calendar API (read/write) via Google Identity Services (in-browser OAuth)
- **Auth:** Google Identity Services – browser-only token acquisition, no server-side OAuth flow
- **Database:** None
- **Embeddings:** None
- **Third-party OAuth (Slack/Discord/Email):** None – these are pasted text inputs only

## Key APIs
### NVIDIA NIM
- Endpoint pattern: `https://integrate.api.nvidia.com/v1/chat/completions`
- Standard OpenAI-compatible chat completions interface
- Auth: Bearer token via `NIM_API_KEY` env var

### Google Calendar
- JS quickstart designed for browser apps
- Scopes: `https://www.googleapis.com/auth/calendar.readonly`, `https://www.googleapis.com/auth/calendar.events`
- Event creation: `POST https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events`
- Event list: `GET https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events`
- Auth: Google Identity Services in-browser token (no server secret needed for Calendar access)

## Project Structure
```
app/
  layout.tsx          # Root layout
  page.tsx            # Main UI – single-page app
  api/
    plan/route.ts     # Generate 2-3 schedule options via NIM
    extract/route.ts  # Extract commitments from pasted text via NIM
    apply-plan/route.ts  # Write chosen plan back to Google Calendar
lib/
  nim.ts              # NIM API client
  prompts.ts          # All LLM prompt templates
  calendar.ts         # Google Calendar read/write helpers
  scoring.ts          # Schedule scoring / tradeoff logic
  types.ts            # Shared TypeScript types
  fixtures.ts         # Dev fixtures for testing without live APIs
components/
  GoalForm.tsx            # Goals + constraints input
  CalendarView.tsx        # Today's calendar display
  CandidateCommitments.tsx # Pasted email/chat commitments
  PlanOptions.tsx         # Display 2-3 proposed schedules + tradeoffs
```

## Environment Variables
| Variable | Purpose |
|---|---|
| `NIM_API_KEY` | NVIDIA NIM API key |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth client ID (public, used in browser) |

## Dev Commands
```bash
npm install
npm run dev       # Start dev server on localhost:3000
npm run build     # Production build
npm run lint      # Lint
```

## Architecture Notes
- **No backend auth flow.** Google tokens are acquired entirely in the browser via Google Identity Services and passed to API routes as needed.
- **Pasted text only for email/Slack/Discord.** No OAuth integrations for messaging platforms. Users copy-paste candidate commitments.
- **Stateless.** No database. All state lives in React component state for the duration of a session.
- **NIM handles all LLM work:** commitment extraction from pasted text, schedule generation/ranking, and tradeoff explanation.
