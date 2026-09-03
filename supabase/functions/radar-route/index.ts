// Rota real (ruas/quadras) + ETA com trânsito via Google Routes API (gateway Lovable)
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/google_maps'

interface Body {
  origin: { lat: number; lng: number }
  destination: { lat: number; lng: number }
  mode?: 'DRIVE' | 'TWO_WHEELER' | 'WALK'
}

const isCoord = (c: any) =>
  c && typeof c.lat === 'number' && typeof c.lng === 'number' &&
  Math.abs(c.lat) <= 90 && Math.abs(c.lng) <= 180

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json() as Body
    if (!isCoord(body?.origin) || !isCoord(body?.destination)) {
      return new Response(JSON.stringify({ error: 'origin/destination inválidos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY')
    if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) {
      return new Response(JSON.stringify({ error: 'Google Maps não configurado' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const res = await fetch(`${GATEWAY_URL}/routes/directions/v2:computeRoutes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': GOOGLE_MAPS_API_KEY,
        'Content-Type': 'application/json',
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline',
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: body.origin.lat, longitude: body.origin.lng } } },
        destination: { location: { latLng: { latitude: body.destination.lat, longitude: body.destination.lng } } },
        travelMode: body.mode ?? 'DRIVE',
        routingPreference: (body.mode ?? 'DRIVE') === 'WALK' ? undefined : 'TRAFFIC_AWARE',
        languageCode: 'pt-BR',
        units: 'METRIC',
      }),
    })

    if (!res.ok) {
      const details = await res.text()
      console.error(`radar-route gateway failed [${res.status}]: ${details}`)
      return new Response(JSON.stringify({ error: 'Falha ao calcular rota', status: res.status, details }),
        { status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const data = await res.json()
    const route = data?.routes?.[0]
    if (!route) {
      return new Response(JSON.stringify({ error: 'Nenhuma rota encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const seconds = Number(String(route.duration ?? '0s').replace('s', ''))
    return new Response(JSON.stringify({
      distance_km: Number(((route.distanceMeters ?? 0) / 1000).toFixed(2)),
      duration_sec: seconds,
      eta_min: Math.max(1, Math.round(seconds / 60)),
      polyline: route.polyline?.encodedPolyline ?? null,
      traffic_aware: (body.mode ?? 'DRIVE') !== 'WALK',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
