DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Portfolio images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view review evidence" ON storage.objects;
CREATE POLICY "Owners list own public media" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id IN ('avatars','portfolio','review-evidence') AND (owner = auth.uid() OR public.ai_is_staff()));