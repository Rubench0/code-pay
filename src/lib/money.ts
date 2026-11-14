export const TIP_PERCENTS = [0, 10, 15, 20] as const;
export type TipPercent = (typeof TIP_PERCENTS)[number];

export type AmountErrorCode = "invalid_base" | "invalid_tip" | "over_limit";

export class AmountError extends Error {
  constructor(readonly code: AmountErrorCode) {
    super(code);
  }
}

export type Amounts = { baseCents: number; tipCents: number; totalCents: number };

export function computeAmounts(
  input: { baseCents: number; tipPercent?: TipPercent; tipCents?: number },
  maxTotalCents: number,
): Amounts {
  const { baseCents } = input;
  if (!Number.isInteger(baseCents) || baseCents <= 0) throw new AmountError("invalid_base");

  const tipCents = input.tipCents ?? Math.round((baseCents * (input.tipPercent ?? 0)) / 100);
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
