
-- Version history for email templates
CREATE TABLE public.eta_alert_email_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.eta_alert_email_templates(id) ON DELETE CASCADE,
  version integer NOT NULL,
  alert_type text NOT NULL,
  name text NOT NULL,
  subject text NOT NULL,
  html_body text NOT NULL,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX eta_alert_email_template_versions_tpl_idx ON public.eta_alert_email_template_versions(template_id, version DESC);
GRANT SELECT, INSERT ON public.eta_alert_email_template_versions TO authenticated;
GRANT ALL ON public.eta_alert_email_template_versions TO service_role;
ALTER TABLE public.eta_alert_email_template_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage template versions" ON public.eta_alert_email_template_versions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Auto-version trigger on template insert/update
CREATE OR REPLACE FUNCTION public.eta_alert_template_snapshot() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE next_ver integer;
BEGIN
  SELECT COALESCE(MAX(version), 0) + 1 INTO next_ver
    FROM public.eta_alert_email_template_versions WHERE template_id = NEW.id;
  INSERT INTO public.eta_alert_email_template_versions
    (template_id, version, alert_type, name, subject, html_body, changed_by)
  VALUES (NEW.id, next_ver, NEW.alert_type, NEW.name, NEW.subject, NEW.html_body, auth.uid());
  RETURN NEW;
END $$;

CREATE TRIGGER trg_eta_template_version_ins AFTER INSERT ON public.eta_alert_email_templates
  FOR EACH ROW EXECUTE FUNCTION public.eta_alert_template_snapshot();
CREATE TRIGGER trg_eta_template_version_upd AFTER UPDATE OF subject, html_body, name, alert_type ON public.eta_alert_email_templates
  FOR EACH ROW EXECUTE FUNCTION public.eta_alert_template_snapshot();

-- Backfill v1 for existing rows
INSERT INTO public.eta_alert_email_template_versions (template_id, version, alert_type, name, subject, html_body)
  SELECT id, 1, alert_type, name, subject, html_body FROM public.eta_alert_email_templates;

-- Signature tracking on deliveries
ALTER TABLE public.eta_alert_deliveries
  ADD COLUMN IF NOT EXISTS signature text,
  ADD COLUMN IF NOT EXISTS signature_algo text;

-- Enable realtime for alerts + deliveries
ALTER TABLE public.eta_alerts REPLICA IDENTITY FULL;
ALTER TABLE public.eta_alert_deliveries REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.eta_alerts;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.eta_alert_deliveries;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
