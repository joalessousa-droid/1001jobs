// Runs expire_stale_offers and returns how many were expired
import { corsFor, enforceOrigin, DEFAULT_ALLOW_HEADERS } from "../_shared/security.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": DEFAULT_ALLOW_HEADERS,
  "Vary": "Origin",
};
import { createClient } from 'npm:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const originBlocked = enforceOrigin(req);
  if (originBlocked) return originBlocked;
  const corsHeaders = corsFor(req, DEFAULT_ALLOW_HEADERS);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const { data, error } = await supabase.rpc('expire_stale_offers')
    if (error) throw error
    return new Response(JSON.stringify({ ok: true, expired: data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
