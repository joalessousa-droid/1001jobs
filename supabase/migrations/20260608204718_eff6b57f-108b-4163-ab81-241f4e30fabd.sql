
-- Settings columns on app_settings (singleton)
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS cron_alert_threshold int NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS cron_alert_window_minutes int NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS cron_alert_cooldown_minutes int NOT NULL DEFAULT 60;

-- Track when an alert was last sent per jobid to avoid spamming
CREATE TABLE IF NOT EXISTS public.cron_alert_state (
  jobid bigint PRIMARY KEY,
  last_alert_at timestamptz NOT NULL DEFAULT now(),
  last_failure_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.cron_alert_state TO authenticated;
GRANT ALL ON public.cron_alert_state TO service_role;
ALTER TABLE public.cron_alert_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read cron_alert_state"
  ON public.cron_alert_state FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RPC: failure summary per job within window
CREATE OR REPLACE FUNCTION public.get_cron_failure_summary(_window_minutes int DEFAULT 60)
RETURNS TABLE(
  jobid bigint,
  jobname text,
  schedule text,
  failure_count int,
  last_failure_at timestamptz,
  last_message text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, cron
AS $$
  SELECT j.jobid, j.jobname, j.schedule,
         COUNT(*)::int AS failure_count,
         MAX(d.start_time) AS last_failure_at,
         (ARRAY_AGG(d.return_message ORDER BY d.start_time DESC))[1] AS last_message
  FROM cron.job j
  JOIN cron.job_run_details d ON d.jobid = j.jobid
  WHERE d.status = 'failed'
    AND d.start_time >= now() - make_interval(mins => GREATEST(1, _window_minutes))
    AND public.has_role(auth.uid(), 'admin')
  GROUP BY j.jobid, j.jobname, j.schedule;
$$;
REVOKE ALL ON FUNCTION public.get_cron_failure_summary(int) FROM public;
GRANT EXECUTE ON FUNCTION public.get_cron_failure_summary(int) TO authenticated;

-- RPC: full details for a single execution
CREATE OR REPLACE FUNCTION public.get_scheduled_job_run_detail(_runid bigint)
RETURNS TABLE(
  runid bigint,
  jobid bigint,
  jobname text,
  schedule text,
  command text,
  database text,
  username text,
  start_time timestamptz,
  end_time timestamptz,
  status text,
  return_message text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, cron
AS $$
  SELECT d.runid, d.jobid, j.jobname, j.schedule, j.command, j.database, j.username,
         d.start_time, d.end_time, d.status, d.return_message
  FROM cron.job_run_details d
  JOIN cron.job j ON j.jobid = d.jobid
  WHERE d.runid = _runid
    AND public.has_role(auth.uid(), 'admin');
$$;
REVOKE ALL ON FUNCTION public.get_scheduled_job_run_detail(bigint) FROM public;
GRANT EXECUTE ON FUNCTION public.get_scheduled_job_run_detail(bigint) TO authenticated;

-- Service-role helper used by the monitor edge function (no auth check; service_role only)
CREATE OR REPLACE FUNCTION public.svc_cron_failure_summary(_window_minutes int)
RETURNS TABLE(
  jobid bigint,
  jobname text,
  schedule text,
  failure_count int,
  last_failure_at timestamptz,
  last_message text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, cron
AS $$
  SELECT j.jobid, j.jobname, j.schedule,
         COUNT(*)::int,
         MAX(d.start_time),
         (ARRAY_AGG(d.return_message ORDER BY d.start_time DESC))[1]
  FROM cron.job j
  JOIN cron.job_run_details d ON d.jobid = j.jobid
  WHERE d.status = 'failed'
    AND d.start_time >= now() - make_interval(mins => GREATEST(1, _window_minutes))
  GROUP BY j.jobid, j.jobname, j.schedule;
$$;
REVOKE ALL ON FUNCTION public.svc_cron_failure_summary(int) FROM public;
GRANT EXECUTE ON FUNCTION public.svc_cron_failure_summary(int) TO service_role;

CREATE OR REPLACE FUNCTION public.svc_upsert_cron_alert_state(_jobid bigint, _failure_count int)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.cron_alert_state(jobid, last_alert_at, last_failure_count)
  VALUES (_jobid, now(), _failure_count)
  ON CONFLICT (jobid) DO UPDATE
    SET last_alert_at = now(),
        last_failure_count = EXCLUDED.last_failure_count,
        updated_at = now();
$$;
REVOKE ALL ON FUNCTION public.svc_upsert_cron_alert_state(bigint, int) FROM public;
GRANT EXECUTE ON FUNCTION public.svc_upsert_cron_alert_state(bigint, int) TO service_role;
