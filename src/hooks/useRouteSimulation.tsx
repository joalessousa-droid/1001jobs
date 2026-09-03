import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { decodePolyline } from "@/hooks/useGoogleMaps";

export interface LatLng { lat: number; lng: number }

interface Options {
  origin: LatLng | null;
  destination: LatLng | null;
  active: boolean;
  /** quantas vezes mais rápido que o tempo real o deslocamento é simulado */
  speedFactor?: number;
}

const haversineKm = (a: LatLng, b: LatLng) => {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

/**
 * Deslocamento realista do profissional: a rota vem da Routes API (ruas, quadras
 * e trânsito), e a posição é interpolada ao longo da polyline retornada.
 */
export const useRouteSimulation = ({ origin, destination, active, speedFactor = 60 }: Options) => {
  const [path, setPath] = useState<LatLng[]>([]);
  const [position, setPosition] = useState<LatLng | null>(null);
  const [routeKm, setRouteKm] = useState<number | null>(null);
  const [routeMin, setRouteMin] = useState<number | null>(null);
  const [remainingKm, setRemainingKm] = useState<number | null>(null);
  const [etaMin, setEtaMin] = useState<number | null>(null);
  const [arrived, setArrived] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const raf = useRef<number | null>(null);
  const startedAt = useRef<number>(0);

  const reset = useCallback(() => {
    setPath([]); setPosition(null); setRouteKm(null); setRouteMin(null);
    setRemainingKm(null); setEtaMin(null); setArrived(false); setError(null);
  }, []);

  // 1) buscar rota real
  useEffect(() => {
    if (!active || !origin || !destination) { reset(); return; }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const { data, error: err } = await supabase.functions.invoke("radar-route", {
        body: { origin, destination, mode: "DRIVE" },
      });
      if (cancelled) return;
      setLoading(false);
      if (err || !data?.polyline) {
        // fallback: linha reta com penalidade urbana de 30%
        const km = haversineKm(origin, destination) * 1.3;
        setPath([origin, destination]);
        setRouteKm(Number(km.toFixed(2)));
        setRouteMin(Math.max(1, Math.round((km / 0.4))));
        setError(err ? "Rota aproximada (rota real indisponível)" : null);
      } else {
        setPath(decodePolyline(data.polyline));
        setRouteKm(data.distance_km);
        setRouteMin(data.eta_min);
      }
      startedAt.current = Date.now();
      setArrived(false);
    })();
    return () => { cancelled = true; };
  }, [active, origin?.lat, origin?.lng, destination?.lat, destination?.lng, reset]);

  // 2) animar a posição ao longo da rota
  useEffect(() => {
    if (!active || path.length < 2 || !routeMin) return;
    // comprimentos acumulados
    const segs: number[] = [];
    let total = 0;
    for (let i = 1; i < path.length; i++) {
      total += haversineKm(path[i - 1], path[i]);
      segs.push(total);
    }
    const totalSec = routeMin * 60;
    const tick = () => {
      const elapsed = ((Date.now() - startedAt.current) / 1000) * speedFactor;
      const progress = Math.min(1, elapsed / totalSec);
      const target = total * progress;
      let idx = segs.findIndex((d) => d >= target);
      if (idx < 0) idx = segs.length - 1;
      const prevDist = idx === 0 ? 0 : segs[idx - 1];
      const segLen = segs[idx] - prevDist || 1;
      const t = Math.min(1, Math.max(0, (target - prevDist) / segLen));
      const a = path[idx];
      const b = path[idx + 1] ?? path[idx];
      setPosition({ lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t });
      const rest = Math.max(0, total - target);
      setRemainingKm(Number(rest.toFixed(2)));
      setEtaMin(Math.max(0, Math.ceil((totalSec * (1 - progress)) / 60)));
      if (progress >= 1) { setArrived(true); return; }
      raf.current = window.setTimeout(tick, 1000);
    };
    tick();
    return () => { if (raf.current) window.clearTimeout(raf.current); };
  }, [active, path, routeMin, speedFactor]);

  return { path, position, routeKm, routeMin, remainingKm, etaMin, arrived, loading, error, reset };
};
