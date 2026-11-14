import { describe, expect, it } from "vitest";
import { AmountError, centsToPesos, computeAmounts, pesosToCents } from "./money";

describe("computeAmounts", () => {
  it("adds a percent tip rounded to the cent", () => {
    expect(computeAmounts({ baseCents: 7500, tipPercent: 10 }, 100_000)).toEqual({
      baseCents: 7500,
      tipCents: 750,
      totalCents: 8250,
    });
    expect(computeAmounts({ baseCents: 333, tipPercent: 15 }, 100_000).tipCents).toBe(50);
  });

  it("accepts a custom tip in cents", () => {
    expect(computeAmounts({ baseCents: 1000, tipCents: 125 }, 100_000).totalCents).toBe(1125);
  });

  it("rejects invalid amounts and totals over the cap", () => {
    const code = (fn: () => unknown) => {
      try {
        fn();
      } catch (error) {
        return error instanceof AmountError ? error.code : "other";
      }
      return "none";
    };
    expect(code(() => computeAmounts({ baseCents: 0 }, 1000))).toBe("invalid_base");
    expect(code(() => computeAmounts({ baseCents: 10.5 }, 1000))).toBe("invalid_base");
    expect(code(() => computeAmounts({ baseCents: 100, tipCents: -1 }, 1000))).toBe("invalid_tip");
    expect(code(() => computeAmounts({ baseCents: 100, tipCents: 101 }, 1000))).toBe("invalid_tip");
    expect(code(() => computeAmounts({ baseCents: 1000, tipPercent: 10 }, 1000))).toBe("over_limit");
  });
});

describe("peso conversion", () => {
  it("round-trips without floating point drift", () => {
    expect(centsToPesos(1)).toBe(0.01);
    expect(centsToPesos(8250)).toBe(82.5);
    expect(pesosToCents(0.01)).toBe(1);
    expect(pesosToCents(82.5)).toBe(8250);
    expect(pesosToCents(19.99)).toBe(1999);
  });
});
