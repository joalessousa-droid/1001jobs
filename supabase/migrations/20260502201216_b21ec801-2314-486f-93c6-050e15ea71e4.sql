
-- =========================================================
-- 1) COLUNAS NOVAS EM support_chat_logs
-- =========================================================
ALTER TABLE public.support_chat_logs
  ADD COLUMN IF NOT EXISTS is_pro boolean,
  ADD COLUMN IF NOT EXISTS intent_corrected boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_support_chat_logs_is_pro ON public.support_chat_logs(is_pro);
CREATE INDEX IF NOT EXISTS idx_support_chat_logs_intent_corrected ON public.support_chat_logs(intent_corrected);
CREATE INDEX IF NOT EXISTS idx_support_chat_logs_created_status ON public.support_chat_logs(created_at DESC, status);

-- =========================================================
-- 2) TABELA DE CORREÇÕES DE INTENÇÃO
-- =========================================================
CREATE TABLE IF NOT EXISTS public.support_chat_intent_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id uuid NOT NULL REFERENCES public.support_chat_logs(id) ON DELETE CASCADE,
  original_intent text,
  corrected_intent text NOT NULL,
  question text,
  notes text,
  corrected_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intent_corrections_log ON public.support_chat_intent_corrections(log_id);
CREATE INDEX IF NOT EXISTS idx_intent_corrections_corrected ON public.support_chat_intent_corrections(corrected_intent);

ALTER TABLE public.support_chat_intent_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view corrections"
  ON public.support_chat_intent_corrections FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Service role manages corrections"
  ON public.support_chat_intent_corrections FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- =========================================================
-- 3) BASE DE TREINAMENTO LEVE (append-only)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.support_chat_intent_training (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  intent text NOT NULL,
  source text NOT NULL DEFAULT 'correction',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intent_training_intent ON public.support_chat_intent_training(intent);
CREATE INDEX IF NOT EXISTS idx_intent_training_created ON public.support_chat_intent_training(created_at DESC);

ALTER TABLE public.support_chat_intent_training ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view training"
  ON public.support_chat_intent_training FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Service role manages training"
  ON public.support_chat_intent_training FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- =========================================================
-- 4) FUNÇÃO: aplicar correção de intenção (admin/mod)
-- =========================================================
CREATE OR REPLACE FUNCTION public.apply_intent_correction(
  _log_id uuid,
  _corrected_intent text,
  _notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_admin boolean;
  _log record;
BEGIN
  _is_admin := has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role);
  IF NOT _is_admin THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT id, question, intent_category INTO _log
  FROM public.support_chat_logs WHERE id = _log_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'log_not_found'; END IF;

  INSERT INTO public.support_chat_intent_corrections(
    log_id, original_intent, corrected_intent, question, notes, corrected_by_user_id
  ) VALUES (
    _log_id, _log.intent_category, _corrected_intent, _log.question, _notes, auth.uid()
  );

  UPDATE public.support_chat_logs
     SET intent_category = _corrected_intent, intent_corrected = true
   WHERE id = _log_id;

  IF _log.question IS NOT NULL AND length(_log.question) > 0 THEN
    INSERT INTO public.support_chat_intent_training(question, intent, source)
    VALUES (_log.question, _corrected_intent, 'correction');
  END IF;

  RETURN jsonb_build_object('ok', true, 'log_id', _log_id, 'intent', _corrected_intent);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_intent_correction(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_intent_correction(uuid, text, text) TO authenticated;

-- =========================================================
-- 5) MÉTRICAS SEGMENTADAS POR PLANO
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_support_chat_metrics_segmented(
  _from timestamptz DEFAULT now() - interval '7 days',
  _to   timestamptz DEFAULT now()
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_admin boolean;
  _result jsonb;
BEGIN
  _is_admin := has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role);
  IF NOT _is_admin THEN RAISE EXCEPTION 'forbidden'; END IF;

  WITH base AS (
    SELECT *,
      CASE
        WHEN is_pro IS TRUE THEN 'pro'
        WHEN user_id IS NULL THEN 'anon'
        ELSE 'free'
      END AS segment
    FROM public.support_chat_logs
    WHERE created_at BETWEEN _from AND _to
  ),
  per_seg AS (
    SELECT segment,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status='success') AS answered,
      COUNT(*) FILTER (WHERE status='rate_limited' OR http_status=429) AS rate_limited,
      COUNT(*) FILTER (WHERE status='credits_exhausted' OR http_status=402) AS credits_exhausted,
      COUNT(*) FILTER (WHERE status='error') AS errors,
      COALESCE(AVG(response_time_ms) FILTER (WHERE status='success'),0)::int AS avg_response_ms,
      COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY response_time_ms) FILTER (WHERE status='success'),0)::int AS p95_response_ms
    FROM base GROUP BY segment
  ),
  intents AS (
    SELECT segment, intent_category, COUNT(*) AS qty
    FROM base WHERE intent_category IS NOT NULL
    GROUP BY segment, intent_category
  ),
  top_intents AS (
    SELECT segment, jsonb_agg(jsonb_build_object('intent', intent_category, 'count', qty) ORDER BY qty DESC) AS list
    FROM (
      SELECT segment, intent_category, qty,
        ROW_NUMBER() OVER (PARTITION BY segment ORDER BY qty DESC) AS rn
      FROM intents
    ) t WHERE rn <= 8
    GROUP BY segment
  )
  SELECT jsonb_object_agg(p.segment, jsonb_build_object(
    'total', p.total,
    'answered', p.answered,
    'rate_limited_429', p.rate_limited,
    'credits_exhausted_402', p.credits_exhausted,
    'errors', p.errors,
    'avg_response_ms', p.avg_response_ms,
    'p95_response_ms', p.p95_response_ms,
    'top_intents', COALESCE((SELECT list FROM top_intents ti WHERE ti.segment = p.segment), '[]'::jsonb)
  )) INTO _result
  FROM per_seg p;

  RETURN COALESCE(_result, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.get_support_chat_metrics_segmented(timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_support_chat_metrics_segmented(timestamptz, timestamptz) TO authenticated;

-- =========================================================
-- 6) ALERTAS EM TEMPO REAL (15min vs baseline 24h)
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_support_chat_alerts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_admin boolean;
  recent_total int; recent_429 int; recent_402 int; recent_err int;
  base_total int; base_429 int; base_402 int; base_err int;
  base_per_min numeric; recent_per_min numeric;
  alerts jsonb := '[]'::jsonb;
  recent_rate_429 numeric; base_rate_429 numeric;
  recent_rate_402 numeric; base_rate_402 numeric;
  recent_rate_err numeric; base_rate_err numeric;
BEGIN
  _is_admin := has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role);
  IF NOT _is_admin THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE status='rate_limited' OR http_status=429),
         COUNT(*) FILTER (WHERE status='credits_exhausted' OR http_status=402),
         COUNT(*) FILTER (WHERE status='error')
    INTO recent_total, recent_429, recent_402, recent_err
  FROM public.support_chat_logs
  WHERE created_at >= now() - interval '15 minutes';

  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE status='rate_limited' OR http_status=429),
         COUNT(*) FILTER (WHERE status='credits_exhausted' OR http_status=402),
         COUNT(*) FILTER (WHERE status='error')
    INTO base_total, base_429, base_402, base_err
  FROM public.support_chat_logs
  WHERE created_at BETWEEN now() - interval '24 hours' AND now() - interval '15 minutes';

  recent_rate_429 := CASE WHEN recent_total = 0 THEN 0 ELSE recent_429::numeric / recent_total END;
  base_rate_429   := CASE WHEN base_total   = 0 THEN 0 ELSE base_429::numeric   / base_total   END;
  recent_rate_402 := CASE WHEN recent_total = 0 THEN 0 ELSE recent_402::numeric / recent_total END;
  base_rate_402   := CASE WHEN base_total   = 0 THEN 0 ELSE base_402::numeric   / base_total   END;
  recent_rate_err := CASE WHEN recent_total = 0 THEN 0 ELSE recent_err::numeric / recent_total END;
  base_rate_err   := CASE WHEN base_total   = 0 THEN 0 ELSE base_err::numeric   / base_total   END;

  IF recent_429 >= 5 AND recent_rate_429 > GREATEST(base_rate_429 * 2, 0.1) THEN
    alerts := alerts || jsonb_build_object(
      'type','rate_limit_spike','severity','high',
      'message', format('Pico de 429: %s ocorrências nos últimos 15min (%.0f%% das requisições)', recent_429, recent_rate_429*100),
      'count', recent_429
    );
  END IF;

  IF recent_402 >= 1 THEN
    alerts := alerts || jsonb_build_object(
      'type','credits_exhausted','severity','critical',
      'message', format('Crédito da IA esgotado: %s falhas 402 nos últimos 15min', recent_402),
      'count', recent_402
    );
  END IF;

  IF recent_err >= 5 AND recent_rate_err > GREATEST(base_rate_err * 2, 0.1) THEN
    alerts := alerts || jsonb_build_object(
      'type','error_spike','severity','high',
      'message', format('Aumento de erros: %s falhas nos últimos 15min (%.0f%% das requisições)', recent_err, recent_rate_err*100),
      'count', recent_err
    );
  END IF;

  base_per_min   := base_total::numeric   / GREATEST(60*23.75,1);
  recent_per_min := recent_total::numeric / 15;
  IF recent_total >= 30 AND recent_per_min > base_per_min * 3 THEN
    alerts := alerts || jsonb_build_object(
      'type','traffic_spike','severity','medium',
      'message', format('Tráfego acima do normal: %.1f msg/min (baseline %.2f msg/min)', recent_per_min, base_per_min),
      'count', recent_total
    );
  END IF;

  RETURN jsonb_build_object(
    'generated_at', now(),
    'recent_window_minutes', 15,
    'recent', jsonb_build_object('total', recent_total, 'rate_limited', recent_429, 'credits_exhausted', recent_402, 'errors', recent_err),
    'baseline', jsonb_build_object('total', base_total, 'rate_limited', base_429, 'credits_exhausted', base_402, 'errors', base_err),
    'alerts', alerts
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_support_chat_alerts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_support_chat_alerts() TO authenticated;

-- =========================================================
-- 7) RELATÓRIO SEMANAL (consolidado)
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_support_chat_weekly_report()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_admin boolean;
  _from timestamptz := now() - interval '7 days';
  _prev_from timestamptz := now() - interval '14 days';
  _prev_to timestamptz := now() - interval '7 days';
  current_period jsonb;
  prev_total int;
  curr_total int;
  trend numeric;
  top_intents jsonb;
  top_failures jsonb;
  daily jsonb;
  segmented jsonb;
BEGIN
  _is_admin := has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role)
               OR (auth.role() = 'service_role');
  IF NOT _is_admin THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT COUNT(*) INTO curr_total FROM public.support_chat_logs WHERE created_at >= _from;
  SELECT COUNT(*) INTO prev_total FROM public.support_chat_logs WHERE created_at BETWEEN _prev_from AND _prev_to;
  trend := CASE WHEN prev_total = 0 THEN NULL ELSE ((curr_total - prev_total)::numeric / prev_total) * 100 END;

  SELECT jsonb_build_object(
    'total', COUNT(*),
    'answered', COUNT(*) FILTER (WHERE status='success'),
    'rate_limited_429', COUNT(*) FILTER (WHERE status='rate_limited' OR http_status=429),
    'credits_exhausted_402', COUNT(*) FILTER (WHERE status='credits_exhausted' OR http_status=402),
    'errors', COUNT(*) FILTER (WHERE status='error'),
    'avg_response_ms', COALESCE(AVG(response_time_ms) FILTER (WHERE status='success'),0)::int,
    'p95_response_ms', COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY response_time_ms) FILTER (WHERE status='success'),0)::int,
    'unique_sessions', COUNT(DISTINCT session_id),
    'unique_users', COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL)
  ) INTO current_period
  FROM public.support_chat_logs WHERE created_at >= _from;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('intent', intent, 'count', c) ORDER BY c DESC),'[]'::jsonb)
    INTO top_intents
  FROM (
    SELECT intent_category AS intent, COUNT(*) AS c
    FROM public.support_chat_logs
    WHERE created_at >= _from AND intent_category IS NOT NULL
    GROUP BY intent_category ORDER BY c DESC LIMIT 10
  ) t;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'status', status, 'http_status', http_status,
    'sample_error', sample_error, 'count', c
  ) ORDER BY c DESC),'[]'::jsonb)
    INTO top_failures
  FROM (
    SELECT status, http_status,
           (ARRAY_AGG(error_message) FILTER (WHERE error_message IS NOT NULL))[1] AS sample_error,
           COUNT(*) AS c
    FROM public.support_chat_logs
    WHERE created_at >= _from AND status <> 'success'
    GROUP BY status, http_status ORDER BY c DESC LIMIT 10
  ) f;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('day', day, 'total', total, 'errors', errors) ORDER BY day),'[]'::jsonb)
    INTO daily
  FROM (
    SELECT date_trunc('day', created_at)::date AS day,
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE status <> 'success') AS errors
    FROM public.support_chat_logs
    WHERE created_at >= _from
    GROUP BY 1
  ) d;

  segmented := public.get_support_chat_metrics_segmented(_from, now());

  RETURN jsonb_build_object(
    'generated_at', now(),
    'period', jsonb_build_object('from', _from, 'to', now()),
    'current', current_period,
    'previous_total', prev_total,
    'trend_pct', trend,
    'top_intents', top_intents,
    'top_failures', top_failures,
    'daily', daily,
    'by_segment', segmented
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_support_chat_weekly_report() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_support_chat_weekly_report() TO authenticated, service_role;
