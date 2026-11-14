import "server-only";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { charges, webhookEvents, type Charge } from "@/db/schema";
import { env } from "@/lib/env";
import { computeAmounts, pesosToCents } from "@/lib/money";
import * as pey from "@/lib/pey/client";
import { eventType, parsePaymentEvent, sanitizePayload, type PaymentEvent } from "@/lib/pey/events";
import type { ChargeView, CreateChargeRequest } from "./types";

const EXPIRATION_SECONDS = 360;
// Pey sends no expiration event; wait a bit past expiry so a slow webhook is not treated as unpaid.
const EXPIRY_GRACE_MS = 60_000;
const RECONCILE_INTERVAL_MS = 10_000;
const RECONCILE_MIN_AGE_MS = 5_000;

export class ChargeCreationError extends Error {}

export type CreateChargeInput = CreateChargeRequest & { tipCents?: number };

function toView(charge: Charge): ChargeView {
  return {
    id: charge.id,
    kind: charge.kind,
    status: charge.status,
    late: charge.late,
    baseCents: charge.baseCents,
    tipCents: charge.tipCents,
    totalCents: charge.totalCents,
    numRef: charge.numRef,
    expiresAt: charge.expiresAt.toISOString(),
    paidAt: charge.paidAt?.toISOString() ?? null,
    qrString: charge.qrString,
  };
}

const expiresFromNow = () => new Date(Date.now() + EXPIRATION_SECONDS * 1000);

async function findCharge(id: string): Promise<Charge | undefined> {
  const [charge] = await db().select().from(charges).where(eq(charges.id, id)).limit(1);
  return charge;
}

export async function createCharge(input: CreateChargeInput): Promise<ChargeView> {
  const amounts = computeAmounts(input, env.demoMaxAmountCents());
  if (input.kind === "push" && !input.phone) throw new ChargeCreationError("phone required");

  const [draft] = await db()
    .insert(charges)
    .values({
      kind: input.kind,
      ...amounts,
      concept: "Cobro",
      phoneLast4: input.phone?.slice(-4) ?? null,
      expiresAt: expiresFromNow(),
    })
    .returning();

  const request = {
    chargeId: draft.id,
    amountCents: draft.totalCents,
    concept: `Cobro #${draft.numRef}`,
    numRef: draft.numRef,
    expirationSeconds: EXPIRATION_SECONDS,
  };

  try {
    const peyFields =
      input.kind === "qr"
        ? await pey.createQr(request).then(({ qrId, qrString }) => ({ peyQrId: qrId, qrString }))
        : await pey
            .createPush({ ...request, phoneNumber: input.phone! })
            .then(({ transactionId, codiId }) => ({ peyTransactionId: transactionId, peyCodiId: codiId }));

    const [charge] = await db()
      .update(charges)
      .set({ ...peyFields, concept: request.concept, expiresAt: expiresFromNow() })
      .where(eq(charges.id, draft.id))
      .returning();
    return toView(charge);
  } catch (error) {
    const peyError =
      error instanceof pey.PeyError
        ? `${error.type}${error.requestId ? ` ${error.requestId}` : ""}`
        : "UNEXPECTED_RESPONSE";
    await db().update(charges).set({ status: "failed", peyError }).where(eq(charges.id, draft.id));
    console.error("charge creation failed", { chargeId: draft.id, kind: input.kind, peyError });
    throw new ChargeCreationError(peyError);
  }
}

type PaymentInput = {
  chargeId: string;
  peyTransactionId: string;
  amountCents: number;
  trackingKey: string | null;
  paidAt: Date;
  source: "webhook" | "reconcile";
};

// One statement so webhook and reconcile can race safely: the charge row lock lets only one payment win,
// later ones become `excess`, and a repeated transaction id is a no-op.
async function applyPayment(payment: PaymentInput) {
  const paidAt = payment.paidAt.toISOString();
  await db().execute(sql`
    with target as (
      select id, total_cents from charges where id = ${payment.chargeId}
    ),
    applied as (
      update charges
      set status = 'paid', late = (charges.status = 'expired'), paid_at = ${paidAt}::timestamptz
      where charges.id = ${payment.chargeId}
        and charges.status in ('pending', 'expired')
        and charges.total_cents = ${payment.amountCents}
        and not exists (select 1 from payments where pey_transaction_id = ${payment.peyTransactionId})
      returning charges.id
    )
    insert into payments (charge_id, pey_transaction_id, amount_cents, tracking_key, paid_at, source, outcome)
    select
      target.id,
      ${payment.peyTransactionId},
      ${payment.amountCents},
      ${payment.trackingKey},
      ${paidAt}::timestamptz,
      ${payment.source}::payment_source,
      case
        when exists (select 1 from applied) then 'applied'::payment_outcome
        when target.total_cents <> ${payment.amountCents} then 'mismatch'::payment_outcome
        else 'excess'::payment_outcome
      end
    from target
    on conflict (pey_transaction_id) do nothing
  `);
}

async function reconcile(charge: Charge): Promise<Charge> {
  const now = Date.now();
  const claimed = await db()
    .update(charges)
    .set({ lastReconciledAt: new Date(now) })
    .where(
      and(
        eq(charges.id, charge.id),
        eq(charges.status, "pending"),
        or(
          isNull(charges.lastReconciledAt),
          lt(charges.lastReconciledAt, new Date(now - RECONCILE_INTERVAL_MS)),
        ),
      ),
    )
    .returning({ id: charges.id });
  if (claimed.length === 0) return charge;

  try {
    const transactions =
      charge.kind === "push" && charge.peyTransactionId
        ? [await pey.getTransaction(charge.peyTransactionId)].filter((tx) => tx !== null)
        : charge.peyQrId
          ? await pey.getQrTransactions(charge.peyQrId)
          : [];
    for (const tx of transactions) {
      if (tx.status !== "PAID") continue;
      await applyPayment({
        chargeId: charge.id,
        peyTransactionId: tx.id,
        amountCents: tx.amountCents,
        trackingKey: tx.trackingKey,
        paidAt: tx.paidAt ?? new Date(now),
        source: "reconcile",
      });
    }
  } catch (error) {
    const reason = error instanceof pey.PeyError ? error.message : "unexpected response";
    console.warn("reconcile failed", { chargeId: charge.id, reason });
  }

  await db()
    .update(charges)
    .set({ status: "expired" })
    .where(
      and(
        eq(charges.id, charge.id),
        eq(charges.status, "pending"),
        lt(charges.expiresAt, new Date(now - EXPIRY_GRACE_MS)),
      ),
    );

  return (await findCharge(charge.id)) ?? charge;
}

// Polled by the UI. Reconciling while pending keeps payments visible even if a webhook is late or missing.
export async function getCharge(id: string): Promise<ChargeView | null> {
  let charge = await findCharge(id);
  if (!charge) return null;
  if (charge.status === "pending" && Date.now() - charge.createdAt.getTime() > RECONCILE_MIN_AGE_MS) {
    charge = await reconcile(charge);
  }
  return toView(charge);
}

async function findChargeForEvent(event: PaymentEvent): Promise<Charge | undefined> {
  const condition =
    event.type === "codi.pn.payment_received"
      ? eq(charges.peyTransactionId, event.transactionId)
      : eq(charges.peyQrId, event.codiQrId!);
  const [charge] = await db().select().from(charges).where(condition).limit(1);
  return charge;
}

// Webhook amounts may include a fee charged to the payer; on a mismatch, trust the transaction's base amount.
async function resolvePaidCents(event: PaymentEvent, charge: Charge): Promise<number> {
  const amountCents = pesosToCents(event.amount);
  if (amountCents === charge.totalCents) return amountCents;
  const tx = await pey.getTransaction(event.transactionId).catch(() => null);
  return tx?.amountCents ?? amountCents;
}

export async function handleWebhook(webhookId: string, payload: unknown): Promise<void> {
  const stored = sanitizePayload(payload);
  const event = parsePaymentEvent(payload);

  if (!event) {
    await db()
      .insert(webhookEvents)
      .values({ webhookId, type: eventType(payload), payload: stored })
      .onConflictDoNothing();
    return;
  }

  const charge = await findChargeForEvent(event);
  const claimedChargeId = event.metadata?.externalMetadata?.chargeId;
  const matches = charge !== undefined && (!claimedChargeId || claimedChargeId === charge.id);

  await db()
    .insert(webhookEvents)
    .values({ webhookId, type: event.type, chargeId: matches ? charge.id : null, payload: stored })
    .onConflictDoNothing();

  if (!matches) {
    console.warn("webhook did not match a charge", { webhookId, type: event.type });
    return;
  }

  // Processing is idempotent, so replays (same webhook-id) are safe to run again.
  await applyPayment({
    chargeId: charge.id,
    peyTransactionId: event.transactionId,
    amountCents: await resolvePaidCents(event, charge),
    trackingKey: event.metadata?.trackingKey ?? null,
    paidAt: event.datePaid ? new Date(event.datePaid * 1000) : new Date(),
    source: "webhook",
  });
}
