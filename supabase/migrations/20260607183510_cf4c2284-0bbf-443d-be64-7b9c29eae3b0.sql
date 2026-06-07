
DROP FUNCTION IF EXISTS public.get_kyc_metrics(timestamptz, timestamptz, text);
DROP FUNCTION IF EXISTS public.get_kyc_metrics(timestamptz, timestamptz, text, text);
CREATE OR REPLACE FUNCTION public.get_kyc_metrics(_from timestamptz, _to timestamptz, _city text DEFAULT NULL, _category text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _out jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  WITH base AS (
    SELECT s.*, p.city AS pcity
    FROM public.kyc_submissions s
    LEFT JOIN public.profiles p ON p.id = s.profile_id
    WHERE s.submitted_at >= _from AND s.submitted_at <= _to
      AND (_city IS NULL OR p.city = _city)
      AND (_category IS NULL OR s.rejection_category = _category)
  ),
  totals AS (
    SELECT count(*) AS total,
      count(*) FILTER (WHERE status='in_review') AS in_review,
      count(*) FILTER (WHERE status='approved') AS approved,
      count(*) FILTER (WHERE status='rejected') AS rejected,
      avg(EXTRACT(EPOCH FROM (decided_at - submitted_at))) FILTER (WHERE decided_at IS NOT NULL) AS avg_review_seconds
    FROM base
  ),
  daily AS (
    SELECT to_char(submitted_at::date,'YYYY-MM-DD') AS day,
      count(*) AS submitted,
      count(*) FILTER (WHERE status='approved') AS approved,
      count(*) FILTER (WHERE status='rejected') AS rejected
    FROM base GROUP BY 1 ORDER BY 1
  ),
  reasons AS (
    SELECT coalesce(rejection_reason,'(sem motivo)') AS reason, count(*) AS count
    FROM base WHERE status='rejected' GROUP BY 1 ORDER BY 2 DESC LIMIT 10
  ),
  cats AS (
    SELECT coalesce(rejection_category,'other') AS category, count(*) AS count
    FROM base WHERE status='rejected' GROUP BY 1 ORDER BY 2 DESC
  ),
  by_city AS (
    SELECT coalesce(pcity,'(sem cidade)') AS city,
      count(*) AS total,
      count(*) FILTER (WHERE status='approved') AS approved,
      count(*) FILTER (WHERE status='rejected') AS rejected
    FROM base GROUP BY 1 ORDER BY 2 DESC
  )
  SELECT jsonb_build_object(
    'totals', (SELECT jsonb_build_object(
      'total', total, 'in_review', in_review, 'approved', approved, 'rejected', rejected,
      'avg_review_seconds', coalesce(avg_review_seconds,0),
      'approval_rate', CASE WHEN total>0 THEN approved::numeric/total ELSE 0 END,
      'rejection_rate', CASE WHEN total>0 THEN rejected::numeric/total ELSE 0 END
    ) FROM totals),
    'daily', coalesce((SELECT jsonb_agg(row_to_json(daily)) FROM daily), '[]'::jsonb),
    'top_rejection_reasons', coalesce((SELECT jsonb_agg(row_to_json(reasons)) FROM reasons), '[]'::jsonb),
    'by_category', coalesce((SELECT jsonb_agg(row_to_json(cats)) FROM cats), '[]'::jsonb),
    'by_city', coalesce((SELECT jsonb_agg(row_to_json(by_city)) FROM by_city), '[]'::jsonb)
  ) INTO _out;
  RETURN _out;
END $$;
REVOKE EXECUTE ON FUNCTION public.get_kyc_metrics(timestamptz, timestamptz, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_kyc_metrics(timestamptz, timestamptz, text, text) TO authenticated;

DROP FUNCTION IF EXISTS public.export_kyc_decisions(timestamptz, timestamptz, text);
DROP FUNCTION IF EXISTS public.export_kyc_decisions(timestamptz, timestamptz, text, text);
CREATE OR REPLACE FUNCTION public.export_kyc_decisions(_from timestamptz, _to timestamptz, _city text DEFAULT NULL, _category text DEFAULT NULL)
RETURNS TABLE (
  created_at timestamptz, submission_id uuid, user_id uuid, operator_id uuid,
  from_status text, to_status text, rejection_category text, reason text, city text
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
    SELECT d.created_at, d.submission_id, d.user_id, d.operator_id,
           d.from_status, d.to_status, d.rejection_category, d.reason, d.city
    FROM public.kyc_decisions d
    WHERE d.created_at >= _from AND d.created_at <= _to
      AND (_city IS NULL OR d.city = _city)
      AND (_category IS NULL OR d.rejection_category = _category)
    ORDER BY d.created_at DESC;
END $$;
REVOKE EXECUTE ON FUNCTION public.export_kyc_decisions(timestamptz, timestamptz, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.export_kyc_decisions(timestamptz, timestamptz, text, text) TO authenticated;
