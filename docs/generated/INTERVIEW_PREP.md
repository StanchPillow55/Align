# 🎯 Interview Prep - Align

**Last Updated:** 2026-04-29

---

## 60-90 Second STAR Pitch

### Situation
Professionals struggle to balance calendar events, commitments from various sources (email, Slack, Discord), and personal goals like deep work time, resulting in chaotic, unoptimized schedules.

### Task
Build an AI-powered schedule optimizer that ingests calendar events and text-based commitments, then generates ranked, tradeoff-aware schedule options using NVIDIA Nemotron.

### Action
- Built **Next.js app** with 3-column workflow (calendar → commitments → plans)
- Integrated **NVIDIA NIM API** with Nemotron for structured JSON output
- Created **5-prompt architecture** for extraction, planning, and explanation
- Implemented **Google Calendar integration** (read events, write-back plans)
- Designed **5-dimension scoring system** (deadline safety, goal alignment, commute burden, downtime protection, flexibility)
- Built **demo mode** with fixture data for API-key-free testing

### Result

| Feature | Status | Evidence |
|---------|--------|----------|
| NVIDIA NIM integration | **Confirmed** | 5 prompts in `lib/prompts.ts` |
| Google Calendar read/write | **Confirmed** | GIS browser auth |
| 5-dimension scoring | **Confirmed** | `lib/scoring.ts` |
| 2-3 ranked plans | **Confirmed** | Planning prompt output |
| Demo mode | **Confirmed** | Fixture data + demo badge |
| "Why this plan?" | **Confirmed** | Explanation API |

---

## Technical Deep Dive

### Architecture
- **Framework:** Next.js 16 (App Router) + TypeScript
- **AI:** NVIDIA NIM with `llama-3.1-nemotron-nano-8b-v1`
- **Calendar:** Google Calendar API v3 + Google Identity Services
- **UI:** Tailwind CSS + shadcn/ui
- **State:** React component state (no database)

### 5-Prompt System

| Prompt | Purpose | Used By |
|--------|---------|---------|
| A | Extraction system prompt | `/api/extract` |
| B | Extraction user prompt | `/api/extract` |
| C | Planning system prompt | `/api/plan` |
| D | Planning user prompt | `/api/plan` |
| E | Explanation system prompt | `/api/explain` |

### Scoring Dimensions
- **Deadline Safety (30%):** Are hard deadlines met?
- **Goal Alignment (25%):** Does it match user preferences?
- **Commute Burden (15%):** Travel time optimization
- **Downtime Protection (15%):** Rest/break time
- **Flexibility (15%):** Buffer for unexpected changes

### Data Flow
```
Paste text → /api/extract (A+B) → Nemotron → CandidateCommitment[]
Events+goals → /api/plan (C+D) → Nemotron → PlanResponse (2-3 options)
Selected plan → /api/explain (E) → Nemotron → PlanExplanation
Apply → /api/apply-plan → Google Calendar API → events created
```

---

## Drill-Down Q&A

### Q1: "How does the extraction work?"

**Answer (Confirmed):**
- Paste raw text (emails, Slack, Discord)
- Nemotron parses into structured `CandidateCommitment` objects
- Classifies each as `hard` (fixed time) or `soft` (flexible)
- Extracts time windows and confidence scores

**Evidence:** `README.md:143-148`

### Q2: "Why NVIDIA NIM instead of OpenAI?"

**Answer (Confirmed):**
- Hackathon sponsor/theme
- Free tier access to capable models
- OpenAI-compatible API format
- Good structured output capabilities

**Evidence:** `README.md:71-79`

### Q3: "How does the scoring work?"

**Answer (Confirmed):**
- Model scores are discarded
- Server-side recomputation with fixed weights
- 5 dimensions with transparent percentages
- Rule-based warning augmentation

**Evidence:** `README.md:173-175`, `lib/scoring.ts`

### Q4: "What's the 'Why this plan?' feature?"

**Answer (Confirmed):**
- Calls `/api/explain` with selected plan
- Returns `explanation`, `tradeoffs[]`, `risks[]`
- Natural language explanation of ranking
- Cached per plan ID for session

**Evidence:** `README.md:163-169`

### Q5: "How does Google Calendar integration work?"

**Answer (Confirmed):**
- Browser-only auth via Google Identity Services
- No server-side OAuth secret required
- Read today's events
- Write-back new blocks from selected plan

**Evidence:** `README.md:81-91`, `README.md:207`

### Q6: "What are the known limitations?"

**Answer (Confirmed):**
- Single-day planning only
- Paste-only commitment input (no OAuth for email/Slack)
- Token expires after ~1 hour
- No session persistence

**Evidence:** `README.md:236-242`

---

## API Routes

| Route | Purpose | Prompts |
|-------|---------|---------|
| `/api/extract` | Raw text → structured commitments | A+B |
| `/api/plan` | Events + goals → ranked options | C+D |
| `/api/explain` | Selected plan → explanation | E |
| `/api/apply-plan` | Write blocks to Google Calendar | — |

---

## Reflection

### Technical Debt (Confirmed)

| Item | Issue |
|------|-------|
| Single-day scope | Multi-day not supported |
| No persistence | State lost on refresh |
| Token expiry | Manual reconnect needed |

### What I'd Do Differently

| Change | Rationale |
|--------|-----------|
| Multi-day planning | More realistic scheduling |
| Email/Slack OAuth | Auto-ingest commitments |
| IndexedDB persistence | Survive page reload |
| Streaming responses | Better perceived latency |

---

## Quick Reference

| Topic | Evidence |
|-------|----------|
| Setup | `README.md:36-91` |
| 7-step flow | `README.md:94-127` |
| NIM prompts | `README.md:130-176` |
| Architecture | `README.md:179-212` |
| Limitations | `README.md:234-242` |
