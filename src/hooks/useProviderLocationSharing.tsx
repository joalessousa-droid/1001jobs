import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Options {
  providerId: string | null;
  intervalMs?: number;
  serviceId?: string | null; // when provided, points are also written to history under this service
  enabled?: boolean;
}

interface Position {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
}

/**
 * Provider-side hook: continuously streams GPS to provider_locations (upsert) and
 * appends to provider_location_history. Throttled by intervalMs (default 5s).
 */
export const useProviderLocationSharing = ({
  providerId,
  intervalMs = 5000,
  serviceId = null,
  enabled = false,
}: Options) => {
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<Position | null>(null);
  const watchId = useRef<number | null>(null);
  const lastSent = useRef<number>(0);

  const flush = useCallback(
    async (pos: Position) => {
      if (!providerId) return;
      const payload = {
        provider_id: providerId,
        latitude: pos.latitude,
        longitude: pos.longitude,
        accuracy: pos.accuracy ?? null,
        heading: pos.heading ?? null,
        speed: pos.speed ?? null,
        is_sharing: true,
        updated_at: new Date().toISOString(),
      };
      await supabase.from("provider_locations" as any).upsert(payload, { onConflict: "provider_id" });
      await supabase.from("provider_location_history" as any).insert({
        provider_id: providerId,
        latitude: pos.latitude,
        longitude: pos.longitude,
        accuracy: pos.accuracy ?? null,
        heading: pos.heading ?? null,
        speed: pos.speed ?? null,
        service_id: serviceId,
      });
    },
    [providerId, serviceId]
  );

  const stop = useCallback(async () => {
    if (watchId.current !== null && "geolocation" in navigator) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setSharing(false);
    if (providerId) {
      await supabase.from("provider_locations" as any).update({ is_sharing: false }).eq("provider_id", providerId);
    }
  }, [providerId]);

  const start = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setError("Geolocalização não suportada neste dispositivo");
      return;
    }
    if (!providerId) return;
    setError(null);
    setSharing(true);
    watchId.current = navigator.geolocation.watchPosition(
      (geo) => {
        const pos: Position = {
          latitude: geo.coords.latitude,
          longitude: geo.coords.longitude,
          accuracy: geo.coords.accuracy,
          heading: geo.coords.heading,
          speed: geo.coords.speed,
        };
        setLast(pos);
        const now = Date.now();
        if (now - lastSent.current >= intervalMs) {
          lastSent.current = now;
          void flush(pos);
        }
      },
      (err) => setError(err.message),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
    );
  }, [providerId, intervalMs, flush]);

  useEffect(() => {
    if (enabled) start();
    else void stop();
    return () => {
      if (watchId.current !== null && "geolocation" in navigator) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, providerId]);

  return { sharing, error, last, start, stop };
};
