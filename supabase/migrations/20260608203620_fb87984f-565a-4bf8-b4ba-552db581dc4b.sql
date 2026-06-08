
CREATE OR REPLACE FUNCTION public.validate_insurance_attachment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _count int; _total bigint; _ext text;
  _allowed_mime text[] := ARRAY[
    'image/jpeg','image/png','image/webp','image/gif',
    'video/mp4','video/quicktime','video/webm',
    'application/pdf','application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  _allowed_ext text[] := ARRAY['jpg','jpeg','png','webp','gif','mp4','mov','webm','pdf','doc','docx'];
BEGIN
  IF NEW.size_bytes IS NULL OR NEW.size_bytes <= 0 THEN
    RAISE EXCEPTION 'attachment_invalid_size' USING ERRCODE='22023';
  END IF;
  IF NEW.size_bytes > 50 * 1024 * 1024 THEN
    RAISE EXCEPTION 'attachment_too_large' USING ERRCODE='22023';
  END IF;
  IF NEW.mime_type IS NULL OR NOT (NEW.mime_type = ANY(_allowed_mime)) THEN
    RAISE EXCEPTION 'attachment_mime_not_allowed:%', NEW.mime_type USING ERRCODE='22023';
  END IF;
  _ext := lower(regexp_replace(coalesce(NEW.file_path,''), '^.*\.', ''));
  IF _ext = '' OR NOT (_ext = ANY(_allowed_ext)) THEN
    RAISE EXCEPTION 'attachment_extension_not_allowed:%', _ext USING ERRCODE='22023';
  END IF;
  SELECT count(*), COALESCE(SUM(size_bytes),0)
    INTO _count, _total
    FROM public.insurance_claim_attachments WHERE claim_id = NEW.claim_id;
  IF _count >= 20 THEN
    RAISE EXCEPTION 'attachment_max_files_reached' USING ERRCODE='22023';
  END IF;
  IF (_total + NEW.size_bytes) > 200 * 1024 * 1024 THEN
    RAISE EXCEPTION 'attachment_stage_size_exceeded' USING ERRCODE='22023';
  END IF;
  RETURN NEW;
END $$;
