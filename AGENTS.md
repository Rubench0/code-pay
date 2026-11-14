<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project

CoDi point of sale for small businesses: counter mode, table mode with split bill, tips.
Built on the Pey API for Hackatón México 2026. Money always goes straight to the
merchant's own CLABE; we never hold funds.

## Stack
Next.js 16 (App Router) + TypeScript · Tailwind + shadcn/ui · Postgres (Neon) + Drizzle · Vercel · pnpm

## Layout
- `src/lib/pey/` Pey HTTP client. The only place that talks to Pey. Server-only.
- `src/lib/charges/` domain: create charge, apply webhook, reconcile, state transitions.
- `src/db/` Drizzle schema and queries.
- `src/app/api/` route handlers, thin: validate → call lib → respond.
- `src/app/(merchant)/` counter, table, panel. Login required.
- `src/app/t/[token]/` diner page. Public, scoped by table token.

## Commands
`pnpm dev` · `pnpm build` · `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm db:push` (schema → Neon, reads `.env.local`)

## Security (non-negotiable)
- `PEY_API_KEY` and `PEY_WEBHOOK_SECRET` only in server env vars. Never import `src/lib/pey` from client code.
  Never commit `.env*` except `.env.example` without values. The repo is public.
- Webhook: verify the Standard Webhooks signature on the raw body (`await req.text()`) before parsing;
  reject on failure. `webhook-id` is unique in the DB; replays are no-ops.
- Only the server marks a charge paid (webhook, or reconcile via `GET /transaction/{id}`).
  Paid amount must equal the requested amount, otherwise flag it.
- Money is integer cents, computed server-side. Clients send items or tip percent, never totals.
- Endpoints that send push charges: open table only, one per seat, cooldown, demo amount cap from env.
- Mask phone numbers in logs.

## Public repo checklist (before every commit)
- Review the staged diff for secrets (`PEY_`, `whsec_`, `Bearer `, `postgres://`, API keys) and
  personal data (phones, CLABEs, emails, names). None may be committed.
- No real data in fixtures, seeds, tests, screenshots or docs; use obvious fakes (`5500000000`).
- Jury test credentials go in the submission form, never in the repo.
- Opus security review at the end of every phase that touches Pey, webhooks, auth or money.

## Hackathon constraints (details: docs/hackathon-rules.md)
- The product is the merchant's own POS. No public charges API for third parties, no pooled funds,
  no charges to accounts other than the credential holder's. No pharmacy vertical.
- Everything in this repo is new. Do not copy code from Amigapp or any prior project.

## Code
- Identifiers, comments and commit messages in English. UI text in Spanish (es-MX).
- Comment only the non-obvious why. No dead code, no speculative abstractions.
- Reuse existing patterns and shadcn components before creating new ones.

## Tools and ownership
- Claude Code does everything by default.
- Cursor is used only for UI work, inside `src/app/(merchant)/**`, `src/app/t/**`, `src/components/**`,
  plus shadcn setup (`components.json`, `src/lib/utils.ts`, `src/app/globals.css`, UI deps in `package.json`).
  It never edits the rest of `src/lib/**`, `src/db/**`, `src/app/api/**`, `docs/**` or this file.
- Never edit the same file from both tools at the same time.

## Way of working
- Do the minimum for the current phase. Side findings go to "Pending" in docs/plan.md.
- Rubén approves each phase; that OK covers the installs the phase needs.
  Commits, pushes and deploys always need his explicit OK.
- At the end of each phase: 2–3 line summary, update "Current status" in docs/plan.md, ask "¿seguimos?".
- Models: Opus for design, Pey integration and security review; Sonnet for UI and straightforward implementation.
- Read docs on demand, only the guide you need: `node_modules/next/dist/docs/` for Next APIs,
  docs/pey-api.md when touching Pey or webhooks, docs/domain.md for schema, states and our API contract,
  docs/plan.md for phase and status.
- Done means typecheck + lint + relevant test pass; for UI, checked in the browser.
