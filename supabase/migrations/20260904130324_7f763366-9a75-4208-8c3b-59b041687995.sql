CREATE UNIQUE INDEX IF NOT EXISTS ai_regional_stats_unique_scope
  ON public.ai_regional_stats (level, scope_value, coalesce(category, ''), period_days);

SELECT cron.unschedule('ai-learning-cycle-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ai-learning-cycle-daily');

SELECT cron.schedule(
  'ai-learning-cycle-daily',
  '17 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ndtiregwcgbrgenozycb.supabase.co/functions/v1/ai-learning-cycle',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', current_setting('app.cron_secret', true)),
    body := jsonb_build_object('source', 'pg_cron')
  );
  $$
);