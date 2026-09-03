-- Admin management policies
CREATE POLICY "Admins can update profiles" ON public.profiles
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete profiles" ON public.profiles
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage categories" ON public.service_categories
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_categories TO authenticated;

CREATE POLICY "Admins manage provider services" ON public.provider_services
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admin creates a provider profile (affiliate_code has no default)
CREATE OR REPLACE FUNCTION public.admin_create_provider(
  _display_name text,
  _bio text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _city text DEFAULT NULL,
  _state text DEFAULT NULL,
  _avatar_url text DEFAULT NULL,
  _is_synthetic boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
  code text;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF coalesce(trim(_display_name), '') = '' THEN
    RAISE EXCEPTION 'display_name required';
  END IF;

  LOOP
    code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.affiliate_code = code);
  END LOOP;

  INSERT INTO public.profiles (
    user_type, display_name, bio, phone, city, state, avatar_url,
    affiliate_code, is_synthetic, synthetic_expires_at
  ) VALUES (
    'provider', trim(_display_name), _bio, _phone, _city, _state, _avatar_url,
    code, coalesce(_is_synthetic, false),
    CASE WHEN coalesce(_is_synthetic, false) THEN now() + interval '30 days' ELSE NULL END
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_provider(text, text, text, text, text, text, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_create_provider(text, text, text, text, text, text, boolean) TO authenticated, service_role;

-- Public summarized history of completed services for a provider
CREATE OR REPLACE FUNCTION public.get_provider_public_history(_provider_id uuid, _limit integer DEFAULT 20)
RETURNS TABLE (completed_at timestamptz, category_name text, title text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.completed_at,
         c.name AS category_name,
         s.title
  FROM public.services s
  LEFT JOIN public.service_categories c ON c.id = s.category_id
  WHERE s.provider_id = _provider_id
    AND s.status IN ('completed', 'confirmed')
    AND s.completed_at IS NOT NULL
  ORDER BY s.completed_at DESC
  LIMIT LEAST(GREATEST(coalesce(_limit, 20), 1), 50);
$$;

GRANT EXECUTE ON FUNCTION public.get_provider_public_history(uuid, integer) TO anon, authenticated, service_role;