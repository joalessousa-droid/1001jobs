
DROP POLICY IF EXISTS "app_settings_read_auth" ON public.app_settings;
CREATE POLICY "app_settings_read_admin_mod"
  ON public.app_settings FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

DROP POLICY IF EXISTS "Authenticated read tuning" ON public.eta_tuning_overrides;
CREATE POLICY "eta_tuning_read_admin_mod"
  ON public.eta_tuning_overrides FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

DROP FUNCTION IF EXISTS public.is_valid_cpf(text);
CREATE FUNCTION public.is_valid_cpf(cpf text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  digits text;
  i int;
  sum1 int := 0;
  sum2 int := 0;
  d1 int;
  d2 int;
BEGIN
  IF cpf IS NULL THEN RETURN false; END IF;
  digits := regexp_replace(cpf, '\D', '', 'g');
  IF length(digits) <> 11 THEN RETURN false; END IF;
  IF digits ~ '^(\d)\1{10}$' THEN RETURN false; END IF;
  FOR i IN 1..9 LOOP
    sum1 := sum1 + (substring(digits, i, 1))::int * (11 - i);
  END LOOP;
  d1 := (sum1 * 10) % 11;
  IF d1 = 10 THEN d1 := 0; END IF;
  IF d1 <> (substring(digits, 10, 1))::int THEN RETURN false; END IF;
  FOR i IN 1..10 LOOP
    sum2 := sum2 + (substring(digits, i, 1))::int * (12 - i);
  END LOOP;
  d2 := (sum2 * 10) % 11;
  IF d2 = 10 THEN d2 := 0; END IF;
  RETURN d2 = (substring(digits, 11, 1))::int;
END;
$$;

DROP POLICY IF EXISTS "Authenticated users can upload review evidence" ON storage.objects;
CREATE POLICY "Users upload review evidence to own profile path"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'review-evidence'
    AND (
      (storage.foldername(name))[1] IN (
        SELECT id::text FROM public.profiles WHERE user_id = auth.uid()
      )
      OR (
        (storage.foldername(name))[1] = 'disputes'
        AND (storage.foldername(name))[2] IN (
          SELECT id::text FROM public.profiles WHERE user_id = auth.uid()
        )
      )
    )
  );
