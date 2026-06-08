import { describe, it, expect } from "vitest";
import { calculateDynamicPrice, DEFAULT_PRICING_CONFIG } from "@/lib/pricing-engine";

describe("dynamic pricing — weight ties", () => {
  it("equal positive weights produce equal contributions from equivalent deltas", () => {
    // demand factor 1.5 (count=10) vs urgency factor 1.5 (critical) → same delta of 0.5
    const r = calculateDynamicPrice({
      basePrice: 100, demandCount: 10, supplyOnline: 15, hour: 10, dow: 3, urgency: "critical",
    });
    expect(r.breakdown.demand.factor).toBe(1.5);
    expect(r.breakdown.urgency.factor).toBe(1.5);
    // weights are equal (1.0 each) so combined multiplier = 1 + 0.5 + 0.5 = 2.0
    expect(r.multiplier).toBe(2.0);
  });

  it("zero weights neutralize a high factor", () => {
    const r = calculateDynamicPrice({
      basePrice: 100, demandCount: 100, supplyOnline: 15, hour: 10, dow: 3,
      config: { demand_weight: 0 },
    });
    expect(r.breakdown.demand.factor).toBeGreaterThan(1);
    expect(r.multiplier).toBe(1.0);
  });

  it("opposing factors with equal weights cancel out", () => {
    // urgency low (0.95) + supply abundant (0.85) vs nothing pulling up
    const r = calculateDynamicPrice({
      basePrice: 100, demandCount: 0, supplyOnline: 30, hour: 10, dow: 3, urgency: "low",
      config: { min_multiplier: 0.5 },
    });
    // sum: 1 + (0.85-1) + (0.95-1) = 0.80, within floor 0.5
    expect(r.multiplier).toBeCloseTo(0.80, 2);
  });

  it("symmetrically-weighted ties never exceed max_multiplier", () => {
    const r = calculateDynamicPrice({
      basePrice: 100, demandCount: 60, supplyOnline: 0, hour: 20, dow: 3, urgency: "high",
      config: {
        demand_weight: 1, supply_weight: 1, time_weight: 1, urgency_weight: 1, region_weight: 1,
        max_multiplier: 1.75,
      },
    });
    expect(r.multiplier).toBe(1.75);
  });
});

describe("dynamic pricing — region/city variations", () => {
  it.each([
    ["São Paulo"], ["Rio de Janeiro"], ["Belo Horizonte"], ["Curitiba"], ["Salvador"],
  ])("preserves city '%s' literally in breakdown", (city) => {
    const r = calculateDynamicPrice({ basePrice: 100, demandCount: 0, supplyOnline: 15, hour: 10, dow: 3, city });
    expect(r.breakdown.region.city).toBe(city);
  });

  it("null/undefined city normalize to null", () => {
    const a = calculateDynamicPrice({ basePrice: 100, demandCount: 0, supplyOnline: 15, hour: 10, dow: 3, city: null });
    const b = calculateDynamicPrice({ basePrice: 100, demandCount: 0, supplyOnline: 15, hour: 10, dow: 3 });
    expect(a.breakdown.region.city).toBeNull();
    expect(b.breakdown.region.city).toBeNull();
  });

  it("region factor currently neutral (1.0) regardless of city", () => {
    const a = calculateDynamicPrice({ basePrice: 100, demandCount: 0, supplyOnline: 15, hour: 10, dow: 3, city: "São Paulo" });
    const b = calculateDynamicPrice({ basePrice: 100, demandCount: 0, supplyOnline: 15, hour: 10, dow: 3, city: "Curitiba" });
    expect(a.multiplier).toBe(b.multiplier);
    expect(a.breakdown.region.factor).toBe(1.0);
  });

  it("region weight does not change price while factor is neutral", () => {
    const r = calculateDynamicPrice({
      basePrice: 100, demandCount: 0, supplyOnline: 15, hour: 10, dow: 3, city: "São Paulo",
      config: { region_weight: 5 },
    });
    expect(r.multiplier).toBe(1.0);
  });

  it("preserves unicode/accented city names", () => {
    const r = calculateDynamicPrice({
      basePrice: 100, demandCount: 0, supplyOnline: 15, hour: 10, dow: 3, city: "Brasília — DF",
    });
    expect(r.breakdown.region.city).toBe("Brasília — DF");
  });
});

describe("dynamic pricing — currency rounding/truncation", () => {
  it("rounds multiplier to 2 decimals (banker-free, half-up)", () => {
    // demand=1 → demand factor = 1 + 1/20 = 1.05
    const r = calculateDynamicPrice({ basePrice: 100, demandCount: 1, supplyOnline: 15, hour: 10, dow: 3 });
    expect(r.multiplier).toBe(1.05);
  });

  it("never returns a final_price with more than 2 decimals", () => {
    const samples = [33.33, 99.99, 123.456, 1.01, 0.10];
    for (const p of samples) {
      const r = calculateDynamicPrice({ basePrice: p, demandCount: 7, supplyOnline: 12, hour: 19, dow: 3, urgency: "high" });
      const decimals = (r.final_price.toString().split(".")[1] || "").length;
      expect(decimals).toBeLessThanOrEqual(2);
    }
  });

  it("final_price equals base_price × multiplier rounded to cents", () => {
    const r = calculateDynamicPrice({ basePrice: 199.99, demandCount: 6, supplyOnline: 10, hour: 19, dow: 3 });
    const expected = Math.round(199.99 * r.multiplier * 100) / 100;
    expect(r.final_price).toBe(expected);
  });

  it("handles fractional cents correctly", () => {
    // multiplier 1.05, base 0.10 → 0.105 → 0.11 (half-up)
    const r = calculateDynamicPrice({ basePrice: 0.10, demandCount: 1, supplyOnline: 15, hour: 10, dow: 3 });
    expect(r.final_price).toBe(0.11);
  });

  it("preserves zero base price", () => {
    const r = calculateDynamicPrice({ basePrice: 0, demandCount: 50, supplyOnline: 0, hour: 2, dow: 6, urgency: "critical" });
    expect(r.final_price).toBe(0);
  });

  it("large base prices remain finite and rounded", () => {
    const r = calculateDynamicPrice({ basePrice: 9999999.99, demandCount: 0, supplyOnline: 15, hour: 10, dow: 3 });
    expect(Number.isFinite(r.final_price)).toBe(true);
    const decimals = (r.final_price.toString().split(".")[1] || "").length;
    expect(decimals).toBeLessThanOrEqual(2);
  });

  it("respects min floor even when raw multiplier would round below", () => {
    const r = calculateDynamicPrice({
      basePrice: 100, demandCount: 0, supplyOnline: 100, hour: 10, dow: 3, urgency: "low",
      config: { ...DEFAULT_PRICING_CONFIG, min_multiplier: 0.95 },
    });
    expect(r.multiplier).toBeGreaterThanOrEqual(0.95);
  });
});
