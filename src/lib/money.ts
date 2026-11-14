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

// Splits a bill into `parts` shares that add up exactly; leftover cents go to the first shares.
export function splitCents(totalCents: number, parts: number): number[] {
  if (!Number.isInteger(totalCents) || totalCents <= 0) return [];
  if (!Number.isInteger(parts) || parts < 1 || parts > totalCents) return [];
  const base = Math.floor(totalCents / parts);
  const remainder = totalCents % parts;
  return Array.from({ length: parts }, (_, index) => base + (index < remainder ? 1 : 0));
}

// Parses what a person types ("120", "120.5", "120.50") into cents without floating point; null if invalid.
export function parsePesosInput(value: string): number | null {
  const match = /^(\d{1,7})(?:[.,](\d{0,2}))?$/.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}

export const centsToPesosInput = (cents: number) =>
  (cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2));

// Pey speaks MXN pesos as JSON numbers; we keep integer cents everywhere else.
export const centsToPesos = (cents: number) => Math.round(cents) / 100;
export const pesosToCents = (pesos: number) => Math.round(pesos * 100);
