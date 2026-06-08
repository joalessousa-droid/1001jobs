
CREATE TABLE IF NOT EXISTS public.app_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  kyc_auto_reprocess_on_decide boolean NOT NULL DEFAULT true,
  cpf_check_max_attempts integer NOT NULL DEFAULT 3,
  cpf_check_timeout_ms integer NOT NULL DEFAULT 4000,
  cpf_check_backoff_base_ms integer NOT NULL DEFAULT 400,
  dispatch_ranking_boost_weight numeric NOT NULL DEFAULT 0.10,
  dispatch_ranking_boost_max numeric NOT NULL DEFAULT 10,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT ON public.app_settings TO authenticated;
GRANT UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_settings_read_auth" ON public.app_settings;
CREATE POLICY "app_settings_read_auth" ON public.app_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "app_settings_update_admin" ON public.app_settings;
CREATE POLICY "app_settings_update_admin" ON public.app_settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.app_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_kyc_audit_trail(
  _from timestamptz,
  _to timestamptz,
  _city text DEFAULT NULL,
  _action text DEFAULT NULL
) RETURNS TABLE (
  created_at timestamptz,
  action text,
  entity_id uuid,
  user_id uuid,
  city text,
  details jsonb
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.created_at, a.action, a.entity_id, a.user_id,
         COALESCE(p.city, '') AS city,
         a.details
  FROM public.audit_logs a
  LEFT JOIN public.kyc_submissions s ON s.id = a.entity_id
  LEFT JOIN public.profiles p ON p.id = s.profile_id
  WHERE a.created_at BETWEEN _from AND _to
    AND a.action IN ('kyc.decide_auto_reprocess','kyc.batch_reprocess_started','kyc.batch_reprocess_finished','kyc.batch_reprocess_item')
    AND (_action IS NULL OR a.action = _action)
    AND (_city IS NULL OR p.city = _city)
    AND public.has_role(auth.uid(), 'admin')
  ORDER BY a.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_kyc_audit_trail(timestamptz, timestamptz, text, text) TO authenticated;
