CREATE OR REPLACE FUNCTION public.confirm_task_arrival(
  _service_id uuid, _latitude double precision DEFAULT NULL, _longitude double precision DEFAULT NULL,
  _accuracy double precision DEFAULT NULL, _source text DEFAULT 'PROVIDER_BUTTON', _metadata jsonb DEFAULT '{}'::jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _prov uuid; _client uuid; _already timestamptz; _src text; _pname text; _title text;
BEGIN
  SELECT s.provider_id, s.client_id, s.title INTO _prov, _client, _title FROM services s JOIN profiles p ON p.id = s.provider_id
   WHERE s.id = _service_id AND p.user_id = auth.uid();
  IF _prov IS NULL THEN RAISE EXCEPTION 'not_assigned_provider'; END IF;
  _src := CASE WHEN _source = 'GPS' THEN 'GPS' ELSE 'PROVIDER_BUTTON' END;
  SELECT arrived_at INTO _already FROM service_tracking WHERE service_id = _service_id;
  INSERT INTO task_navigation_events(service_id, provider_id, event_type, latitude, longitude, accuracy, source, metadata)
  VALUES (_service_id, _prov, CASE WHEN _src='GPS' THEN 'arrival_confirmed' ELSE 'provider_manual_arrival' END,
          _latitude, _longitude, _accuracy, _src, coalesce(_metadata,'{}'::jsonb));
  IF _already IS NOT NULL THEN RETURN false; END IF;
  UPDATE service_tracking SET nav_state='arrived', arrived_at=now(), arrival_source=_src,
    arrival_lat=_latitude, arrival_lng=_longitude, updated_at=now() WHERE service_id=_service_id;
  SELECT coalesce(nullif(split_part(display_name,' ',1),''),'Seu profissional') INTO _pname FROM profiles WHERE id=_prov;
  INSERT INTO notifications(profile_id, type, title, message, link, metadata)
  VALUES (_client, 'provider_arrived', '📍 ' || _pname || ' chegou ao local',
          'Seu profissional chegou ao endereço' || coalesce(' do serviço "' || left(_title,60) || '"','') ||
          '. Vá até a porta para recebê-lo e confira o serviço pelo app.',
          '/servico/' || _service_id || '/rastreio',
          jsonb_build_object('service_id', _service_id, 'source', _src, 'action_label', 'Abrir serviço'));
  INSERT INTO task_navigation_events(service_id, provider_id, event_type, source)
  VALUES (_service_id, _prov, 'arrival_notification_sent', _src);
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.admin_navigation_history(_provider_id uuid DEFAULT NULL, _days int DEFAULT 30)
RETURNS TABLE(id uuid, service_id uuid, service_title text, provider_id uuid, provider_name text,
  event_type text, latitude double precision, longitude double precision, accuracy double precision,
  source text, metadata jsonb, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.ai_is_staff() THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT e.id, e.service_id, s.title, e.provider_id, p.display_name, e.event_type, e.latitude, e.longitude,
         e.accuracy, e.source, e.metadata, e.created_at
  FROM task_navigation_events e
  LEFT JOIN services s ON s.id = e.service_id
  LEFT JOIN profiles p ON p.id = e.provider_id
  WHERE e.created_at >= now() - make_interval(days => greatest(1, least(coalesce(_days,30), 365)))
    AND (_provider_id IS NULL OR e.provider_id = _provider_id)
  ORDER BY e.created_at DESC LIMIT 5000;
END $$;
REVOKE ALL ON FUNCTION public.admin_navigation_history(uuid,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_navigation_history(uuid,int) TO authenticated;