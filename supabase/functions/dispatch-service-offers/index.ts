// Dispatch service offers with radius escalation 3→5→10→20 km
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

const RADII = [3, 5, 10, 20]

interface DispatchBody {
  service_request_id?: string
  service_id?: string
  client_id: string
  category_id?: string | null
  latitude: number
  longitude: number
  max_providers?: number
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json() as DispatchBody
    if (!body?.client_id || typeof body.latitude !== 'number' || typeof body.longitude !== 'number') {
      return new Response(JSON.stringify({ error: 'Missing client_id/latitude/longitude' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const maxProviders = Math.min(body.max_providers ?? 5, 10)

    // Idempotency / concurrency: serialize dispatch per service_request,
    // and short-circuit if active offers already exist for this request.
    if (body.service_request_id) {
      try {
        await supabase.rpc('acquire_dispatch_lock', { _service_request_id: body.service_request_id })
      } catch (_) { /* lock is best-effort */ }

      const { count: existing } = await supabase
        .from('service_offers')
        .select('id', { count: 'exact', head: true })
        .eq('service_request_id', body.service_request_id)
        .in('status', ['pending', 'queued', 'accepted'])
      if ((existing ?? 0) > 0) {
        return new Response(JSON.stringify({
          ok: true, deduped: true,
          message: 'Active offers already exist for this request',
          existing_offers: existing,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }


    // Fetch online providers with current location
    const { data: locations, error: locErr } = await supabase
      .from('provider_locations')
      .select('provider_id, latitude, longitude, is_sharing')
      .eq('is_sharing', true)
    if (locErr) throw locErr

    const { data: availability } = await supabase
      .from('provider_availability')
      .select('provider_id, is_online, is_busy, current_load, max_concurrent')
      .eq('is_online', true)

    const onlineSet = new Set((availability ?? [])
      .filter(a => !a.is_busy && (a.current_load ?? 0) < (a.max_concurrent ?? 1))
      .map(a => a.provider_id))

    const candidates = (locations ?? [])
      .filter(l => onlineSet.has(l.provider_id))
      .map(l => ({
        provider_id: l.provider_id,
        distance: haversineKm(body.latitude, body.longitude, l.latitude, l.longitude)
      }))

    // Radius escalation
    let chosen: { provider_id: string; distance: number; radius: number }[] = []
    let usedRadius = 0
    for (const r of RADII) {
      usedRadius = r
      chosen = candidates.filter(c => c.distance <= r).map(c => ({ ...c, radius: r }))
      if (chosen.length > 0) break
    }

    // Score each candidate (composite: dispatch RPC + provider_ranking_scores.score_total boost)
    const scored: { provider_id: string; distance: number; radius: number; score: number; base_score: number; ranking_total: number }[] = []
    for (const c of chosen) {
      const { data: score } = await supabase.rpc('calculate_provider_score', {
        _provider_id: c.provider_id,
        _client_id: body.client_id,
        _distance_km: c.distance,
        _category_id: body.category_id ?? null,
      })
      scored.push({ ...c, base_score: Number(score ?? 0), score: Number(score ?? 0), ranking_total: 0 })
    }
    // Combine com score_total do ranking global (peso 10%, normalizado por 100)
    if (scored.length > 0) {
      const ids = scored.map((s) => s.provider_id)
      const { data: rankings } = await supabase
        .from('provider_ranking_scores')
        .select('provider_id, score_total')
        .in('provider_id', ids)
      const byId = new Map<string, number>()
      for (const r of (rankings ?? []) as any[]) byId.set(r.provider_id, Number(r.score_total ?? 0))
      for (const s of scored) {
        s.ranking_total = byId.get(s.provider_id) ?? 0
        // boost aditivo de até 10 pontos (score_total assumido em 0..100)
        s.score = Number((s.base_score + 0.1 * Math.min(100, s.ranking_total)).toFixed(2))
      }
    }
    scored.sort((a, b) => b.score - a.score || b.ranking_total - a.ranking_total)

    const queue = scored.slice(0, maxProviders)

    // Insert log
    const { data: log } = await supabase.from('service_matching_logs').insert({
      service_request_id: body.service_request_id ?? null,
      service_id: body.service_id ?? null,
      client_id: body.client_id,
      radius_km: usedRadius,
      providers_found: candidates.length,
      providers_notified: queue.length,
      outcome: queue.length > 0 ? 'matched' : 'exhausted',
      details: { scored: queue, escalation: RADII.slice(0, RADII.indexOf(usedRadius) + 1) },
    }).select().single()

    // Enrich offers with request/client/category context so the provider sees value, description, client
    let requestInfo: any = null
    if (body.service_request_id) {
      const { data: sr } = await supabase
        .from('service_requests')
        .select('description, budget, requester_name, city, state, category_id')
        .eq('id', body.service_request_id).maybeSingle()
      requestInfo = sr
    }
    let categoryName: string | null = null
    const catId = body.category_id ?? requestInfo?.category_id ?? null
    if (catId) {
      const { data: cat } = await supabase
        .from('service_categories').select('name').eq('id', catId).maybeSingle()
      categoryName = (cat as any)?.name ?? null
    }
    let clientName: string | null = requestInfo?.requester_name ?? null
    if (!clientName && body.client_id) {
      const { data: cli } = await supabase
        .from('profiles').select('display_name').eq('id', body.client_id).maybeSingle()
      clientName = (cli as any)?.display_name ?? null
    }
    const offerMeta = {
      description: requestInfo?.description ?? null,
      budget: requestInfo?.budget ?? null,
      currency: 'BRL',
      client_name: clientName,
      city: requestInfo?.city ?? null,
      state: requestInfo?.state ?? null,
      category_name: categoryName,
    }

    // Create offers: first = pending, rest = queued
    if (queue.length > 0) {
      const offers = queue.map((q, idx) => ({
        service_request_id: body.service_request_id ?? null,
        service_id: body.service_id ?? null,
        provider_id: q.provider_id,
        client_id: body.client_id,
        status: idx === 0 ? 'pending' : 'queued',
        queue_position: idx + 1,
        match_score: q.score,
        distance_km: q.distance,
        radius_km: q.radius,
        expires_at: idx === 0
          ? new Date(Date.now() + 30_000).toISOString()
          : new Date(Date.now() + 30_000 * (idx + 5)).toISOString(),
        metadata: offerMeta,
      }))
      // upsert-style: ignore duplicate active offers (uniq partial index)
      const { error: insErr } = await supabase
        .from('service_offers')
        .upsert(offers, { onConflict: 'service_request_id,provider_id', ignoreDuplicates: true })
      if (insErr && !String(insErr.message).includes('duplicate')) throw insErr
    }

    return new Response(JSON.stringify({
      ok: true,
      log_id: log?.id,
      radius_used_km: usedRadius,
      candidates: candidates.length,
      queue_size: queue.length,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
