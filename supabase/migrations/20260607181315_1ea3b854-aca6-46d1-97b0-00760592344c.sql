
-- 1) Columns
ALTER TABLE public.kyc_submissions
  ADD COLUMN IF NOT EXISTS ocr_extracted jsonb,
  ADD COLUMN IF NOT EXISTS ocr_name_match numeric,
  ADD COLUMN IF NOT EXISTS ocr_cpf_match boolean,
  ADD COLUMN IF NOT EXISTS ocr_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS cpf_regularidade text,
  ADD COLUMN IF NOT EXISTS cpf_checked_at timestamptz;

-- 2) CPF validator
CREATE OR REPLACE FUNCTION public.is_valid_cpf(_cpf text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE c text; nums int[]; s int; d1 int; d2 int; i int;
BEGIN
  IF _cpf IS NULL THEN RETURN false; END IF;
  c := regexp_replace(_cpf, '\D', '', 'g');
  IF length(c) <> 11 THEN RETURN false; END IF;
  IF c ~ '^(.)\1{10}$' THEN RETURN false; END IF;
  nums := ARRAY(SELECT (substring(c,i,1))::int FROM generate_series(1,11) i);
  s := 0;
  FOR i IN 1..9 LOOP s := s + nums[i] * (11 - i); END LOOP;
  d1 := (s * 10) % 11; IF d1 = 10 THEN d1 := 0; END IF;
  IF d1 <> nums[10] THEN RETURN false; END IF;
  s := 0;
  FOR i IN 1..10 LOOP s := s + nums[i] * (12 - i); END LOOP;
  d2 := (s * 10) % 11; IF d2 = 10 THEN d2 := 0; END IF;
  RETURN d2 = nums[11];
END $$;

-- 3) Metrics RPC
CREATE OR REPLACE FUNCTION public.get_kyc_metrics(
  _from timestamptz DEFAULT now() - interval '30 days',
  _to   timestamptz DEFAULT now(),
  _city text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _r jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  WITH base AS (
    SELECT k.*, p.city
    FROM public.kyc_submissions k
    LEFT JOIN public.profiles p ON p.id = k.profile_id
    WHERE k.submitted_at BETWEEN _from AND _to
      AND (_city IS NULL OR lower(p.city) = lower(_city))
  )
  SELECT jsonb_build_object(
    'generated_at', now(),
    'period', jsonb_build_object('from', _from, 'to', _to, 'city', _city),
    'totals', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'pending', COUNT(*) FILTER (WHERE status='pending'),
        'in_review', COUNT(*) FILTER (WHERE status='in_review'),
        'approved', COUNT(*) FILTER (WHERE status='approved'),
        'rejected', COUNT(*) FILTER (WHERE status='rejected'),
        'approval_rate', CASE WHEN COUNT(*)=0 THEN 0
          ELSE ROUND((COUNT(*) FILTER (WHERE status='approved'))::numeric / COUNT(*), 4) END,
        'rejection_rate', CASE WHEN COUNT(*)=0 THEN 0
          ELSE ROUND((COUNT(*) FILTER (WHERE status='rejected'))::numeric / COUNT(*), 4) END,
        'avg_review_seconds', COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (decided_at - submitted_at)))
          FILTER (WHERE decided_at IS NOT NULL)::numeric, 0), 0)
      ) FROM base
    ),
    'top_rejection_reasons', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('reason', reason, 'count', c) ORDER BY c DESC), '[]'::jsonb)
      FROM (
        SELECT COALESCE(NULLIF(rejection_reason,''),'(sem motivo)') AS reason, COUNT(*) AS c
        FROM base WHERE status='rejected'
        GROUP BY 1 ORDER BY c DESC LIMIT 10
      ) t
    ),
    'daily', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'day', d, 'submitted', total, 'approved', approved, 'rejected', rejected
      ) ORDER BY d), '[]'::jsonb)
      FROM (
        SELECT date_trunc('day', submitted_at)::date AS d,
               COUNT(*) AS total,
               COUNT(*) FILTER (WHERE status='approved') AS approved,
               COUNT(*) FILTER (WHERE status='rejected') AS rejected
        FROM base GROUP BY 1
      ) d
    ),
    'by_city', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'city', city, 'total', total, 'approved', approved, 'rejected', rejected
      ) ORDER BY total DESC), '[]'::jsonb)
      FROM (
        SELECT COALESCE(NULLIF(city,''),'(sem cidade)') AS city,
               COUNT(*) AS total,
               COUNT(*) FILTER (WHERE status='approved') AS approved,
               COUNT(*) FILTER (WHERE status='rejected') AS rejected
        FROM base GROUP BY 1 ORDER BY total DESC LIMIT 50
      ) c
    )
  ) INTO _r;

  RETURN _r;
END $$;

GRANT EXECUTE ON FUNCTION public.get_kyc_metrics(timestamptz, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_valid_cpf(text) TO authenticated, anon;

-- 4) Notification trigger
CREATE OR REPLACE FUNCTION public.notify_kyc_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _title text; _msg text;
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    CASE NEW.status
      WHEN 'pending'   THEN _title := 'KYC pendente';     _msg := 'Sua verificação de identidade está pendente.';
      WHEN 'in_review' THEN _title := 'KYC em análise';   _msg := 'Recebemos seus documentos. Análise em até 48h.';
      WHEN 'approved'  THEN _title := 'KYC aprovado';     _msg := 'Sua identidade foi verificada com sucesso.';
      WHEN 'rejected'  THEN _title := 'KYC reprovado';
                            _msg := COALESCE('Motivo: ' || NEW.rejection_reason, 'Reenvio necessário.') ||
                                    ' Reenvie seus documentos em /perfil/kyc.';
      ELSE _title := 'KYC atualizado'; _msg := 'Status atualizado.';
    END CASE;

    INSERT INTO public.notifications(profile_id, type, title, message, link, metadata)
    VALUES (NEW.profile_id, 'kyc_status', _title, _msg, '/perfil/kyc',
            jsonb_build_object('submission_id', NEW.id, 'status', NEW.status));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS kyc_submissions_notify_status ON public.kyc_submissions;
CREATE TRIGGER kyc_submissions_notify_status
AFTER INSERT OR UPDATE OF status ON public.kyc_submissions
FOR EACH ROW EXECUTE FUNCTION public.notify_kyc_status_change();
