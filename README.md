# Align

**Turn your calendar, inbox, and goals into a ranked daily schedule.**

Align is a hackathon MVP. It ingests your Google Calendar events and pasted text
commitments, runs them through NVIDIA Nemotron via NIM, and returns 2–3 ranked,
tradeoff-aware schedule options with scored breakdowns and natural-language explanations.

---

## What the App Does

1. **Load calendar events** — connect Google Calendar or use built-in fixture data
2. **Paste commitments** — copy/paste emails, Slack threads, Discord messages, texts
3. **Extract** — Nemotron parses the text into structured commitment objects (hard vs. soft, time windows, confidence)
4. **Set goals & constraints** — deep work hours, downtime target, gym deadline, day end, max commute, min buffer
5. **Generate plan** — Nemotron produces 2–3 ranked schedule options, each with a block-by-block timeline, 5-dimension score breakdown, and warnings
6. **Explain** — click "Why this plan?" for a Nemotron natural-language explanation of tradeoffs and risks
7. **Apply** — write the chosen plan's new blocks back to Google Calendar

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript |
| AI | NVIDIA NIM — `nvidia/llama-3.1-nemotron-nano-8b-v1` |
| Calendar | Google Calendar API v3 + Google Identity Services (browser auth) |
| UI | Tailwind CSS + shadcn/ui |
| State | React component state only (no database) |

---

## Prerequisites

- Node.js 18+
- NVIDIA NIM API key ([build.nvidia.com](https://build.nvidia.com))
- Google OAuth client ID (optional — only needed for live Calendar access)

---

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

Create (or edit) `.env.local` in the project root:

```bash
# ── NVIDIA NIM (required for extraction, planning, and explanation) ──
NIM_API_KEY=nvapi-xxxxxxxxxxxxxxxxxxxxxxxxxxxx
NIM_BASE_URL=https://integrate.api.nvidia.com
NIM_MODEL=nvidia/llama-3.1-nemotron-nano-8b-v1

# ── Google OAuth (optional — only needed for live Calendar access) ──
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

> `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is the only Google credential needed.
> Auth is browser-only via Google Identity Services — no server-side OAuth secret required.

### Getting your NVIDIA NIM API key

1. Go to [build.nvidia.com](https://build.nvidia.com) and sign in
2. Navigate to **API Keys** and generate a new key
3. Paste it as `NIM_API_KEY` in `.env.local`
4. `nvidia/llama-3.1-nemotron-nano-8b-v1` is available on the free tier

> **No pre-configuration step.** All system prompts are in `lib/prompts.ts` and sent
> automatically per-request. Your API key is the only credential required.

### Setting up Google OAuth (optional)

Only required to load live calendar events or write plans back to Google Calendar.
The app is fully demoable without it.

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project → enable **Google Calendar API**
3. Create an **OAuth 2.0 Client ID** (Web application type)
4. Add `http://localhost:3000` as an authorized JavaScript origin
5. Paste the Client ID as `NEXT_PUBLIC_GOOGLE_CLIENT_ID`

---

## Using the App (7-Step Flow)

The UI has three columns. Work left → center → right.

**Left — Calendar (Steps 1–2)**
Click **Connect Calendar** to authorize Google, or **Use Sample Events** to load
fixture data and skip auth. Once connected, click **Load Today's Events**.

**Center — Commitments + Goals (Steps 3–5)**
Paste raw text or click **Load Demo Data** for pre-filled fixtures.
Click **Extract Commitments** to call Nemotron (skipped when using demo data).
Adjust Goals & Constraints to your preferences.

**Right — Schedule Options (Steps 6–7)**
Click **Generate Plan** — Nemotron returns 2–3 ranked options.
Expand any card to see the 5-dimension score breakdown, warnings, and block timeline.
Click **Why this plan?** to get a Nemotron explanation of why it was recommended,
what tradeoffs it makes, and what could go wrong.
Select a plan and click **Apply to Google Calendar** to write the new events.

---

## Demo Mode

Fully demoable without a Google Calendar connection:

1. Click **Use Sample Events** → loads 2 fixture events (CS Lecture, team meeting)
2. Click **Load Demo Data** → loads 3 pre-parsed commitments (recruiter chat, dinner, assignment)
3. Click **Generate Plan** → calls NVIDIA NIM for real ranked options
4. Click **Why this plan?** → calls NVIDIA NIM for a real explanation

A **● Demo Mode** badge appears in the header when fixture data is active.
NIM API key is still required for steps 3–4.

---

## How Nemotron / NIM Is Used

All five prompts live in `lib/prompts.ts`. Every call uses:
- **Endpoint:** `${NIM_BASE_URL}/v1/chat/completions` (OpenAI-compatible)
- **Auth:** `Authorization: Bearer ${NIM_API_KEY}`
- **Temperature:** 0.2 for deterministic, structured output
- **max_tokens:** bounded per-route to prevent runaway responses

### Prompt A — Extraction system prompt

Instructs Nemotron to parse messy text into `CandidateCommitment` objects.
Classifies each item as `hard` (fixed time) or `soft` (flexible).
Enforces JSON-only output with a concrete single-line example for format anchoring.
Used by: `/api/extract` (`max_tokens: 1024`)

### Prompt B — Extraction user prompt

Injects `currentDate`, `timezone`, and the raw pasted text into the extraction call.
Paired with prompt A.

### Prompt C — Planning system prompt

Instructs Nemotron to produce 2–3 ranked schedule options with block-by-block timelines,
5-dimension `score_breakdown`, plan `summary`, and `warnings`.
Valid block types: `existing`, `proposed`, `buffer`, `deep_work`, `downtime`, `commute`.
Used by: `/api/plan` (`max_tokens: 4096`)

### Prompt D — Planning user prompt

Injects calendar events, candidate commitments, user goals, and constraints as JSON blobs.
Paired with prompt C.

### Prompt E — Explanation system prompt

Given a selected `PlanOption`, returns:
```json
{ "explanation": "...", "tradeoffs": ["..."], "risks": ["..."] }
```
Keeps responses concise and practical.
Used by: `/api/explain` (`max_tokens: 600`)

All NIM responses pass through a 4-stage JSON fallback parser (`lib/json-utils.ts`)
that handles markdown fences, bare arrays, and loose object extraction.
Scores returned by the model are discarded and recomputed server-side using fixed
weights in `lib/scoring.ts` (`deadline_safety: 30%, goal_alignment: 25%,
commute_burden: 15%, downtime_protection: 15%, flexibility: 15%`).

---

## Architecture

```
app/
  page.tsx                  # Single-page client — 3-column layout, all state
  api/
    extract/route.ts        # POST: raw text → CandidateCommitment[]   (prompts A+B)
    plan/route.ts           # POST: events + commitments + goals → PlanResponse (prompts C+D)
    explain/route.ts        # POST: selected plan → PlanExplanation    (prompt E)
    apply-plan/route.ts     # POST: selected blocks → Google Calendar events
lib/
  nim.ts                    # NIM client — fetch, Bearer auth, temp 0.2, max_tokens
  prompts.ts                # All 5 prompts (A–E) + user prompt builder functions
  json-utils.ts             # 4-stage JSON fallback parser
  scoring.ts                # Score weights, normalization, warning detection, ranking
  calendar.ts               # Google Calendar normalizer + insertable block filter
  types.ts                  # Shared TypeScript interfaces
  fixtures.ts               # Demo data with today-relative timestamps
components/
  CalendarSection.tsx       # GIS browser auth + event list + demo mode
  CommitmentsSection.tsx    # Paste textarea + NIM extraction + commitment cards
```

**Data flow:**
```
Paste text  → /api/extract (A+B) → Nemotron → CandidateCommitment[]
Events+goals → /api/plan  (C+D) → Nemotron → PlanResponse (ranked options)
Selected plan → /api/explain (E) → Nemotron → PlanExplanation
User picks  → /api/apply-plan   → Google Calendar API → events created
```

**No database.** State lives in React for the duration of the session.
**No server-side OAuth.** Google tokens are acquired in-browser via GIS.

---

## What Works

- NIM extraction (prompt A+B) → structured commitments with confidence scores
- NIM planning (prompt C+D) → 2–3 ranked plans with score breakdown and warnings
- NIM explanation (prompt E) → tradeoffs and risks for any selected plan
- Demo mode with today-relative fixture data (no Google auth needed)
- Score recomputation server-side (model scores are overridden with weighted formula)
- Rule-based warning augmentation (overload, context switching, downtime/deep work shortfalls, commute)
- Google Calendar read (live events for today)
- Google Calendar write-back (apply chosen plan blocks as new events)

## What Is Mock / Demo-Only

- Fixture calendar events and commitments in `lib/fixtures.ts`
- No email/Slack/Discord OAuth — paste only
- No session persistence — state resets on page reload

---

## Known Limitations

- **Model**: `nvidia/llama-3.1-nemotron-70b-instruct` requires plan-tier access on some accounts; the app falls back to `nvidia/llama-3.1-nemotron-nano-8b-v1` (8B) which works on the free tier. Update `NIM_MODEL` in `.env.local` to swap models.
- **JSON quirks**: The 8B model occasionally emits duplicate JSON keys or omits opening braces on array items; the extract route pre-processes these before parsing.
- **Larger reasoning models** (`nemotron-super-49b`, `nemotron-ultra-253b`) use `<think>` chain-of-thought blocks that can exhaust the token budget before producing JSON — avoid them for structured output tasks.
- Planning responses with many blocks may approach the 4096-token limit; increase `max_tokens` in `/api/plan/route.ts` if truncation occurs.
- Google Calendar access token expires (~1 hour); user must re-click Connect to refresh.
- "Why this plan?" explanations are cached per plan ID for the session only.

---

## Next Steps After the Hackathon

- Multi-day planning (current scope is one day)
- Auto-ingest from email or calendar instead of paste-only
- Persistent session or lightweight backend (IndexedDB, KV store)
- Streaming NIM responses for faster perceived latency on the planning step
- Google Calendar token refresh without requiring a full reconnect

---

## Commands

```bash
npm install    # Install dependencies
npm run dev    # Start dev server on localhost:3000
npm run build  # Production build + TypeScript check
npm run lint   # ESLint
```
