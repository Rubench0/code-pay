# Pey API

Draft from the docs read on 2026-11-14. Verify every field against https://docs.pey.mx (openapi.json) in phase 1b.

Base URL `https://api.pey.mx` · Auth `Authorization: Bearer <PEY_API_KEY>` · No sandbox: production only, test with $0.01.

## Endpoints we use
- `POST /codi/qr` — amount (0 lets the payer type it; we never send 0), concept, expiration (0 or ≥360 s), numRef (1–7 digits), generateImage, bankAccountId, metadata (≤50 pairs). Returns id (Banxico IDC), qrString, qrImage.
- `POST /codi/pn` — push to a phone: amount (≤1,000,000), phoneNumber (10 digits), concept, expiration (≥360 s, default 360), numRef, bankAccountId, metadata. Returns transactionId, codiId.
- `GET /transaction/{id}` — status, used for reconciliation.
- `GET /transaction/api-key` — transactions for this key.

## Not in scope for now
- `POST /payment-link/create` — hosted checkout (CoDi, card, Apple/Google Pay) with hasTip. Card payments carry fees (`fee`, `applicationFee`).
- `POST /bank-account` — alias, name, clabe, entity (BUSINESS/PERSON); codiStatus PENDING → ACTIVE, up to ~5 business days.

## Webhooks
- Standard Webhooks: headers `webhook-id`, `webhook-timestamp`, `webhook-signature`; secret `whsec_…`. Verify on the raw body before parsing.
- `webhook-id` is the dedupe key.
- Events: payment received (QR), payment received (push), payment link status change, bank account updated.
- There is no expiration or rejection event: expire with a timer and reconcile via `GET /transaction/{id}`.

## To verify in 1b
- Amount type (decimal pesos vs cents), exact field names and enums.
- Webhook payload shape per event, and how a payment links back to our charge (id, numRef or metadata).
- Rate limits.
