
-- ETA Module: regional traffic history + computed speed metrics on tracking rows.

ALTER TABLE public.service_tracking
  ADD COLUMN IF NOT EXISTS avg_speed_kmh numeric,
  ADD COLUMN IF NOT EXISTS regional_avg_speed_kmh numeric,
  ADD COLUMN IF NOT EXISTS traffic_factor numeric, -- duration / staticDuration (>=1 means slower than free-flow)
  ADD COLUMN IF NOT EXISTS eta_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS destination_city text,
  ADD COLUMN IF NOT EXISTS destination_state text;

CREATE TABLE IF NOT EXISTS public.regional_traffic_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_key text NOT NULL,         -- normalized "city|state" or "lat_bucket|lng_bucket"
  city text,
  state text,
  hour_of_day smallint NOT NULL CHECK (hour_of_day BETWEEN 0 AND 23),
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  avg_speed_kmh numeric NOT NULL,
  sample_count integer NOT NULL DEFAULT 1,
  last_sample_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (region_key, hour_of_day, day_of_week)
);

GRANT SELECT ON public.regional_traffic_stats TO authenticated;
GRANT ALL ON public.regional_traffic_stats TO service_role;

ALTER TABLE public.regional_traffic_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read regional stats"
  ON public.regional_traffic_stats FOR SELECT TO authenticated USING (true);

-- writes only via edge function with service_role; no INSERT/UPDATE policies for end-users.

CREATE INDEX IF NOT EXISTS idx_regional_traffic_lookup
  ON public.regional_traffic_stats (region_key, hour_of_day, day_of_week);

CREATE TRIGGER trg_regional_traffic_updated_at
  BEFORE UPDATE ON public.regional_traffic_stats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Upsert helper: blends new sample with EMA (alpha=0.2) so recent samples weigh more
-- without losing long-term trend.
CREATE OR REPLACE FUNCTION public.upsert_regional_traffic_sample(
  _region_key text,
  _city text,
  _state text,
  _hour smallint,
  _dow smallint,
  _speed_kmh numeric
) RETURNS public.regional_traffic_stats
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.regional_traffic_stats;
  _alpha numeric := 0.2;
BEGIN
  INSERT INTO public.regional_traffic_stats(region_key, city, state, hour_of_day, day_of_week, avg_speed_kmh)
  VALUES (_region_key, _city, _state, _hour, _dow, _speed_kmh)
  ON CONFLICT (region_key, hour_of_day, day_of_week) DO UPDATE
    SET avg_speed_kmh = ROUND(((1 - _alpha) * public.regional_traffic_stats.avg_speed_kmh + _alpha * EXCLUDED.avg_speed_kmh)::numeric, 2),
        sample_count = public.regional_traffic_stats.sample_count + 1,
        last_sample_at = now(),
        city = COALESCE(EXCLUDED.city, public.regional_traffic_stats.city),
        state = COALESCE(EXCLUDED.state, public.regional_traffic_stats.state)
  RETURNING * INTO _row;
  RETURN _row;
END;
$$;
