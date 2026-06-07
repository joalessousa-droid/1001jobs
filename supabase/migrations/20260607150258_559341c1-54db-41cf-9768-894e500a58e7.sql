
REVOKE EXECUTE ON FUNCTION public.calculate_provider_score(uuid,uuid,numeric,uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.expire_stale_offers() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accept_service_offer(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.decline_service_offer(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_dispatch_dashboard() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.calculate_provider_score(uuid,uuid,numeric,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.expire_stale_offers() TO service_role;
GRANT EXECUTE ON FUNCTION public.accept_service_offer(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.decline_service_offer(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_dispatch_dashboard() TO authenticated, service_role;
