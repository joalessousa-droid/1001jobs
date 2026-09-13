
-- =========================================================
-- 1) Ciclo de feedback real: avaliação -> reputação -> ranking -> IA
-- =========================================================
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
       SET provider_score = v_score,
           provider_tier  = v_tier,
           updated_at     = now()
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

  -- alimenta o aprendizado da IA quando existe predição para o serviço
  IF r.completed_service_id IS NOT NULL THEN
    SELECT id INTO v_pred_id
    FROM public.ai_predictions
    WHERE service_id = r.completed_service_id
    ORDER BY created_at DESC LIMIT 1;

    IF v_pred_id IS NOT NULL THEN
      INSERT INTO public.ai_outcomes (prediction_id, service_id, client_feedback, outcome)
      VALUES (
        v_pred_id,
        r.completed_service_id,
        jsonb_build_object('rating', r.rating, 'comment', r.comment, 'review_id', r.id),
        CASE WHEN r.rating >= 4 THEN 'confirmed' WHEN r.rating = 3 THEN 'partial' ELSE 'rejected' END
      );
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'profile_id', r.reviewed_id, 'avg', v_avg,
                            'reviews', v_count, 'score', v_score, 'tier', v_tier);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_review_feedback(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.apply_review_feedback(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.trg_review_feedback()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(NEW.is_published, true) AND coalesce(NEW.is_shadow, false) = false THEN
    PERFORM public.apply_review_feedback(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reviews_apply_feedback ON public.reviews;
CREATE TRIGGER reviews_apply_feedback
AFTER INSERT OR UPDATE OF rating, is_published, is_shadow ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.trg_review_feedback();

-- =========================================================
-- 2) Administração real: pessoas
-- =========================================================
CREATE OR REPLACE FUNCTION public.admin_list_profiles(
  _user_type text DEFAULT NULL,
  _search text DEFAULT NULL,
  _city text DEFAULT NULL,
  _include_synthetic boolean DEFAULT true,
  _limit integer DEFAULT 200,
  _offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid, user_id uuid, user_type text, display_name text, bio text, phone text,
  city text, state text, avatar_url text, is_active boolean, is_blocked boolean,
  blocked_reason text, is_synthetic boolean, synthetic_expires_at timestamptz,
  verification_status text, provider_score integer, provider_tier text,
  client_score integer, fraud_score integer, total_reviews integer,
  avg_rating numeric, created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.user_id, p.user_type::text, p.display_name, p.bio, p.phone,
         p.city, p.state, p.avatar_url, coalesce(p.is_active, true), coalesce(p.is_blocked, false),
         p.blocked_reason, coalesce(p.is_synthetic, false), p.synthetic_expires_at,
         p.verification_status::text, p.provider_score, p.provider_tier,
         p.client_score, p.fraud_score,
         coalesce(rs.total_reviews, 0), coalesce(rs.weighted_score, 0), p.created_at
  FROM public.profiles p
  LEFT JOIN public.reputation_scores rs ON rs.profile_id = p.id
  WHERE public.ai_is_staff()
    AND (_user_type IS NULL OR p.user_type::text = _user_type)
    AND (_city IS NULL OR _city = '' OR p.city ILIKE '%' || _city || '%')
    AND (_include_synthetic OR coalesce(p.is_synthetic, false) = false)
    AND (
      _search IS NULL OR _search = ''
      OR p.display_name ILIKE '%' || _search || '%'
      OR coalesce(p.phone, '') ILIKE '%' || _search || '%'
      OR coalesce(p.city, '')  ILIKE '%' || _search || '%'
      OR p.id::text = _search
    )
  ORDER BY p.created_at DESC
  LIMIT greatest(1, least(coalesce(_limit, 200), 500))
  OFFSET greatest(0, coalesce(_offset, 0));
$$;

REVOKE ALL ON FUNCTION public.admin_list_profiles(text, text, text, boolean, integer, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_profiles(text, text, text, boolean, integer, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_upsert_profile(
  _id uuid,
  _user_type text,
  _display_name text,
  _bio text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _city text DEFAULT NULL,
  _state text DEFAULT NULL,
  _avatar_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.ai_is_staff() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF coalesce(trim(_display_name), '') = '' THEN RAISE EXCEPTION 'display_name obrigatorio'; END IF;

  IF _id IS NULL THEN
    INSERT INTO public.profiles (user_type, display_name, bio, phone, city, state, avatar_url, is_active)
    VALUES (coalesce(_user_type, 'client')::public.user_type, trim(_display_name), _bio, _phone, _city, _state, _avatar_url, true)
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.profiles
       SET display_name = trim(_display_name),
           bio = _bio, phone = _phone, city = _city, state = _state,
           avatar_url = _avatar_url,
           user_type = coalesce(_user_type, user_type::text)::public.user_type,
           updated_at = now()
     WHERE id = _id
     RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_upsert_profile(uuid, text, text, text, text, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_profile(uuid, text, text, text, text, text, text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_set_profile_blocked(
  _profile_id uuid, _blocked boolean, _reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.ai_is_staff() THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.profiles
     SET is_blocked = _blocked,
         blocked_at = CASE WHEN _blocked THEN now() ELSE NULL END,
         blocked_reason = CASE WHEN _blocked THEN _reason ELSE NULL END,
         is_active = CASE WHEN _blocked THEN false ELSE is_active END,
         updated_at = now()
   WHERE id = _profile_id;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_profile_blocked(uuid, boolean, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_profile_blocked(uuid, boolean, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_delete_profile(_profile_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.ai_is_staff() THEN RAISE EXCEPTION 'forbidden'; END IF;
  DELETE FROM public.profiles WHERE id = _profile_id;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_profile(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_profile(uuid) TO authenticated, service_role;

-- =========================================================
-- 3) Administração real: tarefas
-- =========================================================
CREATE OR REPLACE FUNCTION public.admin_list_tasks(
  _status text DEFAULT NULL,
  _city text DEFAULT NULL,
  _category_id uuid DEFAULT NULL,
  _origin text DEFAULT NULL,
  _search text DEFAULT NULL,
  _limit integer DEFAULT 200,
  _offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid, description text, requester_name text, profile_id uuid,
  category_id uuid, category_name text, city text, state text,
  budget numeric, urgency text, origin text, status text,
  computed_status text, is_synthetic boolean, synthetic_expires_at timestamptz,
  is_active boolean, service_id uuid, created_at timestamptz, updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT sr.*, c.name AS category_name,
      CASE
        WHEN sr.is_synthetic AND sr.synthetic_expires_at IS NOT NULL AND sr.synthetic_expires_at < now() THEN 'expirada'
        WHEN sr.status::text IN ('closed') THEN 'concluida'
        WHEN sr.status::text IN ('cancelled') THEN 'expirada'
        WHEN sr.status::text = 'assigned' OR sr.service_id IS NOT NULL THEN 'agendada'
        WHEN coalesce(sr.is_active, true) = false THEN 'expirada'
        ELSE 'aberta'
      END AS computed_status
    FROM public.service_requests sr
    LEFT JOIN public.service_categories c ON c.id = sr.category_id
    WHERE public.ai_is_staff()
  )
  SELECT b.id, b.description, b.requester_name, b.profile_id,
         b.category_id, b.category_name, b.city, b.state,
         b.budget, b.urgency, coalesce(b.origin, 'standard'), b.status::text,
         b.computed_status, coalesce(b.is_synthetic, false), b.synthetic_expires_at,
         coalesce(b.is_active, true), b.service_id, b.created_at, b.updated_at
  FROM base b
  WHERE (_status IS NULL OR _status = '' OR b.computed_status = _status)
    AND (_city IS NULL OR _city = '' OR b.city ILIKE '%' || _city || '%')
    AND (_category_id IS NULL OR b.category_id = _category_id)
    AND (_origin IS NULL OR _origin = '' OR coalesce(b.origin, 'standard') = _origin)
    AND (_search IS NULL OR _search = ''
         OR b.description ILIKE '%' || _search || '%'
         OR coalesce(b.requester_name, '') ILIKE '%' || _search || '%'
         OR b.id::text = _search)
  ORDER BY b.created_at DESC
  LIMIT greatest(1, least(coalesce(_limit, 200), 500))
  OFFSET greatest(0, coalesce(_offset, 0));
$$;

REVOKE ALL ON FUNCTION public.admin_list_tasks(text, text, uuid, text, text, integer, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_tasks(text, text, uuid, text, text, integer, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_set_task_active(_task_id uuid, _active boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.ai_is_staff() THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.service_requests SET is_active = _active, updated_at = now() WHERE id = _task_id;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_task_active(uuid, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_task_active(uuid, boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_delete_task(_task_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.ai_is_staff() THEN RAISE EXCEPTION 'forbidden'; END IF;
  DELETE FROM public.service_requests WHERE id = _task_id;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_task(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_task(uuid) TO authenticated, service_role;

-- =========================================================
-- 4) Relatório de segurança
-- =========================================================
CREATE OR REPLACE FUNCTION public.admin_security_report()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.ai_is_staff() THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT jsonb_build_object(
    'generated_at', now(),
    'totals', jsonb_build_object(
      'profiles', (SELECT count(*) FROM public.profiles),
      'public_profiles', (SELECT count(*) FROM public.profiles WHERE coalesce(is_active, true) AND coalesce(is_blocked, false) = false),
      'synthetic_profiles', (SELECT count(*) FROM public.profiles WHERE coalesce(is_synthetic, false)),
      'blocked_profiles', (SELECT count(*) FROM public.profiles WHERE coalesce(is_blocked, false)),
      'tasks', (SELECT count(*) FROM public.service_requests),
      'synthetic_tasks', (SELECT count(*) FROM public.service_requests WHERE coalesce(is_synthetic, false)),
      'expired_tasks', (SELECT count(*) FROM public.service_requests
                         WHERE (synthetic_expires_at IS NOT NULL AND synthetic_expires_at < now())
                            OR coalesce(is_active, true) = false),
      'high_fraud_profiles', (SELECT count(*) FROM public.profiles WHERE coalesce(fraud_score, 0) >= 70)
    ),
    'public_profiles', coalesce((
      SELECT jsonb_agg(x) FROM (
        SELECT p.id, p.display_name, p.user_type::text AS user_type, p.city, p.state,
               coalesce(p.is_synthetic, false) AS is_synthetic,
               coalesce(p.is_blocked, false) AS is_blocked,
               coalesce(p.fraud_score, 0) AS fraud_score,
               p.verification_status::text AS verification_status,
               p.created_at
        FROM public.profiles p
        WHERE coalesce(p.is_active, true)
        ORDER BY coalesce(p.fraud_score, 0) DESC, p.created_at DESC
        LIMIT 100
      ) x), '[]'::jsonb),
    'synthetic_tasks', coalesce((
      SELECT jsonb_agg(x) FROM (
        SELECT sr.id, sr.description, sr.city, sr.state, coalesce(sr.origin, 'standard') AS origin,
               sr.synthetic_expires_at, sr.created_at, coalesce(sr.is_active, true) AS is_active
        FROM public.service_requests sr
        WHERE coalesce(sr.is_synthetic, false)
        ORDER BY sr.created_at DESC
        LIMIT 100
      ) x), '[]'::jsonb),
    'expired_tasks', coalesce((
      SELECT jsonb_agg(x) FROM (
        SELECT sr.id, sr.description, sr.city, sr.state, coalesce(sr.origin, 'standard') AS origin,
               sr.synthetic_expires_at, sr.created_at, coalesce(sr.is_synthetic, false) AS is_synthetic
        FROM public.service_requests sr
        WHERE (sr.synthetic_expires_at IS NOT NULL AND sr.synthetic_expires_at < now())
           OR coalesce(sr.is_active, true) = false
        ORDER BY sr.created_at DESC
        LIMIT 100
      ) x), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_security_report() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_security_report() TO authenticated, service_role;
