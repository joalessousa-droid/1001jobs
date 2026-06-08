// Mirrors the SQL implementation of calculate_dynamic_price so it can be
// integration-tested without a live database. Keep in sync with
// supabase/migrations/20260608205402_*.sql -> calculate_dynamic_price.

export interface PricingConfig {
  min_multiplier: number;
  max_multiplier: number;
  demand_weight: number;
  supply_weight: number;
  time_weight: number;
  region_weight: number;
  urgency_weight: number;
}

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  min_multiplier: 0.8,
  max_multiplier: 2.5,
  demand_weight: 1.0,
  supply_weight: 1.0,
  time_weight: 1.0,
  region_weight: 1.0,
  urgency_weight: 1.0,
};

export type Urgency = "low" | "normal" | "high" | "critical";

export interface PricingInputs {
  basePrice: number;
  demandCount: number;       // requests in last 60min
  supplyOnline: number;      // providers online
  hour: number;              // 0-23 in BRT
  dow: number;               // 0=Sun..6=Sat
  city?: string | null;
  urgency?: Urgency;
  config?: Partial<PricingConfig>;
}

export interface PricingResult {
  multiplier: number;
  base_price: number;
  final_price: number;
  breakdown: {
    demand: { count: number; factor: number; weight: number };
    supply: { online: number; factor: number; weight: number };
    time: { hour: number; dow: number; factor: number; weight: number };
    region: { city: string | null; factor: number; weight: number };
    urgency: { level: Urgency; factor: number; weight: number };
  };
  limits: { min: number; max: number };
}

const round2 = (v: number) => Math.round(v * 100) / 100;

export function calculateDynamicPrice(input: PricingInputs): PricingResult {
  const cfg: PricingConfig = { ...DEFAULT_PRICING_CONFIG, ...(input.config ?? {}) };
  const urgency: Urgency = input.urgency ?? "normal";

  const demandFactor = Math.min(2.5, 1.0 + input.demandCount / 20);
  const supplyFactor =
    input.supplyOnline === 0 ? 1.6
    : input.supplyOnline >= 30 ? 0.85
    : 1.0 + (15 - Math.min(input.supplyOnline, 15)) * 0.04;

  const timeFactor =
    input.hour >= 18 && input.hour <= 22 ? 1.20
    : input.hour >= 0 && input.hour <= 5 ? 1.30
    : (input.dow === 0 || input.dow === 6) ? 1.10
    : 1.0;

  const regionFactor = 1.0;
  const urgencyFactor =
    urgency === "low" ? 0.95
    : urgency === "high" ? 1.20
    : urgency === "critical" ? 1.50
    : 1.0;

  let mult =
    1.0
    + cfg.demand_weight  * (demandFactor - 1.0)
    + cfg.supply_weight  * (supplyFactor - 1.0)
    + cfg.time_weight    * (timeFactor - 1.0)
    + cfg.region_weight  * (regionFactor - 1.0)
    + cfg.urgency_weight * (urgencyFactor - 1.0);

  mult = Math.min(cfg.max_multiplier, Math.max(cfg.min_multiplier, mult));

  return {
    multiplier: round2(mult),
    base_price: input.basePrice,
    final_price: round2(input.basePrice * mult),
    breakdown: {
      demand:  { count: input.demandCount, factor: round2(demandFactor), weight: cfg.demand_weight },
      supply:  { online: input.supplyOnline, factor: round2(supplyFactor), weight: cfg.supply_weight },
      time:    { hour: input.hour, dow: input.dow, factor: round2(timeFactor), weight: cfg.time_weight },
      region:  { city: input.city ?? null, factor: round2(regionFactor), weight: cfg.region_weight },
      urgency: { level: urgency, factor: urgencyFactor, weight: cfg.urgency_weight },
    },
    limits: { min: cfg.min_multiplier, max: cfg.max_multiplier },
  };
}
