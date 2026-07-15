-- Permitir que a busca pública liste tarefas ativas via view segura (sem expor requester_name/PII).
-- Alterna as views public_* para security_invoker=off (executam com privilégios do dono, ignorando RLS da base)
-- e garante grants para anon/authenticated.

ALTER VIEW public.public_service_requests SET (security_invoker = false);
ALTER VIEW public.public_profiles SET (security_invoker = false);

GRANT SELECT ON public.public_service_requests TO anon, authenticated;
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- Também expõe os flags is_synthetic para a UI mostrar o badge "Demo"
CREATE OR REPLACE VIEW public.public_service_requests
WITH (security_invoker = false) AS
SELECT id, requester_type, description, category_id, budget, city, state,
       round(latitude::numeric, 2)::double precision AS latitude,
       round(longitude::numeric, 2)::double precision AS longitude,
       is_active, created_at, updated_at, profile_id, selected_provider_id,
       service_id, status, price_type, is_synthetic
FROM public.service_requests
WHERE is_active = true;

CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = false) AS
SELECT id, user_id, user_type, display_name, avatar_url, bio, city, state,
       latitude, longitude, verification_status, is_active, created_at,
       affiliate_code, affiliate_level, years_experience,
       professional_registration, nome_fantasia, business_hours, is_synthetic
FROM public.profiles
WHERE is_active = true;

GRANT SELECT ON public.public_service_requests TO anon, authenticated;
GRANT SELECT ON public.public_profiles TO anon, authenticated;