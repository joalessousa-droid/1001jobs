CREATE OR REPLACE FUNCTION public.radar_accept_and_schedule(
  _offer_id uuid,
  _scheduled_date date,
  _scheduled_time time,
  _duration_minutes integer DEFAULT 60,
  _notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _me uuid := public.get_my_profile_id();
  _offer public.service_offers;
  _price numeric;
  _title text;
  _service_id uuid;
  _appointment_id uuid;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO _offer FROM public.service_offers WHERE id = _offer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Offer not found'; END IF;
  IF _offer.client_id <> _me THEN RAISE EXCEPTION 'Not your request'; END IF;

  _price := NULLIF(_offer.metadata->>'quoted_price', '')::numeric;

  IF _offer.status IN ('pending','queued','quoted') THEN
    UPDATE public.service_offers
       SET status = 'accepted', responded_at = now(), updated_at = now()
     WHERE id = _offer_id;

    IF _offer.service_request_id IS NOT NULL THEN
      UPDATE public.service_offers
         SET status = 'superseded', updated_at = now()
       WHERE service_request_id = _offer.service_request_id
         AND id <> _offer_id
         AND status IN ('pending','queued','quoted');

      UPDATE public.service_requests
         SET status = 'assigned', selected_provider_id = _offer.provider_id, is_active = false
       WHERE id = _offer.service_request_id;
    END IF;
  ELSIF _offer.status <> 'accepted' THEN
    RAISE EXCEPTION 'Offer no longer open (%)', _offer.status;
  END IF;

  SELECT COALESCE(NULLIF(sr.description, ''), 'Atendimento via Radar')
    INTO _title
    FROM public.service_requests sr
   WHERE sr.id = _offer.service_request_id;
  _title := COALESCE(_title, 'Atendimento via Radar');

  SELECT s.id INTO _service_id
    FROM public.services s
   WHERE s.client_id = _me
     AND s.provider_id = _offer.provider_id
     AND s.service_request_id IS NOT DISTINCT FROM _offer.service_request_id
     AND s.status IN ('pending','accepted','in_progress')
   ORDER BY s.created_at DESC
   LIMIT 1;

  IF _service_id IS NULL THEN
    INSERT INTO public.services (
      client_id, provider_id, service_request_id, title, description,
      price_type, agreed_price, status, payment_status
    ) VALUES (
      _me, _offer.provider_id, _offer.service_request_id, left(_title, 120), _notes,
      'negotiated', _price, 'accepted', 'pending'
    ) RETURNING id INTO _service_id;
  ELSE
    UPDATE public.services
       SET agreed_price = COALESCE(_price, agreed_price),
           status = CASE WHEN status = 'pending' THEN 'accepted'::service_status ELSE status END,
           updated_at = now()
     WHERE id = _service_id;
  END IF;

  INSERT INTO public.appointments (
    client_id, provider_id, service_id, scheduled_date, scheduled_time,
    duration_minutes, status, notes
  ) VALUES (
    _me, _offer.provider_id, _service_id, _scheduled_date, _scheduled_time,
    COALESCE(_duration_minutes, 60), 'confirmed', _notes
  ) RETURNING id INTO _appointment_id;

  UPDATE public.services SET appointment_id = _appointment_id, updated_at = now()
   WHERE id = _service_id;

  RETURN jsonb_build_object(
    'service_id', _service_id,
    'appointment_id', _appointment_id,
    'provider_id', _offer.provider_id,
    'price', _price
  );
END;
$$;

REVOKE ALL ON FUNCTION public.radar_accept_and_schedule(uuid, date, time, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.radar_accept_and_schedule(uuid, date, time, integer, text) TO authenticated, service_role;