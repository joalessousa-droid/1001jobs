
REVOKE EXECUTE ON FUNCTION public.notify_service_status_change() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.notify_dispute_status_change() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.notify_dispute_evidence() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.resolve_service_dispute(uuid, text, text, numeric, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.resolve_service_dispute(uuid, text, text, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
