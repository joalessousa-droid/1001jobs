import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface RadarProvider {
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

interface Options {
  lat: number | null;
  lng: number | null;
  categoryId?: string | null;
  active: boolean;
  /** modo simulação: inclui perfis de demonstração no raio */
  includeSynthetic?: boolean;
  /** perfil do cliente, usado no cálculo do score de match */
  clientId?: string | null;
  /** minimum providers before the radius stops escalating */
  minProviders?: number;
  radii?: number[];
}

const DEFAULT_RADII = [3, 5, 8, 10];

/**
 * Radar de Profissionais — real-time nearby availability.
 * Data always comes from the backend RPC (`find_nearby_providers`), which
 * validates auth, availability and category compatibility server-side and
 * returns coarse coordinates (privacy) plus distance/ETA.
 */
export const useProviderRadar = ({
  lat,
  lng,
  categoryId = null,
  active,
  includeSynthetic = false,
  clientId = null,
  minProviders = 3,
  radii = DEFAULT_RADII,
}: Options) => {
  const [providers, setProviders] = useState<RadarProvider[]>([]);
  const [radiusIndex, setRadiusIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expanding, setExpanding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newIds, setNewIds] = useState<string[]>([]);
  const knownIds = useRef<Set<string>>(new Set());
  const debounceRef = useRef<number | null>(null);
  const escalateRef = useRef<number | null>(null);

  const radius = radii[Math.min(radiusIndex, radii.length - 1)];

  const fetchProviders = useCallback(
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
      const list = ((data ?? []) as RadarProvider[]).filter(
        (p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude)
      );
      const fresh = list.map((p) => p.provider_id).filter((id) => !knownIds.current.has(id));
      if (fresh.length) {
        setNewIds(fresh);
        window.setTimeout(() => setNewIds([]), 1800);
      }
      knownIds.current = new Set(list.map((p) => p.provider_id));
      setProviders(list);
    },
    [lat, lng, categoryId, includeSynthetic, clientId]
  );

  // Reset when radar stops
  useEffect(() => {
    if (active) return;
    setProviders([]);
    setRadiusIndex(0);
    setExpanding(false);
    knownIds.current = new Set();
  }, [active]);

  // Initial + radius change fetch
  useEffect(() => {
    if (!active) return;
    void fetchProviders(radius);
  }, [active, radius, fetchProviders]);

  // Automatic radius escalation while there are not enough providers
  useEffect(() => {
    if (!active || loading) return;
    if (escalateRef.current) window.clearTimeout(escalateRef.current);
    if (providers.length >= minProviders || radiusIndex >= radii.length - 1) {
      setExpanding(false);
      return;
    }
    setExpanding(true);
    escalateRef.current = window.setTimeout(() => setRadiusIndex((i) => i + 1), 2500);
    return () => {
      if (escalateRef.current) window.clearTimeout(escalateRef.current);
    };
  }, [active, loading, providers.length, radiusIndex, minProviders, radii.length]);

  // Realtime: react to GPS / availability changes (debounced, no polling)
  useEffect(() => {
    if (!active || lat == null || lng == null) return;
    const schedule = () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => void fetchProviders(radius), 1200);
    };
    const channel = supabase
      .channel("provider-radar")
      .on("postgres_changes", { event: "*", schema: "public", table: "provider_locations" }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "provider_availability" }, schedule)
      .subscribe();
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [active, lat, lng, radius, fetchProviders]);

  /** ranking pelo score real do motor de matching (fallback: nota + distância) */
  const ranked = useMemo(
    () =>
      [...providers].sort((a, b) => {
        const sa = a.match_score ?? (a.rating ?? 0) * 10 - a.distance_km;
        const sb = b.match_score ?? (b.rating ?? 0) * 10 - b.distance_km;
        return sb - sa || a.distance_km - b.distance_km;
      }),
    [providers]
  );
  const best = ranked[0] ?? null;

  return {
    providers,
    ranked,
    best,
    radius,
    radii,
    expanding,
    loading,
    error,
    newIds,
    refresh: () => fetchProviders(radius),
    expandNow: () => setRadiusIndex((i) => Math.min(i + 1, radii.length - 1)),
  };
};
