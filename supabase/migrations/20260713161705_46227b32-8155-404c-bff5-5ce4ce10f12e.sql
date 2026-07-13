
-- 1. Add synthetic flags to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_synthetic BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS synthetic_expires_at TIMESTAMPTZ;

-- Allow user_id to be nullable ONLY for synthetic rows
ALTER TABLE public.profiles ALTER COLUMN user_id DROP NOT NULL;

-- Drop old unique constraint and replace with partial unique index
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_id_unique_real
  ON public.profiles(user_id) WHERE user_id IS NOT NULL;

-- Enforce: user_id required unless synthetic
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_or_synthetic_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_user_or_synthetic_check
  CHECK (user_id IS NOT NULL OR is_synthetic = true);

CREATE INDEX IF NOT EXISTS profiles_synthetic_expires_idx
  ON public.profiles(synthetic_expires_at) WHERE is_synthetic = true;

-- 2. Add synthetic flags to service_requests
ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS is_synthetic BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS synthetic_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS service_requests_synthetic_expires_idx
  ON public.service_requests(synthetic_expires_at) WHERE is_synthetic = true;

-- 3. Bot state / audit table
CREATE TABLE IF NOT EXISTS public.synthetic_bot_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  action TEXT NOT NULL,
  profiles_created INTEGER NOT NULL DEFAULT 0,
  requests_created INTEGER NOT NULL DEFAULT 0,
  profiles_expired INTEGER NOT NULL DEFAULT 0,
  requests_expired INTEGER NOT NULL DEFAULT 0,
  active_profiles INTEGER NOT NULL DEFAULT 0,
  active_requests INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.synthetic_bot_state TO authenticated;
GRANT ALL ON public.synthetic_bot_state TO service_role;

ALTER TABLE public.synthetic_bot_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view bot state"
  ON public.synthetic_bot_state FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));
