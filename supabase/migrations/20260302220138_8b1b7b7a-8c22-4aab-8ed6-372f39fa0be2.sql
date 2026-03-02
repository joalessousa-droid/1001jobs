
-- Add owner column to service_requests
ALTER TABLE public.service_requests
ADD COLUMN profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Policy: authenticated users can insert their own requests
CREATE POLICY "Users can create own service requests"
ON public.service_requests FOR INSERT
TO authenticated
WITH CHECK (profile_id = public.get_my_profile_id());

-- Policy: users can update their own requests
CREATE POLICY "Users can update own service requests"
ON public.service_requests FOR UPDATE
TO authenticated
USING (profile_id = public.get_my_profile_id());

-- Policy: users can delete their own requests
CREATE POLICY "Users can delete own service requests"
ON public.service_requests FOR DELETE
TO authenticated
USING (profile_id = public.get_my_profile_id());
