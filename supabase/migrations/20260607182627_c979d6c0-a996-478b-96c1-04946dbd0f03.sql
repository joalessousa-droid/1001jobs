
REVOKE EXECUTE ON FUNCTION public.get_kyc_metrics(timestamptz, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_kyc_metrics(timestamptz, timestamptz, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.export_kyc_decisions(timestamptz, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.export_kyc_decisions(timestamptz, timestamptz, text) TO authenticated;
