-- 1. Favoritos
CREATE TABLE public.favorite_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, provider_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.favorite_providers TO authenticated;
GRANT ALL ON public.favorite_providers TO service_role;
ALTER TABLE public.favorite_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients manage own favorites" ON public.favorite_providers
  FOR ALL TO authenticated
  USING (public.is_profile_owner(client_id))
  WITH CHECK (public.is_profile_owner(client_id));

-- 2. Antes / depois
CREATE TABLE public.service_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('before','depois','after')),
  url text NOT NULL,
  caption text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_media TO authenticated;
GRANT ALL ON public.service_media TO service_role;
ALTER TABLE public.service_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service peers read media" ON public.service_media
  FOR SELECT TO authenticated
  USING (
    public.is_profile_owner(provider_id)
    OR EXISTS (
      SELECT 1 FROM public.services s
      WHERE s.id = service_media.service_id
        AND (public.is_profile_owner(s.client_id) OR public.is_profile_owner(s.provider_id))
    )
  );
CREATE POLICY "provider writes media" ON public.service_media
  FOR INSERT TO authenticated
  WITH CHECK (public.is_profile_owner(provider_id));
CREATE POLICY "provider deletes media" ON public.service_media
  FOR DELETE TO authenticated
  USING (public.is_profile_owner(provider_id));

-- 3. Serviços recorrentes
CREATE TABLE public.recurring_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  category_id uuid REFERENCES public.service_categories(id) ON DELETE SET NULL,
  title text NOT NULL,
  frequency text NOT NULL CHECK (frequency IN ('weekly','biweekly','monthly','custom')),
  interval_days integer NOT NULL DEFAULT 30 CHECK (interval_days BETWEEN 1 AND 365),
  next_run_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_services TO authenticated;
GRANT ALL ON public.recurring_services TO service_role;
ALTER TABLE public.recurring_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients manage own recurrences" ON public.recurring_services
  FOR ALL TO authenticated
  USING (public.is_profile_owner(client_id))
  WITH CHECK (public.is_profile_owner(client_id));
CREATE POLICY "providers read own recurrences" ON public.recurring_services
  FOR SELECT TO authenticated
  USING (provider_id IS NOT NULL AND public.is_profile_owner(provider_id));
CREATE TRIGGER recurring_services_updated_at
  BEFORE UPDATE ON public.recurring_services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Mapa de demanda (agregado e anônimo)
CREATE OR REPLACE FUNCTION public.get_demand_heatmap(
  _lat double precision,
  _lng double precision,
  _radius_km double precision DEFAULT 15,
  _hours integer DEFAULT 24
)
RETURNS TABLE (
  cell_lat double precision,
  cell_lng double precision,
  category_id uuid,
  category_name text,
  requests integer,
  distance_km double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    round(sr.latitude::numeric, 2)::double precision AS cell_lat,
    round(sr.longitude::numeric, 2)::double precision AS cell_lng,
    sr.category_id,
    sc.name AS category_name,
    count(*)::integer AS requests,
    (6371 * acos(LEAST(1, GREATEST(-1,
      cos(radians(_lat)) * cos(radians(sr.latitude)) *
      cos(radians(sr.longitude) - radians(_lng)) +
      sin(radians(_lat)) * sin(radians(sr.latitude))
    ))))::double precision AS distance_km
  FROM public.service_requests sr
  LEFT JOIN public.service_categories sc ON sc.id = sr.category_id
  WHERE sr.latitude IS NOT NULL
    AND sr.longitude IS NOT NULL
    AND sr.created_at > now() - make_interval(hours => GREATEST(1, _hours))
    AND (6371 * acos(LEAST(1, GREATEST(-1,
      cos(radians(_lat)) * cos(radians(sr.latitude)) *
      cos(radians(sr.longitude) - radians(_lng)) +
      sin(radians(_lat)) * sin(radians(sr.latitude))
    )))) <= GREATEST(1, _radius_km)
  GROUP BY 1, 2, 3, 4, 6
  ORDER BY requests DESC
  LIMIT 60;
$$;
REVOKE ALL ON FUNCTION public.get_demand_heatmap(double precision, double precision, double precision, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.get_demand_heatmap(double precision, double precision, double precision, integer) TO authenticated;