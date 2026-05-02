
-- ============================================================
-- Sprint 6 — Hardening RLS de service_payments + auditoria
-- ============================================================

-- 1) Tabela de auditoria para o stripe-webhook e checkouts
CREATE TABLE IF NOT EXISTS public.service_payment_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id UUID,
  payment_id UUID,
  actor_profile_id UUID,
  actor_user_id UUID,
  source TEXT NOT NULL,                 -- 'checkout' | 'webhook' | 'refund' | 'manual'
  event_type TEXT NOT NULL,             -- 'checkout.attempt','checkout.session.completed','charge.refunded','error', etc.
  status TEXT NOT NULL DEFAULT 'info',  -- 'info' | 'success' | 'warning' | 'error'
  message TEXT,
  stripe_event_id TEXT,
  stripe_payment_intent_id TEXT,
  stripe_session_id TEXT,
  amount NUMERIC,
  currency TEXT,
  ip_address TEXT,
  user_agent TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_detail JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_spal_service_id ON public.service_payment_audit_logs(service_id);
CREATE INDEX IF NOT EXISTS idx_spal_payment_id ON public.service_payment_audit_logs(payment_id);
CREATE INDEX IF NOT EXISTS idx_spal_event_type ON public.service_payment_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_spal_status ON public.service_payment_audit_logs(status);
CREATE INDEX IF NOT EXISTS idx_spal_created_at ON public.service_payment_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_spal_stripe_event ON public.service_payment_audit_logs(stripe_event_id);

ALTER TABLE public.service_payment_audit_logs ENABLE ROW LEVEL SECURITY;

-- Apenas service_role escreve; admins/moderators leem tudo; participantes leem só os seus
DROP POLICY IF EXISTS "Service role manages payment audit" ON public.service_payment_audit_logs;
CREATE POLICY "Service role manages payment audit"
  ON public.service_payment_audit_logs
  FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admins view all payment audit" ON public.service_payment_audit_logs;
CREATE POLICY "Admins view all payment audit"
  ON public.service_payment_audit_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

DROP POLICY IF EXISTS "Participants view own payment audit" ON public.service_payment_audit_logs;
CREATE POLICY "Participants view own payment audit"
  ON public.service_payment_audit_logs
  FOR SELECT
  TO authenticated
  USING (
    service_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.services s
      WHERE s.id = service_payment_audit_logs.service_id
        AND (s.client_id = public.get_my_profile_id() OR s.provider_id = public.get_my_profile_id())
    )
  );

-- 2) Função SECURITY DEFINER para gravar logs (única forma das edge functions inserirem com contexto seguro)
CREATE OR REPLACE FUNCTION public.log_service_payment_event(
  _service_id UUID,
  _payment_id UUID,
  _source TEXT,
  _event_type TEXT,
  _status TEXT DEFAULT 'info',
  _message TEXT DEFAULT NULL,
  _stripe_event_id TEXT DEFAULT NULL,
  _stripe_payment_intent_id TEXT DEFAULT NULL,
  _stripe_session_id TEXT DEFAULT NULL,
  _amount NUMERIC DEFAULT NULL,
  _currency TEXT DEFAULT NULL,
  _ip_address TEXT DEFAULT NULL,
  _user_agent TEXT DEFAULT NULL,
  _payload JSONB DEFAULT '{}'::jsonb,
  _error_detail JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _id UUID;
BEGIN
  INSERT INTO public.service_payment_audit_logs(
    service_id, payment_id, actor_profile_id, actor_user_id,
    source, event_type, status, message,
    stripe_event_id, stripe_payment_intent_id, stripe_session_id,
    amount, currency, ip_address, user_agent, payload, error_detail
  ) VALUES (
    _service_id, _payment_id, public.get_my_profile_id(), auth.uid(),
    _source, _event_type, COALESCE(_status,'info'), _message,
    _stripe_event_id, _stripe_payment_intent_id, _stripe_session_id,
    _amount, _currency, _ip_address, _user_agent, COALESCE(_payload,'{}'::jsonb), _error_detail
  ) RETURNING id INTO _id;
  RETURN _id;
END $$;

REVOKE ALL ON FUNCTION public.log_service_payment_event(
  UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,NUMERIC,TEXT,TEXT,TEXT,JSONB,JSONB
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_service_payment_event(
  UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,NUMERIC,TEXT,TEXT,TEXT,JSONB,JSONB
) TO service_role;

-- 3) Endurecimento das policies de service_payments
-- Nada de INSERT/UPDATE/DELETE direto pelo client — só via RPC/edge (service_role)
DROP POLICY IF EXISTS "Participants view payments" ON public.service_payments;
CREATE POLICY "Participants view own payments"
  ON public.service_payments
  FOR SELECT
  TO authenticated
  USING (
    client_id = public.get_my_profile_id()
    OR provider_id = public.get_my_profile_id()
  );

DROP POLICY IF EXISTS "Admins view all payments" ON public.service_payments;
CREATE POLICY "Admins view all payments"
  ON public.service_payments
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));

-- Garante que escrita continua restrita ao service_role (a policy "Service role manages payments" já existe)
-- Sem INSERT/UPDATE/DELETE para authenticated → privilege escalation impossible via REST.

-- 4) Função guardada de checagem de acesso a um pagamento (usada por edges)
CREATE OR REPLACE FUNCTION public.can_access_service_payment(_payment_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.service_payments p
    WHERE p.id = _payment_id
      AND (
        p.client_id   = public.get_my_profile_id()
        OR p.provider_id = public.get_my_profile_id()
        OR public.has_role(auth.uid(),'admin')
        OR public.has_role(auth.uid(),'moderator')
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_access_service_payment(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_service_payment(UUID) TO authenticated, service_role;
