# Domain design

Charges, payments and webhooks for phases 1–2. Table mode (bills, seats) is sketched at the end and designed in phase 3.
Pey details live in docs/pey-api.md.

## Money
- Integer cents everywhere (DB, domain, our API). `src/lib/pey` converts: `pesos = cents / 100` on the way out,
  `cents = Math.round(pesos * 100)` on the way in.
- The server computes every amount: `tipCents = round(baseCents * tipPercent / 100)` (or a bounded custom tip),
  `totalCents = baseCents + tipCents`, capped by `DEMO_MAX_AMOUNT_CENTS`.

## Tables (Postgres via Drizzle)
`charges`
- `id` uuid PK (sent to Pey as `metadata.chargeId`)
- `kind` `qr` | `push` · `mode` `counter` | `table`
- `status` `pending` | `paid` | `expired` | `failed` · `late` bool (paid after we marked it expired)
- `base_cents`, `tip_cents`, `total_cents` int, check `total = base + tip`, `total > 0`
- `num_ref` text, 1–7 digits from a sequence (shown as "Cobro #1234") · `concept` text ≤40 chars
- `phone_last4` text null (push only; the full number is sent to Pey once and never stored)
- `pey_qr_id` text unique null (IDC) · `qr_string` text null · `pey_transaction_id` text unique null
  (push: known at creation) · `pey_codi_id` text null
- `expires_at`, `created_at`, `paid_at` timestamptz · `pey_error` text null (error type + requestId only)
- `bill_id`, `seat_id` null (phase 3)

`payments` (one row per Pey transaction we learn about; a QR may get more than one)
- `id` uuid PK · `charge_id` FK · `pey_transaction_id` text **unique**
- `amount_cents` int · `tracking_key` text · `paid_at` timestamptz
- `source` `webhook` | `reconcile` · `outcome` `applied` | `excess` | `mismatch`

`webhook_events` (dedupe and audit)
- `webhook_id` text PK · `type` text · `received_at` timestamptz · `charge_id` null
- `payload` jsonb **with `metadata.clabe`, `bankCode`, `accountType` removed before storing**

## Charge states
```
pending ──payment amount == total──▶ paid
pending ──now > expires_at + 60 s and reconcile finds nothing──▶ expired
expired ──valid payment arrives──▶ paid (late = true)
pending ──Pey create call fails──▶ failed
```
Payment outcomes, applied in one DB transaction with the charge row locked (`SELECT … FOR UPDATE`):
- Charge `pending`/`expired` and amount == total → `applied`, charge → `paid`.
- Amount ≠ total → `mismatch`; charge unchanged, shown in the panel.
- Charge already `paid` → `excess`; refund by hand from the panel (phase 4).
- Same `pey_transaction_id` again → no-op (unique constraint), so webhook and reconcile can race safely.

## Matching a payment to a charge
- `codi.pn.payment_received`: `transactionId` = `charges.pey_transaction_id`.
- `codi.qr.payment_received`: `codiQrId` = `charges.pey_qr_id`.
- Both: `metadata.externalMetadata.chargeId` must agree when present; if it disagrees, store the event and do not apply it.
- No match: store the event, answer 200 (avoids retries), log `webhook-id` only.

## Webhook endpoint `POST /api/webhooks/pey`
1. `raw = await req.text()`; verify with `standardwebhooks` and `PEY_WEBHOOK_SECRET`. Invalid → 401, nothing stored.
2. Insert `webhook_events` (ON CONFLICT DO NOTHING). Already there → 200 (replay).
3. Parse and validate (zod). Unknown `type` → 200, ignored.
4. Apply the payment as above. Answer 200 quickly.

## Reconcile on read
While the UI polls a `pending` charge older than 5 s, at most once every 10 s per charge (claimed atomically through
`charges.last_reconciled_at`). This keeps payments visible even before the webhook is configured:
- push: `GET /transaction/{pey_transaction_id}`; `PAID` → apply payment with `source = reconcile`.
- qr: `GET /transaction/codi/qr/{pey_qr_id}`; apply every `PAID` item.
- Still nothing and past `expires_at + 60 s` → `expired`. No cron needed.
- Amounts compare against `amountBreakdown.base` (a payer fee must not look like a different price). A webhook
  whose `amount` differs from the total is re-checked with `GET /transaction/{id}` before flagging a mismatch.
- `applyPayment` is a single SQL statement (CTE): conditional update of the charge + insert of the payment with
  its outcome, `ON CONFLICT (pey_transaction_id) DO NOTHING`. Works on the Neon HTTP driver (no interactive tx).

## Our API (contract for the UI)
All merchant routes require the session cookie.
- `POST /api/session` `{ password }` → sets an httpOnly, secure, SameSite=Lax cookie signed with `SESSION_SECRET`.
  Compared in constant time (HMAC of both) against `MERCHANT_PASSWORD`, which is a random high-entropy value; add a
  rate limit before ever switching to a human-chosen password. The signature includes the password, so changing it
  logs everyone out.
- `POST /api/charges` `{ kind: "qr" | "push", baseCents: int > 0, tipPercent?: 0 | 10 | 15 | 20, tipCents?: int ≥ 0,
  phone?: "^[0-9]{10}$" (required for push) }`
  → 201 `{ id, kind, status, baseCents, tipCents, totalCents, numRef, expiresAt, qrString? }`
  → 400 `{ error: { code, message } }` for invalid input or amount over the cap · 502 when Pey fails (no Pey details leaked).
- `GET /api/charges/{id}` → `{ id, status, late, totalCents, numRef, expiresAt, paidAt? }`. Polled every 2 s;
  may trigger reconcile.
- `POST /api/webhooks/pey`: Pey only, signature required.

## Integration API (server-to-server, team's own apps only)
Used by the merchant's own systems (for example, its ordering system) so a customer can pay an order with CoDi. Not public: `Authorization: Bearer <INTEGRATION_API_KEY>`,
compared in constant time; without the env var the routes answer 404.
- `POST /api/integrations/charges` `{ kind: "qr" | "push", amountCents: int > 0, reference: REFERENCE_PATTERN, phone? }`
  → 201 `ChargeView`. Amount is final (no tip added here); the demo cap still applies.
- `GET /api/integrations/charges/{id}` → `ChargeView` (same reconcile on read as the merchant route).
The caller must verify `status === "paid"` with this GET before marking anything paid on its side.

## Security notes
- Webhook secrets and the API key only in server env; `src/lib/pey` imports `server-only`.
- The payer's CLABE in webhook metadata is personal data: stripped before storing, never logged.
- Phones: only `phone_last4` is stored; logs mask them.
- IDs are random UUIDs, so charge URLs are not guessable; status endpoints are still merchant-only.
- Charge creation is merchant-only; the public diner endpoints of phase 3 get their own limits
  (open table, one push per seat, cooldown).
- Every Pey failure is logged with `requestId` and error `type`, never with the request body or phone.

## Phase 3 sketch (not final)
`bills` (id, token for the table QR, label, total_cents, split_mode, status `open` | `partially_paid` | `paid` | `closed`)
and `seats` (id, bill_id, share_cents, tip_cents, charge_id, phone_last4, last_push_at). A seat's charge is a normal
push charge with `mode = table`; the bill closes when every seat's charge is `paid`.
