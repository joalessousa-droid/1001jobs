
-- ============ provider_availability ============
CREATE TABLE IF NOT EXISTS public.provider_availability (
  provider_id uuid PRIMARY KEY,
  is_online boolean NOT NULL DEFAULT false,
  is_busy boolean NOT NULL DEFAULT false,
  max_concurrent integer NOT NULL DEFAULT 1,
  current_load integer NOT NULL DEFAULT 0,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.provider_availability TO authenticated;
GRANT ALL ON public.provider_availability TO service_role;
ALTER TABLE public.provider_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads online providers"
  ON public.provider_availability FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Provider manages own availability"
  ON public.provider_availability FOR ALL
  TO authenticated
  USING (provider_id = public.get_my_profile_id())
  WITH CHECK (provider_id = public.get_my_profile_id());

CREATE POLICY "Service role manages availability"
  ON public.provider_availability FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- ============ service_offers ============
CREATE TABLE IF NOT EXISTS public.service_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id uuid,
  service_id uuid,
  provider_id uuid NOT NULL,
  client_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending|accepted|declined|expired|cancelled|superseded
  queue_position integer NOT NULL DEFAULT 1,
  match_score numeric NOT NULL DEFAULT 0,
  distance_km numeric,
  radius_km numeric,
  offered_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 seconds',
  responded_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.service_offers TO authenticated;
GRANT ALL ON public.service_offers TO service_role;
ALTER TABLE public.service_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Offer participants read"
  ON public.service_offers FOR SELECT
  TO authenticated
  USING (
    provider_id = public.get_my_profile_id()
    OR client_id = public.get_my_profile_id()
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'moderator')
  );

CREATE POLICY "Provider updates own offer response"
  ON public.service_offers FOR UPDATE
  TO authenticated
  USING (provider_id = public.get_my_profile_id())
  WITH CHECK (provider_id = public.get_my_profile_id());

CREATE POLICY "Service role manages offers"
  ON public.service_offers FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_offers_provider_pending ON public.service_offers(provider_id, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_offers_request ON public.service_offers(service_request_id, queue_position);

-- ============ service_matching_logs ============
CREATE TABLE IF NOT EXISTS public.service_matching_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id uuid,
  service_id uuid,
  client_id uuid,
  radius_km numeric NOT NULL,
  providers_found integer NOT NULL DEFAULT 0,
  providers_notified integer NOT NULL DEFAULT 0,
  outcome text NOT NULL DEFAULT 'pending', -- pending|matched|exhausted|cancelled
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.service_matching_logs TO authenticated;
GRANT ALL ON public.service_matching_logs TO service_role;
ALTER TABLE public.service_matching_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read logs"
  ON public.service_matching_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator') OR client_id = public.get_my_profile_id());

CREATE POLICY "Service role manages logs"
  ON public.service_matching_logs FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- ============ Realtime ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.service_offers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.provider_availability;
ALTER PUBLICATION supabase_realtime ADD TABLE public.service_matching_logs;
ALTER TABLE public.service_offers REPLICA IDENTITY FULL;
ALTER TABLE public.provider_availability REPLICA IDENTITY FULL;

-- ============ Scoring function ============
CREATE OR REPLACE FUNCTION public.calculate_provider_score(
  _provider_id uuid,
  _client_id uuid,
  _distance_km numeric,
  _category_id uuid DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rating numeric := 0;
  _cancel_rate numeric := 0;
  _specialization numeric := 0;
  _recurrence numeric := 0;
  _proximity numeric := 0;
  _final numeric := 0;
BEGIN
  SELECT COALESCE(weighted_score, 0) INTO _rating
    FROM public.reputation_scores WHERE profile_id = _provider_id;

  SELECT COALESCE(
    (COUNT(*) FILTER (WHERE status IN ('cancelled_by_provider')))::numeric
    / NULLIF(COUNT(*),0), 0)
    INTO _cancel_rate FROM public.services WHERE provider_id = _provider_id;

  IF _category_id IS NOT NULL THEN
    SELECT CASE WHEN EXISTS (
      SELECT 1 FROM public.provider_services
       WHERE provider_id = _provider_id AND category_id = _category_id
    ) THEN 1.0 ELSE 0.0 END INTO _specialization;
  END IF;

  IF _client_id IS NOT NULL THEN
    SELECT LEAST(COUNT(*)::numeric / 5.0, 1.0) INTO _recurrence
      FROM public.services
      WHERE provider_id = _provider_id AND client_id = _client_id
        AND status IN ('confirmed','completed');
  END IF;

  _proximity := GREATEST(0, 1 - (COALESCE(_distance_km,0) / 20.0));

  -- Pesos: rating 35%, proximidade 25%, especialização 15%, recorrência 10%, anti-cancel 15%
  _final := (_rating / 5.0) * 35
          + _proximity * 25
          + _specialization * 15
          + _recurrence * 10
          + (1 - LEAST(_cancel_rate, 1)) * 15;

  RETURN ROUND(_final, 2);
END;
$$;

-- ============ Expire stale offers + fallback ============
CREATE OR REPLACE FUNCTION public.expire_stale_offers()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row record;
  _expired_count integer := 0;
  _next public.service_offers;
BEGIN
  FOR _row IN
    SELECT * FROM public.service_offers
     WHERE status = 'pending' AND expires_at < now()
     FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.service_offers
       SET status = 'expired', responded_at = now(), updated_at = now()
     WHERE id = _row.id;
    _expired_count := _expired_count + 1;

    -- Promove próximo da fila (mesmo service_request)
    SELECT * INTO _next FROM public.service_offers
     WHERE service_request_id = _row.service_request_id
       AND status = 'queued'
     ORDER BY queue_position ASC, match_score DESC
     LIMIT 1;

    IF FOUND THEN
      UPDATE public.service_offers
         SET status = 'pending',
             offered_at = now(),
             expires_at = now() + interval '30 seconds',
             updated_at = now()
       WHERE id = _next.id;
    END IF;
  END LOOP;
  RETURN _expired_count;
END;
$$;

-- ============ Accept offer (atomic) ============
CREATE OR REPLACE FUNCTION public.accept_service_offer(_offer_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := public.get_my_profile_id();
  _offer public.service_offers;
  _service_id uuid;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO _offer FROM public.service_offers
   WHERE id = _offer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Offer not found'; END IF;
  IF _offer.provider_id <> _me THEN RAISE EXCEPTION 'Not your offer'; END IF;
  IF _offer.status <> 'pending' THEN RAISE EXCEPTION 'Offer no longer pending (%)', _offer.status; END IF;
  IF _offer.expires_at < now() THEN
    UPDATE public.service_offers SET status='expired', responded_at=now() WHERE id=_offer_id;
    RAISE EXCEPTION 'Offer expired';
  END IF;

  UPDATE public.service_offers
     SET status='accepted', responded_at=now(), updated_at=now()
   WHERE id=_offer_id;

  -- Marca outras ofertas do mesmo request como superseded
  IF _offer.service_request_id IS NOT NULL THEN
    UPDATE public.service_offers
       SET status='superseded', updated_at=now()
     WHERE service_request_id = _offer.service_request_id
       AND id <> _offer_id
       AND status IN ('pending','queued');

    UPDATE public.service_requests
       SET status='assigned', selected_provider_id=_me, is_active=false
     WHERE id = _offer.service_request_id;
  END IF;

  _service_id := _offer.service_id;
  RETURN _service_id;
END;
$$;

-- ============ Decline offer ============
CREATE OR REPLACE FUNCTION public.decline_service_offer(_offer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := public.get_my_profile_id();
  _offer public.service_offers;
  _next public.service_offers;
BEGIN
  SELECT * INTO _offer FROM public.service_offers WHERE id=_offer_id FOR UPDATE;
  IF _offer.provider_id <> _me THEN RAISE EXCEPTION 'Not your offer'; END IF;
  IF _offer.status <> 'pending' THEN RETURN; END IF;

  UPDATE public.service_offers
     SET status='declined', responded_at=now(), updated_at=now()
   WHERE id=_offer_id;

  SELECT * INTO _next FROM public.service_offers
    WHERE service_request_id = _offer.service_request_id
      AND status = 'queued'
    ORDER BY queue_position ASC, match_score DESC
    LIMIT 1;

  IF FOUND THEN
    UPDATE public.service_offers
       SET status='pending', offered_at=now(),
           expires_at = now() + interval '30 seconds', updated_at=now()
     WHERE id=_next.id;
  END IF;
END;
$$;

-- ============ Executive dashboard aggregator ============
CREATE OR REPLACE FUNCTION public.get_dispatch_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _r jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_build_object(
    'generated_at', now(),
    'live_offers', (SELECT COUNT(*) FROM public.service_offers WHERE status='pending'),
    'queued_offers', (SELECT COUNT(*) FROM public.service_offers WHERE status='queued'),
    'providers_online', (SELECT COUNT(*) FROM public.provider_availability WHERE is_online=true AND last_seen_at > now() - interval '5 minutes'),
    'providers_offline', (SELECT COUNT(*) FROM public.provider_availability WHERE is_online=false OR last_seen_at <= now() - interval '5 minutes'),
    'active_services', (SELECT COUNT(*) FROM public.services WHERE status IN ('accepted','in_progress')),
    'open_disputes', (SELECT COUNT(*) FROM public.service_disputes WHERE status NOT IN ('resolved_client','resolved_provider','resolved_split','closed_no_action')),
    'revenue_today', (SELECT COALESCE(SUM(agreed_price),0) FROM public.services WHERE status IN ('confirmed','completed') AND created_at::date = CURRENT_DATE),
    'revenue_month', (SELECT COALESCE(SUM(agreed_price),0) FROM public.services WHERE status IN ('confirmed','completed') AND date_trunc('month',created_at)=date_trunc('month',now())),
    'conversion_rate', (
      SELECT CASE WHEN COUNT(*)=0 THEN 0
        ELSE ROUND((COUNT(*) FILTER (WHERE status='accepted'))::numeric / COUNT(*) * 100, 2) END
        FROM public.service_offers WHERE created_at > now() - interval '24 hours'
    ),
    'matching_attempts_24h', (SELECT COUNT(*) FROM public.service_matching_logs WHERE created_at > now() - interval '24 hours'),
    'top_online_providers', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'provider_id', pa.provider_id,
        'last_seen_at', pa.last_seen_at,
        'current_load', pa.current_load
      ) ORDER BY pa.last_seen_at DESC), '[]'::jsonb)
      FROM (SELECT * FROM public.provider_availability WHERE is_online=true ORDER BY last_seen_at DESC LIMIT 20) pa
    )
  ) INTO _r;
  RETURN _r;
END;
$$;

CREATE TRIGGER trg_service_offers_updated_at
  BEFORE UPDATE ON public.service_offers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_provider_availability_updated_at
  BEFORE UPDATE ON public.provider_availability
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
