CREATE OR REPLACE FUNCTION public.find_nearby_providers(_lat double precision, _lng double precision, _radius_km numeric DEFAULT 3, _category_id uuid DEFAULT NULL::uuid, _limit integer DEFAULT 40, _include_synthetic boolean DEFAULT false, _client_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(provider_id uuid, display_name text, avatar_url text, rating numeric, category_name text, latitude double precision, longitude double precision, distance_km numeric, eta_min integer, match_score numeric, is_synthetic boolean, updated_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH live AS (
    SELECT
      p.id AS provider_id,
      p.display_name,
      p.avatar_url,
      COALESCE(p.provider_score, 0)::numeric AS rating,
      COALESCE(p.is_synthetic, false) AS is_synthetic,
      pl.updated_at,
      pl.latitude,
      pl.longitude
    FROM public.provider_locations pl
    JOIN public.provider_availability pa ON pa.provider_id = pl.provider_id
    JOIN public.profiles p ON p.id = pl.provider_id
    WHERE auth.uid() IS NOT NULL
      AND pl.is_sharing = true
      AND pa.is_online = true
      AND COALESCE(pa.is_busy, false) = false
      AND COALESCE(pa.current_load, 0) < COALESCE(pa.max_concurrent, 1)
      AND pl.updated_at > now() - interval '15 minutes'
      AND (_include_synthetic OR COALESCE(p.is_synthetic, false) = false)
      AND (
        _category_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.provider_services ps
          WHERE ps.provider_id = pl.provider_id AND ps.category_id = _category_id
        )
      )
  ),
  demo AS (
    -- Modo simulação: perfis sintéticos sem localização ao vivo usam o endereço do perfil
    SELECT
      p.id AS provider_id,
      p.display_name,
      p.avatar_url,
      COALESCE(p.provider_score, 0)::numeric AS rating,
      true AS is_synthetic,
      p.updated_at,
      p.latitude,
      p.longitude
    FROM public.profiles p
    WHERE auth.uid() IS NOT NULL
      AND _include_synthetic
      AND COALESCE(p.is_synthetic, false) = true
      AND p.user_type = 'provider'
      AND p.latitude IS NOT NULL
      AND p.longitude IS NOT NULL
      AND (p.synthetic_expires_at IS NULL OR p.synthetic_expires_at > now())
      AND NOT EXISTS (SELECT 1 FROM live l WHERE l.provider_id = p.id)
      AND (
        _category_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.provider_services ps
          WHERE ps.provider_id = p.id AND ps.category_id = _category_id
        )
      )
  ),
  base AS (
    SELECT u.*,
      (2 * 6371 * asin(sqrt(
        power(sin(radians(u.latitude - _lat) / 2), 2) +
        cos(radians(_lat)) * cos(radians(u.latitude)) *
        power(sin(radians(u.longitude - _lng) / 2), 2)
      )))::numeric AS distance_km
    FROM (SELECT * FROM live UNION ALL SELECT * FROM demo) u
  )
  SELECT
    b.provider_id,
    b.display_name,
    b.avatar_url,
    round(b.rating, 2) AS rating,
    (SELECT sc.name FROM public.provider_services ps
       JOIN public.service_categories sc ON sc.id = ps.category_id
      WHERE ps.provider_id = b.provider_id
        AND (_category_id IS NULL OR ps.category_id = _category_id)
      LIMIT 1) AS category_name,
    round(b.latitude::numeric, 3)::double precision AS latitude,
    round(b.longitude::numeric, 3)::double precision AS longitude,
    round(b.distance_km, 2) AS distance_km,
    GREATEST(1, ceil(b.distance_km / 0.4))::integer AS eta_min,
    public.calculate_provider_score(b.provider_id, _client_id, b.distance_km, _category_id) AS match_score,
    b.is_synthetic,
    b.updated_at
  FROM base b
  WHERE b.distance_km <= _radius_km
  ORDER BY match_score DESC NULLS LAST, b.distance_km ASC
  LIMIT LEAST(COALESCE(_limit, 40), 100);
$function$;

REVOKE ALL ON FUNCTION public.find_nearby_providers(double precision, double precision, numeric, uuid, integer, boolean, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_nearby_providers(double precision, double precision, numeric, uuid, integer, boolean, uuid) TO authenticated, service_role;