ALTER TABLE public.service_requests ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'standard';
UPDATE public.service_requests SET origin = 'radar' WHERE search_radius IS NOT NULL AND origin = 'standard';
CREATE OR REPLACE VIEW public.public_service_requests AS
SELECT id, requester_type, description, category_id, budget, city, state,
  round(latitude::numeric, 2)::double precision AS latitude,
  round(longitude::numeric, 2)::double precision AS longitude,
  is_active, created_at, updated_at, profile_id, selected_provider_id, service_id, status, price_type, is_synthetic, origin
FROM public.service_requests
WHERE is_active = true;
GRANT SELECT ON public.public_service_requests TO anon, authenticated;