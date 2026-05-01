-- ============================================================
-- SPRINT 2 — Pricing, Auction & Service Disputes
-- ============================================================

-- Enum extra para disputas
DO $$ BEGIN
  CREATE TYPE public.service_dispute_status AS ENUM (
    'open',
    'evidence_requested',
    'under_review',
    'resolved_client',
    'resolved_provider',
    'resolved_split',
    'closed_no_action'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.pricing_unit AS ENUM ('hour', 'visit', 'project', 'service');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.proposal_status AS ENUM ('pending', 'accepted', 'rejected', 'withdrawn');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1. category_pricing
CREATE TABLE IF NOT EXISTS public.category_pricing (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL UNIQUE,
  min_price NUMERIC NOT NULL DEFAULT 0,
  suggested_price NUMERIC NOT NULL DEFAULT 0,
  max_price NUMERIC,
  unit public.pricing_unit NOT NULL DEFAULT 'service',
  currency TEXT NOT NULL DEFAULT 'BRL',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.category_pricing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view pricing" ON public.category_pricing;
CREATE POLICY "Anyone can view pricing" ON public.category_pricing
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role manages pricing" ON public.category_pricing;
CREATE POLICY "Service role manages pricing" ON public.category_pricing
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS update_category_pricing_updated_at ON public.category_pricing;
CREATE TRIGGER update_category_pricing_updated_at
  BEFORE UPDATE ON public.category_pricing
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. price_type em service_requests
DO $$ BEGIN
  ALTER TABLE public.service_requests
    ADD COLUMN price_type public.service_price_type NOT NULL DEFAULT 'negotiated';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- 3. service_proposals
CREATE TABLE IF NOT EXISTS public.service_proposals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_request_id UUID NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'BRL',
  message TEXT,
  estimated_days INTEGER,
  status public.proposal_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_proposal
  ON public.service_proposals (service_request_id, provider_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_proposals_request ON public.service_proposals(service_request_id);
CREATE INDEX IF NOT EXISTS idx_proposals_provider ON public.service_proposals(provider_id);

ALTER TABLE public.service_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Provider can view own proposals" ON public.service_proposals;
CREATE POLICY "Provider can view own proposals" ON public.service_proposals
  FOR SELECT TO authenticated
  USING (provider_id = public.get_my_profile_id());

DROP POLICY IF EXISTS "Task owner can view proposals" ON public.service_proposals;
CREATE POLICY "Task owner can view proposals" ON public.service_proposals
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.service_requests sr
    WHERE sr.id = service_proposals.service_request_id
      AND sr.profile_id = public.get_my_profile_id()
  ));

DROP POLICY IF EXISTS "Provider can create proposals" ON public.service_proposals;
CREATE POLICY "Provider can create proposals" ON public.service_proposals
  FOR INSERT TO authenticated
  WITH CHECK (provider_id = public.get_my_profile_id());

DROP POLICY IF EXISTS "Provider can update own proposals" ON public.service_proposals;
CREATE POLICY "Provider can update own proposals" ON public.service_proposals
  FOR UPDATE TO authenticated
  USING (provider_id = public.get_my_profile_id());

DROP POLICY IF EXISTS "Service role manages proposals" ON public.service_proposals;
CREATE POLICY "Service role manages proposals" ON public.service_proposals
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS update_service_proposals_updated_at ON public.service_proposals;
CREATE TRIGGER update_service_proposals_updated_at
  BEFORE UPDATE ON public.service_proposals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.service_proposals;

-- 4. service_disputes
CREATE TABLE IF NOT EXISTS public.service_disputes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  opened_by UUID NOT NULL,
  reason TEXT NOT NULL,
  description TEXT,
  status public.service_dispute_status NOT NULL DEFAULT 'open',
  moderator_id UUID,
  moderator_notes TEXT,
  resolution TEXT,
  refund_amount NUMERIC,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_disputes_service ON public.service_disputes(service_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON public.service_disputes(status);

ALTER TABLE public.service_disputes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view disputes" ON public.service_disputes;
CREATE POLICY "Participants can view disputes" ON public.service_disputes
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.services s
    WHERE s.id = service_disputes.service_id
      AND (s.client_id = public.get_my_profile_id() OR s.provider_id = public.get_my_profile_id())
  ));

DROP POLICY IF EXISTS "Participants can open disputes" ON public.service_disputes;
CREATE POLICY "Participants can open disputes" ON public.service_disputes
  FOR INSERT TO authenticated
  WITH CHECK (
    opened_by = public.get_my_profile_id()
    AND EXISTS (
      SELECT 1 FROM public.services s
      WHERE s.id = service_disputes.service_id
        AND (s.client_id = public.get_my_profile_id() OR s.provider_id = public.get_my_profile_id())
    )
  );

DROP POLICY IF EXISTS "Service role manages disputes" ON public.service_disputes;
CREATE POLICY "Service role manages disputes" ON public.service_disputes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS update_service_disputes_updated_at ON public.service_disputes;
CREATE TRIGGER update_service_disputes_updated_at
  BEFORE UPDATE ON public.service_disputes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. service_dispute_evidence
CREATE TABLE IF NOT EXISTS public.service_dispute_evidence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dispute_id UUID NOT NULL REFERENCES public.service_disputes(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL,
  message TEXT,
  file_urls TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dispute_evidence_dispute ON public.service_dispute_evidence(dispute_id);

ALTER TABLE public.service_dispute_evidence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view evidence" ON public.service_dispute_evidence;
CREATE POLICY "Participants can view evidence" ON public.service_dispute_evidence
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.service_disputes d
    JOIN public.services s ON s.id = d.service_id
    WHERE d.id = service_dispute_evidence.dispute_id
      AND (s.client_id = public.get_my_profile_id() OR s.provider_id = public.get_my_profile_id())
  ));

DROP POLICY IF EXISTS "Participants can submit evidence" ON public.service_dispute_evidence;
CREATE POLICY "Participants can submit evidence" ON public.service_dispute_evidence
  FOR INSERT TO authenticated
  WITH CHECK (
    submitted_by = public.get_my_profile_id()
    AND EXISTS (
      SELECT 1 FROM public.service_disputes d
      JOIN public.services s ON s.id = d.service_id
      WHERE d.id = service_dispute_evidence.dispute_id
        AND (s.client_id = public.get_my_profile_id() OR s.provider_id = public.get_my_profile_id())
    )
  );

DROP POLICY IF EXISTS "Service role manages evidence" ON public.service_dispute_evidence;
CREATE POLICY "Service role manages evidence" ON public.service_dispute_evidence
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.service_dispute_evidence;
ALTER PUBLICATION supabase_realtime ADD TABLE public.service_disputes;

-- 6. accept_service_proposal
CREATE OR REPLACE FUNCTION public.accept_service_proposal(_proposal_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me UUID;
  _proposal public.service_proposals;
  _request public.service_requests;
  _service_id UUID;
BEGIN
  _me := public.get_my_profile_id();
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO _proposal FROM public.service_proposals WHERE id = _proposal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposal not found'; END IF;
  IF _proposal.status <> 'pending' THEN RAISE EXCEPTION 'Proposal is not pending'; END IF;

  SELECT * INTO _request FROM public.service_requests WHERE id = _proposal.service_request_id FOR UPDATE;
  IF _request.profile_id <> _me THEN RAISE EXCEPTION 'Only task owner can accept proposals'; END IF;
  IF _request.status <> 'open' THEN RAISE EXCEPTION 'Task is not open'; END IF;

  -- Cria service
  INSERT INTO public.services (
    client_id, provider_id, service_request_id, category_id,
    title, description, price_type, agreed_price, currency, status
  ) VALUES (
    _me, _proposal.provider_id, _request.id, _request.category_id,
    LEFT(_request.description, 100), _request.description,
    'auction', _proposal.amount, _proposal.currency, 'accepted'
  )
  RETURNING id INTO _service_id;

  -- Aceita esta proposta, rejeita demais
  UPDATE public.service_proposals SET status = 'accepted'
    WHERE id = _proposal.id;
  UPDATE public.service_proposals SET status = 'rejected'
    WHERE service_request_id = _request.id AND id <> _proposal.id AND status = 'pending';

  -- Fecha tarefa
  UPDATE public.service_requests
    SET status = 'assigned', selected_provider_id = _proposal.provider_id, service_id = _service_id, is_active = false
    WHERE id = _request.id;

  RETURN _service_id;
END;
$$;

-- 7. open_service_dispute
CREATE OR REPLACE FUNCTION public.open_service_dispute(
  _service_id UUID,
  _reason TEXT,
  _description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me UUID;
  _svc public.services;
  _dispute_id UUID;
BEGIN
  _me := public.get_my_profile_id();
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO _svc FROM public.services WHERE id = _service_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Service not found'; END IF;
  IF _svc.client_id <> _me AND _svc.provider_id <> _me THEN
    RAISE EXCEPTION 'Not a participant';
  END IF;
  IF _svc.status NOT IN ('in_progress','completed','accepted') THEN
    RAISE EXCEPTION 'Service cannot be disputed in status %', _svc.status;
  END IF;

  INSERT INTO public.service_disputes (service_id, opened_by, reason, description, status)
  VALUES (_service_id, _me, _reason, _description, 'evidence_requested')
  RETURNING id INTO _dispute_id;

  UPDATE public.services
    SET status = 'disputed', disputed_at = now(), dispute_reason = _reason
    WHERE id = _service_id;

  -- Primeira evidência: a descrição
  IF _description IS NOT NULL AND length(_description) > 0 THEN
    INSERT INTO public.service_dispute_evidence (dispute_id, submitted_by, message)
    VALUES (_dispute_id, _me, _description);
  END IF;

  RETURN _dispute_id;
END;
$$;

-- 8. Bucket para evidências de disputa
INSERT INTO storage.buckets (id, name, public)
VALUES ('dispute-evidence', 'dispute-evidence', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated can upload dispute evidence" ON storage.objects;
CREATE POLICY "Authenticated can upload dispute evidence" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'dispute-evidence'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Authenticated can read own dispute evidence" ON storage.objects;
CREATE POLICY "Authenticated can read own dispute evidence" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'dispute-evidence'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- 9. Seed inicial de category_pricing (médias de mercado em BRL)
INSERT INTO public.category_pricing (category_id, min_price, suggested_price, max_price, unit, notes)
SELECT id, 80, 150, 400, 'hour', 'Valor sugerido com base em médias de mercado'
FROM public.service_categories
ON CONFLICT (category_id) DO NOTHING;