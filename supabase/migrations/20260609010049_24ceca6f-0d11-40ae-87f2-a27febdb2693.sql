CREATE OR REPLACE FUNCTION public.cancel_emergency_alert(_alert_id uuid, _reason text DEFAULT NULL)
RETURNS public.emergency_alerts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.emergency_alerts;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT * INTO _row FROM public.emergency_alerts WHERE id = _alert_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Alerta não encontrado';
  END IF;

  IF _row.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Sem permissão para cancelar este alerta';
  END IF;

  IF _row.status IN ('closed','cancelled') THEN
    RAISE EXCEPTION 'Alerta já finalizado';
  END IF;

  UPDATE public.emergency_alerts
    SET status = 'cancelled',
        closed_at = now(),
        closed_by = auth.uid(),
        notes = COALESCE(NULLIF(trim(_reason), ''), 'Cancelado pelo usuário'),
        updated_at = now()
    WHERE id = _alert_id
    RETURNING * INTO _row;

  RETURN _row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_emergency_alert(uuid, text) TO authenticated;