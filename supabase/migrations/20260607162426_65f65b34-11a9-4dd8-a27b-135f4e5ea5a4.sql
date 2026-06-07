-- ETA metrics persistence + tuning overrides + admin alerts
CREATE TABLE IF NOT EXISTS public.eta_metrics (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  service_id UUID,
  provider_id UUID,
  ok BOOLEAN NOT NULL,
  duration_ms INTEGER,
  http_status INTEGER,
  distance_meters INTEGER,
  eta_seconds INTEGER,
  traffic_factor NUMERIC,
  traffic_level TEXT,
  regional_weight NUMERIC,
  retries SMALLINT DEFAULT 0,
  degraded BOOLEAN DEFAULT false,
  error TEXT,
  region_key TEXT,
  category_id UUID
);
CREATE INDEX IF NOT EXISTS eta_metrics_ts_idx ON public.eta_metrics(ts DESC);
CREATE INDEX IF NOT EXISTS eta_metrics_service_idx ON public.eta_metrics(service_id, ts DESC);

GRANT SELECT ON public.eta_metrics TO authenticated;
GRANT ALL ON public.eta_metrics TO service_role;
ALTER TABLE public.eta_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/mods view eta_metrics"
  ON public.eta_metrics FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));

-- Tuning overrides: scope = city | provider | category | global
CREATE TABLE IF NOT EXISTS public.eta_tuning_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL CHECK (scope IN ('global','city','provider','category')),
  scope_value TEXT,                       -- city name, provider profile_id, category id, or NULL for global
  ema_alpha NUMERIC,                      -- 0.01..0.95
  max_regional_weight NUMERIC,            -- 0..0.9
  hour_of_day SMALLINT,                   -- optional 0..23
  day_of_week SMALLINT,                   -- optional 0..6
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS eta_tuning_scope_idx ON public.eta_tuning_overrides(scope, scope_value) WHERE is_active;

GRANT SELECT ON public.eta_tuning_overrides TO authenticated;
GRANT ALL ON public.eta_tuning_overrides TO service_role;
ALTER TABLE public.eta_tuning_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage tuning"
  ON public.eta_tuning_overrides FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Authenticated read tuning"
  ON public.eta_tuning_overrides FOR SELECT TO authenticated
  USING (true);

CREATE TRIGGER eta_tuning_updated
  BEFORE UPDATE ON public.eta_tuning_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Aggregated dashboard function
CREATE OR REPLACE FUNCTION public.get_eta_metrics_dashboard(_minutes INT DEFAULT 60)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _r JSONB; _from TIMESTAMPTZ;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  _from := now() - make_interval(mins => GREATEST(5, LEAST(_minutes, 1440)));

  SELECT jsonb_build_object(
    'generated_at', now(),
    'window_minutes', _minutes,
    'totals', (
      SELECT jsonb_build_object(
        'samples', COUNT(*),
        'failures', COUNT(*) FILTER (WHERE NOT ok),
        'failure_rate', CASE WHEN COUNT(*)=0 THEN 0 ELSE ROUND((COUNT(*) FILTER (WHERE NOT ok))::numeric/COUNT(*),4) END,
        'degraded', COUNT(*) FILTER (WHERE degraded),
        'avg_duration_ms', COALESCE(ROUND(AVG(duration_ms))::int, 0),
        'p95_duration_ms', COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms)::int, 0),
        'avg_traffic_factor', COALESCE(ROUND(AVG(traffic_factor)::numeric, 3), 0),
        'traffic_levels', (
          SELECT jsonb_object_agg(COALESCE(traffic_level,'unknown'), c)
          FROM (SELECT traffic_level, COUNT(*) AS c FROM public.eta_metrics WHERE ts >= _from GROUP BY traffic_level) t
        ),
        'total_retries', COALESCE(SUM(retries)::int, 0)
      ) FROM public.eta_metrics WHERE ts >= _from
    ),
    'timeseries', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'bucket', bucket, 'samples', samples, 'failures', failures,
        'avg_duration_ms', avg_duration_ms, 'avg_traffic_factor', avg_traffic_factor
      ) ORDER BY bucket), '[]'::jsonb)
      FROM (
        SELECT date_trunc('minute', ts) AS bucket,
               COUNT(*) AS samples,
               COUNT(*) FILTER (WHERE NOT ok) AS failures,
               COALESCE(ROUND(AVG(duration_ms))::int,0) AS avg_duration_ms,
               COALESCE(ROUND(AVG(traffic_factor)::numeric,3),0) AS avg_traffic_factor
        FROM public.eta_metrics WHERE ts >= _from
        GROUP BY 1
      ) ts
    ),
    'recent_errors', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'ts', ts, 'service_id', service_id, 'http_status', http_status,
        'retries', retries, 'error', error
      ) ORDER BY ts DESC), '[]'::jsonb)
      FROM (SELECT * FROM public.eta_metrics WHERE ts >= _from AND NOT ok ORDER BY ts DESC LIMIT 20) e
    ),
    'alerts', (
      SELECT jsonb_build_object(
        'persistent_degradation', (
          SELECT (COUNT(*) FILTER (WHERE NOT ok))::numeric / NULLIF(COUNT(*),0) > 0.25 AND COUNT(*) >= 10
          FROM public.eta_metrics WHERE ts >= now() - interval '15 minutes'
        ),
        'slow_responses', (
          SELECT COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms)::int,0) > 3000
          FROM public.eta_metrics WHERE ts >= now() - interval '15 minutes' AND ok
        ),
        'intense_traffic_share', (
          SELECT CASE WHEN COUNT(*)=0 THEN 0
            ELSE ROUND((COUNT(*) FILTER (WHERE traffic_level='intense'))::numeric / COUNT(*), 3) END
          FROM public.eta_metrics WHERE ts >= now() - interval '30 minutes'
        )
      )
    )
  ) INTO _r;
  RETURN _r;
END;
$$;

-- Resolve tuning helper (used by edge function via direct query)
CREATE OR REPLACE FUNCTION public.resolve_eta_tuning(
  _provider_id UUID, _category_id UUID, _city TEXT,
  _hour SMALLINT, _dow SMALLINT
) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _alpha NUMERIC; _maxw NUMERIC;
BEGIN
  -- precedence: provider > category > city > global; hour/dow specific wins within scope
  SELECT ema_alpha, max_regional_weight INTO _alpha, _maxw
  FROM public.eta_tuning_overrides
  WHERE is_active AND (
    (scope='provider' AND scope_value = _provider_id::text)
    OR (scope='category' AND scope_value = _category_id::text)
    OR (scope='city' AND lower(scope_value) = lower(COALESCE(_city,'')))
    OR (scope='global')
  )
  AND (hour_of_day IS NULL OR hour_of_day = _hour)
  AND (day_of_week IS NULL OR day_of_week = _dow)
  ORDER BY
    CASE scope WHEN 'provider' THEN 1 WHEN 'category' THEN 2 WHEN 'city' THEN 3 ELSE 4 END,
    (hour_of_day IS NOT NULL)::int DESC,
    (day_of_week IS NOT NULL)::int DESC
  LIMIT 1;

  RETURN jsonb_build_object('ema_alpha', _alpha, 'max_regional_weight', _maxw);
END;
$$;