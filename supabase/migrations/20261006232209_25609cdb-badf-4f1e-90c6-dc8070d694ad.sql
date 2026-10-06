DROP POLICY IF EXISTS "Public can read ranking" ON public.provider_ranking_scores;
DROP POLICY IF EXISTS "ranking staff read" ON public.provider_ranking_scores;
CREATE POLICY "ranking staff read" ON public.provider_ranking_scores FOR SELECT TO authenticated USING (public.ai_is_staff());