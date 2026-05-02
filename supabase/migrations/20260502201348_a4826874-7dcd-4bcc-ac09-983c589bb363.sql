CREATE TABLE IF NOT EXISTS public.support_chat_weekly_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  generated_at timestamptz NOT NULL DEFAULT now(),
  period_from timestamptz NOT NULL,
  period_to timestamptz NOT NULL,
  subject text NOT NULL,
  recipients text[] NOT NULL DEFAULT '{}',
  payload jsonb NOT NULL,
  email_status text NOT NULL DEFAULT 'pending',
  email_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_weekly_reports_generated ON public.support_chat_weekly_reports(generated_at DESC);

ALTER TABLE public.support_chat_weekly_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view weekly reports"
  ON public.support_chat_weekly_reports FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Service role manages weekly reports"
  ON public.support_chat_weekly_reports FOR ALL TO service_role
  USING (true) WITH CHECK (true);
