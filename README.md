# Note Log - AI Music Practice Tracker

Note Log is an AI-powered practice tracker that turns natural language into structured practice logs, gives personalized coaching tips, and visualizes progress over time.

## Features

- AI practice parsing: "scales 20 min, Bach Invention 25 min" → structured activities
- Personalized daily coaching tips (goal-aware, cached per day)
- Weekly insights with patterns, achievements, concerns, and recommendations
- Overarching goals: piece/exam/technique/performance/general with target date
- Daily minute target with progress and streaks
- Calendar heatmap (365 days) and category breakdowns
- Daily micro-goals (checkbox tasks)
- Secure auth (Supabase Auth)

## Tech Stack

- Frontend: Next.js 14 (App Router), React 19, TypeScript, Tailwind CSS, Radix UI, Lucide icons
- Backend: Next.js API Routes (TypeScript, serverless)
- Database/Auth: Supabase (PostgreSQL + Auth)
- AI: OpenAI API (GPT-4/Chat Completions) with heuristic fallback and Zod validation
- Deployment: Vercel

## Project Structure

```
/music-practice-tracker
  app/                  # UI pages and API routes (app/api/*)
  components/           # UI components (StatsBar, TodayCard, Heatmap, etc.)
  lib/                  # Supabase clients, AI service, utilities
  tailwind.config.ts    # Tailwind configuration (no darkMode flag)
  next.config.mjs       # Next configuration
  .eslintrc.json        # ESLint config (Next + TS)
```

## Environment Variables

Create an `.env.local` in the project root (gitignored):

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# OpenAI (optional; fallback heuristic is used if absent)
OPENAI_API_KEY=...
```

Notes:
- `.env.local` must not be committed. It is ignored via `.gitignore` (both root and app-level rules).
- On Vercel, set these in Project Settings → Environment Variables.

## Getting Started (Local)

```bash
# Install deps
npm install

# Run dev server
npm run dev
# http://localhost:3000
```

Build and preview:

```bash
npm run build
npm run start
```

## Key API Routes

- POST `/api/log` — Parse + save practice entry (AI first, heuristic fallback)
- GET `/api/entries?date=YYYY-MM-DD` — Get entries for a date
- PUT `/api/entries/[id]` — Update entry (re-parses text)
- DELETE `/api/entries/[id]?activityIndex=N` — Delete activity at index
- GET `/api/overarching-goals` — Get active goal
- POST/PUT/DELETE `/api/overarching-goals` — Create/update/pause goal
- GET/POST `/api/weekly-insights` — Load/generate weekly insights
- GET `/api/daily-tip` — Load cached daily tip (supports `?forceRegenerate=true`)
- GET `/api/heatmap` — Minutes by date for the last 365 days
- GET `/api/stats` — Streak, today/weekly totals, category breakdown
- PUT `/api/goal` — Update daily minute target

## AI Behavior

- Primary: OpenAI GPT parses natural language into `{ total_minutes, activities[] }`
- Fallback: Heuristic parser for reliability when AI unavailable
- Validation: Zod schemas enforce structure and safe ranges
- Goal-aware prompts: Parsing and coaching incorporate user’s active goal

## Deployment (Vercel)

- Framework preset: Next.js
- Root Directory: repository root (this folder)
- Build Command: `npm run build`
- Output: (Next.js default)
- Env variables: set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `OPENAI_API_KEY`

### Important Build Notes

- ESLint must be installed in devDependencies (`eslint` is included). Vercel runs type-check + lint by default.
- Tailwind: do not set `darkMode: false` in `tailwind.config.ts` (Tailwind v3 treats this as `media` and TS types error). Omit the flag entirely or use `darkMode: "media"`/`["class"]` if needed.
- Next.js App Router: If using `useSearchParams` in a Client Component page (e.g., `app/login/page.tsx`), wrap your page content in `<Suspense>` to satisfy the prerenderer.

## Troubleshooting

- Tailwind TS error: `Type 'false' is not assignable ...` → Remove `darkMode: false` from `tailwind.config.ts`.
- ESLint build error: `ESLint must be installed` → `npm i -D eslint` (already included here).
- Login prerender error about `useSearchParams` → Wrap page content with `<Suspense>` in `app/login/page.tsx`.
- Supabase auth callback: Implemented at `app/auth/callback/route.ts`.

## Scripts

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint"
}
```