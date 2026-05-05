
CREATE TABLE public.partner_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_slug TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'card_click',
  user_id UUID,
  user_agent TEXT,
  referrer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.partner_clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can log partner clicks" ON public.partner_clicks
  FOR INSERT TO anon, authenticated
  WITH CHECK (length(partner_slug) BETWEEN 1 AND 100 AND length(event_type) BETWEEN 1 AND 50);
CREATE POLICY "Admins view partner clicks" ON public.partner_clicks
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'moderator'));
CREATE POLICY "Service role manages partner clicks" ON public.partner_clicks
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX idx_partner_clicks_slug ON public.partner_clicks(partner_slug, created_at DESC);

CREATE TABLE public.partner_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  institution TEXT NOT NULL,
  category TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.partner_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit partner lead" ON public.partner_leads
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    length(name) BETWEEN 1 AND 200 AND
    length(institution) BETWEEN 1 AND 200 AND
    length(category) BETWEEN 1 AND 100 AND
    length(email) BETWEEN 3 AND 320 AND
    length(message) BETWEEN 1 AND 5000
  );
CREATE POLICY "Admins view partner leads" ON public.partner_leads
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'moderator'));
CREATE POLICY "Admins update partner leads" ON public.partner_leads
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'moderator'));
CREATE POLICY "Service role manages partner leads" ON public.partner_leads
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER trg_partner_leads_updated BEFORE UPDATE ON public.partner_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
