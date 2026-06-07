
ALTER TABLE public.kyc_submissions
  ADD COLUMN IF NOT EXISTS rejection_category text
  CHECK (rejection_category IS NULL OR rejection_category IN (
    'ocr_inconclusive','cpf_irregular','name_cpf_mismatch','face_mismatch','document_invalid','other'
  ));

CREATE TABLE IF NOT EXISTS public.kyc_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL,
  user_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  operator_id uuid,
  from_status text,
  to_status text NOT NULL,
  rejection_category text,
  reason text,
  city text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.kyc_decisions TO authenticated;
GRANT ALL ON public.kyc_decisions TO service_role;
ALTER TABLE public.kyc_decisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins view kyc decisions" ON public.kyc_decisions;
CREATE POLICY "Admins view kyc decisions"
  ON public.kyc_decisions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator')
         OR user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_kyc_decisions_created ON public.kyc_decisions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kyc_decisions_sub ON public.kyc_decisions(submission_id);
CREATE INDEX IF NOT EXISTS idx_kyc_decisions_city ON public.kyc_decisions(city);

CREATE OR REPLACE FUNCTION public.log_kyc_decision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _city text;
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT city INTO _city FROM public.profiles WHERE id = NEW.profile_id;
    INSERT INTO public.kyc_decisions(
      submission_id, user_id, profile_id, operator_id,
      from_status, to_status, rejection_category, reason, city, metadata
    ) VALUES (
      NEW.id, NEW.user_id, NEW.profile_id, auth.uid(),
      CASE WHEN TG_OP='INSERT' THEN NULL ELSE OLD.status END,
      NEW.status, NEW.rejection_category, NEW.rejection_reason, _city,
      jsonb_build_object(
        'cpf_regularidade', NEW.cpf_regularidade,
        'ocr_cpf_match', NEW.ocr_cpf_match,
        'ocr_name_match', NEW.ocr_name_match,
        'face_match_score', NEW.face_match_score
      )
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_kyc_decision ON public.kyc_submissions;
CREATE TRIGGER trg_log_kyc_decision
AFTER INSERT OR UPDATE ON public.kyc_submissions
FOR EACH ROW EXECUTE FUNCTION public.log_kyc_decision();

DROP FUNCTION IF EXISTS public.get_kyc_metrics(timestamptz, timestamptz, text);
CREATE OR REPLACE FUNCTION public.get_kyc_metrics(_from timestamptz, _to timestamptz, _city text DEFAULT NULL)
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
  ),
  totals AS (
    SELECT
      count(*) AS total,
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
    FROM base WHERE status='rejected'
    GROUP BY 1 ORDER BY 2 DESC LIMIT 10
  ),
  cats AS (
    SELECT coalesce(rejection_category,'other') AS category, count(*) AS count
    FROM base WHERE status='rejected'
    GROUP BY 1 ORDER BY 2 DESC
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

DROP FUNCTION IF EXISTS public.export_kyc_decisions(timestamptz, timestamptz, text);
CREATE OR REPLACE FUNCTION public.export_kyc_decisions(_from timestamptz, _to timestamptz, _city text DEFAULT NULL)
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
    ORDER BY d.created_at DESC;
END $$;
