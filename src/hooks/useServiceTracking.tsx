import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TrackingState {
  providerLocation: { latitude: number; longitude: number; updated_at: string } | null;
  destination: { lat: number; lng: number; address?: string | null } | null;
  etaSeconds: number | null;
  distanceMeters: number | null;
  polyline: string | null;
  lastEtaAt: string | null;
  avgSpeedKmh: number | null;
  regionalAvgSpeedKmh: number | null;
  trafficFactor: number | null;
  etaHistory: Array<{ at: string; eta_seconds: number; avg_speed_kmh: number | null }>;
}

export const useServiceTracking = (serviceId: string | null, providerId: string | null) => {
  const [state, setState] = useState<TrackingState>({
    providerLocation: null, destination: null, etaSeconds: null,
    distanceMeters: null, polyline: null, lastEtaAt: null,
    avgSpeedKmh: null, regionalAvgSpeedKmh: null, trafficFactor: null, etaHistory: [],
  });
  const [loading, setLoading] = useState(true);
  const lastEta = useRef<number>(0);

  // Load initial state (provider position + tracking row)
  const load = useCallback(async () => {
    if (!providerId) return;
    const [{ data: loc }, { data: track }] = await Promise.all([
      supabase.from("provider_locations" as any).select("*").eq("provider_id", providerId).maybeSingle(),
      serviceId
        ? supabase.from("service_tracking" as any).select("*").eq("service_id", serviceId).maybeSingle()
        : Promise.resolve({ data: null } as any),
    ]);
    setState((s) => ({
      ...s,
      providerLocation: loc
        ? { latitude: (loc as any).latitude, longitude: (loc as any).longitude, updated_at: (loc as any).updated_at }
        : null,
      destination: track && (track as any).destination_lat != null
        ? { lat: (track as any).destination_lat, lng: (track as any).destination_lng, address: (track as any).destination_address }
        : s.destination,
      etaSeconds: (track as any)?.eta_seconds ?? null,
      distanceMeters: (track as any)?.distance_meters ?? null,
      polyline: (track as any)?.route_polyline ?? null,
      lastEtaAt: (track as any)?.last_eta_at ?? null,
      avgSpeedKmh: (track as any)?.avg_speed_kmh ?? null,
      regionalAvgSpeedKmh: (track as any)?.regional_avg_speed_kmh ?? null,
      trafficFactor: (track as any)?.traffic_factor ?? null,
      etaHistory: Array.isArray((track as any)?.eta_history) ? (track as any).eta_history : [],
    }));
    setLoading(false);
  }, [providerId, serviceId]);

  // Realtime subscriptions
  useEffect(() => {
    if (!providerId) return;
    void load();

    const channels: any[] = [];

    const locCh = supabase
      .channel(`prov-loc-${providerId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "provider_locations",
        filter: `provider_id=eq.${providerId}`,
      }, (payload: any) => {
        const row = payload.new;
        if (!row) return;
        setState((s) => ({ ...s, providerLocation: { latitude: row.latitude, longitude: row.longitude, updated_at: row.updated_at } }));
      })
      .subscribe();
    channels.push(locCh);

    if (serviceId) {
      const trCh = supabase
        .channel(`svc-track-${serviceId}`)
        .on("postgres_changes", {
          event: "*", schema: "public", table: "service_tracking",
          filter: `service_id=eq.${serviceId}`,
        }, (payload: any) => {
          const row = payload.new;
          if (!row) return;
          setState((s) => ({
            ...s,
            destination: row.destination_lat != null
              ? { lat: row.destination_lat, lng: row.destination_lng, address: row.destination_address }
              : s.destination,
            etaSeconds: row.eta_seconds ?? null,
            distanceMeters: row.distance_meters ?? null,
            polyline: row.route_polyline ?? null,
            lastEtaAt: row.last_eta_at ?? null,
            avgSpeedKmh: row.avg_speed_kmh ?? null,
            regionalAvgSpeedKmh: row.regional_avg_speed_kmh ?? null,
            trafficFactor: row.traffic_factor ?? null,
            etaHistory: Array.isArray(row.eta_history) ? row.eta_history : [],
          }));
        })
        .subscribe();
      channels.push(trCh);
    }

    return () => { channels.forEach((c) => supabase.removeChannel(c)); };
  }, [providerId, serviceId, load]);

  // Recompute ETA: triggered by provider movement (throttled to 30s) and
  // a periodic 60s tick so the "Chegada estimada" stays fresh even when the
  // provider stops briefly (traffic light, parked, etc).
  const recomputeEta = useCallback(async (force = false) => {
    if (!serviceId || !state.providerLocation || !state.destination) return;
    const now = Date.now();
    if (!force && now - lastEta.current < 30_000) return;
    lastEta.current = now;
    try {
      await supabase.functions.invoke("compute-eta", {
        body: {
          service_id: serviceId,
          origin: { lat: state.providerLocation.latitude, lng: state.providerLocation.longitude },
          destination: { lat: state.destination.lat, lng: state.destination.lng },
        },
      });
    } catch (e) {
      console.error("compute-eta failed", e);
    }
  }, [serviceId, state.providerLocation, state.destination]);

  useEffect(() => { void recomputeEta(); }, [recomputeEta]);

  // Auto-refresh ETA every 60 seconds while a destination is set.
  useEffect(() => {
    if (!serviceId || !state.destination || !state.providerLocation) return;
    const id = setInterval(() => { void recomputeEta(true); }, 60_000);
    return () => clearInterval(id);
  }, [serviceId, state.destination, state.providerLocation, recomputeEta]);

  // Allow caller to set destination once
  const setDestination = useCallback(async (lat: number, lng: number, address?: string) => {
    if (!serviceId) return;
    await supabase.from("service_tracking" as any).upsert({
      service_id: serviceId, destination_lat: lat, destination_lng: lng, destination_address: address ?? null, state: "tracking",
    }, { onConflict: "service_id" });
    setState((s) => ({ ...s, destination: { lat, lng, address } }));
  }, [serviceId]);

  return { ...state, loading, setDestination, refresh: load };
};
