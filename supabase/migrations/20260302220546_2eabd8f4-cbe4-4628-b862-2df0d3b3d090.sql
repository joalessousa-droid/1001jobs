
-- Add affiliate columns to profiles
ALTER TABLE public.profiles
ADD COLUMN affiliate_code VARCHAR(20) UNIQUE,
ADD COLUMN referred_by uuid REFERENCES public.profiles(id),
ADD COLUMN affiliate_level VARCHAR(20) NOT NULL DEFAULT 'bronze';

-- Generate affiliate codes for existing profiles
UPDATE public.profiles
SET affiliate_code = UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 8))
WHERE affiliate_code IS NULL;

-- Make affiliate_code NOT NULL after backfill
ALTER TABLE public.profiles ALTER COLUMN affiliate_code SET NOT NULL;

-- Subscriptions table
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  amount NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions"
ON public.subscriptions FOR SELECT
TO authenticated
USING (profile_id = public.get_my_profile_id());

CREATE POLICY "System can insert subscriptions"
ON public.subscriptions FOR INSERT
TO authenticated
WITH CHECK (profile_id = public.get_my_profile_id());

-- Commissions table
CREATE TABLE public.commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Affiliates can view own commissions"
ON public.commissions FOR SELECT
TO authenticated
USING (affiliate_id = public.get_my_profile_id());

-- Coupons table
CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) NOT NULL UNIQUE,
  value NUMERIC(10,2) NOT NULL,
  min_value NUMERIC(10,2) NOT NULL DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_by uuid REFERENCES public.profiles(id),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view valid coupons"
ON public.coupons FOR SELECT
USING (true);

CREATE POLICY "Users can create coupons"
ON public.coupons FOR INSERT
TO authenticated
WITH CHECK (created_by = public.get_my_profile_id());

-- Function to generate affiliate code for new users (update existing trigger)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _referred_by uuid;
  _referral_code text;
BEGIN
  -- Check for referral code in metadata
  _referral_code := NEW.raw_user_meta_data->>'referral_code';
  IF _referral_code IS NOT NULL AND _referral_code != '' THEN
    SELECT id INTO _referred_by FROM public.profiles WHERE affiliate_code = _referral_code;
  END IF;

  INSERT INTO public.profiles (user_id, display_name, user_type, affiliate_code, referred_by)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'user_type')::public.user_type, 'client'),
    UPPER(SUBSTR(MD5(NEW.id::TEXT || RANDOM()::TEXT), 1, 8)),
    _referred_by
  );
  RETURN NEW;
END;
$$;

-- DB function to get affiliate dashboard data (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.get_affiliate_dashboard(_profile_id uuid)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'total_commissions', COALESCE((SELECT SUM(amount) FROM commissions WHERE affiliate_id = _profile_id AND status = 'pending'), 0),
    'paid_commissions', COALESCE((SELECT SUM(amount) FROM commissions WHERE affiliate_id = _profile_id AND status = 'paid'), 0),
    'total_referrals', (SELECT COUNT(*) FROM profiles WHERE referred_by = _profile_id),
    'affiliate_code', (SELECT affiliate_code FROM profiles WHERE id = _profile_id),
    'level', (SELECT affiliate_level FROM profiles WHERE id = _profile_id)
  );
$$;

-- DB function to update affiliate level
CREATE OR REPLACE FUNCTION public.update_affiliate_level(_profile_id uuid)
RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _total INT;
  _level VARCHAR(20);
BEGIN
  SELECT COUNT(*) INTO _total FROM profiles WHERE referred_by = _profile_id;
  
  IF _total > 150 THEN _level := 'diamond';
  ELSIF _total > 50 THEN _level := 'gold';
  ELSIF _total > 10 THEN _level := 'silver';
  ELSE _level := 'bronze';
  END IF;

  UPDATE profiles SET affiliate_level = _level WHERE id = _profile_id;
  RETURN _level;
END;
$$;
