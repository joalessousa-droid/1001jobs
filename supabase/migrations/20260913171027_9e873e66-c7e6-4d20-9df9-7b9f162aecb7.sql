CREATE POLICY "Anon can view showcase of active service requests"
ON public.service_requests
FOR SELECT
TO anon
USING (is_active = true);

GRANT SELECT (
  id, requester_type, description, category_id, budget, city, state,
  lat_approx, lng_approx, is_active, created_at, updated_at, profile_id,
  selected_provider_id, service_id, status, price_type, is_synthetic, origin
) ON public.service_requests TO anon;