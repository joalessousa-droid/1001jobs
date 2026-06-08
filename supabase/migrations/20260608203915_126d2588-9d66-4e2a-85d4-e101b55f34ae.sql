
CREATE OR REPLACE FUNCTION public.apply_insurance_retention_policy()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _days int; _rule text; _updated int; _cleared int;
BEGIN
  SELECT insurance_retention_days, insurance_retention_rule
    INTO _days, _rule
    FROM public.app_settings LIMIT 1;
  _days := COALESCE(_days, 90);
  _rule := COALESCE(_rule, 'on_terminal_status');

  IF _rule = 'never' THEN
    UPDATE public.insurance_claims SET retention_until = NULL WHERE retention_until IS NOT NULL;
    GET DIAGNOSTICS _cleared = ROW_COUNT;
    RETURN jsonb_build_object('rule', _rule, 'days', _days, 'updated', 0, 'cleared', _cleared);
  END IF;

  IF _rule = 'from_creation' THEN
    UPDATE public.insurance_claims
       SET retention_until = created_at + (_days || ' days')::interval
     WHERE retention_until IS DISTINCT FROM (created_at + (_days || ' days')::interval);
  ELSIF _rule = 'on_close_only' THEN
    UPDATE public.insurance_claims
       SET retention_until = COALESCE(closed_at, updated_at) + (_days || ' days')::interval
     WHERE status::text = 'closed'
       AND retention_until IS DISTINCT FROM (COALESCE(closed_at, updated_at) + (_days || ' days')::interval);
    UPDATE public.insurance_claims SET retention_until = NULL
     WHERE status::text <> 'closed' AND retention_until IS NOT NULL;
  ELSE -- on_terminal_status (default)
    UPDATE public.insurance_claims
       SET retention_until = COALESCE(closed_at, updated_at) + (_days || ' days')::interval
     WHERE status::text IN ('approved','denied','closed')
       AND retention_until IS DISTINCT FROM (COALESCE(closed_at, updated_at) + (_days || ' days')::interval);
    UPDATE public.insurance_claims SET retention_until = NULL
     WHERE status::text NOT IN ('approved','denied','closed') AND retention_until IS NOT NULL;
  END IF;
  GET DIAGNOSTICS _updated = ROW_COUNT;

  RETURN jsonb_build_object('rule', _rule, 'days', _days, 'updated', _updated);
END $$;

CREATE OR REPLACE FUNCTION public.purge_insurance_attachments(_ids uuid[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n int; _r record;
BEGIN
  FOR _r IN
    SELECT claim_id, array_agg(id) AS ids, count(*) AS qty, COALESCE(SUM(size_bytes),0) AS bytes
    FROM public.insurance_claim_attachments WHERE id = ANY(_ids)
    GROUP BY claim_id
  LOOP
    INSERT INTO public.insurance_claim_events(claim_id, event_type, actor_user_id, is_admin, message, metadata)
    VALUES (_r.claim_id, 'retention_purged', NULL, true,
            'Retenção aplicada: anexos removidos automaticamente',
            jsonb_build_object('count', _r.qty, 'bytes', _r.bytes, 'attachment_ids', _r.ids));
  END LOOP;

  DELETE FROM public.insurance_claim_attachments WHERE id = ANY(_ids);
  GET DIAGNOSTICS _n = ROW_COUNT;

  INSERT INTO public.audit_logs(action, entity_type, user_id, details)
  VALUES ('insurance.attachments_purged','insurance_claim_attachment', NULL,
          jsonb_build_object('count', _n, 'ids', _ids));
  RETURN _n;
END $$;
