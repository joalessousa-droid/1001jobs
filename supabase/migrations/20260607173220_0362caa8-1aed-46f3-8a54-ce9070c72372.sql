
-- ===== Onda A: Finalização 4 & 5 =====

-- 1) Habilitar pg_cron / pg_net (idempotente)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2) Cron: expirar ofertas paradas a cada 10s (chamada SQL direta)
DO $$
DECLARE _jobid bigint;
BEGIN
  SELECT jobid INTO _jobid FROM cron.job WHERE jobname = 'expire-stale-offers-10s';
  IF _jobid IS NOT NULL THEN PERFORM cron.unschedule(_jobid); END IF;
END $$;

SELECT cron.schedule(
  'expire-stale-offers-10s',
  '*/10 * * * * *',
  $$SELECT public.expire_stale_offers();$$
);

-- 3) View de métricas por profissional (30 dias)
CREATE OR REPLACE VIEW public.v_provider_offer_metrics AS
SELECT
  so.provider_id,
  COUNT(*)                                                        AS total_offers,
  COUNT(*) FILTER (WHERE so.status = 'accepted')                  AS accepted,
  COUNT(*) FILTER (WHERE so.status = 'declined')                  AS declined,
  COUNT(*) FILTER (WHERE so.status = 'expired')                   AS expired,
  COUNT(*) FILTER (WHERE so.status = 'superseded')                AS superseded,
  CASE WHEN COUNT(*) = 0 THEN 0
       ELSE ROUND((COUNT(*) FILTER (WHERE so.status='accepted'))::numeric / COUNT(*), 4)
  END                                                             AS acceptance_rate,
  COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (so.responded_at - so.offered_at)))
            FILTER (WHERE so.responded_at IS NOT NULL)::numeric, 2), 0) AS avg_response_seconds,
  MAX(so.offered_at)                                              AS last_offer_at
FROM public.service_offers so
WHERE so.offered_at >= now() - interval '30 days'
GROUP BY so.provider_id;

GRANT SELECT ON public.v_provider_offer_metrics TO authenticated;
GRANT SELECT ON public.v_provider_offer_metrics TO service_role;

-- 4) RPC: histórico de ofertas do profissional logado
CREATE OR REPLACE FUNCTION public.get_my_offer_history(
  _from timestamptz DEFAULT now() - interval '30 days',
  _to   timestamptz DEFAULT now(),
  _status text DEFAULT NULL
)
RETURNS SETOF public.service_offers
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _me uuid := public.get_my_profile_id();
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  RETURN QUERY
  SELECT *
    FROM public.service_offers
   WHERE provider_id = _me
     AND offered_at BETWEEN _from AND _to
     AND (_status IS NULL OR status = _status)
   ORDER BY offered_at DESC
   LIMIT 500;
END $$;

GRANT EXECUTE ON FUNCTION public.get_my_offer_history(timestamptz,timestamptz,text) TO authenticated;

-- 5) RPC: KPIs do profissional logado
CREATE OR REPLACE FUNCTION public.get_my_offer_metrics()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _me uuid := public.get_my_profile_id(); _r jsonb;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT to_jsonb(m.*) INTO _r FROM public.v_provider_offer_metrics m WHERE m.provider_id = _me;
  RETURN COALESCE(_r, jsonb_build_object(
    'provider_id', _me,'total_offers',0,'accepted',0,'declined',0,'expired',0,
    'superseded',0,'acceptance_rate',0,'avg_response_seconds',0,'last_offer_at', null
  ));
END $$;

GRANT EXECUTE ON FUNCTION public.get_my_offer_metrics() TO authenticated;

-- 6) RPC admin: logs de matching com filtros
CREATE OR REPLACE FUNCTION public.get_matching_logs_admin(
  _from timestamptz DEFAULT now() - interval '7 days',
  _to   timestamptz DEFAULT now(),
  _service_request_id uuid DEFAULT NULL,
  _decision text DEFAULT NULL,
  _limit int DEFAULT 200
)
RETURNS SETOF public.service_matching_logs
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT *
    FROM public.service_matching_logs
   WHERE created_at BETWEEN _from AND _to
     AND (_service_request_id IS NULL OR service_request_id = _service_request_id)
     AND (_decision IS NULL OR decision::text = _decision)
   ORDER BY created_at DESC
   LIMIT GREATEST(1, LEAST(_limit, 1000));
END $$;

GRANT EXECUTE ON FUNCTION public.get_matching_logs_admin(timestamptz,timestamptz,uuid,text,int) TO authenticated;
