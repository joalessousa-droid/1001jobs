
-- ============ Price quotes (lock pricing for short window) ============
CREATE TABLE IF NOT EXISTS public.price_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  category_id uuid,
  city text,
  urgency text NOT NULL DEFAULT 'normal',
  base_price numeric(12,2) NOT NULL,
  multiplier numeric(6,3) NOT NULL,
  final_price numeric(12,2) NOT NULL,
  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  service_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.price_quotes TO authenticated;
GRANT ALL ON public.price_quotes TO service_role;
ALTER TABLE public.price_quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own quotes" ON public.price_quotes
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users insert own quotes" ON public.price_quotes
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owner updates own quotes" ON public.price_quotes
  FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE INDEX IF NOT EXISTS idx_price_quotes_user_exp ON public.price_quotes(user_id, expires_at DESC);

-- Quote a dynamic price and persist for short window
CREATE OR REPLACE FUNCTION public.quote_dynamic_price(
  _base_price numeric,
  _category_id uuid DEFAULT NULL,
  _city text DEFAULT NULL,
  _urgency text DEFAULT 'normal',
  _ttl_minutes int DEFAULT 10
) RETURNS public.price_quotes
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _calc jsonb;
  _row public.price_quotes;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  _calc := public.calculate_dynamic_price(_base_price, _category_id, _city, COALESCE(_urgency,'normal'));
  INSERT INTO public.price_quotes(
    user_id, category_id, city, urgency, base_price,
    multiplier, final_price, breakdown, expires_at
  ) VALUES (
    auth.uid(), _category_id, _city, COALESCE(_urgency,'normal'),
    _base_price,
    COALESCE((_calc->>'multiplier')::numeric, 1.0),
    COALESCE((_calc->>'final_price')::numeric, _base_price),
    COALESCE(_calc->'breakdown', '{}'::jsonb),
    now() + make_interval(mins => GREATEST(1, LEAST(_ttl_minutes, 60)))
  ) RETURNING * INTO _row;
  RETURN _row;
END $$;
GRANT EXECUTE ON FUNCTION public.quote_dynamic_price(numeric,uuid,text,text,int) TO authenticated;

-- Confirm a quote (returns it if valid, else raises)
CREATE OR REPLACE FUNCTION public.confirm_price_quote(_quote_id uuid, _service_id uuid DEFAULT NULL)
RETURNS public.price_quotes
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _row public.price_quotes;
BEGIN
  SELECT * INTO _row FROM public.price_quotes WHERE id = _quote_id;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'quote_not_found'; END IF;
  IF _row.user_id <> auth.uid() AND NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _row.consumed_at IS NOT NULL THEN RAISE EXCEPTION 'quote_already_used'; END IF;
  IF _row.expires_at < now() THEN RAISE EXCEPTION 'quote_expired'; END IF;
  UPDATE public.price_quotes
     SET consumed_at = now(), service_id = COALESCE(_service_id, service_id)
   WHERE id = _quote_id
   RETURNING * INTO _row;
  RETURN _row;
END $$;
GRANT EXECUTE ON FUNCTION public.confirm_price_quote(uuid,uuid) TO authenticated;

-- ============ Antifraud audit trail ============
CREATE TABLE IF NOT EXISTS public.fraud_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  triggered_by uuid,                  -- admin/user that initiated, if any
  trigger_source text NOT NULL DEFAULT 'manual',  -- manual | cron | trigger | signup
  score_before int,
  score_after int NOT NULL,
  risk_level text NOT NULL,
  signals jsonb NOT NULL DEFAULT '{}'::jsonb,
  auto_blocked boolean NOT NULL DEFAULT false,
  block_reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.fraud_audit_log TO authenticated;
GRANT ALL ON public.fraud_audit_log TO service_role;
ALTER TABLE public.fraud_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read fraud_audit_log" ON public.fraud_audit_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Service writes fraud_audit_log" ON public.fraud_audit_log
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX IF NOT EXISTS idx_fraud_audit_profile_created
  ON public.fraud_audit_log(profile_id, created_at DESC);

-- Patch recalculate_fraud_score: write audit entry on every recalculation
CREATE OR REPLACE FUNCTION public.recalculate_fraud_score(_profile_id uuid)
RETURNS public.fraud_scores
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user uuid; _city text;
  _multi_acc int := 0; _ip_dupe int := 0; _cancel int := 0; _fake_rev int := 0; _geo_far int := 0;
  _score int := 0; _level text := 'low'; _signals jsonb;
  _row public.fraud_scores;
  _prev int;
  _block_reason text;
BEGIN
  SELECT user_id, city INTO _user, _city FROM public.profiles WHERE id = _profile_id;
  IF _user IS NULL THEN RAISE EXCEPTION 'profile not found'; END IF;

  SELECT score INTO _prev FROM public.fraud_scores WHERE profile_id = _profile_id;

  SELECT COUNT(DISTINCT df2.user_id) - 1 INTO _multi_acc
  FROM public.device_fingerprints df1
  JOIN public.device_fingerprints df2 ON df2.visitor_id = df1.visitor_id AND df2.user_id <> df1.user_id
  WHERE df1.user_id = _user;
  _multi_acc := GREATEST(_multi_acc, 0);

  SELECT COUNT(DISTINCT df2.user_id) INTO _ip_dupe
  FROM public.device_fingerprints df1
  JOIN public.device_fingerprints df2 ON df2.ip_address = df1.ip_address AND df2.user_id <> df1.user_id
  WHERE df1.user_id = _user AND df1.ip_address IS NOT NULL;

  SELECT COUNT(*) INTO _cancel FROM public.services
   WHERE (client_id = _profile_id OR provider_id = _profile_id)
     AND status IN ('cancelled_by_client','cancelled_by_provider')
     AND created_at > now() - interval '30 days';

  SELECT COUNT(*) INTO _fake_rev FROM public.review_fraud_logs
   WHERE reviewer_id = _profile_id OR reviewee_id = _profile_id;

  SELECT COUNT(*) INTO _geo_far FROM public.device_fingerprints
   WHERE user_id = _user AND city IS NOT NULL AND _city IS NOT NULL
     AND lower(city) <> lower(_city);

  _score := LEAST(100,
       _multi_acc * 25
     + LEAST(_ip_dupe,5) * 8
     + LEAST(_cancel,10) * 4
     + LEAST(_fake_rev,5) * 12
     + LEAST(_geo_far,5) * 4);

  _level := CASE WHEN _score >= 70 THEN 'high'
                 WHEN _score >= 35 THEN 'medium'
                 ELSE 'low' END;

  _signals := jsonb_build_object(
    'multi_accounts', _multi_acc,
    'shared_ip_users', _ip_dupe,
    'cancellations_30d', _cancel,
    'review_fraud_logs', _fake_rev,
    'geo_anomalies', _geo_far,
    'contributions', jsonb_build_object(
      'multi_accounts',   _multi_acc * 25,
      'shared_ip_users',  LEAST(_ip_dupe,5) * 8,
      'cancellations_30d',LEAST(_cancel,10) * 4,
      'review_fraud_logs',LEAST(_fake_rev,5) * 12,
      'geo_anomalies',    LEAST(_geo_far,5) * 4
    )
  );

  INSERT INTO public.fraud_scores(profile_id, score, risk_level, signals, last_evaluated_at)
  VALUES (_profile_id, _score, _level, _signals, now())
  ON CONFLICT (profile_id) DO UPDATE
    SET score = EXCLUDED.score, risk_level = EXCLUDED.risk_level,
        signals = EXCLUDED.signals, last_evaluated_at = now(), updated_at = now()
  RETURNING * INTO _row;

  IF _score >= 85 THEN
    _block_reason := 'auto: fraud_score=' || _score
      || ' (multi_accounts=' || _multi_acc
      || ', shared_ip=' || _ip_dupe
      || ', cancels=' || _cancel
      || ', review_fraud=' || _fake_rev
      || ', geo=' || _geo_far || ')';
    UPDATE public.profiles
       SET is_blocked = true, blocked_at = now(),
           blocked_reason = COALESCE(blocked_reason, _block_reason)
     WHERE id = _profile_id AND is_blocked = false;
    UPDATE public.fraud_scores SET auto_blocked = true WHERE profile_id = _profile_id;
    INSERT INTO public.audit_logs(action, entity_type, entity_id, details)
    VALUES ('fraud.auto_block','profile', _profile_id,
            jsonb_build_object('score', _score, 'signals', _signals, 'reason', _block_reason));
  END IF;

  UPDATE public.profiles SET fraud_score = _score WHERE id = _profile_id;

  INSERT INTO public.fraud_audit_log(
    profile_id, triggered_by, trigger_source,
    score_before, score_after, risk_level,
    signals, auto_blocked, block_reason
  ) VALUES (
    _profile_id, auth.uid(), 'manual',
    _prev, _score, _level,
    _signals, (_score >= 85), _block_reason
  );

  RETURN _row;
END $$;
GRANT EXECUTE ON FUNCTION public.recalculate_fraud_score(uuid) TO authenticated, service_role;

-- Admin unblock helper
CREATE OR REPLACE FUNCTION public.admin_unblock_profile(_profile_id uuid, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  UPDATE public.profiles
     SET is_blocked = false, blocked_at = NULL, blocked_reason = NULL
   WHERE id = _profile_id;
  UPDATE public.fraud_scores SET auto_blocked = false WHERE profile_id = _profile_id;
  INSERT INTO public.audit_logs(action, entity_type, entity_id, details, user_id)
  VALUES ('fraud.manual_unblock','profile', _profile_id,
          jsonb_build_object('reason', COALESCE(_reason,'manual unblock')), auth.uid());
  INSERT INTO public.fraud_audit_log(
    profile_id, triggered_by, trigger_source,
    score_before, score_after, risk_level,
    signals, auto_blocked, block_reason, notes
  )
  SELECT profile_id, auth.uid(), 'unblock',
         score, score, risk_level, signals, false, NULL,
         COALESCE(_reason,'manual unblock')
    FROM public.fraud_scores WHERE profile_id = _profile_id;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_unblock_profile(uuid,text) TO authenticated;
