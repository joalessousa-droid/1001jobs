
CREATE OR REPLACE FUNCTION public.apply_review_feedback(_review_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.reviews%ROWTYPE;
  v_avg numeric;
  v_count integer;
  v_disputes integer := 0;
  v_dispute_rate numeric := 0;
  v_score integer;
  v_tier text;
  v_is_provider boolean := false;
  v_pred_id uuid;
  v_service_id uuid;
  v_badges text[] := '{}';
BEGIN
  SELECT * INTO r FROM public.reviews WHERE id = _review_id;
  IF NOT FOUND OR r.reviewed_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'review_not_found');
  END IF;

  SELECT round(avg(rating)::numeric, 2), count(*)
    INTO v_avg, v_count
  FROM public.reviews
  WHERE reviewed_id = r.reviewed_id
    AND coalesce(is_published, true)
    AND coalesce(is_shadow, false) = false;

  v_avg := coalesce(v_avg, 0);
  v_count := coalesce(v_count, 0);

  BEGIN
    SELECT count(*) INTO v_disputes
    FROM public.service_disputes sd
    JOIN public.services s ON s.id = sd.service_id
    WHERE s.provider_id = r.reviewed_id OR s.client_id = r.reviewed_id;
  EXCEPTION WHEN OTHERS THEN
    v_disputes := 0;
  END;

  IF v_count > 0 THEN
    v_dispute_rate := round((v_disputes::numeric / v_count::numeric), 4);
  END IF;

  v_score := greatest(0, least(100, round((v_avg / 5.0) * 100 - (v_dispute_rate * 20))::int));

  v_tier := CASE
    WHEN v_count >= 20 AND v_score >= 90 THEN 'diamante'
    WHEN v_count >= 10 AND v_score >= 80 THEN 'ouro'
    WHEN v_count >= 5  AND v_score >= 70 THEN 'prata'
    ELSE 'bronze'
  END;

  IF v_avg >= 4.8 AND v_count >= 10 THEN v_badges := array_append(v_badges, 'excelencia'); END IF;
  IF v_dispute_rate = 0 AND v_count >= 5 THEN v_badges := array_append(v_badges, 'sem_disputas'); END IF;

  INSERT INTO public.reputation_scores
    (profile_id, weighted_score, total_reviews, total_disputes, dispute_rate, last_review_at, badges, score_breakdown, updated_at)
  VALUES
    (r.reviewed_id, v_avg, v_count, v_disputes, v_dispute_rate, coalesce(r.created_at, now()), v_badges,
     jsonb_build_object('avg_rating', v_avg, 'reviews', v_count, 'dispute_rate', v_dispute_rate, 'score_0_100', v_score), now())
  ON CONFLICT (profile_id) DO UPDATE SET
    weighted_score = EXCLUDED.weighted_score,
    total_reviews  = EXCLUDED.total_reviews,
    total_disputes = EXCLUDED.total_disputes,
    dispute_rate   = EXCLUDED.dispute_rate,
    last_review_at = EXCLUDED.last_review_at,
    badges         = EXCLUDED.badges,
    score_breakdown= EXCLUDED.score_breakdown,
    updated_at     = now();

  SELECT (user_type = 'provider') INTO v_is_provider FROM public.profiles WHERE id = r.reviewed_id;

  IF coalesce(v_is_provider, false) THEN
    UPDATE public.profiles
       SET provider_score = v_score, provider_tier = v_tier, updated_at = now()
     WHERE id = r.reviewed_id;

    INSERT INTO public.provider_ranking_scores (provider_id, score_rating, score_total, sample_size, computed_at, updated_at)
    VALUES (r.reviewed_id, round(v_avg / 5.0, 4), round(v_avg / 5.0, 4), v_count, now(), now())
    ON CONFLICT (provider_id) DO UPDATE SET
      score_rating = round(v_avg / 5.0, 4),
      score_total  = round(
        0.40 * (v_avg / 5.0)
        + 0.20 * coalesce(public.provider_ranking_scores.score_anti_cancel, 0)
        + 0.15 * coalesce(public.provider_ranking_scores.score_proximity, 0)
        + 0.15 * coalesce(public.provider_ranking_scores.score_specialization, 0)
        + 0.10 * coalesce(public.provider_ranking_scores.score_recurrence, 0), 4),
      sample_size  = v_count,
      computed_at  = now(),
      updated_at   = now();
  ELSE
    UPDATE public.profiles SET client_score = v_score, updated_at = now() WHERE id = r.reviewed_id;
  END IF;

  IF r.completed_service_id IS NOT NULL THEN
    SELECT cs.service_id INTO v_service_id
    FROM public.completed_services cs WHERE cs.id = r.completed_service_id;

    IF v_service_id IS NOT NULL THEN
      SELECT id INTO v_pred_id
      FROM public.ai_predictions WHERE service_id = v_service_id
      ORDER BY created_at DESC LIMIT 1;

      IF v_pred_id IS NOT NULL THEN
        INSERT INTO public.ai_outcomes (prediction_id, service_id, client_feedback, outcome)
        VALUES (
          v_pred_id, v_service_id,
          jsonb_build_object('rating', r.rating, 'comment', r.comment, 'review_id', r.id),
          CASE WHEN r.rating >= 4 THEN 'confirmed' WHEN r.rating = 3 THEN 'partial' ELSE 'rejected' END
        );
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'profile_id', r.reviewed_id, 'avg', v_avg,
                            'reviews', v_count, 'score', v_score, 'tier', v_tier);
END;
$$;
