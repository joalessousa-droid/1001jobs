-- ============================================================
-- SPRINT 1 — Núcleo do serviço (lifecycle completo)
-- ============================================================

-- 1. ENUMs para status e tipos
DO $$ BEGIN
  CREATE TYPE public.service_status AS ENUM (
    'pending',
    'accepted',
    'in_progress',
    'completed',
    'confirmed',
    'cancelled_by_client',
    'cancelled_by_provider',
    'disputed',
    'refunded'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.service_price_type AS ENUM ('fixed', 'hourly', 'auction', 'negotiated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.service_payment_status AS ENUM ('pending', 'paid', 'refunded', 'released');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.service_request_status AS ENUM ('open', 'assigned', 'closed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Tabela services
CREATE TABLE IF NOT EXISTS public.services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  provider_id UUID NOT NULL,
  service_request_id UUID,
  appointment_id UUID,
  category_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  price_type public.service_price_type NOT NULL DEFAULT 'negotiated',
  agreed_price NUMERIC,
  currency TEXT NOT NULL DEFAULT 'BRL',
  status public.service_status NOT NULL DEFAULT 'pending',
  payment_status public.service_payment_status NOT NULL DEFAULT 'pending',
  cancellation_reason TEXT,
  dispute_reason TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  disputed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_services_client ON public.services(client_id);
CREATE INDEX IF NOT EXISTS idx_services_provider ON public.services(provider_id);
CREATE INDEX IF NOT EXISTS idx_services_status ON public.services(status);
CREATE INDEX IF NOT EXISTS idx_services_request ON public.services(service_request_id);

-- 3. Tabela de histórico
CREATE TABLE IF NOT EXISTS public.service_status_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  changed_by UUID NOT NULL,
  from_status public.service_status,
  to_status public.service_status NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_status_history_service ON public.service_status_history(service_id);

-- 4. Atualiza service_requests
ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS selected_provider_id UUID,
  ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status public.service_request_status NOT NULL DEFAULT 'open';

-- 5. Trigger updated_at em services
DROP TRIGGER IF EXISTS update_services_updated_at ON public.services;
CREATE TRIGGER update_services_updated_at
BEFORE UPDATE ON public.services
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Trigger que registra histórico em mudanças de status
CREATE OR REPLACE FUNCTION public.log_service_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _actor := COALESCE(public.get_my_profile_id(), NEW.client_id);
    INSERT INTO public.service_status_history (service_id, changed_by, from_status, to_status, reason)
    VALUES (NEW.id, _actor, NULL, NEW.status, 'Service created');
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    _actor := COALESCE(public.get_my_profile_id(), NEW.client_id);
    INSERT INTO public.service_status_history (service_id, changed_by, from_status, to_status, reason)
    VALUES (
      NEW.id,
      _actor,
      OLD.status,
      NEW.status,
      COALESCE(NEW.cancellation_reason, NEW.dispute_reason)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_service_status ON public.services;
CREATE TRIGGER trg_log_service_status
AFTER INSERT OR UPDATE OF status ON public.services
FOR EACH ROW EXECUTE FUNCTION public.log_service_status_change();

-- 7. Função de transição validada
CREATE OR REPLACE FUNCTION public.transition_service_status(
  _service_id UUID,
  _new_status public.service_status,
  _reason TEXT DEFAULT NULL
)
RETURNS public.services
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _svc public.services;
  _me UUID;
  _is_client BOOLEAN;
  _is_provider BOOLEAN;
  _allowed BOOLEAN := false;
BEGIN
  _me := public.get_my_profile_id();
  IF _me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO _svc FROM public.services WHERE id = _service_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service not found';
  END IF;

  _is_client := (_svc.client_id = _me);
  _is_provider := (_svc.provider_id = _me);

  IF NOT (_is_client OR _is_provider) THEN
    RAISE EXCEPTION 'Not a participant of this service';
  END IF;

  -- Matriz de transições permitidas
  IF _svc.status = 'pending' AND _new_status = 'accepted' AND _is_provider THEN
    _allowed := true;
  ELSIF _svc.status = 'pending' AND _new_status IN ('cancelled_by_client') AND _is_client THEN
    _allowed := true;
  ELSIF _svc.status = 'pending' AND _new_status IN ('cancelled_by_provider') AND _is_provider THEN
    _allowed := true;
  ELSIF _svc.status = 'accepted' AND _new_status = 'in_progress' AND _is_provider THEN
    _allowed := true;
  ELSIF _svc.status = 'accepted' AND _new_status = 'cancelled_by_client' AND _is_client THEN
    _allowed := true;
  ELSIF _svc.status = 'accepted' AND _new_status = 'cancelled_by_provider' AND _is_provider THEN
    _allowed := true;
  ELSIF _svc.status = 'in_progress' AND _new_status = 'completed' AND _is_provider THEN
    _allowed := true;
  ELSIF _svc.status = 'in_progress' AND _new_status = 'disputed' AND _is_client THEN
    _allowed := true;
  ELSIF _svc.status = 'completed' AND _new_status = 'confirmed' AND _is_client THEN
    _allowed := true;
  ELSIF _svc.status = 'completed' AND _new_status = 'disputed' AND _is_client THEN
    _allowed := true;
  END IF;

  IF NOT _allowed THEN
    RAISE EXCEPTION 'Transition % -> % not allowed for this user', _svc.status, _new_status;
  END IF;

  -- Aplica mudança + timestamps + motivo
  UPDATE public.services SET
    status = _new_status,
    started_at = CASE WHEN _new_status = 'in_progress' THEN now() ELSE started_at END,
    completed_at = CASE WHEN _new_status = 'completed' THEN now() ELSE completed_at END,
    confirmed_at = CASE WHEN _new_status = 'confirmed' THEN now() ELSE confirmed_at END,
    cancelled_at = CASE WHEN _new_status IN ('cancelled_by_client','cancelled_by_provider') THEN now() ELSE cancelled_at END,
    disputed_at = CASE WHEN _new_status = 'disputed' THEN now() ELSE disputed_at END,
    cancellation_reason = CASE WHEN _new_status IN ('cancelled_by_client','cancelled_by_provider') THEN _reason ELSE cancellation_reason END,
    dispute_reason = CASE WHEN _new_status = 'disputed' THEN _reason ELSE dispute_reason END
  WHERE id = _service_id
  RETURNING * INTO _svc;

  -- Se confirmado, fecha service_request vinculado
  IF _new_status = 'confirmed' AND _svc.service_request_id IS NOT NULL THEN
    UPDATE public.service_requests
      SET status = 'closed', is_active = false
      WHERE id = _svc.service_request_id;
  END IF;

  RETURN _svc;
END;
$$;

-- 8. RLS
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view services" ON public.services;
CREATE POLICY "Participants can view services"
ON public.services FOR SELECT TO authenticated
USING (client_id = public.get_my_profile_id() OR provider_id = public.get_my_profile_id());

DROP POLICY IF EXISTS "Clients can create services" ON public.services;
CREATE POLICY "Clients can create services"
ON public.services FOR INSERT TO authenticated
WITH CHECK (client_id = public.get_my_profile_id());

DROP POLICY IF EXISTS "Participants can update services" ON public.services;
CREATE POLICY "Participants can update services"
ON public.services FOR UPDATE TO authenticated
USING (client_id = public.get_my_profile_id() OR provider_id = public.get_my_profile_id());

DROP POLICY IF EXISTS "Service role manages services" ON public.services;
CREATE POLICY "Service role manages services"
ON public.services FOR ALL TO service_role
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Participants can view status history" ON public.service_status_history;
CREATE POLICY "Participants can view status history"
ON public.service_status_history FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.services s
  WHERE s.id = service_status_history.service_id
    AND (s.client_id = public.get_my_profile_id() OR s.provider_id = public.get_my_profile_id())
));

DROP POLICY IF EXISTS "Service role manages status history" ON public.service_status_history;
CREATE POLICY "Service role manages status history"
ON public.service_status_history FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- 9. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.services;