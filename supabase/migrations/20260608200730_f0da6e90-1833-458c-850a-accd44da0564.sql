
-- 1) Audit trigger for app_settings changes
CREATE OR REPLACE FUNCTION public.log_app_settings_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _changes jsonb := '{}'::jsonb; _k text;
BEGIN
  FOR _k IN SELECT jsonb_object_keys(to_jsonb(NEW)) LOOP
    IF _k IN ('updated_at','updated_by','id') THEN CONTINUE; END IF;
    IF to_jsonb(NEW)->_k IS DISTINCT FROM to_jsonb(OLD)->_k THEN
      _changes := _changes || jsonb_build_object(_k, jsonb_build_object(
        'old', to_jsonb(OLD)->_k, 'new', to_jsonb(NEW)->_k
      ));
    END IF;
  END LOOP;

  IF _changes <> '{}'::jsonb THEN
    NEW.updated_at := now();
    NEW.updated_by := auth.uid();
    INSERT INTO public.audit_logs(action, entity_type, entity_id, user_id, details)
    VALUES ('app_settings.update', 'app_settings', NULL, auth.uid(),
            jsonb_build_object('changes', _changes, 'at', now()));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_app_settings_audit ON public.app_settings;
CREATE TRIGGER trg_app_settings_audit
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.log_app_settings_change();

-- 2) Paginated audit-trail RPC + count
CREATE OR REPLACE FUNCTION public.get_kyc_audit_trail(
  _from timestamptz, _to timestamptz,
  _city text DEFAULT NULL, _action text DEFAULT NULL,
  _limit integer DEFAULT 500, _offset integer DEFAULT 0
) RETURNS TABLE (
  created_at timestamptz, action text, entity_id uuid, user_id uuid, city text, details jsonb
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.created_at, a.action, a.entity_id, a.user_id,
         COALESCE(p.city, '') AS city, a.details
  FROM public.audit_logs a
  LEFT JOIN public.kyc_submissions s ON s.id = a.entity_id
  LEFT JOIN public.profiles p ON p.id = s.profile_id
  WHERE a.created_at BETWEEN _from AND _to
    AND a.action IN ('kyc.decide_auto_reprocess','kyc.batch_reprocess_started',
                     'kyc.batch_reprocess_finished','kyc.batch_reprocess_item')
    AND (_action IS NULL OR a.action = _action)
    AND (_city IS NULL OR p.city = _city)
    AND public.has_role(auth.uid(), 'admin')
  ORDER BY a.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 5000)) OFFSET GREATEST(0, _offset);
$$;

CREATE OR REPLACE FUNCTION public.get_kyc_audit_trail_count(
  _from timestamptz, _to timestamptz,
  _city text DEFAULT NULL, _action text DEFAULT NULL
) RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)
  FROM public.audit_logs a
  LEFT JOIN public.kyc_submissions s ON s.id = a.entity_id
  LEFT JOIN public.profiles p ON p.id = s.profile_id
  WHERE a.created_at BETWEEN _from AND _to
    AND a.action IN ('kyc.decide_auto_reprocess','kyc.batch_reprocess_started',
                     'kyc.batch_reprocess_finished','kyc.batch_reprocess_item')
    AND (_action IS NULL OR a.action = _action)
    AND (_city IS NULL OR p.city = _city)
    AND public.has_role(auth.uid(), 'admin');
$$;

GRANT EXECUTE ON FUNCTION public.get_kyc_audit_trail(timestamptz, timestamptz, text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_kyc_audit_trail_count(timestamptz, timestamptz, text, text) TO authenticated;
