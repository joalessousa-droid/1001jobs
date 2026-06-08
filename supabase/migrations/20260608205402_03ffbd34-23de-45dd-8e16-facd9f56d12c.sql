
-- ============ Profile flags for blocking + cached scores ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS blocked_at timestamptz,
  ADD COLUMN IF NOT EXISTS blocked_reason text,
  ADD COLUMN IF NOT EXISTS fraud_score int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS provider_score int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS provider_tier text,
  ADD COLUMN IF NOT EXISTS client_score int NOT NULL DEFAULT 500;

-- ============ MODULE 13 — Dynamic Pricing ============
CREATE TABLE IF NOT EXISTS public.dynamic_pricing_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL DEFAULT 'global',          -- 'global' | 'category' | 'city'
  scope_value text,
  min_multiplier numeric(4,2) NOT NULL DEFAULT 0.80,
  max_multiplier numeric(4,2) NOT NULL DEFAULT 2.50,
  demand_weight numeric(4,2) NOT NULL DEFAULT 0.40,
  supply_weight numeric(4,2) NOT NULL DEFAULT 0.30,
  time_weight numeric(4,2) NOT NULL DEFAULT 0.15,
  region_weight numeric(4,2) NOT NULL DEFAULT 0.05,
  urgency_weight numeric(4,2) NOT NULL DEFAULT 0.10,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.dynamic_pricing_config TO authenticated, anon;
GRANT ALL ON public.dynamic_pricing_config TO service_role;
ALTER TABLE public.dynamic_pricing_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads pricing config" ON public.dynamic_pricing_config FOR SELECT USING (is_active);
CREATE POLICY "Admins manage pricing config" ON public.dynamic_pricing_config
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.dynamic_pricing_config (scope) VALUES ('global')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.calculate_dynamic_price(
  _base_price numeric,
  _category_id uuid DEFAULT NULL,
  _city text DEFAULT NULL,
  _urgency text DEFAULT 'normal'   -- 'low' | 'normal' | 'high' | 'critical'
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _cfg public.dynamic_pricing_config;
  _demand int := 0; _supply int := 0;
  _demand_factor numeric := 1.0; _supply_factor numeric := 1.0;
  _time_factor numeric := 1.0; _region_factor numeric := 1.0; _urgency_factor numeric := 1.0;
  _hour int := EXTRACT(hour FROM now() AT TIME ZONE 'America/Sao_Paulo')::int;
  _dow int := EXTRACT(dow FROM now() AT TIME ZONE 'America/Sao_Paulo')::int;
  _mult numeric;
BEGIN
  SELECT * INTO _cfg FROM public.dynamic_pricing_config
   WHERE is_active
     AND ((scope='category' AND scope_value = _category_id::text)
       OR (scope='city' AND lower(scope_value) = lower(COALESCE(_city,'')))
       OR scope='global')
   ORDER BY CASE scope WHEN 'category' THEN 1 WHEN 'city' THEN 2 ELSE 3 END
   LIMIT 1;

  IF _cfg.id IS NULL THEN
    RETURN jsonb_build_object('multiplier',1.0,'final_price',_base_price,'breakdown','{}'::jsonb,'note','no_config');
  END IF;

  SELECT COUNT(*) INTO _demand FROM public.service_requests
   WHERE created_at > now() - interval '60 minutes'
     AND (_category_id IS NULL OR category_id = _category_id)
     AND (_city IS NULL OR lower(city) = lower(_city));

  SELECT COUNT(*) INTO _supply FROM public.provider_availability
   WHERE is_online = true AND last_seen_at > now() - interval '5 minutes';

  -- factors normalize around 1.0
  _demand_factor := LEAST(2.5, 1.0 + (_demand::numeric / 20.0));      -- +0.05 per request
  _supply_factor := CASE WHEN _supply = 0 THEN 1.6
                         WHEN _supply >= 30 THEN 0.85
                         ELSE 1.0 + ((15 - LEAST(_supply,15))::numeric * 0.04) END;
  _time_factor := CASE
                    WHEN _hour BETWEEN 18 AND 22 THEN 1.20
                    WHEN _hour BETWEEN 0 AND 5 THEN 1.30
                    WHEN _dow IN (0,6) THEN 1.10
                    ELSE 1.0 END;
  _region_factor := 1.0;  -- placeholder for future regional traffic adjustment
  _urgency_factor := CASE COALESCE(_urgency,'normal')
                       WHEN 'low' THEN 0.95
                       WHEN 'high' THEN 1.20
                       WHEN 'critical' THEN 1.50
                       ELSE 1.0 END;

  _mult := 1.0
    + _cfg.demand_weight  * (_demand_factor - 1.0)
    + _cfg.supply_weight  * (_supply_factor - 1.0)
    + _cfg.time_weight    * (_time_factor - 1.0)
    + _cfg.region_weight  * (_region_factor - 1.0)
    + _cfg.urgency_weight * (_urgency_factor - 1.0);

  _mult := LEAST(_cfg.max_multiplier, GREATEST(_cfg.min_multiplier, _mult));

  RETURN jsonb_build_object(
    'multiplier', ROUND(_mult,2),
    'base_price', _base_price,
    'final_price', ROUND(_base_price * _mult, 2),
    'breakdown', jsonb_build_object(
      'demand', jsonb_build_object('count', _demand, 'factor', ROUND(_demand_factor,2), 'weight', _cfg.demand_weight),
      'supply', jsonb_build_object('online', _supply, 'factor', ROUND(_supply_factor,2), 'weight', _cfg.supply_weight),
      'time', jsonb_build_object('hour', _hour, 'dow', _dow, 'factor', ROUND(_time_factor,2), 'weight', _cfg.time_weight),
      'region', jsonb_build_object('city', _city, 'factor', ROUND(_region_factor,2), 'weight', _cfg.region_weight),
      'urgency', jsonb_build_object('level', _urgency, 'factor', _urgency_factor, 'weight', _cfg.urgency_weight)
    ),
    'limits', jsonb_build_object('min', _cfg.min_multiplier, 'max', _cfg.max_multiplier)
  );
END $$;
GRANT EXECUTE ON FUNCTION public.calculate_dynamic_price(numeric,uuid,text,text) TO anon, authenticated;

-- ============ MODULE 14 — Antifraud ============
CREATE TABLE IF NOT EXISTS public.fraud_scores (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  score int NOT NULL DEFAULT 0,
  risk_level text NOT NULL DEFAULT 'low',          -- low | medium | high
  signals jsonb NOT NULL DEFAULT '{}'::jsonb,
  auto_blocked boolean NOT NULL DEFAULT false,
  last_evaluated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.fraud_scores TO authenticated;
GRANT ALL ON public.fraud_scores TO service_role;
ALTER TABLE public.fraud_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read fraud_scores" ON public.fraud_scores
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Owner reads own fraud_score" ON public.fraud_scores
  FOR SELECT TO authenticated USING (public.is_profile_owner(profile_id));

CREATE OR REPLACE FUNCTION public.recalculate_fraud_score(_profile_id uuid)
RETURNS public.fraud_scores
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user uuid; _city text;
  _multi_acc int := 0; _ip_dupe int := 0; _cancel int := 0; _fake_rev int := 0; _geo_far int := 0;
  _score int := 0; _level text := 'low'; _signals jsonb;
  _row public.fraud_scores;
BEGIN
  SELECT user_id, city INTO _user, _city FROM public.profiles WHERE id = _profile_id;
  IF _user IS NULL THEN RAISE EXCEPTION 'profile not found'; END IF;

  -- 1) multiple accounts sharing a device fingerprint
  SELECT COUNT(DISTINCT df2.user_id) - 1 INTO _multi_acc
  FROM public.device_fingerprints df1
  JOIN public.device_fingerprints df2 ON df2.visitor_id = df1.visitor_id AND df2.user_id <> df1.user_id
  WHERE df1.user_id = _user;
  _multi_acc := GREATEST(_multi_acc, 0);

  -- 2) suspicious IP (shared by other users)
  SELECT COUNT(DISTINCT df2.user_id) INTO _ip_dupe
  FROM public.device_fingerprints df1
  JOIN public.device_fingerprints df2 ON df2.ip_address = df1.ip_address AND df2.user_id <> df1.user_id
  WHERE df1.user_id = _user AND df1.ip_address IS NOT NULL;

  -- 3) excessive cancellations (30d)
  SELECT COUNT(*) INTO _cancel FROM public.services
   WHERE (client_id = _profile_id OR provider_id = _profile_id)
     AND status IN ('cancelled_by_client','cancelled_by_provider')
     AND created_at > now() - interval '30 days';

  -- 4) fake/flagged reviews
  SELECT COUNT(*) INTO _fake_rev FROM public.review_fraud_logs
   WHERE reviewer_id = _profile_id OR reviewee_id = _profile_id;

  -- 5) geo anomaly (locations far from declared city)
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
    'geo_anomalies', _geo_far
  );

  INSERT INTO public.fraud_scores(profile_id, score, risk_level, signals, last_evaluated_at)
  VALUES (_profile_id, _score, _level, _signals, now())
  ON CONFLICT (profile_id) DO UPDATE
    SET score = EXCLUDED.score, risk_level = EXCLUDED.risk_level,
        signals = EXCLUDED.signals, last_evaluated_at = now(), updated_at = now()
  RETURNING * INTO _row;

  -- Auto-block on critical risk
  IF _score >= 85 THEN
    UPDATE public.profiles
       SET is_blocked = true, blocked_at = now(),
           blocked_reason = COALESCE(blocked_reason, 'auto: fraud_score=' || _score)
     WHERE id = _profile_id AND is_blocked = false;
    UPDATE public.fraud_scores SET auto_blocked = true WHERE profile_id = _profile_id;
    INSERT INTO public.audit_logs(action, entity_type, entity_id, details)
    VALUES ('fraud.auto_block','profile', _profile_id,
            jsonb_build_object('score', _score, 'signals', _signals));
  END IF;

  UPDATE public.profiles SET fraud_score = _score WHERE id = _profile_id;
  RETURN _row;
END $$;
GRANT EXECUTE ON FUNCTION public.recalculate_fraud_score(uuid) TO authenticated, service_role;

-- ============ MODULE 15 — Provider composite score ============
CREATE TABLE IF NOT EXISTS public.provider_composite_scores (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  score int NOT NULL DEFAULT 0,                 -- 0..1000
  tier text NOT NULL DEFAULT 'bronze',          -- bronze | silver | gold | diamond
  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_evaluated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.provider_composite_scores TO authenticated, anon;
GRANT ALL ON public.provider_composite_scores TO service_role;
ALTER TABLE public.provider_composite_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads provider scores" ON public.provider_composite_scores
  FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.recalculate_provider_score(_profile_id uuid)
RETURNS public.provider_composite_scores
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _avg_rating numeric := 0; _total_rev int := 0;
  _on_time_rate numeric := 0; _completed int := 0; _late int := 0;
  _cancel_rate numeric := 0; _cancellations int := 0; _total_svc int := 0;
  _recurring int := 0;
  _kyc_ok boolean := false;
  _rating_pts numeric; _ontime_pts numeric; _cancel_pts numeric; _rec_pts numeric; _doc_pts numeric;
  _score int; _tier text; _row public.provider_composite_scores;
BEGIN
  SELECT COALESCE(AVG(rating)::numeric,0), COUNT(*) INTO _avg_rating, _total_rev
    FROM public.reviews WHERE reviewee_id = _profile_id;

  SELECT COUNT(*) FILTER (WHERE status IN ('completed','confirmed')),
         COUNT(*) FILTER (WHERE status IN ('completed','confirmed') AND completed_at > scheduled_at + interval '15 minutes'),
         COUNT(*),
         COUNT(*) FILTER (WHERE status = 'cancelled_by_provider')
    INTO _completed, _late, _total_svc, _cancellations
    FROM public.services WHERE provider_id = _profile_id;

  _on_time_rate := CASE WHEN _completed = 0 THEN 0.9 ELSE (1.0 - LEAST(_late,_completed)::numeric / _completed) END;
  _cancel_rate := CASE WHEN _total_svc = 0 THEN 0 ELSE _cancellations::numeric / _total_svc END;

  SELECT COUNT(*) INTO _recurring
  FROM (SELECT client_id, COUNT(*) c FROM public.services
         WHERE provider_id = _profile_id AND status IN ('completed','confirmed')
         GROUP BY client_id HAVING COUNT(*) >= 2) t;

  SELECT EXISTS (SELECT 1 FROM public.kyc_submissions
                  WHERE profile_id = _profile_id AND status = 'approved') INTO _kyc_ok;

  _rating_pts := LEAST(400, (_avg_rating / 5.0) * 400);                   -- 40%
  _ontime_pts := _on_time_rate * 200;                                     -- 20%
  _cancel_pts := GREATEST(0, (1 - LEAST(_cancel_rate*5,1)) * 150);        -- 15%
  _rec_pts    := LEAST(150, _recurring * 15);                             -- 15%
  _doc_pts    := CASE WHEN _kyc_ok THEN 100 ELSE 0 END;                   -- 10%

  _score := LEAST(1000, ROUND(_rating_pts + _ontime_pts + _cancel_pts + _rec_pts + _doc_pts)::int);
  _tier := CASE WHEN _score >= 850 THEN 'diamond'
                WHEN _score >= 650 THEN 'gold'
                WHEN _score >= 400 THEN 'silver'
                ELSE 'bronze' END;

  INSERT INTO public.provider_composite_scores(profile_id, score, tier, breakdown, last_evaluated_at)
  VALUES (_profile_id, _score, _tier, jsonb_build_object(
    'avg_rating', _avg_rating, 'total_reviews', _total_rev,
    'on_time_rate', ROUND(_on_time_rate,3), 'completed', _completed, 'late', _late,
    'cancel_rate', ROUND(_cancel_rate,3), 'cancellations', _cancellations, 'total_services', _total_svc,
    'recurring_clients', _recurring, 'kyc_approved', _kyc_ok,
    'points', jsonb_build_object('rating',_rating_pts,'ontime',_ontime_pts,'cancel',_cancel_pts,'recurring',_rec_pts,'docs',_doc_pts)
  ), now())
  ON CONFLICT (profile_id) DO UPDATE
    SET score = EXCLUDED.score, tier = EXCLUDED.tier,
        breakdown = EXCLUDED.breakdown, last_evaluated_at = now(), updated_at = now()
  RETURNING * INTO _row;

  UPDATE public.profiles SET provider_score = _score, provider_tier = _tier WHERE id = _profile_id;
  RETURN _row;
END $$;
GRANT EXECUTE ON FUNCTION public.recalculate_provider_score(uuid) TO authenticated, service_role;

-- ============ MODULE 16 — Client internal score ============
CREATE TABLE IF NOT EXISTS public.client_internal_scores (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  score int NOT NULL DEFAULT 500,               -- 0..1000
  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_evaluated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.client_internal_scores TO authenticated;
GRANT ALL ON public.client_internal_scores TO service_role;
ALTER TABLE public.client_internal_scores ENABLE ROW LEVEL SECURITY;
-- internal only: admins
CREATE POLICY "Admins read client_internal_scores" ON public.client_internal_scores
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.recalculate_client_score(_profile_id uuid)
RETURNS public.client_internal_scores
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _paid_ok int := 0; _payment_fail int := 0;
  _cancellations int := 0; _total_svc int := 0;
  _reports int := 0;
  _avg_received numeric := 0; _rev_count int := 0;
  _score int; _row public.client_internal_scores;
BEGIN
  SELECT COUNT(*) FILTER (WHERE status = 'released'),
         COUNT(*) FILTER (WHERE status IN ('failed','refunded'))
    INTO _paid_ok, _payment_fail
  FROM public.service_payments sp
  JOIN public.services s ON s.id = sp.service_id
  WHERE s.client_id = _profile_id;

  SELECT COUNT(*) FILTER (WHERE status='cancelled_by_client'), COUNT(*)
    INTO _cancellations, _total_svc
    FROM public.services WHERE client_id = _profile_id;

  SELECT COUNT(*) INTO _reports FROM public.review_fraud_logs WHERE reviewer_id = _profile_id;

  SELECT COALESCE(AVG(rating),0), COUNT(*) INTO _avg_received, _rev_count
    FROM public.reviews WHERE reviewee_id = _profile_id;

  _score := 500
    + LEAST(200, _paid_ok * 10)
    - LEAST(150, _payment_fail * 30)
    - LEAST(200, _cancellations * 15)
    - LEAST(200, _reports * 25)
    + CASE WHEN _rev_count > 0 THEN ROUND((_avg_received/5.0)*150)::int ELSE 0 END;

  _score := GREATEST(0, LEAST(1000, _score));

  INSERT INTO public.client_internal_scores(profile_id, score, breakdown, last_evaluated_at)
  VALUES (_profile_id, _score, jsonb_build_object(
    'payments_ok', _paid_ok, 'payment_failures', _payment_fail,
    'cancellations', _cancellations, 'total_services', _total_svc,
    'reports', _reports, 'avg_received_rating', _avg_received, 'reviews_received', _rev_count
  ), now())
  ON CONFLICT (profile_id) DO UPDATE
    SET score = EXCLUDED.score, breakdown = EXCLUDED.breakdown,
        last_evaluated_at = now(), updated_at = now()
  RETURNING * INTO _row;

  UPDATE public.profiles SET client_score = _score WHERE id = _profile_id;
  RETURN _row;
END $$;
GRANT EXECUTE ON FUNCTION public.recalculate_client_score(uuid) TO authenticated, service_role;

-- ============ Update triggers ============
CREATE OR REPLACE TRIGGER trg_dynamic_pricing_config_updated_at
BEFORE UPDATE ON public.dynamic_pricing_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_fraud_scores_updated_at
BEFORE UPDATE ON public.fraud_scores
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_provider_composite_scores_updated_at
BEFORE UPDATE ON public.provider_composite_scores
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_client_internal_scores_updated_at
BEFORE UPDATE ON public.client_internal_scores
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
