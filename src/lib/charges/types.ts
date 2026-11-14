export type ChargeKind = "qr" | "push";

// Short label shown to the payer in the bank app concept, e.g. "Mesa 5 2/4" or "PED-123".
export const REFERENCE_PATTERN = /^[A-Za-z0-9 #/._-]{1,24}$/;
export const REFERENCE_MAX_LENGTH = 24;

export function sanitizeReference(value: string | null | undefined): string | undefined {
  const cleaned = (value ?? "").replace(/[^A-Za-z0-9 #/._-]/g, "").trim().slice(0, REFERENCE_MAX_LENGTH);
  return cleaned || undefined;
}
export type ChargeStatus = "pending" | "paid" | "expired" | "failed";

// Shape returned by POST /api/charges and GET /api/charges/{id}.
export type ChargeView = {
  id: string;
  kind: ChargeKind;
  status: ChargeStatus;
  late: boolean;
  baseCents: number;
  tipCents: number;
  totalCents: number;
  numRef: string;
  reference: string | null;
  expiresAt: string;
  paidAt: string | null;
  qrString: string | null;
};

export type CreateChargeRequest = {
  kind: ChargeKind;
  baseCents: number;
  tipPercent?: number;
  phone?: string;
  reference?: string;
};
