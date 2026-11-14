# Plan

Source of truth for phase and status. Update "Current status" at the end of every phase.

## Current status
- 1a done: scaffold, agent files, docs, secret guards; pushed to github.com/Rubench0/code-pay.
- 1b done: `docs/pey-api.md` verified against openapi.json and webhook docs; `docs/domain.md` has schema,
  charge states, matching, reconcile and our API contract.
- 1c done: Drizzle schema (pushed to Neon), Pey client, session login, charges API with reconcile on read,
  signed webhook, `/login` and `/prueba` ($0.01 diagnostic page).
- Phase 2 integrated: counter screen (built in Cursor) wired to the real engine at `/mostrador` (`/` redirects there):
  real QR/push, server-driven status polling, server expiry, retry creates a new charge, any tip 0–100 %.
- Next: first real $0.01 on Vercel (QR and push) → register webhook URL `/api/webhooks/pey` in Pey, set
  `PEY_WEBHOOK_SECRET` → 1d security review (Opus) → submit Cursor CDMX form (Sun 13:00).
- Waiting on Rubén: real payment test from his phone, webhook secret after deploy.

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
- Confirm Pey CoDi fees before claiming "no fees" (`amountBreakdown.fee` is charged to the payer).
- Verify with the first real payment: webhook headers and retries, whether webhook `amount` includes fees,
  whether a fixed-amount QR accepts more than one payment.
