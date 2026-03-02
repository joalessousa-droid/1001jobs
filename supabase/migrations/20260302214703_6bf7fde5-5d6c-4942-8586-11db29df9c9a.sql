
-- Table for service requests/demands from clients looking for professionals
CREATE TABLE public.service_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_name text NOT NULL,
  requester_type text NOT NULL DEFAULT 'person', -- 'person' or 'company'
  description text NOT NULL,
  category_id uuid REFERENCES public.service_categories(id) NOT NULL,
  budget numeric,
  city text,
  state text,
  latitude double precision,
  longitude double precision,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active service requests"
ON public.service_requests FOR SELECT
USING (is_active = true);

CREATE TRIGGER update_service_requests_updated_at
BEFORE UPDATE ON public.service_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
