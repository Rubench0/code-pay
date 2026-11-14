import { z } from "zod";

const paymentEventSchema = z.object({
  type: z.enum(["codi.qr.payment_received", "codi.pn.payment_received"]),
  amount: z.number(),
  transactionId: z.string().min(1),
  codiQrId: z.string().min(1).optional(),
  datePaid: z.number().optional(),
  metadata: z
    .object({
      trackingKey: z.string().optional(),
      externalMetadata: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
});

export type PaymentEvent = z.infer<typeof paymentEventSchema>;

export function parsePaymentEvent(payload: unknown): PaymentEvent | null {
  const result = paymentEventSchema.safeParse(payload);
  if (!result.success) return null;
  if (result.data.type === "codi.qr.payment_received" && !result.data.codiQrId) return null;
  return result.data;
}

export function eventType(payload: unknown): string {
  if (payload && typeof payload === "object" && "type" in payload) {
    const { type } = payload as { type: unknown };
    if (typeof type === "string") return type.slice(0, 100);
  }
  return "unknown";
}

// These describe the payer's bank account: personal data we never store or log.
const PAYER_ACCOUNT_FIELDS = ["clabe", "bankCode", "accountType"];

export function sanitizePayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") return payload;
  const copy = structuredClone(payload) as Record<string, unknown>;
  const metadata = copy.metadata;
  if (metadata && typeof metadata === "object") {
    for (const field of PAYER_ACCOUNT_FIELDS) delete (metadata as Record<string, unknown>)[field];
  }
  return copy;
}
