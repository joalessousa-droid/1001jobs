
-- Drop the restrictive SELECT policy and recreate as permissive
DROP POLICY IF EXISTS "Providers can view client profiles" ON public.profiles;

CREATE POLICY "Anyone can view profiles"
ON public.profiles
FOR SELECT
USING (true);
