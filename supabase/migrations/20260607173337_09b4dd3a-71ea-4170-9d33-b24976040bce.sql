
-- ===== Onda C: Módulo 7 - KYC =====

CREATE TABLE IF NOT EXISTS public.kyc_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','in_review','approved','rejected')),
  cpf text,
  rg_number text,
  cnh_number text,
  selfie_path text,
  doc_front_path text,
  doc_back_path text,
  cpf_valid boolean,
  doc_valid boolean,
  face_match_score numeric,
  reviewer_id uuid,
  reviewer_notes text,
  rejection_reason text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.kyc_submissions TO authenticated;
GRANT ALL ON public.kyc_submissions TO service_role;

ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own kyc"
  ON public.kyc_submissions FOR SELECT TO authenticated
  USING (user_id = auth.uid()
         OR public.has_role(auth.uid(),'admin')
         OR public.has_role(auth.uid(),'moderator'));

CREATE POLICY "Users insert own kyc"
  ON public.kyc_submissions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins update kyc"
  ON public.kyc_submissions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));

CREATE INDEX IF NOT EXISTS idx_kyc_submissions_profile ON public.kyc_submissions(profile_id);
CREATE INDEX IF NOT EXISTS idx_kyc_submissions_status  ON public.kyc_submissions(status);

CREATE TRIGGER kyc_submissions_touch_updated
  BEFORE UPDATE ON public.kyc_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Histórico
CREATE TABLE IF NOT EXISTS public.kyc_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.kyc_submissions(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  changed_by uuid,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.kyc_status_history TO authenticated;
GRANT ALL ON public.kyc_status_history TO service_role;

ALTER TABLE public.kyc_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view kyc history"
  ON public.kyc_status_history FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator')
         OR EXISTS (SELECT 1 FROM public.kyc_submissions s
                     WHERE s.id = submission_id AND s.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.log_kyc_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP='INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.kyc_status_history(submission_id, from_status, to_status, changed_by, reason)
    VALUES (NEW.id,
            CASE WHEN TG_OP='INSERT' THEN NULL ELSE OLD.status END,
            NEW.status, auth.uid(), NEW.rejection_reason);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER kyc_submissions_log_status
  AFTER INSERT OR UPDATE ON public.kyc_submissions
  FOR EACH ROW EXECUTE FUNCTION public.log_kyc_status_change();

-- Políticas do bucket kyc-docs (privado)
CREATE POLICY "kyc owner read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'kyc-docs'
         AND (auth.uid()::text = (storage.foldername(name))[1]
              OR public.has_role(auth.uid(),'admin')
              OR public.has_role(auth.uid(),'moderator')));

CREATE POLICY "kyc owner upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'kyc-docs'
              AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "kyc owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'kyc-docs'
         AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "kyc owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'kyc-docs'
         AND (auth.uid()::text = (storage.foldername(name))[1]
              OR public.has_role(auth.uid(),'admin')));

-- ===== Onda D: Módulo 8 - Reconhecimento Facial =====

CREATE TABLE IF NOT EXISTS public.face_verification_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  user_id uuid NOT NULL,
  context text NOT NULL CHECK (context IN ('login','payment','withdrawal','sensitive_change','kyc')),
  similarity numeric,
  decision text NOT NULL CHECK (decision IN ('approved','review','blocked','error')),
  baseline_path text,
  attempt_path text,
  ip_address text,
  user_agent text,
  fingerprint_hash text,
  notes text,
  attempt_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.face_verification_attempts TO authenticated;
GRANT ALL ON public.face_verification_attempts TO service_role;

ALTER TABLE public.face_verification_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own face attempts"
  ON public.face_verification_attempts FOR SELECT TO authenticated
  USING (user_id = auth.uid()
         OR public.has_role(auth.uid(),'admin')
         OR public.has_role(auth.uid(),'moderator'));

CREATE POLICY "Users insert own face attempts"
  ON public.face_verification_attempts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_face_attempts_profile ON public.face_verification_attempts(profile_id, attempt_at DESC);
CREATE INDEX IF NOT EXISTS idx_face_attempts_decision ON public.face_verification_attempts(decision);
