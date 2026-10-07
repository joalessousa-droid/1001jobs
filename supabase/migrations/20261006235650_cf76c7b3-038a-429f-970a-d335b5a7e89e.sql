CREATE OR REPLACE FUNCTION public.trg_synthetic_provider_setup() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_synthetic AND NEW.user_type = 'provider' AND NEW.latitude IS NOT NULL THEN
    INSERT INTO provider_locations(provider_id, latitude, longitude, accuracy, is_sharing, is_public, updated_at)
    VALUES (NEW.id, NEW.latitude, NEW.longitude, 30, true, false, now()) ON CONFLICT (provider_id) DO NOTHING;
    INSERT INTO provider_availability(provider_id, is_online, is_busy, last_seen_at, updated_at)
    VALUES (NEW.id, true, false, now(), now()) ON CONFLICT (provider_id) DO NOTHING;
    INSERT INTO provider_services(provider_id, category_id, description, hourly_rate)
    SELECT NEW.id, c.id, 'Atendimento de demonstração', round((60 + random()*120)::numeric, 2)
    FROM (SELECT id FROM service_categories ORDER BY md5(NEW.id::text || id::text) LIMIT 2) c;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.trg_synthetic_provider_setup() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS synthetic_provider_setup ON public.profiles;
CREATE TRIGGER synthetic_provider_setup AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.trg_synthetic_provider_setup();