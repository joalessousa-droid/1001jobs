
-- ============ 1. provider_locations (current position) ============
CREATE TABLE IF NOT EXISTS public.provider_locations (
  provider_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  accuracy double precision,
  heading double precision,
  speed double precision,
  is_sharing boolean NOT NULL DEFAULT true,
  is_public boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.provider_locations TO authenticated;
GRANT SELECT ON public.provider_locations TO anon;
GRANT ALL ON public.provider_locations TO service_role;

ALTER TABLE public.provider_locations ENABLE ROW LEVEL SECURITY;

-- Helper: am I a client/provider on an ACTIVE service with this provider?
CREATE OR REPLACE FUNCTION public.is_active_service_peer(_provider_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.services s
    WHERE s.provider_id = _provider_id
      AND (s.client_id = public.get_my_profile_id() OR s.provider_id = public.get_my_profile_id())
      AND s.status IN ('accepted','in_progress','completed')
  );
$$;

CREATE POLICY "Provider manages own location"
ON public.provider_locations FOR ALL TO authenticated
USING (provider_id = public.get_my_profile_id())
WITH CHECK (provider_id = public.get_my_profile_id());

CREATE POLICY "Peers can read provider location during active service"
ON public.provider_locations FOR SELECT TO authenticated
USING (
  is_sharing = true AND (
    is_public = true
    OR provider_id = public.get_my_profile_id()
    OR public.is_active_service_peer(provider_id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'moderator'::app_role)
  )
);

CREATE POLICY "Public can read explicitly public locations"
ON public.provider_locations FOR SELECT TO anon
USING (is_sharing = true AND is_public = true);

-- ============ 2. provider_location_history ============
CREATE TABLE IF NOT EXISTS public.provider_location_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  accuracy double precision,
  heading double precision,
  speed double precision,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provider_history_provider_time
  ON public.provider_location_history (provider_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_provider_history_service
  ON public.provider_location_history (service_id);

GRANT SELECT, INSERT ON public.provider_location_history TO authenticated;
GRANT ALL ON public.provider_location_history TO service_role;

ALTER TABLE public.provider_location_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Provider inserts own history"
ON public.provider_location_history FOR INSERT TO authenticated
WITH CHECK (provider_id = public.get_my_profile_id());

CREATE POLICY "Provider and admins read history"
ON public.provider_location_history FOR SELECT TO authenticated
USING (
  provider_id = public.get_my_profile_id()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'moderator'::app_role)
  OR (
    service_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.services s
      WHERE s.id = service_id AND s.client_id = public.get_my_profile_id()
    )
  )
);

-- ============ 3. service_tracking (per-service ETA state) ============
CREATE TABLE IF NOT EXISTS public.service_tracking (
  service_id uuid PRIMARY KEY REFERENCES public.services(id) ON DELETE CASCADE,
  destination_lat double precision,
  destination_lng double precision,
  destination_address text,
  current_lat double precision,
  current_lng double precision,
  eta_seconds integer,
  distance_meters integer,
  duration_in_traffic_seconds integer,
  route_polyline text,
  state text NOT NULL DEFAULT 'pending',
  last_eta_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_tracking_updated
  ON public.service_tracking (updated_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.service_tracking TO authenticated;
GRANT ALL ON public.service_tracking TO service_role;

ALTER TABLE public.service_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants view service tracking"
ON public.service_tracking FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.services s
    WHERE s.id = service_id
      AND (s.client_id = public.get_my_profile_id() OR s.provider_id = public.get_my_profile_id())
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Provider or client can create tracking row"
ON public.service_tracking FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.services s
    WHERE s.id = service_id
      AND (s.client_id = public.get_my_profile_id() OR s.provider_id = public.get_my_profile_id())
  )
);

CREATE POLICY "Participants update service tracking"
ON public.service_tracking FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.services s
    WHERE s.id = service_id
      AND (s.client_id = public.get_my_profile_id() OR s.provider_id = public.get_my_profile_id())
  )
);

-- updated_at triggers
CREATE TRIGGER trg_provider_locations_updated_at
BEFORE UPDATE ON public.provider_locations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_service_tracking_updated_at
BEFORE UPDATE ON public.service_tracking
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.provider_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.service_tracking;
