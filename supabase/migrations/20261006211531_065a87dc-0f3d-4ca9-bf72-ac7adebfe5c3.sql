CREATE TABLE IF NOT EXISTS public.navigation_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  geofence_radius_m integer NOT NULL DEFAULT 100,
  dwell_seconds integer NOT NULL DEFAULT 45,
  max_speed_kmh numeric NOT NULL DEFAULT 8,
  min_accuracy_m integer NOT NULL DEFAULT 120,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.navigation_settings TO authenticated;
GRANT ALL ON public.navigation_settings TO service_role;
ALTER TABLE public.navigation_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "navigation_settings read" ON public.navigation_settings;
CREATE POLICY "navigation_settings read" ON public.navigation_settings FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "navigation_settings staff write" ON public.navigation_settings;
CREATE POLICY "navigation_settings staff write" ON public.navigation_settings FOR ALL TO authenticated USING (public.ai_is_staff()) WITH CHECK (public.ai_is_staff());
INSERT INTO public.navigation_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.task_navigation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  provider_id uuid,
  event_type text NOT NULL CHECK (event_type IN ('navigation_started','navigation_provider','en_route','arrival_detected','arrival_confirmed','provider_manual_arrival','arrival_notification_sent')),
  latitude double precision, longitude double precision, accuracy double precision,
  source text, metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS task_navigation_events_service_idx ON public.task_navigation_events (service_id, created_at DESC);
GRANT SELECT ON public.task_navigation_events TO authenticated;
GRANT ALL ON public.task_navigation_events TO service_role;
ALTER TABLE public.task_navigation_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nav events visible to parties" ON public.task_navigation_events;
CREATE POLICY "nav events visible to parties" ON public.task_navigation_events FOR SELECT TO authenticated USING (
  public.ai_is_staff() OR EXISTS (
    SELECT 1 FROM public.services s JOIN public.profiles p ON p.id IN (s.client_id, s.provider_id)
    WHERE s.id = task_navigation_events.service_id AND p.user_id = auth.uid()));

ALTER TABLE public.service_tracking
  ADD COLUMN IF NOT EXISTS nav_state text NOT NULL DEFAULT 'accepted',
  ADD COLUMN IF NOT EXISTS navigation_app text,
  ADD COLUMN IF NOT EXISTS navigation_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS arrival_detected_at timestamptz,
  ADD COLUMN IF NOT EXISTS arrived_at timestamptz,
  ADD COLUMN IF NOT EXISTS arrival_source text,
  ADD COLUMN IF NOT EXISTS arrival_lat double precision,
  ADD COLUMN IF NOT EXISTS arrival_lng double precision;

CREATE OR REPLACE FUNCTION public.record_navigation_event(
  _service_id uuid, _event_type text, _latitude double precision DEFAULT NULL,
  _longitude double precision DEFAULT NULL, _accuracy double precision DEFAULT NULL,
  _source text DEFAULT 'GPS', _metadata jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _prov uuid; _id uuid;
BEGIN
  SELECT s.provider_id INTO _prov FROM services s JOIN profiles p ON p.id = s.provider_id
   WHERE s.id = _service_id AND p.user_id = auth.uid();
  IF _prov IS NULL THEN RAISE EXCEPTION 'not_assigned_provider'; END IF;
  IF _event_type NOT IN ('navigation_started','navigation_provider','en_route','arrival_detected') THEN
    RAISE EXCEPTION 'invalid_event_type'; END IF;
  INSERT INTO task_navigation_events(service_id, provider_id, event_type, latitude, longitude, accuracy, source, metadata)
  VALUES (_service_id, _prov, _event_type, _latitude, _longitude, _accuracy, left(_source, 40), coalesce(_metadata,'{}'::jsonb))
  RETURNING id INTO _id;
  UPDATE service_tracking SET
    nav_state = CASE _event_type WHEN 'navigation_started' THEN 'navigation_started'
      WHEN 'en_route' THEN 'en_route' WHEN 'arrival_detected' THEN 'arrival_detected' ELSE nav_state END,
    navigation_app = CASE WHEN _event_type = 'navigation_provider' THEN left(_metadata->>'app', 30) ELSE navigation_app END,
    navigation_started_at = CASE WHEN _event_type = 'navigation_started' THEN coalesce(navigation_started_at, now()) ELSE navigation_started_at END,
    arrival_detected_at = CASE WHEN _event_type = 'arrival_detected' THEN coalesce(arrival_detected_at, now()) ELSE arrival_detected_at END,
    updated_at = now()
  WHERE service_id = _service_id AND nav_state <> 'arrived';
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.confirm_task_arrival(
  _service_id uuid, _latitude double precision DEFAULT NULL, _longitude double precision DEFAULT NULL,
  _accuracy double precision DEFAULT NULL, _source text DEFAULT 'PROVIDER_BUTTON', _metadata jsonb DEFAULT '{}'::jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _prov uuid; _client uuid; _already timestamptz; _src text;
BEGIN
  SELECT s.provider_id, s.client_id INTO _prov, _client FROM services s JOIN profiles p ON p.id = s.provider_id
   WHERE s.id = _service_id AND p.user_id = auth.uid();
  IF _prov IS NULL THEN RAISE EXCEPTION 'not_assigned_provider'; END IF;
  _src := CASE WHEN _source = 'GPS' THEN 'GPS' ELSE 'PROVIDER_BUTTON' END;
  SELECT arrived_at INTO _already FROM service_tracking WHERE service_id = _service_id;
  INSERT INTO task_navigation_events(service_id, provider_id, event_type, latitude, longitude, accuracy, source, metadata)
  VALUES (_service_id, _prov, CASE WHEN _src='GPS' THEN 'arrival_confirmed' ELSE 'provider_manual_arrival' END,
          _latitude, _longitude, _accuracy, _src, coalesce(_metadata,'{}'::jsonb));
  IF _already IS NOT NULL THEN RETURN false; END IF;
  UPDATE service_tracking SET nav_state='arrived', arrived_at=now(), arrival_source=_src,
    arrival_lat=_latitude, arrival_lng=_longitude, updated_at=now() WHERE service_id=_service_id;
  INSERT INTO notifications(profile_id, type, title, message, link, metadata)
  VALUES (_client, 'provider_arrived', 'Seu profissional chegou ao local',
          'O profissional chegou ao endereço do serviço.', '/acompanhar/' || _service_id,
          jsonb_build_object('service_id', _service_id, 'source', _src));
  INSERT INTO task_navigation_events(service_id, provider_id, event_type, source)
  VALUES (_service_id, _prov, 'arrival_notification_sent', _src);
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.record_navigation_event(uuid,text,double precision,double precision,double precision,text,jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirm_task_arrival(uuid,double precision,double precision,double precision,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_navigation_event(uuid,text,double precision,double precision,double precision,text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_task_arrival(uuid,double precision,double precision,double precision,text,jsonb) TO authenticated;

DROP POLICY IF EXISTS "Anyone reads provider scores" ON public.provider_composite_scores;
DROP POLICY IF EXISTS "Signed-in users read provider scores" ON public.provider_composite_scores;
CREATE POLICY "Signed-in users read provider scores" ON public.provider_composite_scores FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "ai_model_versions read" ON public.ai_model_versions;
DROP POLICY IF EXISTS "ai_model_versions staff read" ON public.ai_model_versions;
CREATE POLICY "ai_model_versions staff read" ON public.ai_model_versions FOR SELECT TO authenticated USING (public.ai_is_staff());
DROP POLICY IF EXISTS "ai_regional_stats read" ON public.ai_regional_stats;
DROP POLICY IF EXISTS "ai_regional_stats staff read" ON public.ai_regional_stats;
CREATE POLICY "ai_regional_stats staff read" ON public.ai_regional_stats FOR SELECT TO authenticated USING (public.ai_is_staff());