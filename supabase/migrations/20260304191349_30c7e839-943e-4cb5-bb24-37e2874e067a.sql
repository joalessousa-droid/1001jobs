CREATE POLICY "Service role can update subscriptions"
ON public.subscriptions
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);