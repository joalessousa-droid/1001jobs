// Modo Navegação da Tarefa — geofencing de chegada + registro de eventos.
// Reaproveita provider_locations/service_tracking e o sistema de notificações existentes.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_GEOFENCE,
  evaluateArrival,
  type GeoSample,
  type GeofenceConfig,
  type NavAppOption,
} from "@/lib/navigationApps";

export type NavState =
  | "ACCEPTED"
  | "NAVIGATION_STARTED"
  | "EN_ROUTE"
  | "ARRIVAL_DETECTED"
  | "ARRIVED"
  | "SERVICE_STARTED"
  | "SERVICE_COMPLETED";

interface Options {
  serviceId: string | null;
  /** Só o profissional designado registra eventos. */
  isProvider: boolean;
  destination: { lat: number; lng: number; address?: string | null } | null;
  /** Última posição conhecida do profissional (vem do compartilhamento de localização já existente). */
  position: { latitude: number; longitude: number; accuracy?: number | null; speed?: number | null } | null;
}

export const useTaskNavigation = ({ serviceId, isProvider, destination, position }: Options) => {
  const [config, setConfig] = useState<GeofenceConfig>(DEFAULT_GEOFENCE);
  const [navState, setNavState] = useState<NavState>("ACCEPTED");
  const [arrivalSource, setArrivalSource] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const samples = useRef<GeoSample[]>([]);
  const sentDetected = useRef(false);
  const sentArrived = useRef(false);
  const sentEnRoute = useRef(false);

  // Configuração de geofence (ajustável no backend)
  useEffect(() => {
    let active = true;
    void (async () => {
      const { data } = await supabase.from("navigation_settings" as never).select("*").maybeSingle();
      if (!active || !data) return;
      const row = data as Record<string, number>;
      setConfig({
        radiusM: Number(row.geofence_radius_m ?? DEFAULT_GEOFENCE.radiusM),
        dwellSeconds: Number(row.dwell_seconds ?? DEFAULT_GEOFENCE.dwellSeconds),
        maxSpeedKmh: Number(row.max_speed_kmh ?? DEFAULT_GEOFENCE.maxSpeedKmh),
        minAccuracyM: Number(row.min_accuracy_m ?? DEFAULT_GEOFENCE.minAccuracyM),
      });
    })();
    return () => { active = false; };
  }, []);

  // Estado atual do deslocamento (compartilhado com o cliente em tempo real)
  useEffect(() => {
    if (!serviceId) return;
    let active = true;
    const load = async () => {
      const { data } = await supabase
        .from("service_tracking" as never)
        .select("nav_state, arrival_source")
        .eq("service_id", serviceId)
        .maybeSingle();
      if (!active || !data) return;
      const row = data as { nav_state?: string | null; arrival_source?: string | null };
      if (row.nav_state) setNavState(row.nav_state as NavState);
      setArrivalSource(row.arrival_source ?? null);
      if (row.nav_state === "ARRIVED") sentArrived.current = true;
    };
    void load();
    const ch = supabase
      .channel(`task-nav-${serviceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "service_tracking", filter: `service_id=eq.${serviceId}` },
        (payload: { new?: Record<string, unknown> }) => {
          const row = payload.new;
          if (!row) return;
          if (row.nav_state) setNavState(row.nav_state as NavState);
          setArrivalSource((row.arrival_source as string) ?? null);
        })
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [serviceId]);

  const recordEvent = useCallback(
    async (eventType: string, extra: Record<string, unknown> = {}, source?: string) => {
      if (!serviceId || !isProvider) return;
      await supabase.rpc("record_navigation_event" as never, {
        _service_id: serviceId,
        _event_type: eventType,
        _latitude: position?.latitude ?? null,
        _longitude: position?.longitude ?? null,
        _accuracy: position?.accuracy ?? null,
        _source: source ?? "GPS",
        _metadata: extra,
      } as never);
    },
    [serviceId, isProvider, position],
  );

  /** Registra o início da navegação externa (sem substituir o rastreamento da 1001Jobs). */
  const startNavigation = useCallback(
    async (app: NavAppOption) => {
      setNavState("NAVIGATION_STARTED");
      await recordEvent("navigation_started", { app: app.id, label: app.label }, "PROVIDER_BUTTON");
      await recordEvent("navigation_provider", { app: app.id }, "PROVIDER_BUTTON");
    },
    [recordEvent],
  );

  const evaluation = useMemo(() => {
    if (!destination || !position) return null;
    const now = Date.now();
    const lastSample = samples.current[samples.current.length - 1];
    if (!lastSample || lastSample.latitude !== position.latitude || lastSample.longitude !== position.longitude) {
      samples.current = [...samples.current, { ...position, timestamp: now }].slice(-120);
    }
    return evaluateArrival(samples.current, destination, config);
  }, [destination, position, config]);

  // Transições automáticas
  useEffect(() => {
    if (!isProvider || !serviceId || !evaluation) return;
    void (async () => {
      if (!sentEnRoute.current && !evaluation.inside && navState === "NAVIGATION_STARTED") {
        sentEnRoute.current = true;
        setNavState("EN_ROUTE");
        await recordEvent("en_route", { distance_m: Math.round(evaluation.distanceM) });
      }
      if (evaluation.detected && !sentDetected.current && !sentArrived.current) {
        sentDetected.current = true;
        setNavState("ARRIVAL_DETECTED");
        await recordEvent("arrival_detected", { distance_m: Math.round(evaluation.distanceM), dwell_s: Math.round(evaluation.dwellSeconds) });
      }
      if (evaluation.arrived && !sentArrived.current) {
        sentArrived.current = true;
        await supabase.rpc("confirm_task_arrival" as never, {
          _service_id: serviceId,
          _latitude: position?.latitude ?? null,
          _longitude: position?.longitude ?? null,
          _accuracy: position?.accuracy ?? null,
          _source: "GPS",
          _metadata: { distance_m: Math.round(evaluation.distanceM), dwell_s: Math.round(evaluation.dwellSeconds) },
        } as never);
        setNavState("ARRIVED");
        setArrivalSource((s) => s ?? "GPS");
      }
    })();
  }, [evaluation, isProvider, serviceId, navState, position, recordEvent]);

  /** Confirmação manual: "CHEGUEI AO LOCAL". */
  const confirmArrival = useCallback(async () => {
    if (!serviceId || !isProvider) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("confirm_task_arrival" as never, {
        _service_id: serviceId,
        _latitude: position?.latitude ?? null,
        _longitude: position?.longitude ?? null,
        _accuracy: position?.accuracy ?? null,
        _source: "PROVIDER_BUTTON",
        _metadata: { manual: true },
      } as never);
      if (error) throw error;
      sentArrived.current = true;
      setNavState("ARRIVED");
      setArrivalSource((s) => s ?? "PROVIDER_BUTTON");
    } finally {
      setBusy(false);
    }
  }, [serviceId, isProvider, position]);

  return {
    config,
    navState,
    arrivalSource,
    busy,
    distanceM: evaluation?.distanceM ?? null,
    insideGeofence: evaluation?.inside ?? false,
    startNavigation,
    confirmArrival,
  };
};
