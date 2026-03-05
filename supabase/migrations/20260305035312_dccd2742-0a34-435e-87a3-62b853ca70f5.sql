
-- 1. Completed Services table
CREATE TABLE public.completed_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.provider_services(id) ON DELETE SET NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'completed',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_completed_services_client ON public.completed_services(client_id);
CREATE INDEX idx_completed_services_provider ON public.completed_services(provider_id);
CREATE INDEX idx_completed_services_status ON public.completed_services(status);

ALTER TABLE public.completed_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view completed services" ON public.completed_services
  FOR SELECT TO authenticated
  USING (client_id = get_my_profile_id() OR provider_id = get_my_profile_id());

CREATE POLICY "Service role manages completed services" ON public.completed_services
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. Review subcriteria table
CREATE TABLE public.review_subcriteria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  criterion text NOT NULL,
  score smallint NOT NULL CHECK (score >= 1 AND score <= 5),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_review_subcriteria_review ON public.review_subcriteria(review_id);

ALTER TABLE public.review_subcriteria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view subcriteria" ON public.review_subcriteria
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert subcriteria" ON public.review_subcriteria
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM reviews WHERE id = review_id AND reviewer_id = get_my_profile_id()));

-- 3. Review evidence table
CREATE TABLE public.review_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text,
  file_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_review_evidence_review ON public.review_evidence(review_id);

ALTER TABLE public.review_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view evidence" ON public.review_evidence
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Reviewers can upload evidence" ON public.review_evidence
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM reviews WHERE id = review_id AND reviewer_id = get_my_profile_id()));

-- 4. Add columns to reviews table for blind review + completed_service link
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS completed_service_id uuid REFERENCES public.completed_services(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS review_type text NOT NULL DEFAULT 'client_to_provider',
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS publish_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_contested boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_shadow boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fraud_score integer NOT NULL DEFAULT 0;

CREATE INDEX idx_reviews_completed_service ON public.reviews(completed_service_id);
CREATE INDEX idx_reviews_published ON public.reviews(is_published);
CREATE INDEX idx_reviews_type ON public.reviews(review_type);

-- 5. Disputes / Mediation table
CREATE TABLE public.review_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  disputed_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text NOT NULL,
  evidence_urls text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'open',
  moderator_id uuid REFERENCES public.profiles(id),
  moderator_notes text,
  decision text,
  penalty_applied text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX idx_disputes_review ON public.review_disputes(review_id);
CREATE INDEX idx_disputes_disputed_by ON public.review_disputes(disputed_by);
CREATE INDEX idx_disputes_status ON public.review_disputes(status);

ALTER TABLE public.review_disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Disputers can view own disputes" ON public.review_disputes
  FOR SELECT TO authenticated
  USING (disputed_by = get_my_profile_id());

CREATE POLICY "Review owners can view disputes on their reviews" ON public.review_disputes
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM reviews WHERE id = review_id AND (reviewer_id = get_my_profile_id() OR reviewed_id = get_my_profile_id())));

CREATE POLICY "Users can create disputes" ON public.review_disputes
  FOR INSERT TO authenticated
  WITH CHECK (disputed_by = get_my_profile_id());

CREATE POLICY "Service role manages disputes" ON public.review_disputes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 6. Reputation scores table
CREATE TABLE public.reputation_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  weighted_score numeric(4,2) NOT NULL DEFAULT 0,
  total_reviews integer NOT NULL DEFAULT 0,
  total_disputes integer NOT NULL DEFAULT 0,
  dispute_rate numeric(5,4) NOT NULL DEFAULT 0,
  last_review_at timestamptz,
  badges text[] DEFAULT '{}',
  score_breakdown jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reputation_profile ON public.reputation_scores(profile_id);
CREATE INDEX idx_reputation_score ON public.reputation_scores(weighted_score);

ALTER TABLE public.reputation_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reputation" ON public.reputation_scores
  FOR SELECT USING (true);

CREATE POLICY "Service role manages reputation" ON public.reputation_scores
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 7. Review fraud logs
CREATE TABLE public.review_fraud_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  fraud_type text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  score integer NOT NULL DEFAULT 0,
  flagged_for_mediation boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fraud_logs_review ON public.review_fraud_logs(review_id);
CREATE INDEX idx_fraud_logs_reviewer ON public.review_fraud_logs(reviewer_id);

ALTER TABLE public.review_fraud_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages fraud logs" ON public.review_fraud_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 8. Storage bucket for review evidence
INSERT INTO storage.buckets (id, name, public) VALUES ('review-evidence', 'review-evidence', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload review evidence" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'review-evidence');

CREATE POLICY "Anyone can view review evidence" ON storage.objects
  FOR SELECT USING (bucket_id = 'review-evidence');

-- 9. Trigger for updated_at
CREATE TRIGGER update_completed_services_updated_at BEFORE UPDATE ON public.completed_services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_disputes_updated_at BEFORE UPDATE ON public.review_disputes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 10. Function to publish blind reviews (called by cron or edge function)
CREATE OR REPLACE FUNCTION public.publish_blind_reviews()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  published_count integer := 0;
  cs record;
BEGIN
  -- Find completed services where both reviews exist OR 7 days passed
  FOR cs IN
    SELECT DISTINCT r.completed_service_id
    FROM reviews r
    WHERE r.is_published = false
      AND r.completed_service_id IS NOT NULL
      AND r.is_shadow = false
  LOOP
    DECLARE
      review_count integer;
      oldest_review timestamptz;
    BEGIN
      SELECT COUNT(*), MIN(created_at) INTO review_count, oldest_review
      FROM reviews
      WHERE completed_service_id = cs.completed_service_id AND is_shadow = false;

      -- Publish if both parties reviewed OR 7 days since first review
      IF review_count >= 2 OR (oldest_review IS NOT NULL AND oldest_review < now() - interval '7 days') THEN
        UPDATE reviews SET is_published = true, publish_at = now()
        WHERE completed_service_id = cs.completed_service_id AND is_published = false AND is_shadow = false;
        published_count := published_count + review_count;
      END IF;
    END;
  END LOOP;

  RETURN published_count;
END;
$$;
