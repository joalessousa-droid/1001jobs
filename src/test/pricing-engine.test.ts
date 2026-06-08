import { describe, it, expect } from "vitest";
import { calculateDynamicPrice, DEFAULT_PRICING_CONFIG } from "@/lib/pricing-engine";

describe("dynamic pricing — demand", () => {
  it("raises multiplier as demand grows", () => {
    const low = calculateDynamicPrice({ basePrice: 100, demandCount: 0, supplyOnline: 15, hour: 10, dow: 3 });
    const high = calculateDynamicPrice({ basePrice: 100, demandCount: 40, supplyOnline: 15, hour: 10, dow: 3 });
    expect(high.multiplier).toBeGreaterThan(low.multiplier);
    expect(high.breakdown.demand.count).toBe(40);
  });
  it("caps demand factor at 2.5", () => {
    const r = calculateDynamicPrice({ basePrice: 100, demandCount: 1000, supplyOnline: 15, hour: 10, dow: 3 });
    expect(r.breakdown.demand.factor).toBeLessThanOrEqual(2.5);
  });
});

describe("dynamic pricing — supply", () => {
  it("zero supply triggers scarcity multiplier", () => {
    const r = calculateDynamicPrice({ basePrice: 100, demandCount: 0, supplyOnline: 0, hour: 10, dow: 3 });
    expect(r.breakdown.supply.factor).toBe(1.6);
  });
  it("high supply lowers the price", () => {
    const r = calculateDynamicPrice({ basePrice: 100, demandCount: 0, supplyOnline: 50, hour: 10, dow: 3 });
    expect(r.breakdown.supply.factor).toBe(0.85);
    expect(r.multiplier).toBeLessThan(1.0);
  });
});

describe("dynamic pricing — time", () => {
  it("rush hour evening adds time factor", () => {
    const r = calculateDynamicPrice({ basePrice: 100, demandCount: 0, supplyOnline: 15, hour: 20, dow: 3 });
    expect(r.breakdown.time.factor).toBe(1.20);
  });
  it("late night has the strongest time factor", () => {
    const r = calculateDynamicPrice({ basePrice: 100, demandCount: 0, supplyOnline: 15, hour: 2, dow: 3 });
    expect(r.breakdown.time.factor).toBe(1.30);
  });
  it("weekend daytime applies weekend factor", () => {
    const r = calculateDynamicPrice({ basePrice: 100, demandCount: 0, supplyOnline: 15, hour: 10, dow: 6 });
    expect(r.breakdown.time.factor).toBe(1.10);
  });
});

describe("dynamic pricing — region & urgency", () => {
  it("carries the city through the breakdown", () => {
    const r = calculateDynamicPrice({ basePrice: 100, demandCount: 0, supplyOnline: 15, hour: 10, dow: 3, city: "São Paulo" });
    expect(r.breakdown.region.city).toBe("São Paulo");
  });
  it("critical urgency raises price", () => {
    const normal = calculateDynamicPrice({ basePrice: 100, demandCount: 0, supplyOnline: 15, hour: 10, dow: 3 });
    const critical = calculateDynamicPrice({ basePrice: 100, demandCount: 0, supplyOnline: 15, hour: 10, dow: 3, urgency: "critical" });
    expect(critical.multiplier).toBeGreaterThan(normal.multiplier);
    expect(critical.breakdown.urgency.factor).toBe(1.5);
  });
  it("low urgency mildly discounts price", () => {
    const r = calculateDynamicPrice({ basePrice: 100, demandCount: 0, supplyOnline: 15, hour: 10, dow: 3, urgency: "low" });
    expect(r.breakdown.urgency.factor).toBe(0.95);
  });
});

describe("dynamic pricing — bounds", () => {
  it("respects max_multiplier ceiling", () => {
    const r = calculateDynamicPrice({
      basePrice: 100, demandCount: 1000, supplyOnline: 0, hour: 2, dow: 6, urgency: "critical",
    });
    expect(r.multiplier).toBeLessThanOrEqual(DEFAULT_PRICING_CONFIG.max_multiplier);
    expect(r.final_price).toBe(r.base_price * r.multiplier);
  });
  it("respects min_multiplier floor", () => {
    const r = calculateDynamicPrice({
      basePrice: 100, demandCount: 0, supplyOnline: 100, hour: 10, dow: 3, urgency: "low",
      config: { min_multiplier: 0.9 },
    });
    expect(r.multiplier).toBeGreaterThanOrEqual(0.9);
  });
  it("returns limits in payload", () => {
    const r = calculateDynamicPrice({ basePrice: 100, demandCount: 0, supplyOnline: 15, hour: 10, dow: 3 });
    expect(r.limits.min).toBe(DEFAULT_PRICING_CONFIG.min_multiplier);
    expect(r.limits.max).toBe(DEFAULT_PRICING_CONFIG.max_multiplier);
  });
});

describe("dynamic pricing — integration scenarios", () => {
  it("Saturday 2am with no providers and critical urgency hits the ceiling", () => {
    const r = calculateDynamicPrice({
      basePrice: 200, demandCount: 80, supplyOnline: 0, hour: 2, dow: 6, urgency: "critical",
    });
    expect(r.multiplier).toBe(2.5);
    expect(r.final_price).toBe(500);
  });
  it("low-demand weekday morning stays near base price", () => {
    const r = calculateDynamicPrice({
      basePrice: 200, demandCount: 0, supplyOnline: 20, hour: 10, dow: 3, urgency: "normal",
    });
    expect(r.multiplier).toBeGreaterThanOrEqual(DEFAULT_PRICING_CONFIG.min_multiplier);
    expect(r.multiplier).toBeLessThanOrEqual(1.1);
  });
});
