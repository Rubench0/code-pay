import { NextResponse } from "next/server";
import { z } from "zod";
import { hasSession } from "@/lib/auth/session";
import { ChargeCreationError, createCharge } from "@/lib/charges/service";
import { REFERENCE_PATTERN } from "@/lib/charges/types";
import { jsonError, readJson } from "@/lib/http";
import { AmountError, MAX_TIP_PERCENT } from "@/lib/money";

const createChargeBody = z
  .object({
    kind: z.enum(["qr", "push"]),
    baseCents: z.int().positive(),
    tipPercent: z.int().min(0).max(MAX_TIP_PERCENT).optional(),
    tipCents: z.int().nonnegative().optional(),
    phone: z
      .string()
      .regex(/^[0-9]{10}$/)
      .optional(),
    reference: z.string().regex(REFERENCE_PATTERN).optional(),
  })
  .refine((body) => body.tipPercent === undefined || body.tipCents === undefined, {
    message: "Send tipPercent or tipCents, not both",
  })
  .refine((body) => body.kind !== "push" || body.phone !== undefined, {
    message: "A 10-digit phone is required for push",
    path: ["phone"],
  });

const AMOUNT_MESSAGES: Record<AmountError["code"], string> = {
  invalid_base: "El monto no es válido",
  invalid_tip: "La propina no es válida",
  over_limit: "El monto supera el máximo permitido en la demo",
};

export async function POST(request: Request) {
  if (!(await hasSession())) return jsonError(401, "unauthorized", "Inicia sesión");

  const parsed = createChargeBody.safeParse(await readJson(request));
  if (!parsed.success) return jsonError(400, "invalid_request", "Datos del cobro no válidos");

  try {
    const charge = await createCharge(parsed.data);
    return NextResponse.json(charge, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AmountError) return jsonError(400, error.code, AMOUNT_MESSAGES[error.code]);
    if (error instanceof ChargeCreationError) {
      return jsonError(502, "charge_failed", "No se pudo crear el cobro. Intenta de nuevo.");
    }
    throw error;
  }
}
