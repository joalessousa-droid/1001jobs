
-- 1. Restrict review_evidence to published, non-shadow reviews (or participants)
DROP POLICY IF EXISTS "Anyone can view evidence" ON public.review_evidence;
CREATE POLICY "View evidence of published reviews or own"
ON public.review_evidence FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.reviews r
    WHERE r.id = review_evidence.review_id
      AND (
        (r.is_published = true AND r.is_shadow = false)
        OR r.reviewer_id = public.get_my_profile_id()
        OR r.reviewed_id = public.get_my_profile_id()
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'moderator'::app_role)
      )
  )
);

-- 2. Restrict review_subcriteria similarly
DROP POLICY IF EXISTS "Anyone can view subcriteria" ON public.review_subcriteria;
CREATE POLICY "View subcriteria of published reviews or own"
ON public.review_subcriteria FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.reviews r
    WHERE r.id = review_subcriteria.review_id
      AND (
        (r.is_published = true AND r.is_shadow = false)
        OR r.reviewer_id = public.get_my_profile_id()
        OR r.reviewed_id = public.get_my_profile_id()
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'moderator'::app_role)
      )
  )
);

-- 3. Hide internal moderation fields (fraud_score, is_contested) from clients
REVOKE SELECT (fraud_score, is_contested) ON public.reviews FROM anon, authenticated;

-- 4. Coarsen / hide sensitive fields on publicly visible service_requests
DROP POLICY IF EXISTS "Anyone can view active service requests" ON public.service_requests;
-- Owners and admins keep full access
CREATE POLICY "Owners view own service requests"
ON public.service_requests FOR SELECT TO authenticated
USING (profile_id = public.get_my_profile_id()
       OR public.has_role(auth.uid(), 'admin'::app_role)
       OR public.has_role(auth.uid(), 'moderator'::app_role));

-- Public/authenticated browsing via a safe view (no requester_name, no precise GPS)
CREATE OR REPLACE VIEW public.public_service_requests
WITH (security_invoker = true) AS
SELECT
  id,
  requester_type,
  description,
  category_id,
  budget,
  city,
  state,
  -- coarsen geo to ~1km (3 decimal places)
  round(latitude::numeric, 2)::double precision AS latitude,
  round(longitude::numeric, 2)::double precision AS longitude,
  is_active,
  created_at,
  updated_at,
  profile_id,
  selected_provider_id,
  service_id,
  status,
  price_type
FROM public.service_requests
WHERE is_active = true;

GRANT SELECT ON public.public_service_requests TO anon, authenticated;

-- 5. Recreate public_profiles view with security_invoker so it honors caller RLS
DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles
WITH (security_invoker = true) AS
SELECT id, user_id, user_type, display_name, avatar_url, bio, city, state,
       latitude, longitude, verification_status, is_active, created_at,
       affiliate_code, affiliate_level, years_experience,
       professional_registration, nome_fantasia, business_hours
FROM public.profiles
WHERE is_active = true;
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- Allow anon SELECT on safe columns of profiles so the security_invoker view works for anonymous browsing
GRANT SELECT (id, user_id, user_type, display_name, avatar_url, bio, city, state,
              latitude, longitude, verification_status, is_active, created_at,
              affiliate_code, affiliate_level, years_experience,
              professional_registration, nome_fantasia, business_hours)
ON public.profiles TO anon, authenticated;

-- Add a permissive RLS policy so anon/authenticated can read active profiles (safe columns only)
DROP POLICY IF EXISTS "Public can view active profiles safe cols" ON public.profiles;
CREATE POLICY "Public can view active profiles safe cols"
ON public.profiles FOR SELECT TO anon, authenticated
USING (is_active = true);

-- 6. Defense-in-depth on user_roles: trigger prevents non-admin/non-service_role writes
CREATE OR REPLACE FUNCTION public.guard_user_roles_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins or service_role may modify user_roles';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_user_roles_write_trg ON public.user_roles;
CREATE TRIGGER guard_user_roles_write_trg
BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.guard_user_roles_write();
