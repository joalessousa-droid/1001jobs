
-- 1) Multi-webhook destinations
CREATE TABLE public.eta_alert_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL,
  secret text,
  headers jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  alert_types text[] NOT NULL DEFAULT '{}'::text[],
  min_severity text NOT NULL DEFAULT 'high',
  max_retries smallint NOT NULL DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.eta_alert_webhooks TO authenticated;
GRANT ALL ON public.eta_alert_webhooks TO service_role;
ALTER TABLE public.eta_alert_webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage webhooks" ON public.eta_alert_webhooks FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 2) Per-recipient delivery log (webhooks + emails)
CREATE TABLE public.eta_alert_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL REFERENCES public.eta_alerts(id) ON DELETE CASCADE,
  channel text NOT NULL,
  target text NOT NULL,
  target_label text,
  status text NOT NULL DEFAULT 'pending',
  http_status integer,
  attempts smallint NOT NULL DEFAULT 0,
  last_error text,
  first_attempt_at timestamptz,
  last_attempt_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX eta_alert_deliveries_alert_idx ON public.eta_alert_deliveries(alert_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.eta_alert_deliveries TO authenticated;
GRANT ALL ON public.eta_alert_deliveries TO service_role;
ALTER TABLE public.eta_alert_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view deliveries" ON public.eta_alert_deliveries FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));
CREATE POLICY "Service manages deliveries" ON public.eta_alert_deliveries FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3) Customizable email templates
CREATE TABLE public.eta_alert_email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  name text NOT NULL,
  subject text NOT NULL,
  html_body text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.eta_alert_email_templates TO authenticated;
GRANT ALL ON public.eta_alert_email_templates TO service_role;
ALTER TABLE public.eta_alert_email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage email templates" ON public.eta_alert_email_templates FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed default template for persistent_degradation
INSERT INTO public.eta_alert_email_templates (alert_type, name, subject, html_body, is_default) VALUES (
  'persistent_degradation',
  'Default · Degradação persistente',
  '[ETA] {{alert_type}} — {{failure_pct}}% falhas / p95 {{p95_ms}}ms',
  '<div style="font-family:system-ui,sans-serif;max-width:640px;color:#0f172a">
    <h2 style="margin:0 0 12px;color:#dc2626">ETA · {{alert_type}}</h2>
    <p style="margin:0 0 10px"><b>Período:</b> {{period_from}} → {{period_to}} (janela {{window_min}} min)</p>
    <h3 style="margin:16px 0 6px;font-size:14px;color:#334155">Métricas</h3>
    <ul style="margin:0;padding-left:18px;line-height:1.6">
      <li>Amostras: {{samples}} · Falhas: {{failures}} ({{failure_pct}}%)</li>
      <li>Latência média: {{avg_ms}}ms · p95: {{p95_ms}}ms</li>
      <li>Fator de trânsito médio: {{avg_traffic}}</li>
    </ul>
    <h3 style="margin:16px 0 6px;font-size:14px;color:#334155">Top cidades</h3>
    <div style="font-size:13px">{{top_cities_html}}</div>
    <h3 style="margin:16px 0 6px;font-size:14px;color:#334155">Top profissionais</h3>
    <div style="font-size:13px">{{top_providers_html}}</div>
    <h3 style="margin:16px 0 6px;font-size:14px;color:#334155">Tuning ativo</h3>
    <pre style="background:#f1f5f9;padding:10px;border-radius:6px;font-size:11px;overflow:auto">{{tuning_json}}</pre>
    <p style="color:#64748b;font-size:12px;margin-top:16px">Gerado em {{generated_at}} · <a href="{{dashboard_url}}">Abrir dashboard</a></p>
  </div>',
  true
);

CREATE OR REPLACE FUNCTION public.eta_alerts_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_eta_alert_webhooks_upd BEFORE UPDATE ON public.eta_alert_webhooks
  FOR EACH ROW EXECUTE FUNCTION public.eta_alerts_touch_updated_at();
CREATE TRIGGER trg_eta_alert_email_templates_upd BEFORE UPDATE ON public.eta_alert_email_templates
  FOR EACH ROW EXECUTE FUNCTION public.eta_alerts_touch_updated_at();
