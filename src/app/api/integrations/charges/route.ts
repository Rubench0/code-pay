import { NextResponse } from "next/server";
import { z } from "zod";
import { checkIntegrationAuth } from "@/lib/auth/integration";
import { ChargeCreationError, createCharge } from "@/lib/charges/service";
import { REFERENCE_PATTERN } from "@/lib/charges/types";
import { jsonError, readJson } from "@/lib/http";
import { AmountError } from "@/lib/money";

// Amounts arrive final (the calling app already applied its own tip and taxes), so no tip here.
const integrationChargeBody = z
  .object({
    kind: z.enum(["qr", "push"]),
    amountCents: z.int().positive(),
    reference: z.string().regex(REFERENCE_PATTERN),
    phone: z
      .string()
      .regex(/^[0-9]{10}$/)
      .optional(),
  })
  .refine((body) => body.kind !== "push" || body.phone !== undefined, {
    message: "A 10-digit phone is required for push",
    path: ["phone"],
  });

export async function POST(request: Request) {
  const auth = checkIntegrationAuth(request);
  if (auth === "disabled") return jsonError(404, "not_found", "Not found");
  if (auth === "unauthorized") return jsonError(401, "unauthorized", "Invalid integration key");

  const parsed = integrationChargeBody.safeParse(await readJson(request));
  if (!parsed.success) return jsonError(400, "invalid_request", "Invalid charge request");

  const { kind, amountCents, reference, phone } = parsed.data;
  try {
    const charge = await createCharge({ kind, baseCents: amountCents, tipPercent: 0, reference, phone });
    return NextResponse.json(charge, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AmountError) return jsonError(400, error.code, "Invalid amount");
    if (error instanceof ChargeCreationError) return jsonError(502, "charge_failed", "Could not create the charge");
    throw error;
  }
}
