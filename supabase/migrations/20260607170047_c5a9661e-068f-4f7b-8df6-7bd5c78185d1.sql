
-- ===== eta_alert_deliveries: novas colunas =====
ALTER TABLE public.eta_alert_deliveries
  ADD COLUMN IF NOT EXISTS template_id uuid,
  ADD COLUMN IF NOT EXISTS template_version int,
  ADD COLUMN IF NOT EXISTS webhook_id uuid,
  ADD COLUMN IF NOT EXISTS webhook_version int,
  ADD COLUMN IF NOT EXISTS payload_size int,
  ADD COLUMN IF NOT EXISTS hmac_validated boolean,
  ADD COLUMN IF NOT EXISTS hmac_validation_error text,
  ADD COLUMN IF NOT EXISTS hmac_validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS metadata jsonb;

CREATE INDEX IF NOT EXISTS eta_alert_deliveries_template_ver_idx
  ON public.eta_alert_deliveries(template_id, template_version);
CREATE INDEX IF NOT EXISTS eta_alert_deliveries_webhook_ver_idx
  ON public.eta_alert_deliveries(webhook_id, webhook_version);

-- ===== eta_alert_webhooks: versão + rotação =====
ALTER TABLE public.eta_alert_webhooks
  ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS secret_next text,
  ADD COLUMN IF NOT EXISTS secret_next_activates_at timestamptz,
  ADD COLUMN IF NOT EXISTS secret_expires_at timestamptz;

-- ===== Tabela de versões de webhooks =====
CREATE TABLE IF NOT EXISTS public.eta_alert_webhook_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid NOT NULL REFERENCES public.eta_alert_webhooks(id) ON DELETE CASCADE,
  version int NOT NULL,
  name text NOT NULL,
  url text NOT NULL,
  headers jsonb,
  alert_types text[],
  min_severity text,
  max_retries int,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(webhook_id, version)
);
GRANT SELECT ON public.eta_alert_webhook_versions TO authenticated;
GRANT ALL ON public.eta_alert_webhook_versions TO service_role;
ALTER TABLE public.eta_alert_webhook_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view webhook versions" ON public.eta_alert_webhook_versions
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator')
  );

-- Trigger: cria snapshot e incrementa version a cada alteração relevante
CREATE OR REPLACE FUNCTION public.eta_alert_webhook_snapshot()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE next_ver int;
BEGIN
  IF TG_OP = 'UPDATE' AND
     NEW.name IS NOT DISTINCT FROM OLD.name AND
     NEW.url IS NOT DISTINCT FROM OLD.url AND
     NEW.headers IS NOT DISTINCT FROM OLD.headers AND
     NEW.alert_types IS NOT DISTINCT FROM OLD.alert_types AND
     NEW.min_severity IS NOT DISTINCT FROM OLD.min_severity AND
     NEW.max_retries IS NOT DISTINCT FROM OLD.max_retries THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(MAX(version),0) + 1 INTO next_ver
    FROM public.eta_alert_webhook_versions WHERE webhook_id = NEW.id;
  NEW.version := next_ver;
  INSERT INTO public.eta_alert_webhook_versions
    (webhook_id, version, name, url, headers, alert_types, min_severity, max_retries, changed_by)
  VALUES (NEW.id, next_ver, NEW.name, NEW.url, NEW.headers,
          NEW.alert_types, NEW.min_severity, NEW.max_retries, auth.uid());
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_eta_webhook_snapshot ON public.eta_alert_webhooks;
CREATE TRIGGER trg_eta_webhook_snapshot
  BEFORE INSERT OR UPDATE ON public.eta_alert_webhooks
  FOR EACH ROW EXECUTE FUNCTION public.eta_alert_webhook_snapshot();

-- Seed inicial: linha para webhooks já existentes
INSERT INTO public.eta_alert_webhook_versions
  (webhook_id, version, name, url, headers, alert_types, min_severity, max_retries, changed_by)
SELECT w.id, 1, w.name, w.url, w.headers, w.alert_types, w.min_severity, w.max_retries, NULL
FROM public.eta_alert_webhooks w
LEFT JOIN public.eta_alert_webhook_versions v ON v.webhook_id = w.id
WHERE v.id IS NULL;

-- ===== Tabela de rollback =====
CREATE TABLE IF NOT EXISTS public.eta_alert_rollback_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('template','webhook')),
  entity_id uuid NOT NULL,
  from_version int,
  to_version int NOT NULL,
  reverted_by uuid,
  reverted_at timestamptz NOT NULL DEFAULT now(),
  reason text
);
GRANT SELECT ON public.eta_alert_rollback_log TO authenticated;
GRANT ALL ON public.eta_alert_rollback_log TO service_role;
ALTER TABLE public.eta_alert_rollback_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view rollback log" ON public.eta_alert_rollback_log
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator')
  );

-- ===== Função: rollback de template =====
CREATE OR REPLACE FUNCTION public.rollback_eta_template(
  _template_id uuid, _to_version int, _reason text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _v record;
  _cur_ver int;
  _pending int;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT MAX(version) INTO _cur_ver FROM public.eta_alert_email_template_versions
    WHERE template_id = _template_id;

  SELECT COUNT(*) INTO _pending FROM public.eta_alert_deliveries
    WHERE template_id = _template_id AND template_version = _cur_ver AND status = 'pending';
  IF _pending > 0 THEN
    RAISE EXCEPTION 'rollback bloqueado: % entregas pendentes na versão atual', _pending;
  END IF;

  SELECT * INTO _v FROM public.eta_alert_email_template_versions
    WHERE template_id = _template_id AND version = _to_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'versão % não encontrada', _to_version; END IF;

  UPDATE public.eta_alert_email_templates
     SET subject = _v.subject, html_body = _v.html_body,
         name = _v.name, alert_type = _v.alert_type, updated_at = now()
   WHERE id = _template_id;

  INSERT INTO public.eta_alert_rollback_log(entity_type, entity_id, from_version, to_version, reverted_by, reason)
  VALUES ('template', _template_id, _cur_ver, _to_version, auth.uid(), _reason);

  RETURN jsonb_build_object('ok', true, 'from', _cur_ver, 'to', _to_version);
END $$;

-- ===== Função: rollback de webhook =====
CREATE OR REPLACE FUNCTION public.rollback_eta_webhook(
  _webhook_id uuid, _to_version int, _reason text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _v record;
  _cur_ver int;
  _pending int;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT version INTO _cur_ver FROM public.eta_alert_webhooks WHERE id = _webhook_id;

  SELECT COUNT(*) INTO _pending FROM public.eta_alert_deliveries
    WHERE webhook_id = _webhook_id AND webhook_version = _cur_ver AND status = 'pending';
  IF _pending > 0 THEN
    RAISE EXCEPTION 'rollback bloqueado: % entregas pendentes na versão atual', _pending;
  END IF;

  SELECT * INTO _v FROM public.eta_alert_webhook_versions
    WHERE webhook_id = _webhook_id AND version = _to_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'versão % não encontrada', _to_version; END IF;

  UPDATE public.eta_alert_webhooks
     SET name = _v.name, url = _v.url, headers = _v.headers,
         alert_types = _v.alert_types, min_severity = _v.min_severity,
         max_retries = _v.max_retries, updated_at = now()
   WHERE id = _webhook_id;

  INSERT INTO public.eta_alert_rollback_log(entity_type, entity_id, from_version, to_version, reverted_by, reason)
  VALUES ('webhook', _webhook_id, _cur_ver, _to_version, auth.uid(), _reason);

  RETURN jsonb_build_object('ok', true, 'from', _cur_ver, 'to', _to_version);
END $$;

-- ===== Função: rotação de segredo HMAC =====
CREATE OR REPLACE FUNCTION public.rotate_eta_webhook_secret(
  _webhook_id uuid,
  _new_secret text,
  _activates_at timestamptz DEFAULT NULL,
  _expires_at timestamptz DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _new_secret IS NULL OR length(_new_secret) < 8 THEN
    RAISE EXCEPTION 'secret muito curto (min 8 chars)';
  END IF;

  IF _activates_at IS NULL OR _activates_at <= now() THEN
    -- promove imediatamente
    UPDATE public.eta_alert_webhooks
       SET secret = _new_secret,
           secret_next = NULL,
           secret_next_activates_at = NULL,
           secret_expires_at = _expires_at,
           updated_at = now()
     WHERE id = _webhook_id;
    RETURN jsonb_build_object('ok', true, 'mode', 'immediate');
  ELSE
    UPDATE public.eta_alert_webhooks
       SET secret_next = _new_secret,
           secret_next_activates_at = _activates_at,
           secret_expires_at = _expires_at,
           updated_at = now()
     WHERE id = _webhook_id;
    RETURN jsonb_build_object('ok', true, 'mode', 'scheduled', 'activates_at', _activates_at);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.promote_eta_webhook_next_secret(_webhook_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _w record;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO _w FROM public.eta_alert_webhooks WHERE id = _webhook_id;
  IF _w.secret_next IS NULL THEN RAISE EXCEPTION 'sem próximo segredo'; END IF;
  UPDATE public.eta_alert_webhooks
     SET secret = _w.secret_next,
         secret_next = NULL,
         secret_next_activates_at = NULL,
         updated_at = now()
   WHERE id = _webhook_id;
  RETURN jsonb_build_object('ok', true);
END $$;
