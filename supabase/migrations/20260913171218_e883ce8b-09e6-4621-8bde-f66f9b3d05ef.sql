-- Vitrine pública passa a ler pela view (sem acesso direto de visitantes à tabela)
ALTER VIEW public.public_service_requests SET (security_invoker = false);
DROP POLICY IF EXISTS "Anon can view showcase of active service requests" ON public.service_requests;
REVOKE SELECT ON public.service_requests FROM anon;
GRANT SELECT ON public.public_service_requests TO anon, authenticated;

-- Configurações internas somente para equipe
DROP POLICY IF EXISTS "ai_config read" ON public.ai_config;
CREATE POLICY "ai_config read staff" ON public.ai_config
FOR SELECT TO authenticated USING (public.ai_is_staff());

DROP POLICY IF EXISTS "ai_price_corrections read" ON public.ai_price_corrections;
CREATE POLICY "ai_price_corrections read staff" ON public.ai_price_corrections
FOR SELECT TO authenticated USING (public.ai_is_staff());

DROP POLICY IF EXISTS "Anyone can read weights" ON public.dispatch_match_weights;
CREATE POLICY "Staff can read weights" ON public.dispatch_match_weights
FOR SELECT TO authenticated USING (public.ai_is_staff());