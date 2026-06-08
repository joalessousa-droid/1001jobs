
CREATE OR REPLACE FUNCTION public.get_scheduled_jobs_status()
RETURNS TABLE(
  jobid bigint,
  jobname text,
  schedule text,
  active boolean,
  last_start timestamptz,
  last_end timestamptz,
  last_status text,
  last_return_message text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, cron
AS $$
  SELECT
    j.jobid,
    j.jobname,
    j.schedule,
    j.active,
    r.start_time,
    r.end_time,
    r.status,
    r.return_message
  FROM cron.job j
  LEFT JOIN LATERAL (
    SELECT start_time, end_time, status, return_message
    FROM cron.job_run_details d
    WHERE d.jobid = j.jobid
    ORDER BY d.start_time DESC
    LIMIT 1
  ) r ON true
  WHERE public.has_role(auth.uid(), 'admin');
$$;

REVOKE ALL ON FUNCTION public.get_scheduled_jobs_status() FROM public;
GRANT EXECUTE ON FUNCTION public.get_scheduled_jobs_status() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_scheduled_job_runs(_jobid bigint, _limit int DEFAULT 25)
RETURNS TABLE(
  runid bigint,
  jobid bigint,
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
  SELECT d.runid, d.jobid, d.start_time, d.end_time, d.status, d.return_message
  FROM cron.job_run_details d
  WHERE d.jobid = _jobid
    AND public.has_role(auth.uid(), 'admin')
  ORDER BY d.start_time DESC
  LIMIT GREATEST(1, LEAST(_limit, 200));
$$;

REVOKE ALL ON FUNCTION public.get_scheduled_job_runs(bigint, int) FROM public;
GRANT EXECUTE ON FUNCTION public.get_scheduled_job_runs(bigint, int) TO authenticated;
