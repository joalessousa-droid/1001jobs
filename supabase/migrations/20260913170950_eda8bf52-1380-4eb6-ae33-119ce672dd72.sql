DROP POLICY IF EXISTS "Public can view active service requests" ON public.service_requests;

CREATE POLICY "Authenticated can view active service requests"
ON public.service_requests
FOR SELECT
TO authenticated
USING (is_active = true);

REVOKE SELECT ON public.service_requests FROM anon;