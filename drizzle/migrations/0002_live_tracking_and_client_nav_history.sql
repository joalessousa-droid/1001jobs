CREATE OR REPLACE FUNCTION public.admin_live_provider_locations(_include_synthetic boolean DEFAULT false)
RETURNS TABLE(provider_id uuid, provider_name text, city text, latitude double precision, longitude double precision,
  accuracy double precision, speed double precision, is_sharing boolean, is_synthetic boolean, updated_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.ai_is_staff() THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT l.provider_id, p.display_name, p.city, l.latitude, l.longitude, l.accuracy, l.speed, l.is_sharing,
         coalesce(p.is_synthetic,false), l.updated_at
  FROM provider_locations l JOIN profiles p ON p.id = l.provider_id
  WHERE l.latitude IS NOT NULL AND l.longitude IS NOT NULL
    AND (_include_synthetic OR coalesce(p.is_synthetic,false) = false)
  ORDER BY l.updated_at DESC LIMIT 3000;
END $$;
REVOKE ALL ON FUNCTION public.admin_live_provider_locations(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_live_provider_locations(boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.client_navigation_history(_days int DEFAULT 30)
RETURNS TABLE(id uuid, service_id uuid, service_title text, provider_id uuid, provider_name text,
  event_type text, latitude double precision, longitude double precision, accuracy double precision,
  source text, metadata jsonb, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.id, e.service_id, s.title, e.provider_id, p.display_name, e.event_type,
         -- cliente só vê o ponto de chegada; posições do trajeto ficam ocultas por privacidade
         CASE WHEN e.event_type IN ('arrival_confirmed','provider_manual_arrival') THEN e.latitude END,
         CASE WHEN e.event_type IN ('arrival_confirmed','provider_manual_arrival') THEN e.longitude END,
         NULL::double precision, e.source, jsonb_build_object('app', e.metadata->>'app'), e.created_at
  FROM task_navigation_events e
  JOIN services s ON s.id = e.service_id
  JOIN profiles c ON c.id = s.client_id AND c.user_id = auth.uid()
  LEFT JOIN profiles p ON p.id = e.provider_id
  WHERE e.created_at >= now() - make_interval(days => greatest(1, least(coalesce(_days,30), 365)))
  ORDER BY e.created_at DESC LIMIT 2000;
$$;
REVOKE ALL ON FUNCTION public.client_navigation_history(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_navigation_history(int) TO authenticated;