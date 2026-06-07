// ETA / route computation using Google Routes API (via Lovable connector gateway).
// Updates public.service_tracking with eta_seconds, distance_meters, polyline.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const mapsKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!lovableKey || !mapsKey) {
      return new Response(JSON.stringify({ error: "Maps connector not configured" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { service_id, origin, destination } = body ?? {};
    if (!service_id || !origin?.lat || !origin?.lng || !destination?.lat || !destination?.lng) {
      return new Response(JSON.stringify({ error: "Missing service_id, origin or destination" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // verify the caller participates in this service
    const { data: svc } = await admin
      .from("services").select("id, client_id, provider_id")
      .eq("id", service_id).maybeSingle();
    if (!svc) {
      return new Response(JSON.stringify({ error: "Service not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: profile } = await admin
      .from("profiles").select("id").eq("user_id", user.id).maybeSingle();
    if (!profile || (profile.id !== svc.client_id && profile.id !== svc.provider_id)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Routes API
    const routeRes = await fetch(`${GATEWAY}/routes/directions/v2:computeRoutes`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": mapsKey,
        "Content-Type": "application/json",
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.staticDuration",
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
      return new Response(JSON.stringify({ error: "Routes API failed", detail: txt }), {
        status: routeRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const route = (await routeRes.json())?.routes?.[0];
    if (!route) {
      return new Response(JSON.stringify({ error: "No route" }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const eta = parseInt(String(route.duration ?? "0").replace("s", ""), 10) || null;
    const staticDur = parseInt(String(route.staticDuration ?? "0").replace("s", ""), 10) || null;

    await admin.from("service_tracking").upsert({
      service_id,
      destination_lat: destination.lat,
      destination_lng: destination.lng,
      current_lat: origin.lat,
      current_lng: origin.lng,
      eta_seconds: eta,
      duration_in_traffic_seconds: eta,
      distance_meters: route.distanceMeters ?? null,
      route_polyline: route.polyline?.encodedPolyline ?? null,
      state: "tracking",
      last_eta_at: new Date().toISOString(),
    }, { onConflict: "service_id" });

    return new Response(JSON.stringify({
      eta_seconds: eta,
      static_duration_seconds: staticDur,
      distance_meters: route.distanceMeters ?? null,
      polyline: route.polyline?.encodedPolyline ?? null,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? "internal" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
