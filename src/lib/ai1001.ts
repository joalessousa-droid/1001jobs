import { supabase } from "@/integrations/supabase/client";

/** Camada de serviço desacoplada da 1001 AI (troca de modelo sem tocar na UI). */

export interface AiQuestion {
  question: string;
  options: string[];
}

export interface AiDiagnosis {
  problem_detected: string;
  summary: string;
  confidence: number;
  category: string;
  recommended_profession: string;
  urgency: "normal" | "prioridade" | "urgente";
  complexity: "baixa" | "media" | "alta";
  estimated_price_min: number;
  estimated_price_max: number;
  required_questions: AiQuestion[];
  safety_warnings: string[];
  reasons: string[];
}

export interface AiDiagnoseInput {
  text?: string;
  image_base64?: string | null;
  voice_transcription?: string | null;
  location?: { lat: number; lng: number; city?: string | null } | null;
  service_history?: string[];
  categories?: string[];
  answers?: { question: string; answer: string }[];
}

export async function diagnoseProblem(input: AiDiagnoseInput): Promise<AiDiagnosis> {
  const { data, error } = await supabase.functions.invoke("ai-diagnose", { body: input });
  if (error) throw error;
  if (!data?.diagnosis) throw new Error("Diagnóstico indisponível");
  return data.diagnosis as AiDiagnosis;
}

export function formatPriceRange(min: number, max: number) {
  const f = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  return `${f(min)} – ${f(max)}`;
}

export const URGENCY_LABEL: Record<AiDiagnosis["urgency"], string> = {
  normal: "Normal",
  prioridade: "Prioridade",
  urgente: "Urgente",
};

export const COMPLEXITY_LABEL: Record<AiDiagnosis["complexity"], string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};
