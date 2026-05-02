
CREATE TABLE public.investor_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  company text,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.investor_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit lead" ON public.investor_leads
  FOR INSERT TO anon, authenticated
  WITH CHECK (length(name) BETWEEN 1 AND 200 AND length(email) BETWEEN 3 AND 320 AND length(message) BETWEEN 1 AND 5000);

CREATE POLICY "Admins view leads" ON public.investor_leads
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Admins update leads" ON public.investor_leads
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Service role manages leads" ON public.investor_leads
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER investor_leads_updated_at
  BEFORE UPDATE ON public.investor_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.investor_kpis (
  id int PRIMARY KEY DEFAULT 1,
  ticket_medio numeric,
  taxa_conclusao numeric,
  tempo_aceite_seconds numeric,
  recompra numeric,
  gmv_anual numeric,
  receita_anual numeric,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT singleton CHECK (id = 1)
);
ALTER TABLE public.investor_kpis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view kpis" ON public.investor_kpis
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Admins update kpis" ON public.investor_kpis
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages kpis" ON public.investor_kpis
  FOR ALL TO service_role USING (true) WITH CHECK (true);

INSERT INTO public.investor_kpis (id, ticket_medio, taxa_conclusao, tempo_aceite_seconds, recompra, gmv_anual, receita_anual)
VALUES (1, 480, 92.5, 45, 38, 12000000, 1500000);
