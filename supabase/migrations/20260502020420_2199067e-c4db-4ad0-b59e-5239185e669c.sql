
-- Revoke broad EXECUTE from public/anon on all SECURITY DEFINER functions, then grant scoped access.

-- 1) Trigger functions: not callable directly
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_service_status_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_dispute_evidence() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_dispute_status_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_service_status_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- 2) Helper / RPC functions used by RLS or by authenticated UI
REVOKE ALL ON FUNCTION public.get_my_profile_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_profile_id() TO authenticated;

REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.is_conversation_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_conversation_member(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.is_profile_owner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_profile_owner(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.is_provider_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_provider_profile(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_affiliate_dashboard(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_affiliate_dashboard(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.update_affiliate_level(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_affiliate_level(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.publish_blind_reviews() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_blind_reviews() TO service_role;

-- 3) Service lifecycle / dispute RPCs
REVOKE ALL ON FUNCTION public.transition_service_status(uuid, service_status, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transition_service_status(uuid, service_status, text) TO authenticated;

REVOKE ALL ON FUNCTION public.accept_service_proposal(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_service_proposal(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.open_service_dispute(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_service_dispute(uuid, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.resolve_service_dispute(uuid, text, text, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_service_dispute(uuid, text, text, numeric, text) TO authenticated;
