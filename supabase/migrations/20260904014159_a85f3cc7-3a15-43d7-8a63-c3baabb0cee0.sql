CREATE OR REPLACE FUNCTION public.admin_open_service_dispute(
  _service_id uuid,
  _reason text,
  _description text DEFAULT NULL,
  _on_behalf_of text DEFAULT 'client'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _me UUID;
  _svc public.services;
  _opener UUID;
  _dispute_id UUID;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  _me := public.get_my_profile_id();

  SELECT * INTO _svc FROM public.services WHERE id = _service_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Service not found'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.service_disputes
    WHERE service_id = _service_id
      AND status NOT IN ('resolved_client','resolved_provider','resolved_split','closed_no_action')
  ) THEN
    RAISE EXCEPTION 'An open dispute already exists for this service';
  END IF;

  _opener := CASE WHEN _on_behalf_of = 'provider' THEN _svc.provider_id ELSE _svc.client_id END;
  IF _opener IS NULL THEN _opener := COALESCE(_svc.client_id, _svc.provider_id, _me); END IF;

  INSERT INTO public.service_disputes (service_id, opened_by, reason, description, status, moderator_id, moderator_notes)
  VALUES (_service_id, _opener, _reason, _description, 'evidence_requested', _me,
          'Caso registrado pelo suporte 1001 Garantia')
  RETURNING id INTO _dispute_id;

  UPDATE public.services
    SET status = 'disputed', disputed_at = now(), dispute_reason = _reason
    WHERE id = _service_id;

  IF _description IS NOT NULL AND length(_description) > 0 THEN
    INSERT INTO public.service_dispute_evidence (dispute_id, submitted_by, message)
    VALUES (_dispute_id, COALESCE(_me, _opener), _description);
  END IF;

  RETURN _dispute_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_open_service_dispute(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_open_service_dispute(uuid, text, text, text) TO authenticated;