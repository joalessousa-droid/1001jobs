
-- 1) Retention column
ALTER TABLE public.insurance_claims
  ADD COLUMN IF NOT EXISTS retention_until timestamptz;

-- 2) Indexes for attachments
CREATE INDEX IF NOT EXISTS idx_ica_claim ON public.insurance_claim_attachments(claim_id);
CREATE INDEX IF NOT EXISTS idx_ica_mime ON public.insurance_claim_attachments(mime_type);
CREATE INDEX IF NOT EXISTS idx_ica_kind ON public.insurance_claim_attachments(kind);
CREATE INDEX IF NOT EXISTS idx_ica_created ON public.insurance_claim_attachments(created_at DESC);

-- 3) Update log trigger to also set retention_until on terminal states
CREATE OR REPLACE FUNCTION public.log_insurance_claim_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.insurance_claim_events(claim_id, event_type, actor_user_id, actor_profile_id, is_admin, message, metadata)
    VALUES (NEW.id, 'opened', auth.uid(), NEW.claimant_profile_id, false,
            'Sinistro aberto: ' || NEW.protocol,
            jsonb_build_object('protocol', NEW.protocol, 'service_id', NEW.service_id));
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.insurance_claim_events(claim_id, event_type, actor_user_id, is_admin, message, metadata)
    VALUES (NEW.id, 'status_changed', auth.uid(),
            public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'),
            'Status: ' || OLD.status::text || ' → ' || NEW.status::text,
            jsonb_build_object('from', OLD.status, 'to', NEW.status, 'notes', NEW.resolution_notes));

    INSERT INTO public.notifications(profile_id, type, title, message, link, metadata)
    VALUES (NEW.claimant_profile_id, 'insurance_status',
            'Sinistro ' || NEW.protocol,
            'Status atualizado para ' || NEW.status::text,
            '/seguros/' || NEW.id::text,
            jsonb_build_object('claim_id', NEW.id, 'status', NEW.status));

    -- Retention: 90 days after terminal status
    IF NEW.status::text IN ('approved','denied','closed') AND NEW.retention_until IS NULL THEN
      NEW.retention_until := now() + interval '90 days';
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- Need BEFORE UPDATE to mutate NEW.retention_until: split into two triggers
DROP TRIGGER IF EXISTS trg_log_insurance_claim_change ON public.insurance_claims;

CREATE OR REPLACE FUNCTION public.set_insurance_retention()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP='UPDATE' AND NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status::text IN ('approved','denied','closed')
     AND NEW.retention_until IS NULL THEN
    NEW.retention_until := now() + interval '90 days';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_set_insurance_retention
BEFORE UPDATE ON public.insurance_claims
FOR EACH ROW EXECUTE FUNCTION public.set_insurance_retention();

CREATE TRIGGER trg_log_insurance_claim_change
AFTER INSERT OR UPDATE ON public.insurance_claims
FOR EACH ROW EXECUTE FUNCTION public.log_insurance_claim_change();

-- 4) Stable validation with error codes
CREATE OR REPLACE FUNCTION public.validate_insurance_attachment()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _count int; _allowed text[] := ARRAY[
  'image/jpeg','image/png','image/webp','image/gif',
  'video/mp4','video/quicktime','video/webm',
  'application/pdf','application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];
BEGIN
  IF NEW.size_bytes IS NULL OR NEW.size_bytes <= 0 THEN
    RAISE EXCEPTION 'attachment_invalid_size' USING ERRCODE='22023';
  END IF;
  IF NEW.size_bytes > 50 * 1024 * 1024 THEN
    RAISE EXCEPTION 'attachment_too_large' USING ERRCODE='22023';
  END IF;
  IF NEW.mime_type IS NULL OR NOT (NEW.mime_type = ANY(_allowed)) THEN
    RAISE EXCEPTION 'attachment_mime_not_allowed:%', NEW.mime_type USING ERRCODE='22023';
  END IF;
  SELECT count(*) INTO _count FROM public.insurance_claim_attachments WHERE claim_id = NEW.claim_id;
  IF _count >= 20 THEN
    RAISE EXCEPTION 'attachment_max_files_reached' USING ERRCODE='22023';
  END IF;
  RETURN NEW;
END $$;

-- 5) Cleanup RPCs (service_role only; called by edge function)
CREATE OR REPLACE FUNCTION public.list_expired_insurance_attachments(_limit int DEFAULT 200)
RETURNS TABLE(attachment_id uuid, claim_id uuid, file_path text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id, a.claim_id, a.file_path
  FROM public.insurance_claim_attachments a
  JOIN public.insurance_claims c ON c.id = a.claim_id
  WHERE c.retention_until IS NOT NULL
    AND c.retention_until < now()
  ORDER BY c.retention_until ASC
  LIMIT GREATEST(1, LEAST(_limit, 1000));
$$;

CREATE OR REPLACE FUNCTION public.purge_insurance_attachments(_ids uuid[])
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n int;
BEGIN
  DELETE FROM public.insurance_claim_attachments WHERE id = ANY(_ids);
  GET DIAGNOSTICS _n = ROW_COUNT;
  INSERT INTO public.audit_logs(action, entity_type, user_id, details)
  VALUES ('insurance.attachments_purged','insurance_claim_attachment', NULL,
          jsonb_build_object('count', _n, 'ids', _ids));
  RETURN _n;
END $$;

REVOKE ALL ON FUNCTION public.list_expired_insurance_attachments(int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.purge_insurance_attachments(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_expired_insurance_attachments(int) TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_insurance_attachments(uuid[]) TO service_role;

-- 6) Audit export RPC
CREATE OR REPLACE FUNCTION public.export_insurance_audit_trail(
  _from timestamptz, _to timestamptz,
  _claim_id uuid DEFAULT NULL, _event_type text DEFAULT NULL
)
RETURNS TABLE(
  created_at timestamptz, claim_id uuid, protocol text, event_type text,
  actor_user_id uuid, is_admin boolean, message text,
  before_value text, after_value text, metadata jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.created_at, e.claim_id, c.protocol, e.event_type,
         e.actor_user_id, e.is_admin, e.message,
         COALESCE(e.metadata->>'from','') AS before_value,
         COALESCE(e.metadata->>'to','') AS after_value,
         e.metadata
  FROM public.insurance_claim_events e
  JOIN public.insurance_claims c ON c.id = e.claim_id
  WHERE e.created_at BETWEEN _from AND _to
    AND (_claim_id IS NULL OR e.claim_id = _claim_id)
    AND (_event_type IS NULL OR e.event_type = _event_type)
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'))
  ORDER BY e.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.export_insurance_audit_trail(timestamptz, timestamptz, uuid, text) TO authenticated;

-- 7) Realtime
ALTER TABLE public.insurance_claim_events REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.insurance_claim_events;
ALTER TABLE public.insurance_claims REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.insurance_claims;
