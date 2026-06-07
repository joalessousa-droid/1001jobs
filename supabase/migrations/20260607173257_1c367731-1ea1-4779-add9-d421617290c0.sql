
-- ===== Onda B: Módulo 6 - Fila Inteligente =====

CREATE TABLE IF NOT EXISTS public.provider_ranking_scores (
  provider_id uuid PRIMARY KEY,
  score_total numeric NOT NULL DEFAULT 0,
  score_rating numeric NOT NULL DEFAULT 0,
  score_anti_cancel numeric NOT NULL DEFAULT 0,
  score_proximity numeric NOT NULL DEFAULT 0,
  score_specialization numeric NOT NULL DEFAULT 0,
  score_recurrence numeric NOT NULL DEFAULT 0,
  sample_size integer NOT NULL DEFAULT 0,
  computed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.provider_ranking_scores TO anon;
GRANT SELECT ON public.provider_ranking_scores TO authenticated;
GRANT ALL ON public.provider_ranking_scores TO service_role;

ALTER TABLE public.provider_ranking_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read ranking"
  ON public.provider_ranking_scores FOR SELECT
  USING (true);

CREATE POLICY "Service manages ranking"
  ON public.provider_ranking_scores FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_provider_ranking_total
  ON public.provider_ranking_scores (score_total DESC);

-- Função de recálculo
CREATE OR REPLACE FUNCTION public.recompute_provider_ranking(_provider_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _w record;
  _count integer := 0;
  _r record;
BEGIN
  SELECT * INTO _w FROM public.dispatch_match_weights WHERE is_active LIMIT 1;
  IF _w IS NULL THEN
    _w := ROW(NULL, NULL, true, 25, 35, 10, 15, 10, 5, 0, NULL, NULL, NULL, NULL)::public.dispatch_match_weights;
  END IF;

  FOR _r IN
    SELECT p.id AS provider_id
      FROM public.profiles p
     WHERE p.user_type = 'provider' AND p.is_active = true
       AND (_provider_id IS NULL OR p.id = _provider_id)
  LOOP
    DECLARE
      _rating numeric := 0;
      _anti_cancel numeric := 0;
      _proximity numeric := 0;
      _specialization numeric := 0;
      _recurrence numeric := 0;
      _samples int := 0;
      _total numeric := 0;
      _rep_score numeric;
      _cancels int; _completed int;
      _spec_count int;
      _recur_count int;
    BEGIN
      -- rating (0..1)
      SELECT COALESCE(rs.average_rating,0)/5.0, COALESCE(rs.total_reviews,0)
        INTO _rep_score, _samples
        FROM public.reputation_scores rs WHERE rs.profile_id = _r.provider_id;
      _rating := COALESCE(_rep_score, 0);

      -- anti-cancel (1 - taxa de cancelamento últimos 90d)
      SELECT
        COUNT(*) FILTER (WHERE status='cancelled_by_provider'),
        COUNT(*)
        INTO _cancels, _completed
        FROM public.services
       WHERE provider_id = _r.provider_id
         AND created_at >= now() - interval '90 days';
      IF _completed > 0 THEN
        _anti_cancel := GREATEST(0, 1 - (_cancels::numeric / _completed));
      ELSE
        _anti_cancel := 0.5; -- neutro sem amostra
      END IF;

      -- proximidade: usa atividade recente (provider online %)
      SELECT CASE WHEN pa.is_online THEN 1 ELSE 0.3 END
        INTO _proximity
        FROM public.provider_availability pa
       WHERE pa.provider_id = _r.provider_id;
      _proximity := COALESCE(_proximity, 0.2);

      -- especialização: nº de categorias com serviços (normalizado)
      SELECT LEAST(COUNT(DISTINCT category_id)::numeric / 5.0, 1)
        INTO _spec_count
        FROM public.provider_services WHERE provider_id = _r.provider_id;
      _specialization := COALESCE(_spec_count, 0);

      -- recorrência: clientes únicos que reservaram >=2 vezes
      SELECT LEAST(COUNT(*)::numeric / 20.0, 1)
        INTO _recur_count
        FROM (
          SELECT client_id, COUNT(*) c
          FROM public.services
          WHERE provider_id = _r.provider_id AND status IN ('completed','confirmed')
          GROUP BY client_id HAVING COUNT(*) >= 2
        ) x;
      _recurrence := COALESCE(_recur_count, 0);

      _total :=
        _rating          * COALESCE(_w.w_reputation,0)
      + _anti_cancel     * COALESCE(_w.w_anti_cancel, 10)
      + _proximity       * COALESCE(_w.w_distance,0)
      + _specialization  * COALESCE(_w.w_specialization,0)
      + _recurrence      * COALESCE(_w.w_recurrence,0);

      INSERT INTO public.provider_ranking_scores AS prs (
        provider_id, score_total, score_rating, score_anti_cancel,
        score_proximity, score_specialization, score_recurrence,
        sample_size, computed_at, updated_at
      ) VALUES (
        _r.provider_id, _total, _rating, _anti_cancel,
        _proximity, _specialization, _recurrence,
        _samples, now(), now()
      )
      ON CONFLICT (provider_id) DO UPDATE SET
        score_total = EXCLUDED.score_total,
        score_rating = EXCLUDED.score_rating,
        score_anti_cancel = EXCLUDED.score_anti_cancel,
        score_proximity = EXCLUDED.score_proximity,
        score_specialization = EXCLUDED.score_specialization,
        score_recurrence = EXCLUDED.score_recurrence,
        sample_size = EXCLUDED.sample_size,
        computed_at = EXCLUDED.computed_at,
        updated_at = now();

      _count := _count + 1;
    END;
  END LOOP;

  RETURN _count;
END $$;

REVOKE EXECUTE ON FUNCTION public.recompute_provider_ranking(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recompute_provider_ranking(uuid) TO authenticated, service_role;

-- Cron horário (executa para todos)
DO $$
DECLARE _jobid bigint;
BEGIN
  SELECT jobid INTO _jobid FROM cron.job WHERE jobname = 'recompute-provider-ranking-hourly';
  IF _jobid IS NOT NULL THEN PERFORM cron.unschedule(_jobid); END IF;
END $$;

SELECT cron.schedule(
  'recompute-provider-ranking-hourly',
  '5 * * * *',
  $$SELECT public.recompute_provider_ranking(NULL);$$
);
