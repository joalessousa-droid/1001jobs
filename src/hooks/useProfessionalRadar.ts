import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/* ------------------------------------------------------------------ */
/*  Tipos                                                              */
/* ------------------------------------------------------------------ */

export interface RadarProfessional {
  provider_id: string;
  display_name: string | null;
  avatar_url: string | null;
  rating: number | null;
  category_name: string | null;
  latitude: number;
  longitude: number;
  distance_km: number;
  eta_min: number;
  match_score: number | null;
  is_synthetic: boolean | null;
  updated_at: string;
}

/** Máquina de estados de 8 etapas do despacho */
export type RadarStage =
  | "idle"
  | "locating"
  | "scanning"
  | "found"
  | "dispatching"
  | "offer_sent"
  | "accepted"
  | "enroute"
  | "arrived";

export const RADAR_STAGES: Exclude<RadarStage, "idle">[] = [
  "locating",
  "scanning",
  "found",
  "dispatching",
  "offer_sent",
  "accepted",
  "enroute",
  "arrived",
];

export const RADAR_STAGE_LABEL: Record<RadarStage, string> = {
  idle: "Pronto para buscar",
  locating: "Localizando você",
  scanning: "Varrendo profissionais próximos",
  found: "Profissionais encontrados",
  dispatching: "Selecionando o melhor match",
  offer_sent: "Solicitação enviada",
  accepted: "Profissional aceitou",
  enroute: "A caminho",
  arrived: "Chegou ao local",
};

/** Escalação de raio conforme especificação */
export const RADAR_RADII = [3, 5, 8, 10, 20];

/* ------------------------------------------------------------------ */
/*  Utilitários geográficos                                            */
/* ------------------------------------------------------------------ */

export const haversineKm = (
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
) => {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
};

/** ETA dinâmico: velocidade urbana média cai com trânsito/curta distância */
export const dynamicEtaMin = (distanceKm: number, urgent = false) => {
  const base = distanceKm < 2 ? 18 : distanceKm < 6 ? 24 : 32; // km/h
  const speed = urgent ? base * 1.15 : base;
  return Math.max(2, Math.round((distanceKm / speed) * 60) + 2);
};

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

interface Options {
  lat: number | null;
  lng: number | null;
  categoryId?: string | null;
  active: boolean;
  urgent?: boolean;
  includeSynthetic?: boolean;
  clientId?: string | null;
  minProfessionals?: number;
  /** solicitação aberta — habilita realtime de ofertas/tracking */
  serviceRequestId?: string | null;
}

export const useProfessionalRadar = ({
  lat,
  lng,
  categoryId = null,
  active,
  urgent = false,
  includeSynthetic = false,
  clientId = null,
  minProfessionals = 3,
  serviceRequestId = null,
}: Options) => {
  const [professionals, setProfessionals] = useState<RadarProfessional[]>([]);
  const [radiusIndex, setRadiusIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expanding, setExpanding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newIds, setNewIds] = useState<string[]>([]);
  const [stage, setStage] = useState<RadarStage>("idle");
  const [offer, setOffer] = useState<{ provider_id: string; expires_at: string } | null>(null);
  const [acceptedProviderId, setAcceptedProviderId] = useState<string | null>(null);
  const [providerPosition, setProviderPosition] = useState<{ lat: number; lng: number } | null>(null);

  const knownIds = useRef<Set<string>>(new Set());
  const debounceRef = useRef<number | null>(null);
  const escalateRef = useRef<number | null>(null);

  const radius = RADAR_RADII[Math.min(radiusIndex, RADAR_RADII.length - 1)];

  /* ----------------------------- fetch ---------------------------- */
  const fetchProfessionals = useCallback(
    async (r: number) => {
      if (lat == null || lng == null) return;
      setLoading(true);
      const { data, error: err } = await supabase.rpc("find_nearby_providers" as any, {
        _lat: lat,
        _lng: lng,
        _radius_km: r,
        _category_id: categoryId,
        _limit: 60,
        _include_synthetic: includeSynthetic,
        _client_id: clientId,
      });
      setLoading(false);
      if (err) {
        setError(err.message);
        return;
      }
      setError(null);
      const list = ((data ?? []) as RadarProfessional[])
        .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
        .map((p) => {
          const distance_km = haversineKm(lat, lng, p.latitude, p.longitude);
          return { ...p, distance_km, eta_min: dynamicEtaMin(distance_km, urgent) };
        });

      const fresh = list.map((p) => p.provider_id).filter((id) => !knownIds.current.has(id));
      if (fresh.length) {
        setNewIds(fresh);
        window.setTimeout(() => setNewIds([]), 1800);
      }
      knownIds.current = new Set(list.map((p) => p.provider_id));
      setProfessionals(list);
    },
    [lat, lng, categoryId, includeSynthetic, clientId, urgent]
  );

  /* ------------------------- ciclo de vida ------------------------ */
  useEffect(() => {
    if (active) return;
    setProfessionals([]);
    setRadiusIndex(0);
    setExpanding(false);
    setOffer(null);
    setAcceptedProviderId(null);
    setProviderPosition(null);
    setStage("idle");
    knownIds.current = new Set();
  }, [active]);

  useEffect(() => {
    if (!active) return;
    if (lat == null || lng == null) {
      setStage("locating");
      return;
    }
    setStage((s) => (s === "idle" || s === "locating" ? "scanning" : s));
    void fetchProfessionals(radius);
  }, [active, radius, fetchProfessionals, lat, lng]);

  /* ----------------- escalação automática do raio ----------------- */
  useEffect(() => {
    if (!active || loading) return;
    if (escalateRef.current) window.clearTimeout(escalateRef.current);
    if (professionals.length >= minProfessionals || radiusIndex >= RADAR_RADII.length - 1) {
      setExpanding(false);
      return;
    }
    setExpanding(true);
    escalateRef.current = window.setTimeout(
      () => setRadiusIndex((i) => Math.min(i + 1, RADAR_RADII.length - 1)),
      urgent ? 1800 : 2600
    );
    return () => {
      if (escalateRef.current) window.clearTimeout(escalateRef.current);
    };
  }, [active, loading, professionals.length, radiusIndex, minProfessionals, urgent]);

  /* --------------- transições scanning ↔ found -------------------- */
  useEffect(() => {
    if (!active) return;
    setStage((s) => {
      if (s === "scanning" && professionals.length > 0) return "found";
      if (s === "found" && professionals.length === 0) return "scanning";
      return s;
    });
  }, [active, professionals.length]);

  /* ------------- realtime: localização e disponibilidade ---------- */
  useEffect(() => {
    if (!active || lat == null || lng == null) return;
    const schedule = () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => void fetchProfessionals(radius), 1200);
    };
    const channel = supabase
      .channel("professional-radar")
      .on("postgres_changes", { event: "*", schema: "public", table: "provider_locations" }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "provider_availability" }, schedule)
      .subscribe();
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [active, lat, lng, radius, fetchProfessionals]);

  /* ---------------- realtime: ofertas + tracking ------------------ */
  useEffect(() => {
    if (!serviceRequestId) return;
    const channel = supabase
      .channel(`radar-dispatch-${serviceRequestId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "service_offers",
          filter: `service_request_id=eq.${serviceRequestId}`,
        },
        (payload) => {
          const row: any = payload.new;
          if (!row) return;
          if (row.status === "pending") {
            setOffer({ provider_id: row.provider_id, expires_at: row.expires_at });
            setStage("offer_sent");
          } else if (row.status === "accepted") {
            setOffer(null);
            setAcceptedProviderId(row.provider_id);
            setStage("accepted");
          } else if (["declined", "expired", "cancelled"].includes(row.status)) {
            setOffer(null);
            setStage((s) => (s === "offer_sent" ? "dispatching" : s));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "service_tracking" },
        (payload) => {
          const row: any = payload.new;
          if (!row) return;
          if (row.provider_latitude && row.provider_longitude) {
            setProviderPosition({ lat: row.provider_latitude, lng: row.provider_longitude });
            setStage((s) => (s === "accepted" ? "enroute" : s));
          }
          if (row.status === "arrived" || row.arrived_at) setStage("arrived");
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [serviceRequestId]);

  /* ---------------------------- ranking --------------------------- */
  const ranked = useMemo(
    () =>
      [...professionals].sort((a, b) => {
        const sa = a.match_score ?? (a.rating ?? 0) * 10 - a.distance_km;
        const sb = b.match_score ?? (b.rating ?? 0) * 10 - b.distance_km;
        return sb - sa || a.distance_km - b.distance_km;
      }),
    [professionals]
  );

  const best = ranked[0] ?? null;
  const accepted = useMemo(
    () => professionals.find((p) => p.provider_id === acceptedProviderId) ?? null,
    [professionals, acceptedProviderId]
  );

  return {
    professionals,
    ranked,
    best,
    accepted,
    radius,
    radii: RADAR_RADII,
    expanding,
    loading,
    error,
    newIds,
    stage,
    setStage,
    offer,
    providerPosition,
    refresh: () => fetchProfessionals(radius),
    expandNow: () => setRadiusIndex((i) => Math.min(i + 1, RADAR_RADII.length - 1)),
  };
};

export default useProfessionalRadar;
