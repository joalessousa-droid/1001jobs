CREATE OR REPLACE FUNCTION public.get_demand_heatmap(_lat double precision, _lng double precision, _radius_km double precision DEFAULT 15, _hours integer DEFAULT 24)
 RETURNS TABLE(cell_lat double precision, cell_lng double precision, category_id uuid, category_name text, requests integer, distance_km double precision)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    AND coalesce(sr.origin, 'standard') <> 'radar'
    AND sr.created_at > now() - make_interval(hours => GREATEST(1, _hours))
    AND (6371 * acos(LEAST(1, GREATEST(-1,
      cos(radians(_lat)) * cos(radians(sr.latitude)) *
      cos(radians(sr.longitude) - radians(_lng)) +
      sin(radians(_lat)) * sin(radians(sr.latitude))
    )))) <= GREATEST(1, _radius_km)
  GROUP BY 1, 2, 3, 4, 6
  ORDER BY requests DESC
  LIMIT 60;
$function$;