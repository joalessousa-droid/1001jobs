-- Tabela de logs do chatbot de suporte
CREATE TABLE IF NOT EXISTS public.support_chat_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID,
  profile_id UUID,
  session_id TEXT,
  question TEXT,
  question_length INTEGER,
  answer_preview TEXT,
  intent_category TEXT,
  status TEXT NOT NULL DEFAULT 'success', -- success | rate_limited | credits_exhausted | error
  http_status INTEGER,
  response_time_ms INTEGER,
  model TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_support_chat_logs_created ON public.support_chat_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_chat_logs_status ON public.support_chat_logs(status);
CREATE INDEX IF NOT EXISTS idx_support_chat_logs_intent ON public.support_chat_logs(intent_category);
CREATE INDEX IF NOT EXISTS idx_support_chat_logs_profile ON public.support_chat_logs(profile_id);

ALTER TABLE public.support_chat_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view all chat logs"
  ON public.support_chat_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));

CREATE POLICY "Users view own chat logs"
  ON public.support_chat_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role manages chat logs"
  ON public.support_chat_logs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Função para registrar eventos (chamada pelo edge function)
CREATE OR REPLACE FUNCTION public.log_support_chat_event(
  _session_id TEXT,
  _question TEXT,
  _answer_preview TEXT DEFAULT NULL,
  _intent_category TEXT DEFAULT NULL,
  _status TEXT DEFAULT 'success',
  _http_status INTEGER DEFAULT 200,
  _response_time_ms INTEGER DEFAULT NULL,
  _model TEXT DEFAULT NULL,
  _prompt_tokens INTEGER DEFAULT NULL,
  _completion_tokens INTEGER DEFAULT NULL,
  _total_tokens INTEGER DEFAULT NULL,
  _error_message TEXT DEFAULT NULL,
  _metadata JSONB DEFAULT '{}'::jsonb,
  _ip_address TEXT DEFAULT NULL,
  _user_agent TEXT DEFAULT NULL,
  _user_id UUID DEFAULT NULL,
  _profile_id UUID DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _id UUID;
BEGIN
  INSERT INTO public.support_chat_logs(
    user_id, profile_id, session_id, question, question_length,
    answer_preview, intent_category, status, http_status,
    response_time_ms, model, prompt_tokens, completion_tokens, total_tokens,
    error_message, metadata, ip_address, user_agent
  ) VALUES (
    COALESCE(_user_id, auth.uid()),
    COALESCE(_profile_id, public.get_my_profile_id()),
    _session_id,
    _question,
    COALESCE(length(_question), 0),
    LEFT(COALESCE(_answer_preview,''), 500),
    _intent_category,
    COALESCE(_status,'success'),
    _http_status,
    _response_time_ms,
    _model,
    _prompt_tokens, _completion_tokens, _total_tokens,
    _error_message,
    COALESCE(_metadata,'{}'::jsonb),
    _ip_address, _user_agent
  ) RETURNING id INTO _id;
  RETURN _id;
END $$;

REVOKE EXECUTE ON FUNCTION public.log_support_chat_event(TEXT,TEXT,TEXT,TEXT,TEXT,INTEGER,INTEGER,TEXT,INTEGER,INTEGER,INTEGER,TEXT,JSONB,TEXT,TEXT,UUID,UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_support_chat_event(TEXT,TEXT,TEXT,TEXT,TEXT,INTEGER,INTEGER,TEXT,INTEGER,INTEGER,INTEGER,TEXT,JSONB,TEXT,TEXT,UUID,UUID) TO service_role;

-- Função de métricas agregadas para o admin
CREATE OR REPLACE FUNCTION public.get_support_chat_metrics(
  _from TIMESTAMPTZ DEFAULT (now() - interval '30 days'),
  _to TIMESTAMPTZ DEFAULT now()
) RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _result JSONB;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator')) THEN
    RAISE EXCEPTION 'Only admins can view chat metrics';
  END IF;

  SELECT jsonb_build_object(
    'period_from', _from,
    'period_to', _to,
    'total_questions', COUNT(*),
    'answered', COUNT(*) FILTER (WHERE status='success'),
    'rate_limited_429', COUNT(*) FILTER (WHERE status='rate_limited' OR http_status=429),
    'credits_exhausted_402', COUNT(*) FILTER (WHERE status='credits_exhausted' OR http_status=402),
    'errors', COUNT(*) FILTER (WHERE status NOT IN ('success','rate_limited','credits_exhausted')),
    'avg_response_time_ms', COALESCE(AVG(response_time_ms) FILTER (WHERE status='success'),0)::INTEGER,
    'p95_response_time_ms', COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY response_time_ms) FILTER (WHERE status='success'),0)::INTEGER,
    'unique_users', COUNT(DISTINCT COALESCE(user_id::text, session_id)),
    'total_tokens', COALESCE(SUM(total_tokens),0),
    'top_intents', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('category', intent_category, 'count', c) ORDER BY c DESC), '[]'::jsonb)
      FROM (
        SELECT intent_category, COUNT(*) AS c
        FROM public.support_chat_logs
        WHERE created_at BETWEEN _from AND _to
          AND intent_category IS NOT NULL
        GROUP BY intent_category
        ORDER BY c DESC
        LIMIT 10
      ) t
    ),
    'daily_volume', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('day', d, 'total', total, 'errors', errs) ORDER BY d), '[]'::jsonb)
      FROM (
        SELECT date_trunc('day', created_at)::date AS d,
               COUNT(*) AS total,
               COUNT(*) FILTER (WHERE status<>'success') AS errs
        FROM public.support_chat_logs
        WHERE created_at BETWEEN _from AND _to
        GROUP BY 1
      ) d
    )
  ) INTO _result
  FROM public.support_chat_logs
  WHERE created_at BETWEEN _from AND _to;

  RETURN _result;
END $$;

REVOKE EXECUTE ON FUNCTION public.get_support_chat_metrics(TIMESTAMPTZ,TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_support_chat_metrics(TIMESTAMPTZ,TIMESTAMPTZ) TO authenticated, service_role;