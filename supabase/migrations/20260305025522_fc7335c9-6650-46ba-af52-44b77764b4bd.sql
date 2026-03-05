
-- Device fingerprints table
CREATE TABLE public.device_fingerprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  fingerprint_hash text NOT NULL,
  ip_address text,
  user_agent text,
  platform text,
  language text,
  timezone text,
  screen_resolution text,
  color_depth integer,
  touch_support boolean DEFAULT false,
  webgl_renderer text,
  canvas_hash text,
  city_geo text,
  state_geo text,
  country_geo text,
  latitude_geo double precision,
  longitude_geo double precision,
  is_blocked boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Risk assessments table
CREATE TABLE public.risk_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  score integer NOT NULL DEFAULT 0,
  risk_level text NOT NULL DEFAULT 'low',
  factors jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'auto_approved',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_device_fingerprints_hash ON public.device_fingerprints(fingerprint_hash);
CREATE INDEX idx_device_fingerprints_ip ON public.device_fingerprints(ip_address);
CREATE INDEX idx_device_fingerprints_user ON public.device_fingerprints(user_id);
CREATE INDEX idx_risk_assessments_profile ON public.risk_assessments(profile_id);
CREATE INDEX idx_risk_assessments_score ON public.risk_assessments(score);

-- RLS
ALTER TABLE public.device_fingerprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_assessments ENABLE ROW LEVEL SECURITY;

-- Device fingerprints: users can insert own, service_role can read all
CREATE POLICY "Users can insert own fingerprints"
ON public.device_fingerprints FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own fingerprints"
ON public.device_fingerprints FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Risk assessments: service_role manages, users can view own
CREATE POLICY "Users can view own risk assessment"
ON public.risk_assessments FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Service role can manage risk assessments"
ON public.risk_assessments FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage fingerprints"
ON public.device_fingerprints FOR ALL TO service_role
USING (true) WITH CHECK (true);
