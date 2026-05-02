
-- =========================================================
-- ROLES
-- =========================================================
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin','moderator','user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =========================================================
-- NOTIFICATIONS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text,
  link text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_profile_unread
  ON public.notifications(profile_id, read, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own notifications" ON public.notifications;
CREATE POLICY "Users view own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (profile_id = public.get_my_profile_id());

DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (profile_id = public.get_my_profile_id());

DROP POLICY IF EXISTS "Service role manages notifications" ON public.notifications;
CREATE POLICY "Service role manages notifications" ON public.notifications
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- =========================================================
-- ADMIN POLICIES on disputes
-- =========================================================
DROP POLICY IF EXISTS "Admins view all disputes" ON public.service_disputes;
CREATE POLICY "Admins view all disputes" ON public.service_disputes
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));

DROP POLICY IF EXISTS "Admins update disputes" ON public.service_disputes;
CREATE POLICY "Admins update disputes" ON public.service_disputes
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));

DROP POLICY IF EXISTS "Admins view all evidence" ON public.service_dispute_evidence;
CREATE POLICY "Admins view all evidence" ON public.service_dispute_evidence
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));

DROP POLICY IF EXISTS "Admins view all services" ON public.services;
CREATE POLICY "Admins view all services" ON public.services
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));

-- =========================================================
-- TRIGGERS that emit notifications
-- =========================================================
CREATE OR REPLACE FUNCTION public.notify_service_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _title text;
  _link text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    _title := 'Serviço: ' || NEW.title;
    _link := '/dashboard?tab=service-orders';
    INSERT INTO public.notifications(profile_id, type, title, message, link, metadata)
    VALUES
      (NEW.client_id, 'service_status', _title,
        'Status atualizado para ' || NEW.status::text, _link,
        jsonb_build_object('service_id', NEW.id, 'status', NEW.status)),
      (NEW.provider_id, 'service_status', _title,
        'Status atualizado para ' || NEW.status::text, _link,
        jsonb_build_object('service_id', NEW.id, 'status', NEW.status));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_services_notify_status ON public.services;
CREATE TRIGGER trg_services_notify_status
AFTER UPDATE ON public.services
FOR EACH ROW EXECUTE FUNCTION public.notify_service_status_change();

CREATE OR REPLACE FUNCTION public.notify_dispute_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _svc public.services;
  _link text;
BEGIN
  SELECT * INTO _svc FROM public.services WHERE id = NEW.service_id;
  _link := '/disputa/' || NEW.id::text;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications(profile_id, type, title, message, link, metadata)
    VALUES
      (_svc.client_id, 'dispute_opened', 'Disputa aberta',
        'Uma disputa foi aberta no serviço "' || _svc.title || '"', _link,
        jsonb_build_object('dispute_id', NEW.id, 'service_id', _svc.id)),
      (_svc.provider_id, 'dispute_opened', 'Disputa aberta',
        'Uma disputa foi aberta no serviço "' || _svc.title || '"', _link,
        jsonb_build_object('dispute_id', NEW.id, 'service_id', _svc.id));
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.notifications(profile_id, type, title, message, link, metadata)
    VALUES
      (_svc.client_id, 'dispute_status', 'Disputa atualizada',
        'Status: ' || NEW.status::text, _link,
        jsonb_build_object('dispute_id', NEW.id, 'status', NEW.status)),
      (_svc.provider_id, 'dispute_status', 'Disputa atualizada',
        'Status: ' || NEW.status::text, _link,
        jsonb_build_object('dispute_id', NEW.id, 'status', NEW.status));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_disputes_notify ON public.service_disputes;
CREATE TRIGGER trg_disputes_notify
AFTER INSERT OR UPDATE ON public.service_disputes
FOR EACH ROW EXECUTE FUNCTION public.notify_dispute_status_change();

CREATE OR REPLACE FUNCTION public.notify_dispute_evidence()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _svc public.services;
  _dispute public.service_disputes;
  _other uuid;
  _link text;
BEGIN
  SELECT * INTO _dispute FROM public.service_disputes WHERE id = NEW.dispute_id;
  SELECT * INTO _svc FROM public.services WHERE id = _dispute.service_id;
  _link := '/disputa/' || _dispute.id::text;

  IF NEW.submitted_by = _svc.client_id THEN
    _other := _svc.provider_id;
  ELSE
    _other := _svc.client_id;
  END IF;

  INSERT INTO public.notifications(profile_id, type, title, message, link, metadata)
  VALUES (_other, 'dispute_evidence', 'Nova evidência na disputa',
    COALESCE(LEFT(NEW.message, 140), array_length(NEW.file_urls,1)::text || ' arquivo(s) anexado(s)'),
    _link, jsonb_build_object('dispute_id', _dispute.id));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_dispute_evidence_notify ON public.service_dispute_evidence;
CREATE TRIGGER trg_dispute_evidence_notify
AFTER INSERT ON public.service_dispute_evidence
FOR EACH ROW EXECUTE FUNCTION public.notify_dispute_evidence();

-- =========================================================
-- ADMIN: resolve dispute (refund / split / favor)
-- =========================================================
CREATE OR REPLACE FUNCTION public.resolve_service_dispute(
  _dispute_id uuid,
  _decision text,        -- resolved_client | resolved_provider | resolved_split | closed_no_action
  _resolution text,
  _refund_amount numeric DEFAULT NULL,
  _moderator_notes text DEFAULT NULL
) RETURNS public.service_disputes
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _me uuid;
  _disp public.service_disputes;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator')) THEN
    RAISE EXCEPTION 'Only moderators can resolve disputes';
  END IF;
  IF _decision NOT IN ('resolved_client','resolved_provider','resolved_split','closed_no_action') THEN
    RAISE EXCEPTION 'Invalid decision %', _decision;
  END IF;

  _me := public.get_my_profile_id();

  UPDATE public.service_disputes SET
    status = _decision::public.service_dispute_status,
    resolution = _resolution,
    refund_amount = _refund_amount,
    moderator_notes = _moderator_notes,
    moderator_id = _me,
    resolved_at = now()
  WHERE id = _dispute_id
  RETURNING * INTO _disp;

  IF NOT FOUND THEN RAISE EXCEPTION 'Dispute not found'; END IF;

  -- Atualiza serviço conforme decisão
  IF _decision = 'resolved_client' THEN
    UPDATE public.services SET status = 'refunded', payment_status = 'refunded' WHERE id = _disp.service_id;
  ELSIF _decision = 'resolved_provider' THEN
    UPDATE public.services SET status = 'confirmed', confirmed_at = now() WHERE id = _disp.service_id;
  ELSIF _decision = 'resolved_split' THEN
    UPDATE public.services SET status = 'confirmed', confirmed_at = now(), payment_status = 'refunded' WHERE id = _disp.service_id;
  ELSIF _decision = 'closed_no_action' THEN
    UPDATE public.services SET status = 'completed' WHERE id = _disp.service_id AND status = 'disputed';
  END IF;

  RETURN _disp;
END $$;
