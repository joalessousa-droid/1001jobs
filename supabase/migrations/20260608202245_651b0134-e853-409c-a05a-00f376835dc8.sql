
-- 1) Timeline events table
CREATE TABLE public.insurance_claim_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.insurance_claims(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('opened','attachment_added','attachment_removed','status_changed','comment','resolution')),
  actor_user_id uuid,
  actor_profile_id uuid,
  is_admin boolean NOT NULL DEFAULT false,
  message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ice_claim ON public.insurance_claim_events(claim_id, created_at DESC);

GRANT SELECT, INSERT ON public.insurance_claim_events TO authenticated;
GRANT ALL ON public.insurance_claim_events TO service_role;

ALTER TABLE public.insurance_claim_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY ice_select ON public.insurance_claim_events FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.insurance_claims c WHERE c.id = claim_id
    AND (c.claimant_profile_id = public.get_my_profile_id()
         OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator')))
);
CREATE POLICY ice_insert_admin ON public.insurance_claim_events FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator')
);

-- 2) Auto-log when claim is created or status changes
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

    -- Notifica o solicitante
    INSERT INTO public.notifications(profile_id, type, title, message, link, metadata)
    VALUES (NEW.claimant_profile_id, 'insurance_status',
            'Sinistro ' || NEW.protocol,
            'Status atualizado para ' || NEW.status::text,
            '/seguros/' || NEW.id::text,
            jsonb_build_object('claim_id', NEW.id, 'status', NEW.status));
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_log_insurance_claim_change
AFTER INSERT OR UPDATE ON public.insurance_claims
FOR EACH ROW EXECUTE FUNCTION public.log_insurance_claim_change();

-- 3) Attachments: validate + auto-log
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
    RAISE EXCEPTION 'attachment size invalid';
  END IF;
  IF NEW.size_bytes > 50 * 1024 * 1024 THEN
    RAISE EXCEPTION 'attachment exceeds 50MB';
  END IF;
  IF NEW.mime_type IS NULL OR NOT (NEW.mime_type = ANY(_allowed)) THEN
    RAISE EXCEPTION 'mime type not allowed: %', NEW.mime_type;
  END IF;
  SELECT count(*) INTO _count FROM public.insurance_claim_attachments WHERE claim_id = NEW.claim_id;
  IF _count >= 20 THEN
    RAISE EXCEPTION 'maximum 20 attachments per claim reached';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_validate_insurance_attachment
BEFORE INSERT ON public.insurance_claim_attachments
FOR EACH ROW EXECUTE FUNCTION public.validate_insurance_attachment();

CREATE OR REPLACE FUNCTION public.log_insurance_attachment_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.insurance_claim_events(claim_id, event_type, actor_user_id, is_admin, message, metadata)
    VALUES (NEW.claim_id, 'attachment_added', auth.uid(), false,
            'Anexo enviado (' || NEW.kind::text || ')',
            jsonb_build_object('attachment_id', NEW.id, 'kind', NEW.kind, 'mime', NEW.mime_type, 'size', NEW.size_bytes));
    INSERT INTO public.audit_logs(action, entity_type, entity_id, user_id, details)
    VALUES ('insurance.attachment_uploaded','insurance_claim_attachment', NEW.id, auth.uid(),
            jsonb_build_object('claim_id', NEW.claim_id, 'kind', NEW.kind, 'size', NEW.size_bytes, 'mime', NEW.mime_type, 'path', NEW.file_path));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.insurance_claim_events(claim_id, event_type, actor_user_id, is_admin, message, metadata)
    VALUES (OLD.claim_id, 'attachment_removed', auth.uid(), false,
            'Anexo removido',
            jsonb_build_object('attachment_id', OLD.id, 'kind', OLD.kind));
    INSERT INTO public.audit_logs(action, entity_type, entity_id, user_id, details)
    VALUES ('insurance.attachment_removed','insurance_claim_attachment', OLD.id, auth.uid(),
            jsonb_build_object('claim_id', OLD.claim_id, 'path', OLD.file_path));
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER trg_log_insurance_attachment_change
AFTER INSERT OR DELETE ON public.insurance_claim_attachments
FOR EACH ROW EXECUTE FUNCTION public.log_insurance_attachment_change();

-- 4) Admin comment RPC
CREATE OR REPLACE FUNCTION public.add_insurance_claim_comment(_claim_id uuid, _message text)
RETURNS public.insurance_claim_events
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _row public.insurance_claim_events; _claim public.insurance_claims;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _message IS NULL OR length(btrim(_message)) < 1 THEN RAISE EXCEPTION 'empty message'; END IF;
  SELECT * INTO _claim FROM public.insurance_claims WHERE id=_claim_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'claim not found'; END IF;

  INSERT INTO public.insurance_claim_events(claim_id, event_type, actor_user_id, is_admin, message)
  VALUES (_claim_id, 'comment', auth.uid(), true, _message)
  RETURNING * INTO _row;

  INSERT INTO public.notifications(profile_id, type, title, message, link, metadata)
  VALUES (_claim.claimant_profile_id, 'insurance_comment',
          'Comentário no sinistro ' || _claim.protocol,
          left(_message, 200), '/seguros/' || _claim.id::text,
          jsonb_build_object('claim_id', _claim.id));

  RETURN _row;
END $$;

GRANT EXECUTE ON FUNCTION public.add_insurance_claim_comment(uuid, text) TO authenticated;

-- 5) Rate limiting in open_insurance_claim (replace)
CREATE OR REPLACE FUNCTION public.open_insurance_claim(_description text, _service_id uuid DEFAULT NULL, _occurrence_date timestamptz DEFAULT now(), _estimated_amount numeric DEFAULT NULL)
RETURNS public.insurance_claims
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := public.get_my_profile_id(); _row public.insurance_claims; _proto text; _recent int;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF length(btrim(coalesce(_description,''))) < 10 THEN RAISE EXCEPTION 'description too short'; END IF;
  IF length(_description) > 2000 THEN RAISE EXCEPTION 'description too long'; END IF;

  -- Rate limit: max 1 per 2 minutes, max 5 per day
  SELECT count(*) INTO _recent FROM public.insurance_claims
   WHERE claimant_profile_id = _me AND created_at > now() - interval '2 minutes';
  IF _recent >= 1 THEN RAISE EXCEPTION 'rate_limited: aguarde 2 minutos entre sinistros'; END IF;
  SELECT count(*) INTO _recent FROM public.insurance_claims
   WHERE claimant_profile_id = _me AND created_at > now() - interval '24 hours';
  IF _recent >= 5 THEN RAISE EXCEPTION 'rate_limited: limite diário de 5 sinistros atingido'; END IF;

  _proto := 'SIN-' || to_char(now(),'YYYYMMDD') || '-' || lpad(((random()*9999)::int)::text, 4, '0');
  INSERT INTO public.insurance_claims(protocol, claimant_profile_id, service_id, occurrence_date, description, estimated_amount)
  VALUES (_proto, _me, _service_id, _occurrence_date, _description, _estimated_amount)
  RETURNING * INTO _row;
  INSERT INTO public.audit_logs(action, entity_type, entity_id, user_id, details)
  VALUES ('insurance.claim_opened','insurance_claim', _row.id, auth.uid(),
          jsonb_build_object('protocol', _proto, 'service_id', _service_id));
  RETURN _row;
END $$;

-- 6) Rate limit on trigger_emergency_alert (replace) + return user info
CREATE OR REPLACE FUNCTION public.trigger_emergency_alert(_latitude double precision DEFAULT NULL, _longitude double precision DEFAULT NULL, _accuracy_meters numeric DEFAULT NULL, _context jsonb DEFAULT '{}'::jsonb)
RETURNS public.emergency_alerts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _me_profile uuid := public.get_my_profile_id();
  _me_user uuid := auth.uid();
  _role public.emergency_alert_role;
  _user_type text; _proto text;
  _row public.emergency_alerts; _admin_profile uuid; _recent int;
BEGIN
  IF _me_user IS NULL OR _me_profile IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Rate limit anti-spam: 1 por minuto, 5 por hora
  SELECT count(*) INTO _recent FROM public.emergency_alerts
   WHERE user_id = _me_user AND created_at > now() - interval '60 seconds';
  IF _recent >= 1 THEN RAISE EXCEPTION 'rate_limited: aguarde 60s antes de outro SOS'; END IF;
  SELECT count(*) INTO _recent FROM public.emergency_alerts
   WHERE user_id = _me_user AND created_at > now() - interval '1 hour';
  IF _recent >= 5 THEN RAISE EXCEPTION 'rate_limited: muitos SOS na última hora'; END IF;

  SELECT user_type INTO _user_type FROM public.profiles WHERE id = _me_profile;
  _role := CASE WHEN _user_type='provider' THEN 'provider'::public.emergency_alert_role ELSE 'client'::public.emergency_alert_role END;
  _proto := 'SOS-' || to_char(now(),'YYYYMMDD') || '-' || lpad(((random()*9999)::int)::text,4,'0');

  INSERT INTO public.emergency_alerts(protocol, profile_id, user_id, role, latitude, longitude, accuracy_meters, context)
  VALUES (_proto, _me_profile, _me_user, _role, _latitude, _longitude, _accuracy_meters, COALESCE(_context,'{}'::jsonb))
  RETURNING * INTO _row;

  INSERT INTO public.audit_logs(action, entity_type, entity_id, user_id, details)
  VALUES ('emergency.triggered','emergency_alert', _row.id, _me_user,
          jsonb_build_object('protocol', _proto, 'role', _role, 'lat', _latitude, 'lng', _longitude));

  -- Notifica o próprio usuário (in-app) com o protocolo
  INSERT INTO public.notifications(profile_id, type, title, message, link, metadata)
  VALUES (_me_profile, 'emergency_sos_self',
          'SOS registrado — ' || _proto,
          'Seu acionamento foi enviado à central. Guarde o protocolo.',
          '/dashboard',
          jsonb_build_object('alert_id', _row.id, 'protocol', _proto));

  FOR _admin_profile IN
    SELECT p.id FROM public.profiles p
    JOIN public.user_roles r ON r.user_id = p.user_id
    WHERE r.role = 'admin'
  LOOP
    INSERT INTO public.notifications(profile_id, type, title, message, link, metadata)
    VALUES (_admin_profile, 'emergency_sos',
            'Alerta SOS recebido — ' || _proto,
            'Acionamento de emergência por ' || _role::text || '.',
            '/admin/emergencias',
            jsonb_build_object('alert_id', _row.id, 'protocol', _proto, 'lat', _latitude, 'lng', _longitude));
  END LOOP;

  RETURN _row;
END $$;
