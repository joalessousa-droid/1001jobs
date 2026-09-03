-- Provider sends a price quote for an offer
CREATE OR REPLACE FUNCTION public.quote_service_offer(_offer_id uuid, _price numeric, _note text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _me uuid := public.get_my_profile_id();
  _offer public.service_offers;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _price IS NULL OR _price <= 0 OR _price > 1000000 THEN RAISE EXCEPTION 'Invalid price'; END IF;

  SELECT * INTO _offer FROM public.service_offers WHERE id = _offer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Offer not found'; END IF;
  IF _offer.provider_id <> _me THEN RAISE EXCEPTION 'Not your offer'; END IF;
  IF _offer.status NOT IN ('pending','queued','quoted') THEN
    RAISE EXCEPTION 'Offer no longer open (%)', _offer.status;
  END IF;
  IF _offer.expires_at < now() THEN
    UPDATE public.service_offers SET status='expired', responded_at=now() WHERE id=_offer_id;
    RAISE EXCEPTION 'Offer expired';
  END IF;

  UPDATE public.service_offers
     SET status = 'quoted',
         responded_at = now(),
         updated_at = now(),
         metadata = metadata
                    || jsonb_build_object('quoted_price', _price, 'quote_note', _note, 'quoted_at', now())
   WHERE id = _offer_id;

  RETURN _offer_id;
END;
$$;

REVOKE ALL ON FUNCTION public.quote_service_offer(uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quote_service_offer(uuid, numeric, text) TO authenticated, service_role;

-- Client accepts a quoted offer (clicking the price)
CREATE OR REPLACE FUNCTION public.client_accept_offer(_offer_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _me uuid := public.get_my_profile_id();
  _offer public.service_offers;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO _offer FROM public.service_offers WHERE id = _offer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Offer not found'; END IF;
  IF _offer.client_id <> _me THEN RAISE EXCEPTION 'Not your request'; END IF;
  IF _offer.status NOT IN ('pending','queued','quoted') THEN
    RAISE EXCEPTION 'Offer no longer open (%)', _offer.status;
  END IF;

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

  RETURN _offer.provider_id;
END;
$$;

REVOKE ALL ON FUNCTION public.client_accept_offer(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_accept_offer(uuid) TO authenticated, service_role;