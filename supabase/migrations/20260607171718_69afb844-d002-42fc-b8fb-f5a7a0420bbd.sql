
-- 1) Configurable weights
CREATE TABLE IF NOT EXISTS public.dispatch_match_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT false,
  w_distance numeric NOT NULL DEFAULT 25,
  w_reputation numeric NOT NULL DEFAULT 35,
  w_availability numeric NOT NULL DEFAULT 10,
  w_specialization numeric NOT NULL DEFAULT 15,
  w_response_time numeric NOT NULL DEFAULT 10,
  w_recurrence numeric NOT NULL DEFAULT 5,
  w_anti_cancel numeric NOT NULL DEFAULT 0,
  notes text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.dispatch_match_weights TO anon, authenticated;
GRANT ALL ON public.dispatch_match_weights TO service_role;
ALTER TABLE public.dispatch_match_weights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read weights" ON public.dispatch_match_weights
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage weights" ON public.dispatch_match_weights
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'))
  WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_dispatch_match_weights_updated_at
  BEFORE UPDATE ON public.dispatch_match_weights
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Only one active preset
CREATE UNIQUE INDEX IF NOT EXISTS idx_dispatch_weights_one_active
  ON public.dispatch_match_weights ((1)) WHERE is_active;

INSERT INTO public.dispatch_match_weights (name, is_active, notes)
VALUES ('default', true, 'Preset padrão inicial')
ON CONFLICT (name) DO NOTHING;

-- 2) Idempotency: no duplicate active offers per (request, provider)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_offer_per_request_provider
  ON public.service_offers (service_request_id, provider_id)
  WHERE status IN ('pending','queued');

-- 3) Rewritten scoring function w/ configurable weights + availability + response time
CREATE OR REPLACE FUNCTION public.calculate_provider_score(
  _provider_id uuid, _client_id uuid, _distance_km numeric, _category_id uuid DEFAULT NULL
) RETURNS numeric
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  w record;
  _rating numeric := 0; _cancel_rate numeric := 0;
  _specialization numeric := 0; _recurrence numeric := 0;
  _proximity numeric := 0; _availability numeric := 0;
  _response numeric := 0; _avg_resp_s numeric;
  _final numeric := 0;
BEGIN
  SELECT * INTO w FROM public.dispatch_match_weights
   WHERE is_active = true ORDER BY updated_at DESC LIMIT 1;
  IF NOT FOUND THEN
    w := ROW(NULL,'default',true,25,35,10,15,10,5,0,NULL,NULL,now(),now())
         ::public.dispatch_match_weights;
  END IF;

  SELECT COALESCE(weighted_score,0)/5.0 INTO _rating
    FROM public.reputation_scores WHERE profile_id=_provider_id;

  SELECT COALESCE(
    (COUNT(*) FILTER (WHERE status='cancelled_by_provider'))::numeric / NULLIF(COUNT(*),0), 0)
    INTO _cancel_rate FROM public.services WHERE provider_id=_provider_id;

  IF _category_id IS NOT NULL THEN
    SELECT CASE WHEN EXISTS (
      SELECT 1 FROM public.provider_services
       WHERE provider_id=_provider_id AND category_id=_category_id
    ) THEN 1.0 ELSE 0.0 END INTO _specialization;
  END IF;

  IF _client_id IS NOT NULL THEN
    SELECT LEAST(COUNT(*)::numeric/5.0,1.0) INTO _recurrence
      FROM public.services
      WHERE provider_id=_provider_id AND client_id=_client_id
        AND status IN ('confirmed','completed');
  END IF;

  _proximity := GREATEST(0, 1 - (COALESCE(_distance_km,0)/20.0));

  -- Availability: online & free → 1, busy → 0.4, offline → 0
  SELECT CASE
      WHEN pa.is_online AND NOT pa.is_busy
           AND COALESCE(pa.current_load,0) < COALESCE(pa.max_concurrent,1) THEN 1.0
      WHEN pa.is_online THEN 0.4
      ELSE 0.0
    END
    INTO _availability
    FROM public.provider_availability pa WHERE pa.provider_id=_provider_id;
  _availability := COALESCE(_availability, 0);

  -- Response time: avg seconds between offered_at and responded_at on accepted offers (last 30d)
  SELECT AVG(EXTRACT(EPOCH FROM (responded_at - offered_at)))
    INTO _avg_resp_s
    FROM public.service_offers
   WHERE provider_id=_provider_id AND status='accepted'
     AND responded_at IS NOT NULL AND offered_at > now() - interval '30 days';
  IF _avg_resp_s IS NULL THEN
    _response := 0.5; -- neutro
  ELSE
    -- 0s → 1, 30s → 0
    _response := GREATEST(0, 1 - (_avg_resp_s / 30.0));
  END IF;

  _final :=
      _rating          * w.w_reputation
    + _proximity       * w.w_distance
    + _specialization  * w.w_specialization
    + _recurrence      * w.w_recurrence
    + (1 - LEAST(_cancel_rate,1)) * w.w_anti_cancel
    + _availability    * w.w_availability
    + _response        * w.w_response_time;

  RETURN ROUND(_final, 2);
END $fn$;

-- 4) Advisory lock per service_request_id to serialize dispatch
CREATE OR REPLACE FUNCTION public.acquire_dispatch_lock(_service_request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF _service_request_id IS NULL THEN RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_service_request_id::text, 1234));
END $$;
GRANT EXECUTE ON FUNCTION public.acquire_dispatch_lock(uuid) TO service_role;

-- 5) Funnel KPIs
CREATE OR REPLACE FUNCTION public.get_dispatch_funnel(
  _from timestamptz DEFAULT now() - interval '7 days',
  _to timestamptz DEFAULT now(),
  _group_by text DEFAULT 'overall'  -- 'overall' | 'city' | 'provider'
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _r jsonb; _breakdown jsonb;
BEGIN
  IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'moderator')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_build_object(
    'sent',      COUNT(*),
    'accepted',  COUNT(*) FILTER (WHERE status='accepted'),
    'declined',  COUNT(*) FILTER (WHERE status='declined'),
    'expired',   COUNT(*) FILTER (WHERE status='expired'),
    'pending',   COUNT(*) FILTER (WHERE status='pending'),
    'queued',    COUNT(*) FILTER (WHERE status='queued'),
    'superseded',COUNT(*) FILTER (WHERE status='superseded'),
    'avg_response_seconds', COALESCE(ROUND(AVG(
        EXTRACT(EPOCH FROM (responded_at - offered_at))
      ) FILTER (WHERE responded_at IS NOT NULL)::numeric, 2), 0),
    'conversion_rate', CASE WHEN COUNT(*)=0 THEN 0
      ELSE ROUND((COUNT(*) FILTER (WHERE status='accepted'))::numeric / COUNT(*), 4) END
  ) INTO _r
  FROM public.service_offers
  WHERE offered_at BETWEEN _from AND _to;

  IF _group_by = 'city' THEN
    SELECT COALESCE(jsonb_agg(row ORDER BY (row->>'sent')::int DESC), '[]'::jsonb) INTO _breakdown
    FROM (
      SELECT jsonb_build_object(
        'key', COALESCE(sr.city,'(sem cidade)'),
        'sent', COUNT(*),
        'accepted', COUNT(*) FILTER (WHERE so.status='accepted'),
        'declined', COUNT(*) FILTER (WHERE so.status='declined'),
        'expired', COUNT(*) FILTER (WHERE so.status='expired'),
        'avg_response_seconds', COALESCE(ROUND(AVG(
            EXTRACT(EPOCH FROM (so.responded_at - so.offered_at))
          ) FILTER (WHERE so.responded_at IS NOT NULL)::numeric, 2),0),
        'conversion_rate', CASE WHEN COUNT(*)=0 THEN 0
          ELSE ROUND((COUNT(*) FILTER (WHERE so.status='accepted'))::numeric / COUNT(*), 4) END
      ) AS row
      FROM public.service_offers so
      LEFT JOIN public.service_requests sr ON sr.id = so.service_request_id
      WHERE so.offered_at BETWEEN _from AND _to
      GROUP BY COALESCE(sr.city,'(sem cidade)')
    ) t;
  ELSIF _group_by = 'provider' THEN
    SELECT COALESCE(jsonb_agg(row ORDER BY (row->>'sent')::int DESC), '[]'::jsonb) INTO _breakdown
    FROM (
      SELECT jsonb_build_object(
        'key', COALESCE(p.display_name, so.provider_id::text),
        'provider_id', so.provider_id,
        'sent', COUNT(*),
        'accepted', COUNT(*) FILTER (WHERE so.status='accepted'),
        'declined', COUNT(*) FILTER (WHERE so.status='declined'),
        'expired', COUNT(*) FILTER (WHERE so.status='expired'),
        'avg_response_seconds', COALESCE(ROUND(AVG(
            EXTRACT(EPOCH FROM (so.responded_at - so.offered_at))
          ) FILTER (WHERE so.responded_at IS NOT NULL)::numeric, 2),0),
        'conversion_rate', CASE WHEN COUNT(*)=0 THEN 0
          ELSE ROUND((COUNT(*) FILTER (WHERE so.status='accepted'))::numeric / COUNT(*), 4) END
      ) AS row
      FROM public.service_offers so
      LEFT JOIN public.profiles p ON p.id = so.provider_id
      WHERE so.offered_at BETWEEN _from AND _to
      GROUP BY so.provider_id, p.display_name
      LIMIT 100
    ) t;
  ELSE
    _breakdown := '[]'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'generated_at', now(),
    'period', jsonb_build_object('from', _from, 'to', _to),
    'group_by', _group_by,
    'totals', _r,
    'breakdown', _breakdown,
    'active_weights', (SELECT row_to_json(w) FROM public.dispatch_match_weights w WHERE is_active LIMIT 1)
  );
END $$;
