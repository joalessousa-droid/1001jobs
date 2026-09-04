-- Public showcase profiles become a real table synced from profiles,
-- so anonymous visitors never touch the PII-bearing base table.
DROP VIEW IF EXISTS public.public_profiles;

CREATE TABLE public.public_profiles (
  id uuid PRIMARY KEY,
  user_id uuid,
  user_type public.user_type,
  display_name text,
  avatar_url text,
  bio text,
  city text,
  state text,
  latitude double precision,
  longitude double precision,
  verification_status public.verification_status,
  is_active boolean,
  created_at timestamptz,
  affiliate_code text,
  affiliate_level text,
  years_experience integer,
  professional_registration text,
  nome_fantasia text,
  business_hours text,
  is_synthetic boolean
);

GRANT SELECT ON public.public_profiles TO anon, authenticated;
GRANT ALL ON public.public_profiles TO service_role;
ALTER TABLE public.public_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view public showcase profiles"
ON public.public_profiles FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.sync_public_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.public_profiles WHERE id = OLD.id;
    RETURN OLD;
  END IF;

  IF NEW.is_active IS DISTINCT FROM true THEN
    DELETE FROM public.public_profiles WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  INSERT INTO public.public_profiles (
    id, user_id, user_type, display_name, avatar_url, bio, city, state,
    latitude, longitude, verification_status, is_active, created_at,
    affiliate_code, affiliate_level, years_experience,
    professional_registration, nome_fantasia, business_hours, is_synthetic
  ) VALUES (
    NEW.id, NEW.user_id, NEW.user_type, NEW.display_name, NEW.avatar_url, NEW.bio,
    NEW.city, NEW.state, NEW.latitude, NEW.longitude, NEW.verification_status,
    NEW.is_active, NEW.created_at, NEW.affiliate_code, NEW.affiliate_level,
    NEW.years_experience, NEW.professional_registration, NEW.nome_fantasia,
    NEW.business_hours, NEW.is_synthetic
  )
  ON CONFLICT (id) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    user_type = EXCLUDED.user_type,
    display_name = EXCLUDED.display_name,
    avatar_url = EXCLUDED.avatar_url,
    bio = EXCLUDED.bio,
    city = EXCLUDED.city,
    state = EXCLUDED.state,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    verification_status = EXCLUDED.verification_status,
    is_active = EXCLUDED.is_active,
    created_at = EXCLUDED.created_at,
    affiliate_code = EXCLUDED.affiliate_code,
    affiliate_level = EXCLUDED.affiliate_level,
    years_experience = EXCLUDED.years_experience,
    professional_registration = EXCLUDED.professional_registration,
    nome_fantasia = EXCLUDED.nome_fantasia,
    business_hours = EXCLUDED.business_hours,
    is_synthetic = EXCLUDED.is_synthetic;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_public_profile_trg ON public.profiles;
CREATE TRIGGER sync_public_profile_trg
AFTER INSERT OR UPDATE OR DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_public_profile();

INSERT INTO public.public_profiles (
  id, user_id, user_type, display_name, avatar_url, bio, city, state,
  latitude, longitude, verification_status, is_active, created_at,
  affiliate_code, affiliate_level, years_experience,
  professional_registration, nome_fantasia, business_hours, is_synthetic
)
SELECT id, user_id, user_type, display_name, avatar_url, bio, city, state,
       latitude, longitude, verification_status, is_active, created_at,
       affiliate_code, affiliate_level, years_experience,
       professional_registration, nome_fantasia, business_hours, is_synthetic
FROM public.profiles WHERE is_active = true
ON CONFLICT (id) DO NOTHING;

-- Base profiles table is no longer readable by anonymous visitors at all
DROP POLICY IF EXISTS "Public can view active profiles safe cols" ON public.profiles;
REVOKE ALL ON public.profiles FROM anon;
CREATE POLICY "Signed-in users can view active profiles"
ON public.profiles FOR SELECT TO authenticated USING (is_active = true);