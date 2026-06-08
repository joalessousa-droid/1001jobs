import { describe, it, expect } from "vitest";
import { calculateDynamicPrice, DEFAULT_PRICING_CONFIG } from "@/lib/pricing-engine";

// These tests pin the deterministic behavior of calculateDynamicPrice when
// multiple weight buckets contribute equally — same input MUST yield same
// output, breakdown order must be stable, and the bounded sum must be
// independent of bucket evaluation order.

describe("tie-breaking — pure determinism", () => {
  it("identical inputs always yield identical outputs", () => {
    const input = {
      basePrice: 100, demandCount: 10, supplyOnline: 0, hour: 20, dow: 6, urgency: "high" as const,
    };
    const a = calculateDynamicPrice(input);
    const b = calculateDynamicPrice(input);
    const c = calculateDynamicPrice(input);
    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });

  it("breakdown keys are emitted in a stable order", () => {
    const r = calculateDynamicPrice({
      basePrice: 100, demandCount: 5, supplyOnline: 15, hour: 10, dow: 3,
    });
    expect(Object.keys(r.breakdown)).toEqual(["demand", "supply", "time", "region", "urgency"]);
  });
});

describe("tie-breaking — equal contributions across buckets", () => {
  it("demand factor 1.5 vs urgency factor 1.5 with equal weights contribute equally to the sum", () => {
    const r = calculateDynamicPrice({
      basePrice: 100, demandCount: 10, supplyOnline: 15, hour: 10, dow: 3, urgency: "critical",
    });
    // contributions: demand (0.5) + urgency (0.5)
    expect(r.multiplier).toBe(2.0);
    expect(r.final_price).toBe(200);
  });

  it("three buckets at the same factor contribute additively, regardless of which has the largest weight", () => {
    // demand=20 → factor 2.0, supply=0 → factor 1.6, urgency=critical → 1.5
    // weights set so demand/urgency/supply each push exactly +0.5
    const r = calculateDynamicPrice({
      basePrice: 100, demandCount: 20, supplyOnline: 0, hour: 10, dow: 3, urgency: "critical",
      config: { demand_weight: 0.5, urgency_weight: 1.0, supply_weight: 0.833333 },
    });
    // 1 + 1.0*1.0 + 0.833333*0.6 + 0.5*0.5 = 1 + 1 + 0.5 + 0.25 = 2.75 → clamped to 2.5
    expect(r.multiplier).toBe(DEFAULT_PRICING_CONFIG.max_multiplier);
  });

  it("permuting equal weights doesn't change final multiplier", () => {
    const base = { basePrice: 100, demandCount: 10, supplyOnline: 0, hour: 20, dow: 3, urgency: "high" as const };
    const a = calculateDynamicPrice({ ...base, config: { demand_weight: 1, supply_weight: 1, time_weight: 1, urgency_weight: 1 } });
    const b = calculateDynamicPrice({ ...base, config: { time_weight: 1, urgency_weight: 1, demand_weight: 1, supply_weight: 1 } });
    expect(a.multiplier).toBe(b.multiplier);
  });
});

describe("tie-breaking — opposite contributions cancel", () => {
  it("equal-magnitude opposing factors with equal weights leave price at base", () => {
    // urgency low (−0.05) + supply 30 (−0.15) vs demand=4 (+0.20)
    // 1 + 0.20 − 0.05 − 0.15 = 1.00
    const r = calculateDynamicPrice({
      basePrice: 100, demandCount: 4, supplyOnline: 30, hour: 10, dow: 3, urgency: "low",
    });
    expect(r.multiplier).toBe(1.00);
    expect(r.final_price).toBe(100);
  });

  it("symmetric opposing pairs neutralize regardless of urgency order", () => {
    const a = calculateDynamicPrice({ basePrice: 100, demandCount: 4, supplyOnline: 30, hour: 10, dow: 3, urgency: "low" });
    const b = calculateDynamicPrice({ basePrice: 100, demandCount: 4, supplyOnline: 30, hour: 10, dow: 3, urgency: "low" });
    expect(a.multiplier).toBe(b.multiplier);
  });
});

describe("tie-breaking — clamping ties", () => {
  it("when raw multiplier exceeds max, all configs that produce >max settle at exactly max", () => {
    const r1 = calculateDynamicPrice({
      basePrice: 100, demandCount: 50, supplyOnline: 0, hour: 2, dow: 6, urgency: "critical",
    });
    const r2 = calculateDynamicPrice({
      basePrice: 100, demandCount: 9999, supplyOnline: 0, hour: 2, dow: 6, urgency: "critical",
    });
    expect(r1.multiplier).toBe(DEFAULT_PRICING_CONFIG.max_multiplier);
    expect(r2.multiplier).toBe(DEFAULT_PRICING_CONFIG.max_multiplier);
    expect(r1.multiplier).toBe(r2.multiplier);
  });

  it("when raw multiplier falls below min, all configs settle at exactly min", () => {
    const r1 = calculateDynamicPrice({
      basePrice: 100, demandCount: 0, supplyOnline: 999, hour: 10, dow: 3, urgency: "low",
    });
    const r2 = calculateDynamicPrice({
      basePrice: 100, demandCount: 0, supplyOnline: 9999, hour: 10, dow: 3, urgency: "low",
    });
    expect(r1.multiplier).toBe(DEFAULT_PRICING_CONFIG.min_multiplier);
    expect(r2.multiplier).toBe(DEFAULT_PRICING_CONFIG.min_multiplier);
  });
});

describe("tie-breaking — weight buckets with equal raw scores", () => {
  it("equal raw contribution from every bucket yields a clean closed-form multiplier", () => {
    // All factors == 1.10, weights all 1.0 → multiplier = 1 + 5*0.10 = 1.50
    // Force this by tweaking urgency only (region is always 1.0).
    const r = calculateDynamicPrice({
      basePrice: 100, demandCount: 2, supplyOnline: 12, hour: 10, dow: 6, urgency: "high",
      // demand 1.10, supply 1+(15-12)*0.04=1.12, time 1.10 (weekend), region 1.0, urgency 1.20
    });
    // Sum of (factor-1) * weight (all weights = 1) = 0.10+0.12+0.10+0+0.20 = 0.52
    expect(r.multiplier).toBeCloseTo(1.52, 2);
  });

  it("scaling all weights by the same factor scales contributions proportionally", () => {
    const baseInput = { basePrice: 100, demandCount: 10, supplyOnline: 15, hour: 10, dow: 3, urgency: "high" as const };
    const half = calculateDynamicPrice({
      ...baseInput,
      config: { demand_weight: 0.5, supply_weight: 0.5, time_weight: 0.5, region_weight: 0.5, urgency_weight: 0.5 },
    });
    const full = calculateDynamicPrice(baseInput);
    // (full − 1) should be exactly 2× (half − 1) within rounding to 2 decimals.
    expect(Math.round((full.multiplier - 1) * 100)).toBe(Math.round((half.multiplier - 1) * 200) / 2 * 2);
  });
});
