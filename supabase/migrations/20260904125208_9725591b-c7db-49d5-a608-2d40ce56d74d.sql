-- Helper: staff check
create or replace function public.ai_is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'moderator')
$$;

create table if not exists public.ai_config (
  key text primary key,
  value jsonb not null,
  description text,
  is_critical boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
grant select on public.ai_config to authenticated;
grant all on public.ai_config to service_role;
alter table public.ai_config enable row level security;
create policy "ai_config staff manage" on public.ai_config for all to authenticated
  using (public.ai_is_staff()) with check (public.ai_is_staff());
create policy "ai_config read" on public.ai_config for select to authenticated using (true);

insert into public.ai_config(key, value, description, is_critical) values
  ('confidence_thresholds', '{"high":500,"medium":100,"low":20}', 'Limites de observacoes por nivel de confianca', false),
  ('temporal_decay_half_life_days', '180', 'Meia-vida do decaimento temporal dos dados', false),
  ('outlier_iqr_multiplier', '2.5', 'Multiplicador IQR para marcar outliers', false),
  ('max_auto_correction_pct', '0.25', 'Correcao automatica maxima permitida na estimativa', true),
  ('min_sample_for_correction', '30', 'Amostra minima para aplicar autocorrecao', false),
  ('min_quality_score', '0.4', 'Qualidade minima para entrar na memoria estatistica', false),
  ('urgency_premium_min_sample', '20', 'Amostra minima para aplicar premio de urgencia', false)
on conflict (key) do nothing;

create table if not exists public.ai_model_versions (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  label text,
  is_active boolean not null default false,
  ab_group text check (ab_group in ('A','B')),
  traffic_pct int not null default 0 check (traffic_pct between 0 and 100),
  params jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select on public.ai_model_versions to authenticated;
grant all on public.ai_model_versions to service_role;
alter table public.ai_model_versions enable row level security;
create policy "ai_model_versions read" on public.ai_model_versions for select to authenticated using (true);
create policy "ai_model_versions staff" on public.ai_model_versions for all to authenticated
  using (public.ai_is_staff()) with check (public.ai_is_staff());
insert into public.ai_model_versions(version,label,is_active,ab_group,traffic_pct)
values ('v1.0','Baseline 1001 AI', true, 'A', 100)
on conflict (version) do nothing;

create table if not exists public.ai_predictions (
  id uuid primary key default gen_random_uuid(),
  service_id uuid,
  service_request_id uuid,
  profile_id uuid,
  model_version text not null default 'v1.0',
  ab_group text,
  diagnosis text,
  category text,
  recommended_profession text,
  confidence numeric,
  estimated_price_min numeric,
  estimated_price_max numeric,
  estimated_duration_min int,
  predicted_urgency text,
  predicted_complexity text,
  country text default 'BR',
  state text,
  city text,
  neighborhood text,
  geohash text,
  evidence jsonb not null default '{}'::jsonb,
  price_source jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists ai_predictions_cat_idx on public.ai_predictions(category, created_at desc);
create index if not exists ai_predictions_service_idx on public.ai_predictions(service_id);
grant select, insert on public.ai_predictions to authenticated;
grant all on public.ai_predictions to service_role;
alter table public.ai_predictions enable row level security;
create policy "ai_predictions owner read" on public.ai_predictions for select to authenticated
  using (public.ai_is_staff() or profile_id = public.get_my_profile_id());
create policy "ai_predictions owner insert" on public.ai_predictions for insert to authenticated
  with check (profile_id = public.get_my_profile_id() or public.ai_is_staff());

create table if not exists public.ai_outcomes (
  id uuid primary key default gen_random_uuid(),
  prediction_id uuid references public.ai_predictions(id) on delete cascade,
  service_id uuid,
  actual_diagnosis text,
  actual_price numeric,
  actual_duration_min int,
  professional_feedback text check (professional_feedback in ('sim','parcial','nao')),
  professional_correction text,
  client_feedback jsonb not null default '{}'::jsonb,
  outcome text,
  created_at timestamptz not null default now()
);
create index if not exists ai_outcomes_pred_idx on public.ai_outcomes(prediction_id);
grant select, insert, update on public.ai_outcomes to authenticated;
grant all on public.ai_outcomes to service_role;
alter table public.ai_outcomes enable row level security;
create policy "ai_outcomes staff read" on public.ai_outcomes for select to authenticated using (public.ai_is_staff());
create policy "ai_outcomes insert" on public.ai_outcomes for insert to authenticated with check (true);

create table if not exists public.ai_price_observations (
  id uuid primary key default gen_random_uuid(),
  service_id uuid,
  provider_id uuid,
  client_id uuid,
  category text not null,
  profession text,
  country text not null default 'BR',
  state text,
  city text,
  region text,
  neighborhood text,
  geohash text,
  urgency text not null default 'normal',
  complexity text not null default 'media',
  hour_bucket text,
  weekday int,
  is_weekend boolean default false,
  is_holiday boolean default false,
  estimated_price numeric,
  final_price numeric,
  duration_estimated_min int,
  duration_actual_min int,
  was_cancelled boolean not null default false,
  cancel_reason text,
  was_rework boolean not null default false,
  rating numeric,
  is_outlier boolean not null default false,
  outlier_reason text,
  data_quality_score numeric not null default 1,
  source text not null default 'platform',
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists ai_price_obs_lookup_idx
  on public.ai_price_observations(category, state, city, neighborhood, observed_at desc);
create index if not exists ai_price_obs_time_idx on public.ai_price_observations(observed_at desc);
grant select on public.ai_price_observations to authenticated;
grant all on public.ai_price_observations to service_role;
alter table public.ai_price_observations enable row level security;
create policy "ai_price_obs staff" on public.ai_price_observations for all to authenticated
  using (public.ai_is_staff()) with check (public.ai_is_staff());

create table if not exists public.ai_learning_events (
  id uuid primary key default gen_random_uuid(),
  prediction_id uuid references public.ai_predictions(id) on delete set null,
  observation_id uuid references public.ai_price_observations(id) on delete set null,
  category text,
  scope_level text,
  scope_value text,
  error_type text not null,
  error_value numeric,
  correction jsonb not null default '{}'::jsonb,
  model_version text,
  created_at timestamptz not null default now()
);
create index if not exists ai_learning_events_idx on public.ai_learning_events(error_type, created_at desc);
grant select on public.ai_learning_events to authenticated;
grant all on public.ai_learning_events to service_role;
alter table public.ai_learning_events enable row level security;
create policy "ai_learning_events staff" on public.ai_learning_events for all to authenticated
  using (public.ai_is_staff()) with check (public.ai_is_staff());

create table if not exists public.ai_price_corrections (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  scope_level text not null default 'city',
  scope_value text,
  urgency text,
  factor numeric not null default 1,
  reason text,
  sample_size int not null default 0,
  mean_error_pct numeric,
  model_version text not null default 'v1.0',
  status text not null default 'auto' check (status in ('auto','pending','approved','rejected')),
  approved_by uuid,
  created_at timestamptz not null default now(),
  unique (category, scope_level, scope_value, urgency, model_version)
);
grant select on public.ai_price_corrections to authenticated;
grant all on public.ai_price_corrections to service_role;
alter table public.ai_price_corrections enable row level security;
create policy "ai_price_corrections read" on public.ai_price_corrections for select to authenticated using (true);
create policy "ai_price_corrections staff" on public.ai_price_corrections for all to authenticated
  using (public.ai_is_staff()) with check (public.ai_is_staff());

create table if not exists public.ai_change_requests (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  target_key text,
  current_value jsonb,
  proposed_value jsonb,
  rationale text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','applied')),
  requested_by text not null default 'learning_engine',
  reviewed_by uuid,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);
grant select, update on public.ai_change_requests to authenticated;
grant all on public.ai_change_requests to service_role;
alter table public.ai_change_requests enable row level security;
create policy "ai_change_requests staff" on public.ai_change_requests for all to authenticated
  using (public.ai_is_staff()) with check (public.ai_is_staff());

create table if not exists public.ai_anomalies (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  severity text not null default 'medium' check (severity in ('low','medium','high')),
  subject_type text,
  subject_id text,
  category text,
  scope_value text,
  details jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open','reviewed','dismissed')),
  reviewed_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists ai_anomalies_status_idx on public.ai_anomalies(status, created_at desc);
grant select, update on public.ai_anomalies to authenticated;
grant all on public.ai_anomalies to service_role;
alter table public.ai_anomalies enable row level security;
create policy "ai_anomalies staff" on public.ai_anomalies for all to authenticated
  using (public.ai_is_staff()) with check (public.ai_is_staff());

create table if not exists public.ai_regional_stats (
  id uuid primary key default gen_random_uuid(),
  level text not null,
  scope_value text not null,
  category text,
  period_days int not null default 30,
  metrics jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now(),
  unique (level, scope_value, category, period_days)
);
grant select on public.ai_regional_stats to authenticated;
grant all on public.ai_regional_stats to service_role;
alter table public.ai_regional_stats enable row level security;
create policy "ai_regional_stats read" on public.ai_regional_stats for select to authenticated using (true);
create policy "ai_regional_stats staff" on public.ai_regional_stats for all to authenticated
  using (public.ai_is_staff()) with check (public.ai_is_staff());