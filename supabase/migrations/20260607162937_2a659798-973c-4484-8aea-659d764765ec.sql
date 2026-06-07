CREATE TABLE IF NOT EXISTS public.eta_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  alert_type TEXT NOT NULL,                 -- 'persistent_degradation' | 'slow_responses' | 'intense_traffic'
  severity TEXT NOT NULL DEFAULT 'high',    -- 'low' | 'medium' | 'high' | 'critical'
  period_from TIMESTAMPTZ NOT NULL,
  period_to TIMESTAMPTZ NOT NULL,
  city TEXT,
  provider_id UUID,
  category_id UUID,
  samples INT,
  failures INT,
  failure_rate NUMERIC,
  avg_duration_ms INT,
  p95_duration_ms INT,
  avg_traffic_factor NUMERIC,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  tuning_snapshot JSONB,
  email_sent BOOLEAN NOT NULL DEFAULT false,
  webhook_status INT,
  webhook_error TEXT,
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS eta_alerts_ts_idx ON public.eta_alerts(ts DESC);
CREATE INDEX IF NOT EXISTS eta_alerts_city_idx ON public.eta_alerts(city);
CREATE INDEX IF NOT EXISTS eta_alerts_provider_idx ON public.eta_alerts(provider_id);
CREATE INDEX IF NOT EXISTS eta_alerts_category_idx ON public.eta_alerts(category_id);

GRANT SELECT ON public.eta_alerts TO authenticated;
GRANT ALL ON public.eta_alerts TO service_role;
ALTER TABLE public.eta_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/mods view eta_alerts"
  ON public.eta_alerts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));

-- Realtime publication
ALTER TABLE public.eta_metrics REPLICA IDENTITY FULL;
ALTER TABLE public.eta_alerts  REPLICA IDENTITY FULL;
DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='eta_metrics';
  IF NOT FOUND THEN EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.eta_metrics'; END IF;
END $$;
DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='eta_alerts';
  IF NOT FOUND THEN EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.eta_alerts'; END IF;
END $$;