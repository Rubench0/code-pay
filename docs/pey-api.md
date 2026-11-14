# Pey API

Verified on 2026-11-14 against https://docs.pey.mx/openapi.json ("CoDi API 2026-10-20") and the webhook pages.
Items marked **(verify)** are not documented; confirm them with the first real $0.01 payment.

Base URL `https://api.pey.mx` · Auth header `Authorization: Bearer <PEY_API_KEY>` · Amounts are **MXN as a JSON number
in pesos** (e.g. `82.5`), not cents. Our code keeps integer cents and converts only inside `src/lib/pey`.
Docs also mention `https://api.dev.pey.mx` for testing; not verified, and the hackathon requires production.

## Errors (all endpoints)
`{ "error": { "message": string, "type": string, "requestId": string } }`
- 400 types: `INVALID_REQUEST`, `INCOMPLETE_PARAMETERS`, `INVALID_PARAMETER(S)`, `INVALID_AMOUNT`, `INVALID_STATE`,
  `PEY_CONSISTENCY_ERROR`, `BAD_REQUEST` · 404 `NOT_FOUND` · 500 `INTERNAL_SERVER_ERROR` ·
  503 `SERVICE_UNAVAILABLE` / `FLAGS_UNAVAILABLE` (maintenance). Log `requestId`, never the request body.

## POST /codi/qr → 201
Request: `amount`* number ≥0 (0 = payer types it; **we never send 0**) · `concept` string · `expiration` int s
(0 = never, else ≥360, default 0) · `numRef` string `^[0-9]{1,7}$` (default "0") · `generateImage` bool (default false;
slows the call) · `bankAccountId` string ULID · `metadata` object ≤50 pairs, keys ≤40 chars, values ≤500 chars.
Response: `id` (Banxico IDC of the QR) · `qrString` (payload to render) · `qrImage` base64 PNG or null.
A QR is **not** a transaction; it can have several transactions **(verify whether a fixed-amount QR accepts more
than one payment)**. We render `qrString` ourselves and send `expiration: 360`.

## POST /codi/pn → 200
Request: `amount`* number >0, ≤1,000,000 · `phoneNumber`* `^[0-9]{10}$` · `concept` · `expiration` int ≥360
(default 360) · `numRef` `^[0-9]{1,7}$` · `bankAccountId` · `metadata` (same limits as QR).
Response: `transactionId` (ULID, use it to track status) · `codiId` (Banxico folio, 20 digits).

## GET /transaction/{id} → 200
Only transactions of our API key (others → 404).
`id` · `status` `PENDING` | `PAID` · `amount` · `amountBreakdown { base, tip, fee }` (fee is charged to the payer) ·
`currency` · `paymentMethod` `CARD` | `CODI` · `payableType` `PAYMENT_LINK` | `API_CODI_QR` | `API_CODI_PN` ·
`payableId` · `description` · `applicationFee` · `dateCreated` / `datePaid` (unix s) · `metadata` (see below).
There is no expired or rejected status.

## GET /transaction/codi/qr/{idc}?nextToken= → 200
`{ items: Transaction[] (≤20, newest first, paymentMethod CODI), nextToken: string | null }`. Used to reconcile QRs.

## GET /transaction/api-key?nextToken= → 200
`{ items: Transaction[] (≤80), nextToken }`. Useful for the panel and audits.

## Not used now
`POST /payment-link/create`, `/payment-link/update`, `GET /payment-link/{id}` (hosted checkout with card fees),
`POST /bank-account`, `GET /bank-account/{id}` (codiStatus PENDING → ACTIVE, ~5 business days),
`GET /transaction/bank-account/{id}`.

## Webhooks
- Configured per API key in portal.mipey.mx/developers (gear icon). "Webhook Logs" there shows each attempt,
  payload and our response.
- Signed with Standard Webhooks; secret `whsec_…`. Verify the **raw body** with the official SDK
  (`standardwebhooks` on npm) before parsing. Spec headers: `webhook-id`, `webhook-timestamp`, `webhook-signature`.
- `webhook-id` is the idempotency key. Retry policy and expected timeout are undocumented **(verify)**:
  answer 2xx fast and keep processing idempotent.
- Payload is flat (no envelope). Events we handle:

`codi.qr.payment_received`
```json
{ "type": "codi.qr.payment_received", "amount": 150, "apiKeyId": "…", "bankAccountId": "…",
  "codiQrId": "35a13c183a", "concept": "…", "datePaid": 1790724818, "numRef": "34567",
  "transactionId": "01M3QR8H0RH0XBCKYYD242YXNV", "metadata": { … } }
```
`codi.pn.payment_received`: same shape without `codiQrId`.
`bankAccountId` is present only if we sent it when creating the charge.

Other events (ignored, answer 2xx): `payment_link.status_updated`, bank account updated.

## Metadata (transactions and webhooks)
`clabe`, `bankCode`, `accountType` describe the **payer's** bank account → personal data: never log or store
(keep at most the last 4 digits). `description`. `trackingKey` = Banxico tracking key, our proof of payment.
`externalMetadata` = the metadata we sent at creation, **all values returned as strings**.
We send only `{ "chargeId": "<our id>" }`.
