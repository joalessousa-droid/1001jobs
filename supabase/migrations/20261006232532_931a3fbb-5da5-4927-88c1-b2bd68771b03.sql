-- Etapa 9: identificador pseudônimo (não substitui o id existente)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS public_ref text
  GENERATED ALWAYS AS ('1001-' || upper(substr(md5(id::text || 'jobs1001'), 1, 10))) STORED;

-- Etapa 10: retenção de localização precisa + registro de acesso
CREATE TABLE IF NOT EXISTS public.location_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  accessor_user_id uuid,
  provider_id uuid,
  service_id uuid,
  purpose text NOT NULL DEFAULT 'tracking',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.location_access_log TO authenticated;
GRANT ALL ON public.location_access_log TO service_role;
ALTER TABLE public.location_access_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "location log insert self" ON public.location_access_log FOR INSERT TO authenticated
  WITH CHECK (accessor_user_id = auth.uid() AND purpose IN ('tracking','navigation','radar','support'));
CREATE POLICY "location log staff read" ON public.location_access_log FOR SELECT TO authenticated
  USING (public.ai_is_staff());

CREATE OR REPLACE FUNCTION public.purge_old_location_history(_days integer DEFAULT 90)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  DELETE FROM provider_location_history WHERE recorded_at < now() - make_interval(days => greatest(_days, 30));
  GET DIAGNOSTICS n = ROW_COUNT;
  DELETE FROM location_access_log WHERE created_at < now() - interval '365 days';
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.purge_old_location_history(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_old_location_history(integer) TO service_role;

SELECT cron.schedule('purge-location-history-daily', '41 4 * * *', $$SELECT public.purge_old_location_history(90)$$);