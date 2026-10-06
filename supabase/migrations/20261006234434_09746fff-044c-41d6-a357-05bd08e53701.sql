CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','low','medium','high','critical')),
  actor_user_id uuid,
  target text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS security_events_created_idx ON public.security_events (created_at DESC);
GRANT SELECT, UPDATE ON public.security_events TO authenticated;
GRANT ALL ON public.security_events TO service_role;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "security events staff read" ON public.security_events FOR SELECT TO authenticated USING (public.ai_is_staff());
CREATE POLICY "security events staff triage" ON public.security_events FOR UPDATE TO authenticated USING (public.ai_is_staff()) WITH CHECK (public.ai_is_staff());

CREATE OR REPLACE FUNCTION public.security_events_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'security_events is append-only'; END IF;
  IF NEW.event_type <> OLD.event_type OR NEW.details <> OLD.details OR NEW.created_at <> OLD.created_at
     OR NEW.severity <> OLD.severity THEN RAISE EXCEPTION 'only status can change'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS security_events_guard ON public.security_events;
CREATE TRIGGER security_events_guard BEFORE UPDATE OR DELETE ON public.security_events
  FOR EACH ROW EXECUTE FUNCTION public.security_events_guard();

CREATE OR REPLACE FUNCTION public.raise_security_event(_type text, _severity text, _target text, _details jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO security_events(event_type, severity, actor_user_id, target, details)
  VALUES (left(_type,60), _severity, auth.uid(), left(_target,200), coalesce(_details,'{}'::jsonb));
$$;
REVOKE ALL ON FUNCTION public.raise_security_event(text,text,text,jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.log_client_security_event(_type text, _details jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  IF _type NOT IN ('login','logout','mfa_enrolled','mfa_removed','sessions_revoked','password_changed') THEN
    RAISE EXCEPTION 'invalid_event'; END IF;
  PERFORM raise_security_event(_type, 'info', auth.uid()::text, jsonb_strip_nulls(jsonb_build_object('ua', left(_details->>'ua',200))));
END $$;
REVOKE ALL ON FUNCTION public.log_client_security_event(text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_client_security_event(text,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.trg_role_change_alert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM raise_security_event('privilege_change', 'high', coalesce(NEW.user_id, OLD.user_id)::text,
    jsonb_build_object('op', TG_OP, 'role', coalesce(NEW.role, OLD.role)));
  RETURN coalesce(NEW, OLD);
END $$;
DROP TRIGGER IF EXISTS role_change_alert ON public.user_roles;
CREATE TRIGGER role_change_alert AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.trg_role_change_alert();

CREATE OR REPLACE FUNCTION public.trg_mass_change_alert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM old_rows;
  IF n >= 50 THEN
    PERFORM raise_security_event('mass_' || lower(TG_OP), 'critical', TG_TABLE_NAME, jsonb_build_object('rows', n));
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS mass_delete_profiles ON public.profiles;
CREATE TRIGGER mass_delete_profiles AFTER DELETE ON public.profiles REFERENCING OLD TABLE AS old_rows
  FOR EACH STATEMENT EXECUTE FUNCTION public.trg_mass_change_alert();
DROP TRIGGER IF EXISTS mass_delete_services ON public.services;
CREATE TRIGGER mass_delete_services AFTER DELETE ON public.services REFERENCING OLD TABLE AS old_rows
  FOR EACH STATEMENT EXECUTE FUNCTION public.trg_mass_change_alert();
DROP TRIGGER IF EXISTS mass_delete_payments ON public.service_payments;
CREATE TRIGGER mass_delete_payments AFTER DELETE ON public.service_payments REFERENCING OLD TABLE AS old_rows
  FOR EACH STATEMENT EXECUTE FUNCTION public.trg_mass_change_alert();

CREATE OR REPLACE FUNCTION public.security_detect_signals() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c int := 0; r record;
BEGIN
  FOR r IN SELECT min(public_ref) ref, count(*) n FROM profiles WHERE cpf_cnpj IS NOT NULL AND cpf_cnpj <> '' AND NOT coalesce(is_synthetic,false)
           GROUP BY cpf_cnpj HAVING count(*) > 1 LOOP
    PERFORM raise_security_event('fraud_duplicate_document','medium', r.ref, jsonb_build_object('accounts', r.n)); c := c + 1;
  END LOOP;
  FOR r IN SELECT provider_id, max(spd) v FROM (
      SELECT provider_id,
        (sqrt(power((latitude - lag(latitude) OVER w) * 111.0, 2) + power((longitude - lag(longitude) OVER w) * 111.0 * cos(radians(latitude)), 2))
         / nullif(extract(epoch FROM recorded_at - lag(recorded_at) OVER w) / 3600.0, 0)) spd
      FROM provider_location_history WHERE recorded_at > now() - interval '1 hour'
      WINDOW w AS (PARTITION BY provider_id ORDER BY recorded_at)) s
    WHERE spd > 250 GROUP BY provider_id LOOP
    PERFORM raise_security_event('fraud_gps_spoofing','medium', r.provider_id::text, jsonb_build_object('kmh', round(r.v::numeric))); c := c + 1;
  END LOOP;
  FOR r IN SELECT reviewer_id, count(*) n FROM reviews WHERE created_at > now() - interval '24 hours'
           GROUP BY reviewer_id HAVING count(*) > 10 LOOP
    PERFORM raise_security_event('fraud_review_burst','medium', r.reviewer_id::text, jsonb_build_object('reviews', r.n)); c := c + 1;
  END LOOP;
  RETURN c;
END $$;
REVOKE ALL ON FUNCTION public.security_detect_signals() FROM PUBLIC, anon, authenticated;
SELECT cron.schedule('security-detect-signals', '7 * * * *', $$SELECT public.security_detect_signals()$$);

CREATE OR REPLACE FUNCTION public.admin_export_credentials() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM raise_security_event('honeytoken_triggered','critical','admin_export_credentials', '{}'::jsonb);
  RETURN jsonb_build_object('error','forbidden');
END $$;
REVOKE ALL ON FUNCTION public.admin_export_credentials() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_export_credentials() TO anon, authenticated;