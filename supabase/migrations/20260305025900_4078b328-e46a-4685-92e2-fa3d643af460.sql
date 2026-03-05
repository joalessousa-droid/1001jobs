
-- KYC documents table
CREATE TABLE public.kyc_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  document_type text NOT NULL, -- 'rg', 'cnh', 'cnpj_card', 'contrato_social', 'selfie', 'selfie_with_doc'
  file_url text NOT NULL,
  file_name text,
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  rejection_reason text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- LGPD consent records
CREATE TABLE public.lgpd_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  consent_type text NOT NULL, -- 'terms', 'privacy', 'data_processing', 'marketing'
  consent_version text NOT NULL DEFAULT '1.0',
  accepted boolean NOT NULL DEFAULT false,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

-- Audit logs
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  profile_id uuid,
  action text NOT NULL, -- 'signup', 'login', 'profile_update', 'kyc_upload', 'consent_given', 'consent_revoked', 'password_change', 'data_export', 'data_deletion'
  entity_type text, -- 'profile', 'kyc_document', 'consent', 'session'
  entity_id uuid,
  details jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_kyc_documents_profile ON public.kyc_documents(profile_id);
CREATE INDEX idx_kyc_documents_status ON public.kyc_documents(status);
CREATE INDEX idx_lgpd_consents_user ON public.lgpd_consents(user_id);
CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at);

-- RLS
ALTER TABLE public.kyc_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lgpd_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- KYC policies
CREATE POLICY "Users can insert own kyc docs"
ON public.kyc_documents FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own kyc docs"
ON public.kyc_documents FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Service role manages kyc"
ON public.kyc_documents FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- LGPD consent policies
CREATE POLICY "Users can insert own consents"
ON public.lgpd_consents FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own consents"
ON public.lgpd_consents FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Service role manages consents"
ON public.lgpd_consents FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- Audit log policies
CREATE POLICY "Users can view own audit logs"
ON public.audit_logs FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own audit logs"
ON public.audit_logs FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role manages audit logs"
ON public.audit_logs FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- KYC storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('kyc-documents', 'kyc-documents', false)
ON CONFLICT (id) DO NOTHING;

-- KYC storage policies (private - only owner can upload/view)
CREATE POLICY "Users can upload own kyc docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view own kyc docs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Service role accesses all kyc docs"
ON storage.objects FOR ALL TO service_role
USING (bucket_id = 'kyc-documents') WITH CHECK (bucket_id = 'kyc-documents');
