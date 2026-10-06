REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (id,user_id,user_type,display_name,avatar_url,bio,city,state,latitude,longitude,verification_status,is_active,created_at,updated_at,affiliate_code,referred_by,affiliate_level,person_type,business_hours,razao_social,nome_fantasia,data_abertura,natureza_juridica,cnae,capital_social,representative_name,representative_role,years_experience,professional_registration,is_blocked,blocked_at,blocked_reason,fraud_score,provider_score,provider_tier,client_score,is_synthetic,synthetic_expires_at,public_ref)
  ON public.profiles TO authenticated;
GRANT SELECT (id,user_id,user_type,display_name,avatar_url,bio,city,state,verification_status,is_active,created_at,nome_fantasia,years_experience,provider_tier,is_synthetic,public_ref)
  ON public.profiles TO anon;

-- Dados sensíveis só para o dono do perfil ou administração
CREATE OR REPLACE FUNCTION public.get_profiles_private(_profile_ids uuid[] DEFAULT NULL, _user_ids uuid[] DEFAULT NULL)
RETURNS SETOF public.profiles LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.* FROM profiles p
  WHERE (p.user_id = auth.uid() OR public.ai_is_staff())
    AND (_profile_ids IS NULL OR p.id = ANY(_profile_ids))
    AND (_user_ids IS NULL OR p.user_id = ANY(_user_ids))
  LIMIT 1000
$$;
REVOKE ALL ON FUNCTION public.get_profiles_private(uuid[], uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profiles_private(uuid[], uuid[]) TO authenticated;