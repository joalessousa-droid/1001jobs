-- 1) ai_outcomes: only participants of the related service/prediction (or staff) may insert
DROP POLICY IF EXISTS "ai_outcomes insert" ON public.ai_outcomes;
CREATE POLICY "ai_outcomes insert own" ON public.ai_outcomes
FOR INSERT TO authenticated
WITH CHECK (
  public.ai_is_staff()
  OR (service_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.services s
        WHERE s.id = ai_outcomes.service_id
          AND (s.client_id = public.get_my_profile_id() OR s.provider_id = public.get_my_profile_id())))
  OR (prediction_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.ai_predictions p
        WHERE p.id = ai_outcomes.prediction_id
          AND p.profile_id = public.get_my_profile_id()))
);

-- 2) profiles: anonymous visitors may only read the public showcase columns
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (
  id, user_id, user_type, display_name, avatar_url, bio, city, state,
  latitude, longitude, verification_status, is_active, created_at,
  affiliate_code, affiliate_level, years_experience, professional_registration,
  nome_fantasia, business_hours, is_synthetic
) ON public.profiles TO anon;

ALTER VIEW public.public_profiles SET (security_invoker = true);

-- 3) service_requests: approximate coordinates + column-restricted anonymous read
ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS lat_approx double precision
    GENERATED ALWAYS AS (round(latitude::numeric, 2)::double precision) STORED,
  ADD COLUMN IF NOT EXISTS lng_approx double precision
    GENERATED ALWAYS AS (round(longitude::numeric, 2)::double precision) STORED;

DROP POLICY IF EXISTS "Public can view active service requests" ON public.service_requests;
CREATE POLICY "Public can view active service requests" ON public.service_requests
FOR SELECT TO anon, authenticated
USING (is_active = true);

REVOKE SELECT ON public.service_requests FROM anon;
GRANT SELECT (
  id, requester_type, description, category_id, budget, city, state,
  lat_approx, lng_approx, is_active, created_at, updated_at, profile_id,
  selected_provider_id, service_id, status, price_type, is_synthetic, origin
) ON public.service_requests TO anon;

DROP VIEW IF EXISTS public.public_service_requests;
CREATE VIEW public.public_service_requests WITH (security_invoker = true) AS
SELECT id, requester_type, description, category_id, budget, city, state,
       lat_approx AS latitude, lng_approx AS longitude, is_active, created_at,
       updated_at, profile_id, selected_provider_id, service_id, status,
       price_type, is_synthetic, origin
FROM public.service_requests
WHERE is_active = true;

GRANT SELECT ON public.public_service_requests TO anon, authenticated;
GRANT ALL ON public.public_service_requests TO service_role;