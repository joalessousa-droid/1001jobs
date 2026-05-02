
-- Enum status
DO $$ BEGIN
  CREATE TYPE public.service_payment_state AS ENUM (
    'pending','authorized','captured','released','refunded','partial_refund','failed','cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.service_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  provider_id uuid NOT NULL,
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'BRL',
  platform_fee numeric(12,2) NOT NULL DEFAULT 0,
  refund_amount numeric(12,2),
  state public.service_payment_state NOT NULL DEFAULT 'pending',
  stripe_payment_intent_id text UNIQUE,
  stripe_checkout_session_id text UNIQUE,
  authorized_at timestamptz,
  captured_at timestamptz,
  released_at timestamptz,
  refunded_at timestamptz,
  failure_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_payments_service ON public.service_payments(service_id);
CREATE INDEX IF NOT EXISTS idx_service_payments_state ON public.service_payments(state);

ALTER TABLE public.service_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants view payments"
  ON public.service_payments FOR SELECT TO authenticated
  USING (client_id = public.get_my_profile_id() OR provider_id = public.get_my_profile_id()
         OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));

CREATE POLICY "Service role manages payments"
  ON public.service_payments FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_service_payments_updated
  BEFORE UPDATE ON public.service_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Mantém services.payment_status em sincronia com service_payments.state
CREATE OR REPLACE FUNCTION public.sync_service_payment_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _new public.service_payment_status;
BEGIN
  _new := CASE NEW.state
    WHEN 'pending' THEN 'pending'::public.service_payment_status
    WHEN 'authorized' THEN 'paid'::public.service_payment_status
    WHEN 'captured' THEN 'paid'::public.service_payment_status
    WHEN 'released' THEN 'released'::public.service_payment_status
    WHEN 'refunded' THEN 'refunded'::public.service_payment_status
    WHEN 'partial_refund' THEN 'refunded'::public.service_payment_status
    WHEN 'failed' THEN 'failed'::public.service_payment_status
    WHEN 'cancelled' THEN 'pending'::public.service_payment_status
  END;
  UPDATE public.services SET payment_status = _new WHERE id = NEW.service_id;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sync_service_payment_status() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_service_payments_sync
  AFTER INSERT OR UPDATE OF state ON public.service_payments
  FOR EACH ROW EXECUTE FUNCTION public.sync_service_payment_status();

-- Libera pagamento quando confirma serviço
CREATE OR REPLACE FUNCTION public.release_service_payment(_service_id uuid)
RETURNS public.service_payments LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _pay public.service_payments;
BEGIN
  UPDATE public.service_payments
    SET state='released', released_at=now()
    WHERE service_id=_service_id AND state IN ('authorized','captured')
    RETURNING * INTO _pay;
  RETURN _pay;
END $$;
REVOKE ALL ON FUNCTION public.release_service_payment(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_service_payment(uuid) TO service_role;

-- Registra reembolso (chamado por edge function após Stripe refund)
CREATE OR REPLACE FUNCTION public.record_service_refund(_service_id uuid, _amount numeric, _full boolean)
RETURNS public.service_payments LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _pay public.service_payments;
BEGIN
  UPDATE public.service_payments SET
    state = CASE WHEN _full THEN 'refunded'::public.service_payment_state ELSE 'partial_refund'::public.service_payment_state END,
    refund_amount = COALESCE(refund_amount,0) + _amount,
    refunded_at = now()
    WHERE service_id=_service_id
    RETURNING * INTO _pay;
  RETURN _pay;
END $$;
REVOKE ALL ON FUNCTION public.record_service_refund(uuid,numeric,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_service_refund(uuid,numeric,boolean) TO service_role;

-- Atualiza transition_service_status: ao confirmar, libera pagamento
CREATE OR REPLACE FUNCTION public.transition_service_status(_service_id uuid, _new_status service_status, _reason text DEFAULT NULL::text)
RETURNS services LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  _svc public.services; _me UUID; _is_client BOOLEAN; _is_provider BOOLEAN; _allowed BOOLEAN := false;
BEGIN
  _me := public.get_my_profile_id();
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _svc FROM public.services WHERE id=_service_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Service not found'; END IF;
  _is_client := (_svc.client_id=_me); _is_provider := (_svc.provider_id=_me);
  IF NOT (_is_client OR _is_provider) THEN RAISE EXCEPTION 'Not a participant'; END IF;

  IF _svc.status='pending' AND _new_status='accepted' AND _is_provider THEN _allowed:=true;
  ELSIF _svc.status='pending' AND _new_status='cancelled_by_client' AND _is_client THEN _allowed:=true;
  ELSIF _svc.status='pending' AND _new_status='cancelled_by_provider' AND _is_provider THEN _allowed:=true;
  ELSIF _svc.status='accepted' AND _new_status='in_progress' AND _is_provider THEN _allowed:=true;
  ELSIF _svc.status='accepted' AND _new_status='cancelled_by_client' AND _is_client THEN _allowed:=true;
  ELSIF _svc.status='accepted' AND _new_status='cancelled_by_provider' AND _is_provider THEN _allowed:=true;
  ELSIF _svc.status='in_progress' AND _new_status='completed' AND _is_provider THEN _allowed:=true;
  ELSIF _svc.status='in_progress' AND _new_status='disputed' AND _is_client THEN _allowed:=true;
  ELSIF _svc.status='completed' AND _new_status='confirmed' AND _is_client THEN _allowed:=true;
  ELSIF _svc.status='completed' AND _new_status='disputed' AND _is_client THEN _allowed:=true;
  END IF;
  IF NOT _allowed THEN RAISE EXCEPTION 'Transition % -> % not allowed', _svc.status, _new_status; END IF;

  UPDATE public.services SET
    status=_new_status,
    started_at=CASE WHEN _new_status='in_progress' THEN now() ELSE started_at END,
    completed_at=CASE WHEN _new_status='completed' THEN now() ELSE completed_at END,
    confirmed_at=CASE WHEN _new_status='confirmed' THEN now() ELSE confirmed_at END,
    cancelled_at=CASE WHEN _new_status IN ('cancelled_by_client','cancelled_by_provider') THEN now() ELSE cancelled_at END,
    disputed_at=CASE WHEN _new_status='disputed' THEN now() ELSE disputed_at END,
    cancellation_reason=CASE WHEN _new_status IN ('cancelled_by_client','cancelled_by_provider') THEN _reason ELSE cancellation_reason END,
    dispute_reason=CASE WHEN _new_status='disputed' THEN _reason ELSE dispute_reason END
  WHERE id=_service_id RETURNING * INTO _svc;

  IF _new_status='confirmed' THEN
    PERFORM public.release_service_payment(_service_id);
    IF _svc.service_request_id IS NOT NULL THEN
      UPDATE public.service_requests SET status='closed', is_active=false WHERE id=_svc.service_request_id;
    END IF;
  END IF;
  RETURN _svc;
END $$;
REVOKE ALL ON FUNCTION public.transition_service_status(uuid, service_status, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transition_service_status(uuid, service_status, text) TO authenticated;
