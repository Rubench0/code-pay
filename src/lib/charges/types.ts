export type ChargeKind = "qr" | "push";
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
  expiresAt: string;
  paidAt: string | null;
  qrString: string | null;
};

export type CreateChargeRequest = {
  kind: ChargeKind;
  baseCents: number;
  tipPercent?: number;
  phone?: string;
};
