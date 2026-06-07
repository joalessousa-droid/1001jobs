CREATE OR REPLACE FUNCTION public.upsert_regional_traffic_sample(
  _region_key text,
  _city text,
  _state text,
  _hour smallint,
  _dow smallint,
  _speed_kmh numeric,
  _alpha numeric DEFAULT 0.2
) RETURNS public.regional_traffic_stats
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.regional_traffic_stats;
  _a numeric := COALESCE(_alpha, 0.2);
BEGIN
  IF _a < 0.01 THEN _a := 0.01; END IF;
  IF _a > 0.95 THEN _a := 0.95; END IF;

  INSERT INTO public.regional_traffic_stats(region_key, city, state, hour_of_day, day_of_week, avg_speed_kmh)
  VALUES (_region_key, _city, _state, _hour, _dow, _speed_kmh)
  ON CONFLICT (region_key, hour_of_day, day_of_week) DO UPDATE
    SET avg_speed_kmh = ROUND(((1 - _a) * public.regional_traffic_stats.avg_speed_kmh + _a * EXCLUDED.avg_speed_kmh)::numeric, 2),
        sample_count = public.regional_traffic_stats.sample_count + 1,
        last_sample_at = now(),
        city = COALESCE(EXCLUDED.city, public.regional_traffic_stats.city),
        state = COALESCE(EXCLUDED.state, public.regional_traffic_stats.state)
  RETURNING * INTO _row;
  RETURN _row;
END;
$$;