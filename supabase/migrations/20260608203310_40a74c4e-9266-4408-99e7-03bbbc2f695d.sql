
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  insurance_status_email boolean NOT NULL DEFAULT true,
  insurance_status_inapp boolean NOT NULL DEFAULT true,
  insurance_comment_email boolean NOT NULL DEFAULT true,
  insurance_comment_inapp boolean NOT NULL DEFAULT true,
  admin_insurance_status_email boolean NOT NULL DEFAULT true,
  admin_insurance_status_inapp boolean NOT NULL DEFAULT true,
  admin_insurance_comment_email boolean NOT NULL DEFAULT false,
  admin_insurance_comment_inapp boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own prefs select" ON public.notification_preferences
  FOR SELECT TO authenticated
  USING (profile_id = public.get_my_profile_id() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "own prefs insert" ON public.notification_preferences
  FOR INSERT TO authenticated WITH CHECK (profile_id = public.get_my_profile_id());
CREATE POLICY "own prefs update" ON public.notification_preferences
  FOR UPDATE TO authenticated
  USING (profile_id = public.get_my_profile_id())
  WITH CHECK (profile_id = public.get_my_profile_id());

CREATE TRIGGER tr_notification_preferences_touch
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.validate_insurance_attachment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _count int; _total bigint; _ext text;
  _allowed_mime text[] := ARRAY[
    'image/jpeg','image/png','image/webp','image/gif',
    'video/mp4','video/quicktime','video/webm',
    'application/pdf','application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  _allowed_ext text[] := ARRAY['jpg','jpeg','png','webp','gif','mp4','mov','webm','pdf','doc','docx'];
BEGIN
  IF NEW.size_bytes IS NULL OR NEW.size_bytes <= 0 THEN
    RAISE EXCEPTION 'attachment_invalid_size' USING ERRCODE='22023';
  END IF;
  IF NEW.size_bytes > 50 * 1024 * 1024 THEN
    RAISE EXCEPTION 'attachment_too_large' USING ERRCODE='22023';
  END IF;
  IF NEW.mime_type IS NULL OR NOT (NEW.mime_type = ANY(_allowed_mime)) THEN
    RAISE EXCEPTION 'attachment_mime_not_allowed:%', NEW.mime_type USING ERRCODE='22023';
  END IF;
  _ext := lower(regexp_replace(coalesce(NEW.file_name,''), '^.*\.', ''));
  IF _ext = '' OR NOT (_ext = ANY(_allowed_ext)) THEN
    RAISE EXCEPTION 'attachment_extension_not_allowed:%', _ext USING ERRCODE='22023';
  END IF;
  SELECT count(*), COALESCE(SUM(size_bytes),0)
    INTO _count, _total
    FROM public.insurance_claim_attachments WHERE claim_id = NEW.claim_id;
  IF _count >= 20 THEN
    RAISE EXCEPTION 'attachment_max_files_reached' USING ERRCODE='22023';
  END IF;
  IF (_total + NEW.size_bytes) > 200 * 1024 * 1024 THEN
    RAISE EXCEPTION 'attachment_stage_size_exceeded' USING ERRCODE='22023';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.get_insurance_claim_audit(
  _claim_id uuid, _event_type text DEFAULT NULL,
  _limit int DEFAULT 100, _offset int DEFAULT 0
)
RETURNS TABLE(created_at timestamptz, event_type text, actor_user_id uuid, actor_profile_id uuid, is_admin boolean, message text, metadata jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.created_at, e.event_type::text, e.actor_user_id, e.actor_profile_id, e.is_admin, e.message, e.metadata
  FROM public.insurance_claim_events e
  JOIN public.insurance_claims c ON c.id = e.claim_id
  WHERE e.claim_id = _claim_id
    AND (_event_type IS NULL OR e.event_type::text = _event_type)
    AND (public.has_role(auth.uid(),'admin') OR c.claimant_profile_id = public.get_my_profile_id())
  ORDER BY e.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 1000)) OFFSET GREATEST(0, _offset);
$$;

CREATE OR REPLACE FUNCTION public.get_insurance_claim_audit_count(
  _claim_id uuid, _event_type text DEFAULT NULL
) RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*) FROM public.insurance_claim_events e
  JOIN public.insurance_claims c ON c.id = e.claim_id
  WHERE e.claim_id = _claim_id
    AND (_event_type IS NULL OR e.event_type::text = _event_type)
    AND (public.has_role(auth.uid(),'admin') OR c.claimant_profile_id = public.get_my_profile_id());
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='app_settings' AND column_name='insurance_retention_days') THEN
    ALTER TABLE public.app_settings ADD COLUMN insurance_retention_days int NOT NULL DEFAULT 90;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='app_settings' AND column_name='insurance_retention_rule') THEN
    ALTER TABLE public.app_settings ADD COLUMN insurance_retention_rule text NOT NULL DEFAULT 'on_terminal_status';
  END IF;
END $$;
