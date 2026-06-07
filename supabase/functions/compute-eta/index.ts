// ETA / route computation using Google Routes API + regional traffic history.
// Calculates: distance, traffic-aware ETA, average speed and regional baseline,
// then blends with regional historical speed to produce an adjusted ETA.
// Updates public.service_tracking and feeds public.regional_traffic_stats.
//
// Tunable via env:
//   ETA_EMA_ALPHA_DEFAULT      - default EMA weight for regional samples (0..1)
//   ETA_EMA_ALPHA_OVERRIDES    - JSON map "dow:hour" -> alpha (e.g. {"1:8":0.4})
//   ETA_MAX_REGIONAL_WEIGHT    - cap for regional blend weight in adjusted ETA (default 0.4)
//   ETA_HISTORY_LIMIT          - rolling history size persisted per service (default 10)
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { computeAdjustedEta, resolveEmaAlpha, retryWithBackoff, type EtaMetric } from "./lib.ts";

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const regionKey = (city: string | null, state: string | null, lat: number, lng: number) => {
  if (city) return `${city.trim().toLowerCase()}|${(state ?? "").trim().toLowerCase()}`;
  return `geo|${lat.toFixed(2)}|${lng.toFixed(2)}`;
};

const logMetric = (m: EtaMetric) => {
  // Structured JSON line — picked up by Supabase function logs.
  console.log(JSON.stringify({ kind: "eta_metric", ts: new Date().toISOString(), ...m }));
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const startedAt = performance.now();
  let serviceIdForLog = "";

  try {
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const mapsKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!lovableKey || !mapsKey) return json({ error: "Maps connector not configured", degraded: true }, 503);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const historyLimit = Math.max(3, Math.min(50, Number(Deno.env.get("ETA_HISTORY_LIMIT")) || 10));
    const maxRegionalWeight = Math.max(
      0,
      Math.min(0.9, Number(Deno.env.get("ETA_MAX_REGIONAL_WEIGHT")) || 0.4),
    );

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const { service_id, origin, destination } = body ?? {};
    if (!service_id || !origin?.lat || !origin?.lng || !destination?.lat || !destination?.lng) {
      return json({ error: "Missing service_id, origin or destination" }, 400);
    }
    serviceIdForLog = service_id;

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: svc } = await admin
      .from("services").select("id, client_id, provider_id").eq("id", service_id).maybeSingle();
    if (!svc) return json({ error: "Service not found" }, 404);

    const { data: profile } = await admin
      .from("profiles").select("id").eq("user_id", user.id).maybeSingle();
    if (!profile || (profile.id !== svc.client_id && profile.id !== svc.provider_id)) {
      return json({ error: "Forbidden" }, 403);
    }

    // 1. Google Routes — traffic-aware ETA + free-flow baseline, with retry+jitter.
    const routesStart = performance.now();
    const retryAttemptsLog: Array<{ attempt: number; delayMs: number; error: string }> = [];
    const retries = Math.max(0, Math.min(5, Number(Deno.env.get("ETA_ROUTES_RETRIES")) || 2));
    const baseMs = Math.max(50, Math.min(2000, Number(Deno.env.get("ETA_ROUTES_BACKOFF_BASE_MS")) || 200));
    const capMs = Math.max(200, Math.min(10000, Number(Deno.env.get("ETA_ROUTES_BACKOFF_CAP_MS")) || 2000));

    let routeRes: Response;
    let totalAttempts = 1;
    try {
      const r = await retryWithBackoff(async () => {
        const res = await fetch(`${GATEWAY}/routes/directions/v2:computeRoutes`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${lovableKey}`,
            "X-Connection-Api-Key": mapsKey,
            "Content-Type": "application/json",
            "X-Goog-FieldMask":
              "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.staticDuration",
          },
          body: JSON.stringify({
            origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
            destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
            travelMode: "DRIVE",
            routingPreference: "TRAFFIC_AWARE",
          }),
        });
        // 5xx / 429 are retryable; 4xx surface immediately.
        if (res.status >= 500 || res.status === 429) {
          const body = await res.text();
          throw Object.assign(new Error(`http_${res.status}`), { status: res.status, body });
        }
        return res;
      }, {
        retries, baseMs, capMs,
        shouldRetry: (err: any) => err?.status == null || err.status >= 500 || err.status === 429,
        onAttempt: (attempt, delayMs, err: any) => {
          retryAttemptsLog.push({ attempt, delayMs, error: err?.message ?? "fetch_failed" });
          console.log(JSON.stringify({ kind: "eta_retry", attempt, delayMs, error: err?.message }));
        },
      });
      routeRes = r.value;
      totalAttempts = r.attempts;
    } catch (netErr: any) {
      const durMs = Math.round(performance.now() - routesStart);
      const status = netErr?.status ?? null;
      const errMsg = `${netErr?.message ?? "fetch failed"}`;
      logMetric({
        service_id, ok: false, duration_ms: durMs, status,
        distance_meters: null, eta_seconds: null,
        traffic_factor: null, traffic_level: null, regional_weight: null,
        retries: retryAttemptsLog.length, error: errMsg,
      });
      await admin.from("eta_metrics").insert({
        service_id, provider_id: svc.provider_id, ok: false, duration_ms: durMs,
        http_status: status, retries: retryAttemptsLog.length, degraded: true, error: errMsg,
      });
      await admin.from("service_tracking").upsert({
        service_id, state: "degraded", last_eta_at: new Date().toISOString(),
      }, { onConflict: "service_id" });
      return json({ error: "Routes API unreachable", degraded: true, attempts: retryAttemptsLog.length + 1 }, 502);
    }

    const routesDuration = Math.round(performance.now() - routesStart);
    if (!routeRes.ok) {
      const txt = await routeRes.text();
      logMetric({
        service_id, ok: false, duration_ms: routesDuration, status: routeRes.status,
        distance_meters: null, eta_seconds: null,
        traffic_factor: null, traffic_level: null, regional_weight: null,
        retries: totalAttempts - 1, error: txt.slice(0, 200),
      });
      await admin.from("eta_metrics").insert({
        service_id, provider_id: svc.provider_id, ok: false, duration_ms: routesDuration,
        http_status: routeRes.status, retries: totalAttempts - 1, degraded: true, error: txt.slice(0, 200),
      });
      await admin.from("service_tracking").upsert({
        service_id, state: "degraded", last_eta_at: new Date().toISOString(),
      }, { onConflict: "service_id" });
      return json({ error: "Routes API failed", detail: txt, degraded: true }, routeRes.status);
    }
    const route = (await routeRes.json())?.routes?.[0];
    if (!route) {
      logMetric({
        service_id, ok: false, duration_ms: routesDuration, status: 200,
        distance_meters: null, eta_seconds: null,
        traffic_factor: null, traffic_level: null, regional_weight: null,
        retries: totalAttempts - 1, error: "no_route",
      });
      await admin.from("eta_metrics").insert({
        service_id, provider_id: svc.provider_id, ok: false, duration_ms: routesDuration,
        http_status: 200, retries: totalAttempts - 1, degraded: true, error: "no_route",
      });
      return json({ error: "No route", degraded: true }, 422);
    }


    const etaTrafficSec = parseInt(String(route.duration ?? "0").replace("s", ""), 10) || 0;
    const staticSec = parseInt(String(route.staticDuration ?? "0").replace("s", ""), 10) || 0;
    const distanceMeters: number = route.distanceMeters ?? 0;
    const polyline: string | null = route.polyline?.encodedPolyline ?? null;

    // 2. Regional baseline lookup.
    const now = new Date();
    const hour = now.getUTCHours();
    const dow = now.getUTCDay();

    const { data: existingTrack } = await admin
      .from("service_tracking")
      .select("destination_city, destination_state, eta_history")
      .eq("service_id", service_id).maybeSingle();

    const key = regionKey(
      existingTrack?.destination_city ?? null,
      existingTrack?.destination_state ?? null,
      destination.lat, destination.lng,
    );

    const { data: regional } = await admin
      .from("regional_traffic_stats")
      .select("avg_speed_kmh, sample_count")
      .eq("region_key", key).eq("hour_of_day", hour).eq("day_of_week", dow).maybeSingle();

    // 2b. Resolve tuning overrides (table) — provider > category > city > global.
    const { data: tuning } = await admin.rpc("resolve_eta_tuning", {
      _provider_id: svc.provider_id,
      _category_id: (svc as any).category_id ?? null,
      _city: existingTrack?.destination_city ?? null,
      _hour: hour,
      _dow: dow,
    });
    const tunedMaxRegional = Number((tuning as any)?.max_regional_weight);
    const effectiveMaxRegional = Number.isFinite(tunedMaxRegional) ? tunedMaxRegional : maxRegionalWeight;

    // 3. Pure ETA computation.
    const result = computeAdjustedEta({
      etaTrafficSec,
      staticSec,
      distanceMeters,
      regionalSpeedKmh: regional?.avg_speed_kmh ?? null,
      regionalSampleCount: regional?.sample_count ?? null,
      maxRegionalWeight: effectiveMaxRegional,
    });

    // 4. Rolling history.
    const history = Array.isArray(existingTrack?.eta_history) ? existingTrack!.eta_history as any[] : [];
    history.push({
      at: now.toISOString(),
      eta_seconds: result.adjustedEtaSec,
      google_eta_seconds: etaTrafficSec,
      avg_speed_kmh: result.avgSpeedKmh,
      traffic_factor: result.trafficFactor,
    });
    const trimmed = history.slice(-historyLimit);

    // 5. Persist tracking row.
    await admin.from("service_tracking").upsert({
      service_id,
      destination_lat: destination.lat,
      destination_lng: destination.lng,
      current_lat: origin.lat,
      current_lng: origin.lng,
      eta_seconds: result.adjustedEtaSec,
      duration_in_traffic_seconds: etaTrafficSec,
      distance_meters: distanceMeters,
      route_polyline: polyline,
      avg_speed_kmh: result.avgSpeedKmh,
      regional_avg_speed_kmh: regional?.avg_speed_kmh ?? null,
      traffic_factor: result.trafficFactor,
      eta_history: trimmed,
      state: "tracking",
      last_eta_at: now.toISOString(),
    }, { onConflict: "service_id" });

    // 6. Feed regional history with EMA alpha (table override > env override > env default).
    if (result.avgSpeedKmh && result.avgSpeedKmh > 1 && distanceMeters > 200) {
      const tunedAlpha = Number((tuning as any)?.ema_alpha);
      const alpha = Number.isFinite(tunedAlpha)
        ? Math.max(0.01, Math.min(0.95, tunedAlpha))
        : resolveEmaAlpha(
            Deno.env.get("ETA_EMA_ALPHA_DEFAULT"),
            Deno.env.get("ETA_EMA_ALPHA_OVERRIDES"),
            dow, hour,
          );
      await admin.rpc("upsert_regional_traffic_sample", {
        _region_key: key,
        _city: existingTrack?.destination_city ?? null,
        _state: existingTrack?.destination_state ?? null,
        _hour: hour,
        _dow: dow,
        _speed_kmh: result.avgSpeedKmh,
        _alpha: alpha,
      });
    }

    const totalMs = Math.round(performance.now() - startedAt);
    logMetric({
      service_id, ok: true, duration_ms: totalMs, status: 200,
      distance_meters: distanceMeters, eta_seconds: result.adjustedEtaSec,
      traffic_factor: result.trafficFactor, traffic_level: result.trafficLevel,
      regional_weight: result.regionalWeight, retries: totalAttempts - 1,
    });
    await admin.from("eta_metrics").insert({
      service_id, provider_id: svc.provider_id, ok: true,
      duration_ms: totalMs, http_status: 200,
      distance_meters: distanceMeters, eta_seconds: result.adjustedEtaSec,
      traffic_factor: result.trafficFactor, traffic_level: result.trafficLevel,
      regional_weight: result.regionalWeight, retries: totalAttempts - 1,
      degraded: false, region_key: key, category_id: (svc as any).category_id ?? null,
    });



    return json({
      eta_seconds: result.adjustedEtaSec,
      google_eta_seconds: etaTrafficSec,
      static_duration_seconds: staticSec,
      distance_meters: distanceMeters,
      avg_speed_kmh: result.avgSpeedKmh,
      regional_avg_speed_kmh: regional?.avg_speed_kmh ?? null,
      traffic_factor: result.trafficFactor,
      traffic_level: result.trafficLevel,
      regional_weight: result.regionalWeight,
      polyline,
      degraded: false,
    });
  } catch (err: any) {
    logMetric({
      service_id: serviceIdForLog, ok: false,
      duration_ms: Math.round(performance.now() - startedAt),
      status: 500, distance_meters: null, eta_seconds: null,
      traffic_factor: null, traffic_level: null, regional_weight: null,
      error: err?.message ?? "internal",
    });
    return json({ error: err?.message ?? "internal", degraded: true }, 500);
  }
});
