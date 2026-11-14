export const MAX_TIP_PERCENT = 100;

export type AmountErrorCode = "invalid_base" | "invalid_tip" | "over_limit";

export class AmountError extends Error {
  constructor(readonly code: AmountErrorCode) {
    super(code);
  }
}

export type Amounts = { baseCents: number; tipCents: number; totalCents: number };

export function computeAmounts(
  input: { baseCents: number; tipPercent?: number; tipCents?: number },
  maxTotalCents: number,
): Amounts {
  const { baseCents, tipPercent = 0 } = input;
  if (!Number.isInteger(baseCents) || baseCents <= 0) throw new AmountError("invalid_base");
  if (!Number.isInteger(tipPercent) || tipPercent < 0 || tipPercent > MAX_TIP_PERCENT) {
    throw new AmountError("invalid_tip");
  }

  const tipCents = input.tipCents ?? Math.round((baseCents * tipPercent) / 100);
  if (!Number.isInteger(tipCents) || tipCents < 0 || tipCents > baseCents) {
    throw new AmountError("invalid_tip");
  }

  const totalCents = baseCents + tipCents;
  if (totalCents > maxTotalCents) throw new AmountError("over_limit");

  return { baseCents, tipCents, totalCents };
}

// Pey speaks MXN pesos as JSON numbers; we keep integer cents everywhere else.
export const centsToPesos = (cents: number) => Math.round(cents) / 100;
export const pesosToCents = (pesos: number) => Math.round(pesos * 100);
