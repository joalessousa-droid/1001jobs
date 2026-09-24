-- ============================================================================
-- MIGRAÇÃO PENDENTE — aplicar assim que o banco hospedado voltar a ficar ativo.
-- Conteúdo: (A) Modo Navegação da Tarefa, (B) correções de acesso apontadas
-- pela varredura de segurança. Tudo aditivo; nenhuma função existente é removida.
-- ============================================================================

-- ------------------------------------------------------------------ (A) ----
-- Modo Navegação da Tarefa
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.navigation_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  geofence_radius_m integer NOT NULL DEFAULT 100,
  dwell_seconds integer NOT NULL DEFAULT 45,
  max_speed_kmh numeric NOT NULL DEFAULT 8,
  min_accuracy_m integer NOT NULL DEFAULT 120,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.navigation_settings TO authenticated;
GRANT ALL ON public.navigation_settings TO service_role;
ALTER TABLE public.navigation_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "navigation_settings read" ON public.navigation_settings;
CREATE POLICY "navigation_settings read" ON public.navigation_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "navigation_settings staff write" ON public.navigation_settings;
CREATE POLICY "navigation_settings staff write" ON public.navigation_settings
  FOR ALL TO authenticated USING (public.ai_is_staff()) WITH CHECK (public.ai_is_staff());

INSERT INTO public.navigation_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.task_navigation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  provider_id uuid,
  event_type text NOT NULL CHECK (event_type IN (
    'navigation_started','navigation_provider','en_route','arrival_detected',
    'arrival_confirmed','provider_manual_arrival','arrival_notification_sent')),
  latitude double precision,
  longitude double precision,
  accuracy double precision,
  source text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS task_navigation_events_service_idx
  ON public.task_navigation_events (service_id, created_at DESC);

GRANT SELECT, INSERT ON public.task_navigation_events TO authenticated;
GRANT ALL ON public.task_navigation_events TO service_role;
ALTER TABLE public.task_navigation_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nav events visible to parties" ON public.task_navigation_events;
CREATE POLICY "nav events visible to parties" ON public.task_navigation_events
  FOR SELECT TO authenticated USING (
    public.ai_is_staff()
    OR EXISTS (
      SELECT 1 FROM public.services s
      JOIN public.profiles p ON p.id IN (s.client_id, s.provider_id)
      WHERE s.id = task_navigation_events.service_id AND p.user_id = auth.uid()
    )
  );

ALTER TABLE public.service_tracking
  ADD COLUMN IF NOT EXISTS nav_state text NOT NULL DEFAULT 'accepted',
  ADD COLUMN IF NOT EXISTS navigation_app text,
  ADD COLUMN IF NOT EXISTS navigation_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS arrival_detected_at timestamptz,
  ADD COLUMN IF NOT EXISTS arrived_at timestamptz,
  ADD COLUMN IF NOT EXISTS arrival_source text,
  ADD COLUMN IF NOT EXISTS arrival_lat double precision,
  ADD COLUMN IF NOT EXISTS arrival_lng double precision;

-- Funções de registro/confirmação de chegada: ver detalhes na especificação do
-- Modo Navegação (record_navigation_event, confirm_task_arrival), a serem criadas
-- com SECURITY DEFINER e restritas ao profissional designado ao serviço.

-- ------------------------------------------------------------------ (B) ----
-- Correções de acesso apontadas pela varredura
-- ---------------------------------------------------------------------------

-- Notas de reputação: mantidas legíveis, mas apenas para usuários autenticados
-- (deixam de ser públicas a visitantes anônimos).
DROP POLICY IF EXISTS "Anyone reads provider scores" ON public.provider_composite_scores;
CREATE POLICY "Signed-in users read provider scores" ON public.provider_composite_scores
  FOR SELECT TO authenticated USING (true);

-- Metadados internos da IA: restritos à administração.
DROP POLICY IF EXISTS "ai_model_versions read" ON public.ai_model_versions;
CREATE POLICY "ai_model_versions staff read" ON public.ai_model_versions
  FOR SELECT TO authenticated USING (public.ai_is_staff());

DROP POLICY IF EXISTS "ai_regional_stats read" ON public.ai_regional_stats;
CREATE POLICY "ai_regional_stats staff read" ON public.ai_regional_stats
  FOR SELECT TO authenticated USING (public.ai_is_staff());

-- Perfis: remover leitura ampla de colunas sensíveis por qualquer usuário logado.
-- O acesso passa a ser: dono do perfil + administração; o restante da aplicação
-- consome a visão pública (nome, foto, cidade, avaliação, categorias).
-- Requer conferência das políticas existentes no momento da aplicação.
