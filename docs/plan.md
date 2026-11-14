# Plan

Source of truth for phase and status. Update "Current status" at the end of every phase.

## Current status
- Phase 1a done: Next.js scaffold, agent files, docs, secret guards, git init.
- Next: 1b (Opus) — verify `docs/pey-api.md` against Pey's openapi.json, design DB schema and charge states.
- Waiting on Rubén: Pey account + pre-authorized CLABE + API key, Vercel project + Neon, public GitHub repo.

## Phases
| # | Scope | Done when |
|---|---|---|
| 1 | Walking skeleton: Pey client, create QR/push charge, webhook (verify, dedupe, amount check), status endpoint, plain page with "Charge $0.01", deploy | A real $0.01 charge flips to paid on its own |
| 2 | Counter mode: amount, tip, QR or push, live "paid" | Tip charge works end to end on a real phone → submit Cursor CDMX form |
| 3 | Table mode: bill, split (equal first), table QR → diner page → phone + tip → push per diner, live progress, resend / QR fallback, auto-close | 3 real phones pay and the table closes |
| 4 | Panel and edge cases: daily sales and tips, expired charges (reconcile on read), late/double payments flagged as excess for manual refund | Panel shows real data |
| 5 | Polish and Pey submission: split by item / custom amounts, multi-bank tests, own CLABE, video, description, test instructions, prior-components declaration | Submitted before Dec 12 |

## Deadlines
- Cursor Hackatón CDMX: Sun Nov 15, 13:00 CDMX. Public repo required, live link preferred.
- Pey hackathon: application by Dec 10, submission by Dec 12 23:59.

## Pending
- Integrator must meet rule 8.2 (legal entity or individual with business activity, CLABE in own name).
- Confirm Pey CoDi fees before claiming "no fees".
