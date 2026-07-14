
CREATE OR REPLACE FUNCTION public.expire_synthetic_batch(_scope text DEFAULT 'all', _limit int DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prof_ids uuid[];
  req_ids uuid[];
  prof_count int := 0;
  req_count int := 0;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _scope IN ('all','requests') THEN
    SELECT array_agg(id) INTO req_ids FROM (
      SELECT id FROM public.service_requests
      WHERE is_synthetic = true
      ORDER BY synthetic_expires_at NULLS FIRST
      LIMIT _limit
    ) t;
    IF req_ids IS NOT NULL THEN
      DELETE FROM public.service_requests WHERE id = ANY(req_ids);
      req_count := array_length(req_ids, 1);
    END IF;
  END IF;

  IF _scope IN ('all','profiles') THEN
    SELECT array_agg(id) INTO prof_ids FROM (
      SELECT id FROM public.profiles
      WHERE is_synthetic = true
      ORDER BY synthetic_expires_at NULLS FIRST
      LIMIT _limit
    ) t;
    IF prof_ids IS NOT NULL THEN
      DELETE FROM public.profiles WHERE id = ANY(prof_ids);
      prof_count := array_length(prof_ids, 1);
    END IF;
  END IF;

  INSERT INTO public.synthetic_bot_state(action, profiles_expired, requests_expired, notes)
  VALUES ('manual_expire', prof_count, req_count, format('scope=%s by=%s', _scope, auth.uid()));

  RETURN jsonb_build_object('profiles_expired', prof_count, 'requests_expired', req_count);
END;
$$;

REVOKE ALL ON FUNCTION public.expire_synthetic_batch(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_synthetic_batch(text, int) TO authenticated;
