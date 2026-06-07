// ETA / route computation using Google Routes API + regional traffic history.
// Calculates: distance, traffic-aware ETA, average speed and regional baseline,
// then blends with regional historical speed to produce an adjusted ETA.
// Updates public.service_tracking and feeds public.regional_traffic_stats.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";
const HISTORY_LIMIT = 10;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Bucket lat/lng to ~5km cells so we still get usable regional samples even
// without a reverse geocode hit.
const regionKey = (city: string | null, state: string | null, lat: number, lng: number) => {
  if (city) return `${city.trim().toLowerCase()}|${(state ?? "").trim().toLowerCase()}`;
  return `geo|${lat.toFixed(2)}|${lng.toFixed(2)}`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const mapsKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!lovableKey || !mapsKey) return json({ error: "Maps connector not configured" }, 503);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

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

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: svc } = await admin
      .from("services").select("id, client_id, provider_id").eq("id", service_id).maybeSingle();
    if (!svc) return json({ error: "Service not found" }, 404);

    const { data: profile } = await admin
      .from("profiles").select("id").eq("user_id", user.id).maybeSingle();
    if (!profile || (profile.id !== svc.client_id && profile.id !== svc.provider_id)) {
      return json({ error: "Forbidden" }, 403);
    }

    // 1. Ask Google Routes for traffic-aware ETA + free-flow baseline.
    const routeRes = await fetch(`${GATEWAY}/routes/directions/v2:computeRoutes`, {
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
    if (!routeRes.ok) {
      const txt = await routeRes.text();
      return json({ error: "Routes API failed", detail: txt }, routeRes.status);
    }
    const route = (await routeRes.json())?.routes?.[0];
    if (!route) return json({ error: "No route" }, 422);

    const etaTrafficSec = parseInt(String(route.duration ?? "0").replace("s", ""), 10) || 0;
    const staticSec = parseInt(String(route.staticDuration ?? "0").replace("s", ""), 10) || 0;
    const distanceMeters: number = route.distanceMeters ?? 0;
    const polyline: string | null = route.polyline?.encodedPolyline ?? null;

    // 2. Average speed (km/h) for this leg and current traffic factor.
    const avgSpeedKmh = etaTrafficSec > 0
      ? Number(((distanceMeters / 1000) / (etaTrafficSec / 3600)).toFixed(2))
      : null;
    const trafficFactor = staticSec > 0 && etaTrafficSec > 0
      ? Number((etaTrafficSec / staticSec).toFixed(3))
      : null;

    // 3. Regional historical baseline — lookup by (region, hour, day-of-week).
    const now = new Date();
    const hour = now.getUTCHours();
    const dow = now.getUTCDay();

    // Existing destination_city/state if we have it cached on the tracking row.
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

    const regionalSpeed: number | null = regional?.avg_speed_kmh ?? null;

    // 4. Blend Google ETA with regional-history-based estimate.
    //    weightRegional grows with sample_count, capped at 0.4.
    let adjustedEta = etaTrafficSec;
    if (regionalSpeed && regionalSpeed > 5 && distanceMeters > 0) {
      const regionalEta = (distanceMeters / 1000) / regionalSpeed * 3600;
      const w = Math.min(0.4, (regional!.sample_count ?? 1) / 50);
      adjustedEta = Math.round(etaTrafficSec * (1 - w) + regionalEta * w);
    }

    // 5. Rolling ETA history (last N snapshots) for trend display.
    const history = Array.isArray(existingTrack?.eta_history) ? existingTrack!.eta_history as any[] : [];
    history.push({
      at: now.toISOString(),
      eta_seconds: adjustedEta,
      google_eta_seconds: etaTrafficSec,
      avg_speed_kmh: avgSpeedKmh,
      traffic_factor: trafficFactor,
    });
    const trimmed = history.slice(-HISTORY_LIMIT);

    // 6. Persist tracking row.
    await admin.from("service_tracking").upsert({
      service_id,
      destination_lat: destination.lat,
      destination_lng: destination.lng,
      current_lat: origin.lat,
      current_lng: origin.lng,
      eta_seconds: adjustedEta,
      duration_in_traffic_seconds: etaTrafficSec,
      distance_meters: distanceMeters,
      route_polyline: polyline,
      avg_speed_kmh: avgSpeedKmh,
      regional_avg_speed_kmh: regionalSpeed,
      traffic_factor: trafficFactor,
      eta_history: trimmed,
      state: "tracking",
      last_eta_at: now.toISOString(),
    }, { onConflict: "service_id" });

    // 7. Feed regional history (don't block on it).
    if (avgSpeedKmh && avgSpeedKmh > 1 && distanceMeters > 200) {
      await admin.rpc("upsert_regional_traffic_sample", {
        _region_key: key,
        _city: existingTrack?.destination_city ?? null,
        _state: existingTrack?.destination_state ?? null,
        _hour: hour,
        _dow: dow,
        _speed_kmh: avgSpeedKmh,
      });
    }

    return json({
      eta_seconds: adjustedEta,
      google_eta_seconds: etaTrafficSec,
      static_duration_seconds: staticSec,
      distance_meters: distanceMeters,
      avg_speed_kmh: avgSpeedKmh,
      regional_avg_speed_kmh: regionalSpeed,
      traffic_factor: trafficFactor,
      polyline,
    });
  } catch (err: any) {
    return json({ error: err?.message ?? "internal" }, 500);
  }
});
