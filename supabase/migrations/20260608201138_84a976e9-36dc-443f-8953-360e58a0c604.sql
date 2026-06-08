
-- ========== MÓDULO 11 — Seguro contra danos ==========

CREATE TYPE public.insurance_claim_status AS ENUM ('open','in_review','approved','denied','closed');
CREATE TYPE public.insurance_attachment_kind AS ENUM ('photo','video','document');

CREATE TABLE public.insurance_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol text NOT NULL UNIQUE,
  claimant_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  occurrence_date timestamptz NOT NULL DEFAULT now(),
  description text NOT NULL,
  estimated_amount numeric(12,2),
  status public.insurance_claim_status NOT NULL DEFAULT 'open',
  resolution_notes text,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.insurance_claims TO authenticated;
GRANT ALL ON public.insurance_claims TO service_role;
ALTER TABLE public.insurance_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "claims_select_own_or_admin" ON public.insurance_claims FOR SELECT TO authenticated
  USING (claimant_profile_id = public.get_my_profile_id()
         OR public.has_role(auth.uid(),'admin')
         OR public.has_role(auth.uid(),'moderator'));
CREATE POLICY "claims_insert_own" ON public.insurance_claims FOR INSERT TO authenticated
  WITH CHECK (claimant_profile_id = public.get_my_profile_id());
CREATE POLICY "claims_update_admin_or_owner" ON public.insurance_claims FOR UPDATE TO authenticated
  USING (claimant_profile_id = public.get_my_profile_id() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (claimant_profile_id = public.get_my_profile_id() OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_insurance_claims_updated_at BEFORE UPDATE ON public.insurance_claims
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.insurance_claim_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.insurance_claims(id) ON DELETE CASCADE,
  kind public.insurance_attachment_kind NOT NULL,
  file_path text NOT NULL,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.insurance_claim_attachments TO authenticated;
GRANT ALL ON public.insurance_claim_attachments TO service_role;
ALTER TABLE public.insurance_claim_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "claim_att_select" ON public.insurance_claim_attachments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.insurance_claims c WHERE c.id = claim_id
    AND (c.claimant_profile_id = public.get_my_profile_id()
         OR public.has_role(auth.uid(),'admin')
         OR public.has_role(auth.uid(),'moderator'))));
CREATE POLICY "claim_att_insert_owner" ON public.insurance_claim_attachments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.insurance_claims c WHERE c.id = claim_id
    AND c.claimant_profile_id = public.get_my_profile_id()));
CREATE POLICY "claim_att_delete_owner" ON public.insurance_claim_attachments FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.insurance_claims c WHERE c.id = claim_id
    AND c.claimant_profile_id = public.get_my_profile_id()));

CREATE OR REPLACE FUNCTION public.open_insurance_claim(
  _description text, _service_id uuid DEFAULT NULL,
  _occurrence_date timestamptz DEFAULT now(),
  _estimated_amount numeric DEFAULT NULL
) RETURNS public.insurance_claims
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := public.get_my_profile_id(); _row public.insurance_claims; _proto text;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  _proto := 'SIN-' || to_char(now(),'YYYYMMDD') || '-' || lpad(((random()*9999)::int)::text, 4, '0');
  INSERT INTO public.insurance_claims(protocol, claimant_profile_id, service_id, occurrence_date, description, estimated_amount)
  VALUES (_proto, _me, _service_id, _occurrence_date, _description, _estimated_amount)
  RETURNING * INTO _row;
  INSERT INTO public.audit_logs(action, entity_type, entity_id, user_id, details)
  VALUES ('insurance.claim_opened','insurance_claim', _row.id, auth.uid(),
          jsonb_build_object('protocol', _proto, 'service_id', _service_id));
  RETURN _row;
END $$;
GRANT EXECUTE ON FUNCTION public.open_insurance_claim(text, uuid, timestamptz, numeric) TO authenticated;

-- Storage policies for insurance-claims bucket (private)
CREATE POLICY "insurance_obj_select_owner_or_admin" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'insurance-claims'
         AND (split_part(name,'/',1) = auth.uid()::text
              OR public.has_role(auth.uid(),'admin')
              OR public.has_role(auth.uid(),'moderator')));
CREATE POLICY "insurance_obj_insert_owner" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'insurance-claims' AND split_part(name,'/',1) = auth.uid()::text);
CREATE POLICY "insurance_obj_delete_owner" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'insurance-claims' AND split_part(name,'/',1) = auth.uid()::text);

-- ========== MÓDULO 12 — Botão de emergência (SOS) ==========

CREATE TYPE public.emergency_alert_status AS ENUM ('open','acknowledged','closed');
CREATE TYPE public.emergency_alert_role AS ENUM ('client','provider');

CREATE TABLE public.emergency_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol text NOT NULL UNIQUE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.emergency_alert_role NOT NULL,
  latitude double precision,
  longitude double precision,
  accuracy_meters numeric(8,2),
  triggered_at timestamptz NOT NULL DEFAULT now(),
  status public.emergency_alert_status NOT NULL DEFAULT 'open',
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  closed_by uuid,
  closed_at timestamptz,
  notes text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.emergency_alerts TO authenticated;
GRANT ALL ON public.emergency_alerts TO service_role;
ALTER TABLE public.emergency_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sos_select_own_or_admin" ON public.emergency_alerts FOR SELECT TO authenticated
  USING (profile_id = public.get_my_profile_id()
         OR public.has_role(auth.uid(),'admin')
         OR public.has_role(auth.uid(),'moderator'));
CREATE POLICY "sos_insert_own" ON public.emergency_alerts FOR INSERT TO authenticated
  WITH CHECK (profile_id = public.get_my_profile_id() AND user_id = auth.uid());
CREATE POLICY "sos_update_admin" ON public.emergency_alerts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));

CREATE TRIGGER trg_emergency_alerts_updated_at BEFORE UPDATE ON public.emergency_alerts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.trigger_emergency_alert(
  _latitude double precision DEFAULT NULL,
  _longitude double precision DEFAULT NULL,
  _accuracy_meters numeric DEFAULT NULL,
  _context jsonb DEFAULT '{}'::jsonb
) RETURNS public.emergency_alerts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _me_profile uuid := public.get_my_profile_id();
  _me_user uuid := auth.uid();
  _role public.emergency_alert_role;
  _user_type text;
  _proto text;
  _row public.emergency_alerts;
  _admin_profile uuid;
BEGIN
  IF _me_user IS NULL OR _me_profile IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT user_type INTO _user_type FROM public.profiles WHERE id = _me_profile;
  _role := CASE WHEN _user_type = 'provider' THEN 'provider'::public.emergency_alert_role
                ELSE 'client'::public.emergency_alert_role END;
  _proto := 'SOS-' || to_char(now(),'YYYYMMDD') || '-' || lpad(((random()*9999)::int)::text,4,'0');

  INSERT INTO public.emergency_alerts(protocol, profile_id, user_id, role, latitude, longitude, accuracy_meters, context)
  VALUES (_proto, _me_profile, _me_user, _role, _latitude, _longitude, _accuracy_meters, COALESCE(_context,'{}'::jsonb))
  RETURNING * INTO _row;

  INSERT INTO public.audit_logs(action, entity_type, entity_id, user_id, details)
  VALUES ('emergency.triggered','emergency_alert', _row.id, _me_user,
          jsonb_build_object('protocol', _proto, 'role', _role,
                             'lat', _latitude, 'lng', _longitude));

  -- Notifica todos os admins in-app
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
            jsonb_build_object('alert_id', _row.id, 'protocol', _proto,
                               'lat', _latitude, 'lng', _longitude));
  END LOOP;

  RETURN _row;
END $$;
GRANT EXECUTE ON FUNCTION public.trigger_emergency_alert(double precision, double precision, numeric, jsonb) TO authenticated;
