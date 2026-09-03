import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  dynamicEtaMin,
  haversineKm,
  type RadarProfessional,
  type RadarQuote,
} from "@/hooks/useProfessionalRadar";

/* ------------------------------------------------------------------ */
/*  Modo de teste — perfis bot 100% locais, nunca tocam dados reais     */
/* ------------------------------------------------------------------ */

export type SandboxScenario =
  | "near_available"
  | "far_available"
  | "scarce_busy"
  | "no_response"
  | "peak_demand";

export interface SandboxScenarioDef {
  id: SandboxScenario;
  label: string;
  description: string;
  count: number;
  /** faixa de distância em km */
  range: [number, number];
  /** fração de profissionais disponíveis (os demais ficam ocupados) */
  availability: number;
  /** atraso base da primeira cotação (ms) */
  replyDelayMs: number;
  /** fração de profissionais que responde com preço */
  replyRate: number;
}

export const SANDBOX_SCENARIOS: SandboxScenarioDef[] = [
  {
    id: "near_available",
    label: "Próximos e disponíveis",
    description: "6 profissionais entre 0,4 e 2,5 km respondendo rápido",
    count: 6,
    range: [0.4, 2.5],
    availability: 1,
    replyDelayMs: 1200,
    replyRate: 1,
  },
  {
    id: "far_available",
    label: "Distantes e disponíveis",
    description: "4 profissionais entre 6 e 18 km com resposta mais lenta",
    count: 4,
    range: [6, 18],
    availability: 1,
    replyDelayMs: 3000,
    replyRate: 0.75,
  },
  {
    id: "scarce_busy",
    label: "Escassez / ocupados",
    description: "Poucos profissionais e a maioria ocupada",
    count: 3,
    range: [1.5, 9],
    availability: 0.34,
    replyDelayMs: 5000,
    replyRate: 0.5,
  },
  {
    id: "no_response",
    label: "Sem resposta",
    description: "Profissionais no raio, mas ninguém envia preço",
    count: 4,
    range: [1, 7],
    availability: 0.5,
    replyDelayMs: 0,
    replyRate: 0,
  },
  {
    id: "peak_demand",
    label: "Pico de demanda",
    description: "12 profissionais, metade ocupada e preços mais altos",
    count: 12,
    range: [0.8, 12],
    availability: 0.5,
    replyDelayMs: 2000,
    replyRate: 0.6,
  },
];

/** RNG determinístico para reprodutibilidade dos testes */
const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const FIRST = [
  "Ana", "Bruno", "Carla", "Diego", "Elisa", "Felipe", "Gabi", "Heitor",
  "Iara", "João", "Karina", "Lucas", "Marina", "Nelson", "Olívia", "Paulo",
];
const LAST = ["Silva", "Souza", "Almeida", "Rocha", "Martins", "Costa", "Ferreira", "Lima"];
const FANTASY = ["Reparos Express", "Casa Nova Serviços", "TecFix", "Pro Master", "Obra Certa"];

export interface SandboxProfessional extends RadarProfessional {
  sandbox: true;
  busy: boolean;
  base_price: number;
  reputation: { rating: number; total_reviews: number; verified: boolean };
}

interface Options {
  active: boolean;
  scenario: SandboxScenario;
  lat: number | null;
  lng: number | null;
  categoryName?: string | null;
  urgent?: boolean;
  seed?: number;
  /** dispara as cotações simuladas */
  requesting: boolean;
}

export const useRadarSandbox = ({
  active,
  scenario,
  lat,
  lng,
  categoryName = null,
  urgent = false,
  seed = 1001,
  requesting,
}: Options) => {
  const def = useMemo(
    () => SANDBOX_SCENARIOS.find((s) => s.id === scenario) ?? SANDBOX_SCENARIOS[0],
    [scenario]
  );

  const professionals = useMemo<SandboxProfessional[]>(() => {
    if (!active || lat == null || lng == null) return [];
    const rnd = mulberry32(seed + def.id.length * 977);
    return Array.from({ length: def.count }).map((_, i) => {
      const dist = def.range[0] + rnd() * (def.range[1] - def.range[0]);
      const angle = rnd() * Math.PI * 2;
      const dLat = (dist / 111) * Math.cos(angle);
      const dLng = (dist / (111 * Math.cos((lat * Math.PI) / 180))) * Math.sin(angle);
      const plat = lat + dLat;
      const plng = lng + dLng;
      const isCompany = rnd() > 0.7;
      const name = isCompany
        ? `${FANTASY[Math.floor(rnd() * FANTASY.length)]}`
        : `${FIRST[Math.floor(rnd() * FIRST.length)]} ${LAST[Math.floor(rnd() * LAST.length)]}`;
      const realDist = haversineKm(lat, lng, plat, plng);
      const rating = Number((3.6 + rnd() * 1.4).toFixed(2));
      return {
        provider_id: `sandbox-${def.id}-${i}`,
        display_name: name,
        avatar_url: null,
        rating,
        category_name: categoryName,
        latitude: plat,
        longitude: plng,
        distance_km: realDist,
        eta_min: dynamicEtaMin(realDist, urgent),
        match_score: Number((rating * 12 + Math.max(0, 20 - realDist)).toFixed(1)),
        is_synthetic: true,
        updated_at: new Date().toISOString(),
        sandbox: true,
        busy: i >= Math.round(def.count * def.availability),
        base_price: Number((60 + rnd() * 90 + realDist * 6).toFixed(2)),
        reputation: {
          rating,
          total_reviews: Math.floor(rnd() * 180),
          verified: rnd() > 0.35,
        },
      } as SandboxProfessional;
    });
  }, [active, def, lat, lng, categoryName, urgent, seed]);

  const [quotes, setQuotes] = useState<RadarQuote[]>([]);
  const timers = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);

  const reset = useCallback(() => {
    clearTimers();
    setQuotes([]);
  }, [clearTimers]);

  useEffect(() => {
    clearTimers();
    setQuotes([]);
    if (!active || !requesting) return;
    const available = professionals.filter((p) => !p.busy);
    const responders = available.slice(0, Math.round(available.length * def.replyRate));
    timers.current = responders.map((p, i) =>
      window.setTimeout(() => {
        setQuotes((prev) =>
          [
            ...prev.filter((q) => q.provider_id !== p.provider_id),
            {
              offer_id: `sandbox-offer-${p.provider_id}`,
              provider_id: p.provider_id,
              price: Number((p.base_price + p.eta_min * 0.8).toFixed(2)),
              note: null,
              expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
              distance_km: p.distance_km,
              simulated: true,
            },
          ].sort((a, b) => a.price - b.price)
        );
      }, def.replyDelayMs + i * 900)
    );
    return clearTimers;
  }, [active, requesting, professionals, def, clearTimers]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  return { scenarioDef: def, professionals, quotes, setQuotes, reset };
};

export default useRadarSandbox;
