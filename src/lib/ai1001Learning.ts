import { supabase } from "@/integrations/supabase/client";

/**
 * 1001 AI LEARNING ENGINE — camada de serviço.
 * Ciclo: observar → estimar → recomendar → executar → comparar → corrigir → aprender.
 */

export type Confidence = "alta" | "media" | "baixa" | "insuficiente";

export interface MarketPrice {
  available: boolean;
  level_used: "neighborhood" | "city" | "state" | "country" | "none";
  confidence: Confidence;
  sample_size?: number;
  median?: number;
  range_min?: number;
  range_max?: number;
  urgency_premium?: number;
  correction_factor?: number;
  trend?: { d30: number; d90: number; d365: number };
  trend_direction?: "alta" | "baixa" | "estavel";
  message?: string;
  stats?: Record<string, unknown>;
}

export interface MarketPriceQuery {
  category: string;
  state?: string | null;
  city?: string | null;
  neighborhood?: string | null;
  urgency?: string | null;
  complexity?: string | null;
}

/** 7/8/9 — Preço de mercado 1001 com fallback geográfico e nível de confiança. */
export async function getMarketPrice(q: MarketPriceQuery): Promise<MarketPrice> {
  const { data, error } = await supabase.rpc("ai_market_price", {
    _category: q.category,
    _state: q.state ?? null,
    _city: q.city ?? null,
    _neighborhood: q.neighborhood ?? null,
    _urgency: q.urgency ?? "normal",
    _complexity: q.complexity ?? null,
  });
  if (error) throw error;
  return (data ?? { available: false, level_used: "none", confidence: "insuficiente" }) as unknown as MarketPrice;
}

export interface PredictionInput {
  service_id?: string | null;
  service_request_id?: string | null;
  diagnosis?: string;
  category?: string;
  recommended_profession?: string;
  confidence?: number;
  estimated_price_min?: number;
  estimated_price_max?: number;
  estimated_duration_min?: number;
  urgency?: string;
  complexity?: string;
  state?: string | null;
  city?: string | null;
  neighborhood?: string | null;
  /** 40 — IA explicável: evidências internas da conclusão. */
  evidence?: Record<string, unknown>;
  /** 8/42 — origem estatística da estimativa. */
  price_source?: Record<string, unknown>;
}

/** 32/46 — grava a previsão com versão de modelo e rastreabilidade. */
export async function recordPrediction(input: PredictionInput): Promise<string | null> {
  const { data, error } = await supabase.rpc("ai_record_prediction", {
    _payload: input as never,
  });
  if (error) {
    console.debug("[1001AI] prediction not recorded", error.message);
    return null;
  }
  return (data as string) ?? null;
}

export interface OutcomeInput {
  prediction_id?: string | null;
  service_id?: string | null;
  provider_id?: string | null;
  client_id?: string | null;
  category?: string;
  actual_diagnosis?: string;
  actual_price?: number;
  estimated_price?: number;
  actual_duration_min?: number;
  professional_feedback?: "sim" | "parcial" | "nao";
  professional_correction?: string;
  client_feedback?: Record<string, unknown>;
  was_cancelled?: boolean;
  cancel_reason?: string;
  was_rework?: boolean;
  rating?: number;
  urgency?: string;
  complexity?: string;
  city?: string | null;
  state?: string | null;
  neighborhood?: string | null;
  outcome?: string;
}

/** 10/29/30/31 — registra o resultado real e alimenta o loop de correção. */
export async function recordOutcome(input: OutcomeInput) {
  const { data, error } = await supabase.rpc("ai_submit_feedback", {
    _payload: input as never,
  });
  if (error) throw error;
  return data as unknown as { price_error_pct: number; data_quality_score: number };
}

/** 25 — memória estruturada do profissional. */
export async function getProfessionalMemory(providerId: string) {
  const { data, error } = await supabase.rpc("ai_professional_memory", { _provider_id: providerId });
  if (error) throw error;
  return data as unknown as Record<string, unknown>;
}

/** 26 — memória do serviço. */
export async function getServiceMemory(category: string) {
  const { data, error } = await supabase.rpc("ai_service_memory", { _category: category });
  if (error) throw error;
  return data as unknown as Record<string, unknown>;
}

/** 27 — memória operacional do cliente (somente o próprio). */
export async function getClientMemory(clientId?: string) {
  const { data, error } = await supabase.rpc("ai_client_memory", { _client_id: clientId ?? undefined });
  if (error) throw error;
  return data as unknown as Record<string, unknown>;
}

/** 18 — previsão de demanda. */
export async function getDemandForecast(city?: string | null) {
  const { data, error } = await supabase.rpc("ai_demand_forecast", { _city: city ?? null });
  if (error) throw error;
  return (data ?? []) as unknown as Array<{
    category: string | null;
    city: string | null;
    last7: number;
    prev7: number;
    growth: number;
    peak_weekday: number;
    peak_hour: number;
  }>;
}

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  alta: "Confiança alta",
  media: "Confiança média",
  baixa: "Confiança baixa",
  insuficiente: "Dados insuficientes",
};

export const GEO_LEVEL_LABEL: Record<MarketPrice["level_used"], string> = {
  neighborhood: "seu bairro",
  city: "sua cidade",
  state: "seu estado",
  country: "todo o Brasil",
  none: "—",
};

export function formatBRL(v?: number | null) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}
