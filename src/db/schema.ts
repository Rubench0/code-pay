import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  jsonb,
  pgEnum,
  pgSequence,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const chargeKind = pgEnum("charge_kind", ["qr", "push"]);
export const chargeMode = pgEnum("charge_mode", ["counter", "table"]);
export const chargeStatus = pgEnum("charge_status", ["pending", "paid", "expired", "failed"]);
export const paymentSource = pgEnum("payment_source", ["webhook", "reconcile"]);
export const paymentOutcome = pgEnum("payment_outcome", ["applied", "excess", "mismatch"]);

// Pey's numRef accepts 1–7 digits.
export const chargeNumRefSeq = pgSequence("charge_num_ref_seq", {
  startWith: 1001,
  maxValue: 9999999,
  cycle: true,
});

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

export const charges = pgTable(
  "charges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: chargeKind("kind").notNull(),
    mode: chargeMode("mode").notNull().default("counter"),
    status: chargeStatus("status").notNull().default("pending"),
    late: boolean("late").notNull().default(false),
    baseCents: integer("base_cents").notNull(),
    tipCents: integer("tip_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull(),
    numRef: text("num_ref")
      .notNull()
      .default(sql`nextval('charge_num_ref_seq')::text`),
    concept: text("concept").notNull(),
    phoneLast4: text("phone_last4"),
    peyQrId: text("pey_qr_id").unique(),
    qrString: text("qr_string"),
    peyTransactionId: text("pey_transaction_id").unique(),
    peyCodiId: text("pey_codi_id"),
    peyError: text("pey_error"),
    lastReconciledAt: timestamptz("last_reconciled_at"),
    expiresAt: timestamptz("expires_at").notNull(),
    paidAt: timestamptz("paid_at"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    check("charges_total_matches", sql`${t.totalCents} = ${t.baseCents} + ${t.tipCents}`),
    check("charges_amounts_valid", sql`${t.baseCents} > 0 AND ${t.tipCents} >= 0`),
  ],
);

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  chargeId: uuid("charge_id")
    .notNull()
    .references(() => charges.id),
  peyTransactionId: text("pey_transaction_id").notNull().unique(),
  amountCents: integer("amount_cents").notNull(),
  trackingKey: text("tracking_key"),
  paidAt: timestamptz("paid_at").notNull(),
  source: paymentSource("source").notNull(),
  outcome: paymentOutcome("outcome").notNull(),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
});

export const webhookEvents = pgTable("webhook_events", {
  webhookId: text("webhook_id").primaryKey(),
  type: text("type").notNull(),
  chargeId: uuid("charge_id").references(() => charges.id),
  // Stored without the payer's bank account fields (see sanitizePayload).
  payload: jsonb("payload").notNull(),
  receivedAt: timestamptz("received_at").notNull().defaultNow(),
});

export type Charge = typeof charges.$inferSelect;
