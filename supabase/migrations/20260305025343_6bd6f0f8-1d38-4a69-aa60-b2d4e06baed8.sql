
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
  _referral_code := NEW.raw_user_meta_data->>'referral_code';
  IF _referral_code IS NOT NULL AND _referral_code != '' THEN
    SELECT id INTO _referred_by FROM public.profiles WHERE affiliate_code = _referral_code;
  END IF;

  INSERT INTO public.profiles (
    user_id, display_name, user_type, affiliate_code, referred_by,
    person_type, cpf_cnpj, date_of_birth, mother_name, phone,
    cep, address_street, address_number, address_complement, address_neighborhood, city, state,
    razao_social, nome_fantasia, data_abertura, natureza_juridica, cnae, capital_social,
    representative_name, representative_cpf, representative_birth_date,
    representative_email, representative_phone, representative_role,
    years_experience, professional_registration, bio
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'user_type')::public.user_type, 'client'),
    UPPER(SUBSTR(MD5(NEW.id::TEXT || RANDOM()::TEXT), 1, 8)),
    _referred_by,
    COALESCE(NEW.raw_user_meta_data->>'person_type', 'fisica'),
    NEW.raw_user_meta_data->>'cpf_cnpj',
    CASE WHEN NEW.raw_user_meta_data->>'date_of_birth' IS NOT NULL AND NEW.raw_user_meta_data->>'date_of_birth' != '' THEN (NEW.raw_user_meta_data->>'date_of_birth')::date ELSE NULL END,
    NEW.raw_user_meta_data->>'mother_name',
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'cep',
    NEW.raw_user_meta_data->>'address_street',
    NEW.raw_user_meta_data->>'address_number',
    NEW.raw_user_meta_data->>'address_complement',
    NEW.raw_user_meta_data->>'address_neighborhood',
    NEW.raw_user_meta_data->>'city',
    NEW.raw_user_meta_data->>'state',
    NEW.raw_user_meta_data->>'razao_social',
    NEW.raw_user_meta_data->>'nome_fantasia',
    CASE WHEN NEW.raw_user_meta_data->>'data_abertura' IS NOT NULL AND NEW.raw_user_meta_data->>'data_abertura' != '' THEN (NEW.raw_user_meta_data->>'data_abertura')::date ELSE NULL END,
    NEW.raw_user_meta_data->>'natureza_juridica',
    NEW.raw_user_meta_data->>'cnae',
    CASE WHEN NEW.raw_user_meta_data->>'capital_social' IS NOT NULL AND NEW.raw_user_meta_data->>'capital_social' != '' THEN (NEW.raw_user_meta_data->>'capital_social')::numeric ELSE NULL END,
    NEW.raw_user_meta_data->>'representative_name',
    NEW.raw_user_meta_data->>'representative_cpf',
    CASE WHEN NEW.raw_user_meta_data->>'representative_birth_date' IS NOT NULL AND NEW.raw_user_meta_data->>'representative_birth_date' != '' THEN (NEW.raw_user_meta_data->>'representative_birth_date')::date ELSE NULL END,
    NEW.raw_user_meta_data->>'representative_email',
    NEW.raw_user_meta_data->>'representative_phone',
    NEW.raw_user_meta_data->>'representative_role',
    CASE WHEN NEW.raw_user_meta_data->>'years_experience' IS NOT NULL AND NEW.raw_user_meta_data->>'years_experience' != '' THEN (NEW.raw_user_meta_data->>'years_experience')::integer ELSE NULL END,
    NEW.raw_user_meta_data->>'professional_registration',
    NEW.raw_user_meta_data->>'bio'
  );
  RETURN NEW;
END;
$$;
