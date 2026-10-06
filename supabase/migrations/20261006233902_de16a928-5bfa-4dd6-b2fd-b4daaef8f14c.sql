DROP POLICY IF EXISTS "Anyone can view kpis" ON public.investor_kpis;
CREATE POLICY "kpis staff read" ON public.investor_kpis FOR SELECT TO authenticated USING (public.ai_is_staff());

DROP POLICY IF EXISTS "Authenticated users can read regional stats" ON public.regional_traffic_stats;
CREATE POLICY "regional traffic staff read" ON public.regional_traffic_stats FOR SELECT TO authenticated USING (public.ai_is_staff());

DROP POLICY IF EXISTS "Public reads online providers" ON public.provider_availability;
CREATE POLICY "Signed-in read provider availability" ON public.provider_availability FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);