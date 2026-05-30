
-- 1. COUPONS: Remove public read access
DROP POLICY IF EXISTS "Anyone can view valid coupons" ON public.coupons;

CREATE POLICY "Owners and admins can view coupons"
ON public.coupons
FOR SELECT
TO authenticated
USING (
  created_by = public.get_my_profile_id()
  OR used_by = public.get_my_profile_id()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'moderator'::public.app_role)
);

REVOKE SELECT ON public.coupons FROM anon;

-- 2. PROFILES: Restrict raw table access; expose only safe columns via a public view
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;

CREATE POLICY "Owners can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'moderator'::public.app_role)
);

REVOKE SELECT ON public.profiles FROM anon;

-- Public view exposes only non-PII columns for browsing providers
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT
  id,
  user_id,
  user_type,
  display_name,
  avatar_url,
  bio,
  city,
  state,
  latitude,
  longitude,
  verification_status,
  is_active,
  created_at,
  affiliate_code,
  affiliate_level,
  years_experience,
  professional_registration,
  nome_fantasia,
  business_hours
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- 3. REVIEWS: Restrict moderation fields and unpublished/shadow reviews
DROP POLICY IF EXISTS "Anyone can view reviews" ON public.reviews;

CREATE POLICY "Public can view published non-shadow reviews"
ON public.reviews
FOR SELECT
TO anon, authenticated
USING (
  is_published = true
  AND is_shadow = false
);

CREATE POLICY "Participants can view own reviews"
ON public.reviews
FOR SELECT
TO authenticated
USING (
  reviewer_id = public.get_my_profile_id()
  OR reviewed_id = public.get_my_profile_id()
);

CREATE POLICY "Admins can view all reviews"
ON public.reviews
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'moderator'::public.app_role)
);
