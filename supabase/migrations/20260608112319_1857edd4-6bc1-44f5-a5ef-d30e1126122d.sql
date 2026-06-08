CREATE OR REPLACE FUNCTION public.export_cpf_check_attempts(_from timestamptz, _to timestamptz, _city text DEFAULT NULL)
RETURNS TABLE (
  created_at timestamptz, submission_id uuid, operator_id uuid, action text,
  attempt int, status_code int, latency_ms int, ok boolean,
  provider text, regularidade text, fallback_reason text,
  serpro_situacao text, serpro_message text, trigger_reason text, city text
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  WITH rows AS (
    SELECT l.created_at, l.entity_id AS submission_id, l.user_id AS operator_id, l.action,
           l.details, p.city AS pcity
    FROM public.audit_logs l
    LEFT JOIN public.kyc_submissions s ON s.id = l.entity_id
    LEFT JOIN public.profiles p ON p.id = s.profile_id
    WHERE l.entity_type = 'kyc_submission'
      AND l.action LIKE 'cpf_check.%'
      AND l.created_at >= _from AND l.created_at <= _to
      AND (_city IS NULL OR p.city = _city)
  )
  SELECT r.created_at, r.submission_id, r.operator_id, r.action,
    (att->>'attempt')::int,
    NULLIF(att->>'status','')::int,
    NULLIF(att->>'latency_ms','')::int,
    (att->>'ok')::boolean,
    r.details->>'provider',
    r.details->>'regularidade',
    coalesce(att->>'fallback_reason', r.details->>'fallback_reason'),
    att->>'serpro_situacao',
    att->>'serpro_message',
    r.details->>'trigger_reason',
    r.pcity
  FROM rows r
  LEFT JOIN LATERAL jsonb_array_elements(coalesce(r.details->'attempts','[]'::jsonb)) AS att ON true
  ORDER BY r.created_at DESC, (att->>'attempt')::int NULLS LAST;
END $$;
REVOKE EXECUTE ON FUNCTION public.export_cpf_check_attempts(timestamptz, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.export_cpf_check_attempts(timestamptz, timestamptz, text) TO authenticated;