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
  /** janela de resposta do profissional (s). Padrão 30s; Radar usa 1800s (30 min) */
  response_timeout_sec?: number
  /** modo broadcast: oferta enviada a TODOS os profissionais da categoria dentro do raio */
  broadcast?: boolean
  /** raio fixo (km) usado no modo broadcast — vem do radar */
  radius_km?: number
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

    // Auth: caller must be authenticated and own the client_id profile
    // (internal callers may use the shared DISPATCH_INTERNAL_SECRET header)
    const internalSecret = Deno.env.get('DISPATCH_INTERNAL_SECRET')
    const providedSecret = req.headers.get('x-internal-secret')
    const isInternal = !!internalSecret && providedSecret === internalSecret
    if (!isInternal) {
      const authHeader = req.headers.get('Authorization') ?? ''
      const userClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } },
      )
      const { data: { user } } = await userClient.auth.getUser()
      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const { data: callerProfile } = await supabase
        .from('profiles').select('id').eq('user_id', user.id).maybeSingle()
      if (!callerProfile || callerProfile.id !== body.client_id) {
        return new Response(JSON.stringify({ error: 'Forbidden' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    const maxProviders = Math.min(body.max_providers ?? 5, 10)
    const timeoutMs = Math.min(Math.max(body.response_timeout_sec ?? 30, 15), 1800) * 1000

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

    // Modo broadcast: todos os profissionais da categoria dentro do raio do radar
    let categorySet: Set<string> | null = null
    if (body.category_id) {
      const { data: catProviders } = await supabase
        .from('provider_services')
        .select('provider_id')
        .eq('category_id', body.category_id)
      categorySet = new Set((catProviders ?? []).map((r: any) => r.provider_id))
    }

    if (body.broadcast) {
      const r = Math.min(Math.max(body.radius_km ?? 10, 1), 50)
      const all = candidates
        .filter((c) => c.distance <= r)
        .filter((c) => !categorySet || categorySet.has(c.provider_id))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 30)

      const expires = new Date(Date.now() + timeoutMs).toISOString()
      let broadcastMeta: Record<string, unknown> = {}
      if (body.service_request_id) {
        const { data: sr } = await supabase
          .from('service_requests')
          .select('description, budget, requester_name, city, state')
          .eq('id', body.service_request_id).maybeSingle()
        broadcastMeta = {
          description: (sr as any)?.description ?? null,
          budget: (sr as any)?.budget ?? null,
          currency: 'BRL',
          client_name: (sr as any)?.requester_name ?? null,
          city: (sr as any)?.city ?? null,
          state: (sr as any)?.state ?? null,
          broadcast: true,
        }
      }

      if (all.length > 0) {
        const offers = all.map((c, idx) => ({
          service_request_id: body.service_request_id ?? null,
          service_id: body.service_id ?? null,
          provider_id: c.provider_id,
          client_id: body.client_id,
          status: 'pending',
          queue_position: idx + 1,
          match_score: 0,
          distance_km: c.distance,
          radius_km: r,
          expires_at: expires,
          metadata: broadcastMeta,
        }))
        const { error: bErr } = await supabase
          .from('service_offers')
          .upsert(offers, { onConflict: 'service_request_id,provider_id', ignoreDuplicates: true })
        if (bErr && !String(bErr.message).includes('duplicate')) throw bErr
      }

      return new Response(JSON.stringify({
        ok: true, mode: 'broadcast', radius_used_km: r,
        candidates: candidates.length, queue_size: all.length,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Radius escalation
    let chosen: { provider_id: string; distance: number; radius: number }[] = []
    let usedRadius = 0
    for (const r of RADII) {
      usedRadius = r
      chosen = candidates
        .filter(c => c.distance <= r)
        .filter(c => !categorySet || categorySet.has(c.provider_id))
        .map(c => ({ ...c, radius: r }))
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
    // Combine com score_total do ranking global (peso configurável)
    if (scored.length > 0) {
      const ids = scored.map((s) => s.provider_id)
      const { data: rankings } = await supabase
        .from('provider_ranking_scores')
        .select('provider_id, score_total')
        .in('provider_id', ids)
      const { data: cfg } = await supabase
        .from('app_settings').select('dispatch_ranking_boost_weight, dispatch_ranking_boost_max')
        .eq('id', true).maybeSingle()
      const weight = Number((cfg as any)?.dispatch_ranking_boost_weight ?? 0.10)
      const maxBoost = Number((cfg as any)?.dispatch_ranking_boost_max ?? 10)
      const byId = new Map<string, number>()
      for (const r of (rankings ?? []) as any[]) byId.set(r.provider_id, Number(r.score_total ?? 0))
      for (const s of scored) {
        s.ranking_total = byId.get(s.provider_id) ?? 0
        const boost = Math.min(maxBoost, weight * s.ranking_total)
        s.score = Number((s.base_score + boost).toFixed(2))
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
          ? new Date(Date.now() + timeoutMs).toISOString()
          : new Date(Date.now() + timeoutMs * (idx + 1)).toISOString(),
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
