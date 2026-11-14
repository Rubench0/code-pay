import "server-only";
import { z } from "zod";
import { env } from "@/lib/env";
import { centsToPesos, pesosToCents } from "@/lib/money";

const BASE_URL = "https://api.pey.mx";
const TIMEOUT_MS = 15_000;
const MAX_QR_TRANSACTION_PAGES = 3;

export class PeyError extends Error {
  constructor(
    readonly status: number,
    readonly type: string,
    readonly requestId?: string,
  ) {
    super(`Pey ${status} ${type}${requestId ? ` requestId=${requestId}` : ""}`);
  }
}

const errorBody = z.object({
  error: z.object({ type: z.string().optional(), requestId: z.string().optional() }),
});

async function call(method: "GET" | "POST", path: string, body?: unknown): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${env.peyApiKey()}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    throw new PeyError(0, "NETWORK_ERROR");
  }

  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = errorBody.safeParse(data);
    const error = parsed.success ? parsed.data.error : {};
    throw new PeyError(response.status, error.type ?? "UNKNOWN", error.requestId);
  }
  return data;
}

type ChargeRequest = {
  chargeId: string;
  amountCents: number;
  concept: string;
  numRef: string;
  expirationSeconds: number;
};

// No bankAccountId on purpose: Pey pays into the CoDi account linked to the API key in the portal,
// and portal accounts cannot be addressed by id through the API.
function chargeBody(request: ChargeRequest) {
  return {
    amount: centsToPesos(request.amountCents),
    concept: request.concept,
    expiration: request.expirationSeconds,
    numRef: request.numRef,
    metadata: { chargeId: request.chargeId },
  };
}

const createQrResponse = z.object({ id: z.string().min(1), qrString: z.string().min(1) });

export async function createQr(request: ChargeRequest) {
  const data = createQrResponse.parse(await call("POST", "/codi/qr", chargeBody(request)));
  return { qrId: data.id, qrString: data.qrString };
}

const createPushResponse = z.object({
  transactionId: z.string().min(1),
  codiId: z.string().optional(),
});

export async function createPush(request: ChargeRequest & { phoneNumber: string }) {
  const data = createPushResponse.parse(
    await call("POST", "/codi/pn", { ...chargeBody(request), phoneNumber: request.phoneNumber }),
  );
  return { transactionId: data.transactionId, codiId: data.codiId ?? null };
}

const transactionSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["PENDING", "PAID"]),
  amount: z.number(),
  amountBreakdown: z.object({ base: z.number().optional() }).optional(),
  datePaid: z.number().optional(),
  metadata: z.object({ trackingKey: z.string().optional() }).optional(),
});

export type PeyTransaction = {
  id: string;
  status: "PENDING" | "PAID";
  // The base amount, so a fee charged to the payer does not look like a different price.
  amountCents: number;
  paidAt: Date | null;
  trackingKey: string | null;
};

function toTransaction(raw: unknown): PeyTransaction {
  const tx = transactionSchema.parse(raw);
  return {
    id: tx.id,
    status: tx.status,
    amountCents: pesosToCents(tx.amountBreakdown?.base ?? tx.amount),
    paidAt: tx.datePaid ? new Date(tx.datePaid * 1000) : null,
    trackingKey: tx.metadata?.trackingKey ?? null,
  };
}

export async function getTransaction(id: string): Promise<PeyTransaction | null> {
  try {
    return toTransaction(await call("GET", `/transaction/${encodeURIComponent(id)}`));
  } catch (error) {
    if (error instanceof PeyError && error.status === 404) return null;
    throw error;
  }
}

const qrTransactionsResponse = z.object({
  items: z.array(z.unknown()),
  nextToken: z.string().nullable().optional(),
});

export async function getQrTransactions(qrId: string): Promise<PeyTransaction[]> {
  const transactions: PeyTransaction[] = [];
  let nextToken: string | null | undefined;
  for (let page = 0; page < MAX_QR_TRANSACTION_PAGES; page++) {
    const query = nextToken ? `?nextToken=${encodeURIComponent(nextToken)}` : "";
    const data = qrTransactionsResponse.parse(
      await call("GET", `/transaction/codi/qr/${encodeURIComponent(qrId)}${query}`),
    );
    transactions.push(...data.items.map(toTransaction));
    nextToken = data.nextToken;
    if (!nextToken) break;
  }
  return transactions;
}
