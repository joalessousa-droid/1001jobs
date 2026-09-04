-- 46/40: registrar previsão (explicável, versionada)
create or replace function public.ai_record_prediction(_payload jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v text; g text; pid uuid;
begin
  select version, ab_group into v, g from public.ai_model_versions
   where is_active order by traffic_pct desc limit 1;
  insert into public.ai_predictions(
    service_id, service_request_id, profile_id, model_version, ab_group, diagnosis, category,
    recommended_profession, confidence, estimated_price_min, estimated_price_max,
    estimated_duration_min, predicted_urgency, predicted_complexity,
    state, city, neighborhood, evidence, price_source)
  values (
    nullif(_payload->>'service_id','')::uuid, nullif(_payload->>'service_request_id','')::uuid,
    public.get_my_profile_id(), coalesce(v,'v1.0'), g,
    _payload->>'diagnosis', _payload->>'category', _payload->>'recommended_profession',
    nullif(_payload->>'confidence','')::numeric,
    nullif(_payload->>'estimated_price_min','')::numeric,
    nullif(_payload->>'estimated_price_max','')::numeric,
    nullif(_payload->>'estimated_duration_min','')::int,
    _payload->>'urgency', _payload->>'complexity',
    _payload->>'state', _payload->>'city', _payload->>'neighborhood',
    coalesce(_payload->'evidence','{}'::jsonb), coalesce(_payload->'price_source','{}'::jsonb))
  returning id into pid;
  return pid;
end $$;
revoke all on function public.ai_record_prediction(jsonb) from anon;

-- 10/21/24/31: registrar resultado real e aprender
create or replace function public.ai_record_outcome(_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  p record; obs_id uuid; err numeric; derr numeric;
  est numeric; actual numeric := nullif(_payload->>'actual_price','')::numeric;
  cancelled boolean := coalesce((_payload->>'was_cancelled')::boolean,false);
  q numeric; oid uuid;
begin
  select * into p from public.ai_predictions where id = nullif(_payload->>'prediction_id','')::uuid;

  insert into public.ai_outcomes(prediction_id, service_id, actual_diagnosis, actual_price,
    actual_duration_min, professional_feedback, professional_correction, client_feedback, outcome)
  values (p.id, coalesce(nullif(_payload->>'service_id','')::uuid, p.service_id),
    _payload->>'actual_diagnosis', actual, nullif(_payload->>'actual_duration_min','')::int,
    _payload->>'professional_feedback', _payload->>'professional_correction',
    coalesce(_payload->'client_feedback','{}'::jsonb),
    coalesce(_payload->>'outcome', case when cancelled then 'cancelado' else 'concluido' end))
  returning id into oid;

  est := case when p.id is not null
    then (coalesce(p.estimated_price_min,0) + coalesce(p.estimated_price_max,0)) / nullif(
      (case when p.estimated_price_min is null then 0 else 1 end) +
      (case when p.estimated_price_max is null then 0 else 1 end), 0)
    else nullif(_payload->>'estimated_price','')::numeric end;

  q := public.ai_quality_score(actual, est, nullif(_payload->>'actual_duration_min','')::int,
        cancelled, nullif(_payload->>'rating','')::numeric, coalesce(_payload->>'source','platform'));

  insert into public.ai_price_observations(
    service_id, provider_id, client_id, category, profession, state, city, region, neighborhood,
    urgency, complexity, hour_bucket, weekday, is_weekend, estimated_price, final_price,
    duration_estimated_min, duration_actual_min, was_cancelled, cancel_reason, was_rework,
    rating, data_quality_score, source)
  values (
    coalesce(nullif(_payload->>'service_id','')::uuid, p.service_id),
    nullif(_payload->>'provider_id','')::uuid, nullif(_payload->>'client_id','')::uuid,
    coalesce(_payload->>'category', p.category, 'geral'), _payload->>'profession',
    coalesce(_payload->>'state', p.state), coalesce(_payload->>'city', p.city),
    _payload->>'region', coalesce(_payload->>'neighborhood', p.neighborhood),
    coalesce(_payload->>'urgency', p.predicted_urgency, 'normal'),
    coalesce(_payload->>'complexity', p.predicted_complexity, 'media'),
    case when extract(hour from now()) < 6 then 'madrugada'
         when extract(hour from now()) < 12 then 'manha'
         when extract(hour from now()) < 18 then 'tarde' else 'noite' end,
    extract(dow from now())::int, extract(dow from now())::int in (0,6),
    est, actual, p.estimated_duration_min, nullif(_payload->>'actual_duration_min','')::int,
    cancelled, _payload->>'cancel_reason', coalesce((_payload->>'was_rework')::boolean,false),
    nullif(_payload->>'rating','')::numeric, q, coalesce(_payload->>'source','platform'))
  returning id into obs_id;

  if est is not null and est > 0 and actual is not null and actual > 0 then
    err := (actual - est) / est;
    insert into public.ai_learning_events(prediction_id, observation_id, category, scope_level,
      scope_value, error_type, error_value, correction, model_version)
    values (p.id, obs_id, coalesce(_payload->>'category', p.category), 'city',
      coalesce(_payload->>'city', p.city), 'price_error', round(err,4),
      jsonb_build_object('estimated', est, 'actual', actual), coalesce(p.model_version,'v1.0'));
  end if;

  if p.estimated_duration_min is not null and (_payload->>'actual_duration_min') is not null then
    derr := ((_payload->>'actual_duration_min')::numeric - p.estimated_duration_min) / greatest(p.estimated_duration_min,1);
    insert into public.ai_learning_events(prediction_id, observation_id, category, error_type, error_value, model_version)
    values (p.id, obs_id, p.category, 'duration_error', round(derr,4), coalesce(p.model_version,'v1.0'));
  end if;

  if (_payload->>'professional_feedback') in ('parcial','nao') then
    insert into public.ai_learning_events(prediction_id, observation_id, category, error_type, error_value, correction, model_version)
    values (p.id, obs_id, p.category, 'diagnosis_error',
      case when _payload->>'professional_feedback' = 'nao' then 1 else 0.5 end,
      jsonb_build_object('predicted', p.diagnosis, 'actual', _payload->>'actual_diagnosis'),
      coalesce(p.model_version,'v1.0'));
  end if;

  perform public.ai_flag_outliers(coalesce(_payload->>'category', p.category, 'geral'));

  return jsonb_build_object('outcome_id', oid, 'observation_id', obs_id,
    'price_error_pct', round(coalesce(err,0)*100,2), 'data_quality_score', q);
end $$;
revoke all on function public.ai_record_outcome(jsonb) from anon;

-- 11/12: recalcular correções (com aprovação quando excede o limite)
create or replace function public.ai_refresh_price_corrections()
returns int language plpgsql security definer set search_path = public as $$
declare r record; maxc numeric; minn int; f numeric; n int := 0;
begin
  maxc := (public.ai_cfg('max_auto_correction_pct','0.25'::jsonb))::text::numeric;
  minn := (public.ai_cfg('min_sample_for_correction','30'::jsonb))::text::numeric;
  for r in
    select o.category, o.city, count(*)::int as n,
           avg((o.final_price - o.estimated_price) / nullif(o.estimated_price,0)) as bias
      from public.ai_price_observations o
     where o.estimated_price > 0 and o.final_price > 0 and not o.is_outlier and not o.was_cancelled
       and o.observed_at > now() - interval '180 days'
     group by o.category, o.city
    having count(*) >= minn and abs(avg((o.final_price - o.estimated_price)/nullif(o.estimated_price,0))) > 0.08
  loop
    f := 1 + r.bias;
    if abs(r.bias) > maxc then
      insert into public.ai_change_requests(kind, target_key, current_value, proposed_value, rationale)
      values ('price_correction', r.category || '/' || coalesce(r.city,'-'),
        jsonb_build_object('factor',1), jsonb_build_object('factor', round(f,3)),
        'Erro sistematico de ' || round(r.bias*100,1) || '% em ' || r.n || ' observacoes (acima do limite automatico).');
      f := 1 + sign(r.bias) * maxc;
    end if;
    insert into public.ai_price_corrections(category, scope_level, scope_value, factor, reason, sample_size, mean_error_pct, status)
    values (r.category, 'city', r.city, round(f,3),
      case when r.bias > 0 then 'Tendencia consistente de subestimacao' else 'Tendencia consistente de superestimacao' end,
      r.n, round(r.bias*100,2), 'auto')
    on conflict (category, scope_level, scope_value, urgency, model_version)
    do update set factor = excluded.factor, sample_size = excluded.sample_size,
                  mean_error_pct = excluded.mean_error_pct, reason = excluded.reason, created_at = now();
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.ai_refresh_price_corrections() from anon;

-- 36/41: anomalias
create or replace function public.ai_detect_anomalies()
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in
    select category, city,
      percentile_cont(0.5) within group (order by final_price) filter (where observed_at > now() - interval '7 days') as recent,
      percentile_cont(0.5) within group (order by final_price) filter (where observed_at <= now() - interval '7 days') as base,
      count(*) filter (where observed_at > now() - interval '7 days') as n7
      from public.ai_price_observations
     where final_price > 0 and not is_outlier and observed_at > now() - interval '90 days'
     group by category, city
  loop
    if r.base is not null and r.base > 0 and r.recent is not null and r.n7 >= 5 then
      if r.recent > r.base * 1.4 or r.recent < r.base * 0.6 then
        insert into public.ai_anomalies(kind, severity, subject_type, category, scope_value, details)
        values (case when r.recent > r.base then 'price_spike' else 'price_drop' end,
          'high','region', r.category, r.city,
          jsonb_build_object('recent', r.recent, 'baseline', r.base, 'samples', r.n7));
        n := n + 1;
      end if;
    end if;
  end loop;

  for r in
    select provider_id,
      count(*) as total,
      count(*) filter (where was_cancelled) as cancels,
      count(*) filter (where was_rework) as reworks
      from public.ai_price_observations
     where provider_id is not null and observed_at > now() - interval '90 days'
     group by provider_id having count(*) >= 10
  loop
    if r.cancels::numeric / r.total > 0.3 or r.reworks::numeric / r.total > 0.2 then
      insert into public.ai_anomalies(kind, severity, subject_type, subject_id, details)
      values ('provider_behavior','high','provider', r.provider_id::text,
        jsonb_build_object('total', r.total, 'cancel_rate', round(r.cancels::numeric/r.total,3),
                           'rework_rate', round(r.reworks::numeric/r.total,3)));
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;
revoke all on function public.ai_detect_anomalies() from anon;

-- 34: control center
create or replace function public.ai_control_center(_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare res jsonb;
begin
  if not public.ai_is_staff() then raise exception 'forbidden'; end if;
  select jsonb_build_object(
    'predictions', (select count(*) from public.ai_predictions where created_at > now() - make_interval(days=>_days)),
    'outcomes', (select count(*) from public.ai_outcomes where created_at > now() - make_interval(days=>_days)),
    'diagnosis_accuracy', (
      select round(100.0 * count(*) filter (where professional_feedback='sim')
        / nullif(count(*) filter (where professional_feedback is not null),0), 1)
      from public.ai_outcomes where created_at > now() - make_interval(days=>_days)),
    'price_mape', (
      select round(100.0 * avg(abs(error_value)), 1) from public.ai_learning_events
       where error_type='price_error' and created_at > now() - make_interval(days=>_days)),
    'price_bias', (
      select round(100.0 * avg(error_value), 1) from public.ai_learning_events
       where error_type='price_error' and created_at > now() - make_interval(days=>_days)),
    'price_mae', (
      select round(avg(abs((correction->>'actual')::numeric - (correction->>'estimated')::numeric)),2)
       from public.ai_learning_events where error_type='price_error'
         and created_at > now() - make_interval(days=>_days)),
    'price_median_error', (
      select round(100.0 * percentile_cont(0.5) within group (order by abs(error_value)),1)
       from public.ai_learning_events where error_type='price_error'
         and created_at > now() - make_interval(days=>_days)),
    'duration_mape', (
      select round(100.0 * avg(abs(error_value)),1) from public.ai_learning_events
       where error_type='duration_error' and created_at > now() - make_interval(days=>_days)),
    'avg_confidence', (
      select round(100.0 * avg(confidence),1) from public.ai_predictions
       where created_at > now() - make_interval(days=>_days) and confidence is not null),
    'cancel_rate', (
      select round(100.0 * count(*) filter (where was_cancelled)/nullif(count(*),0),1)
       from public.ai_price_observations where observed_at > now() - make_interval(days=>_days)),
    'rework_rate', (
      select round(100.0 * count(*) filter (where was_rework)/nullif(count(*),0),1)
       from public.ai_price_observations where observed_at > now() - make_interval(days=>_days)),
    'satisfaction', (
      select round(avg(rating),2) from public.ai_price_observations
       where rating is not null and observed_at > now() - make_interval(days=>_days)),
    'open_anomalies', (select count(*) from public.ai_anomalies where status='open'),
    'pending_changes', (select count(*) from public.ai_change_requests where status='pending'),
    'error_by_category', (
      select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select category, count(*) as n, round(100.0*avg(error_value),1) as bias
        from public.ai_learning_events where error_type='price_error'
          and created_at > now() - make_interval(days=>_days)
        group by category order by count(*) desc limit 12) x),
    'error_by_region', (
      select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select scope_value as region, count(*) as n, round(100.0*avg(error_value),1) as bias
        from public.ai_learning_events where error_type='price_error' and scope_value is not null
          and created_at > now() - make_interval(days=>_days)
        group by scope_value order by count(*) desc limit 12) x)
  ) into res;
  return res;
end $$;
revoke all on function public.ai_control_center(int) from anon;

-- 35: price intelligence
create or replace function public.ai_price_intelligence(
  _category text default null, _state text default null, _city text default null,
  _neighborhood text default null, _urgency text default null, _complexity text default null,
  _days int default 90)
returns table(category text, city text, state text, urgency text, complexity text,
  samples bigint, mean numeric, median numeric, p25 numeric, p75 numeric, trend text, confidence text)
language plpgsql stable security definer set search_path = public as $$
declare th jsonb := public.ai_cfg('confidence_thresholds','{"high":500,"medium":100,"low":20}'::jsonb);
begin
  if not public.ai_is_staff() then raise exception 'forbidden'; end if;
  return query
  select o.category, o.city, o.state, o.urgency, o.complexity, count(*),
    round(avg(o.final_price),2),
    round(percentile_cont(0.5) within group (order by o.final_price)::numeric,2),
    round(percentile_cont(0.25) within group (order by o.final_price)::numeric,2),
    round(percentile_cont(0.75) within group (order by o.final_price)::numeric,2),
    case when avg(o.final_price) filter (where o.observed_at > now() - interval '30 days')
              > avg(o.final_price) filter (where o.observed_at <= now() - interval '30 days') * 1.05 then 'alta'
         when avg(o.final_price) filter (where o.observed_at > now() - interval '30 days')
              < avg(o.final_price) filter (where o.observed_at <= now() - interval '30 days') * 0.95 then 'baixa'
         else 'estavel' end,
    case when count(*) >= (th->>'high')::int then 'alta'
         when count(*) >= (th->>'medium')::int then 'media'
         when count(*) >= (th->>'low')::int then 'baixa' else 'insuficiente' end
  from public.ai_price_observations o
  where o.final_price > 0 and not o.is_outlier and not o.was_cancelled
    and o.observed_at > now() - make_interval(days=>_days)
    and (_category is null or o.category = _category)
    and (_state is null or o.state = _state)
    and (_city is null or o.city = _city)
    and (_neighborhood is null or o.neighborhood = _neighborhood)
    and (_urgency is null or o.urgency = _urgency)
    and (_complexity is null or o.complexity = _complexity)
  group by o.category, o.city, o.state, o.urgency, o.complexity
  order by count(*) desc limit 200;
end $$;
revoke all on function public.ai_price_intelligence(text,text,text,text,text,text,int) from anon;

-- 19/45: inteligência regional
create or replace function public.ai_regional_intelligence(_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.ai_is_staff() then raise exception 'forbidden'; end if;
  return (
    select coalesce(jsonb_agg(x order by x.demand desc), '[]'::jsonb) from (
      select coalesce(o.city,'Nao informado') as city, o.state,
        count(*) as demand,
        round(avg(o.final_price),2) as ticket,
        round(percentile_cont(0.5) within group (order by o.final_price)::numeric,2) as median,
        round(avg(o.duration_actual_min),0) as avg_duration,
        round(100.0*count(*) filter (where o.was_cancelled)/nullif(count(*),0),1) as cancel_rate,
        round(100.0*count(*) filter (where o.was_rework)/nullif(count(*),0),1) as rework_rate,
        (select count(distinct p.id) from public.profiles p
          where p.city = o.city and p.is_active and not p.is_synthetic) as providers,
        (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
           select o2.category, count(*) as n from public.ai_price_observations o2
            where o2.city = o.city and o2.observed_at > now() - make_interval(days=>_days)
            group by o2.category order by count(*) desc limit 5) t) as top_categories
      from public.ai_price_observations o
      where o.observed_at > now() - make_interval(days=>_days)
      group by o.city, o.state) x);
end $$;
revoke all on function public.ai_regional_intelligence(int) from anon;

-- 18: previsão de demanda
create or replace function public.ai_demand_forecast(_city text default null, _days int default 60)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  return (
    select coalesce(jsonb_agg(x order by x.growth desc), '[]'::jsonb) from (
      select sr.category_id::text as category_id, sc.name as category, sr.city,
        count(*) filter (where sr.created_at > now() - interval '7 days') as last7,
        count(*) filter (where sr.created_at <= now() - interval '7 days'
                           and sr.created_at > now() - interval '14 days') as prev7,
        case when count(*) filter (where sr.created_at <= now() - interval '7 days'
               and sr.created_at > now() - interval '14 days') = 0 then 0
          else round(100.0 * (count(*) filter (where sr.created_at > now() - interval '7 days')
            - count(*) filter (where sr.created_at <= now() - interval '7 days' and sr.created_at > now() - interval '14 days'))
            / count(*) filter (where sr.created_at <= now() - interval '7 days' and sr.created_at > now() - interval '14 days'),1)
        end as growth,
        mode() within group (order by extract(dow from sr.created_at)) as peak_weekday,
        mode() within group (order by extract(hour from sr.created_at)) as peak_hour
      from public.service_requests sr
      left join public.service_categories sc on sc.id = sr.category_id
      where sr.created_at > now() - make_interval(days=>_days)
        and coalesce(sr.origin,'standard') <> 'radar'
        and (_city is null or sr.city = _city)
      group by sr.category_id, sc.name, sr.city
      having count(*) >= 3) x);
end $$;
revoke all on function public.ai_demand_forecast(text,int) from anon;

-- 25: memória do profissional
create or replace function public.ai_professional_memory(_provider_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.ai_is_staff() or _provider_id = public.get_my_profile_id()) then
    raise exception 'forbidden';
  end if;
  return (
    select jsonb_build_object(
      'provider_id', _provider_id,
      'services', count(*),
      'avg_rating', round(avg(rating),2),
      'avg_duration_min', round(avg(duration_actual_min),0),
      'completion_rate', round(100.0*count(*) filter (where not was_cancelled)/nullif(count(*),0),1),
      'cancel_rate', round(100.0*count(*) filter (where was_cancelled)/nullif(count(*),0),1),
      'rework_rate', round(100.0*count(*) filter (where was_rework)/nullif(count(*),0),1),
      'avg_ticket', round(avg(final_price),2),
      'categories', (select coalesce(jsonb_agg(t),'[]'::jsonb) from (
         select category, count(*) as n from public.ai_price_observations
          where provider_id = _provider_id group by category order by count(*) desc limit 5) t))
    from public.ai_price_observations where provider_id = _provider_id);
end $$;
revoke all on function public.ai_professional_memory(uuid) from anon;

-- 26: memória do serviço
create or replace function public.ai_service_memory(_category text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'category', _category,
    'samples', count(*),
    'median_price', round(percentile_cont(0.5) within group (order by final_price)::numeric,2),
    'median_duration_min', round(percentile_cont(0.5) within group (order by duration_actual_min)::numeric,0),
    'satisfaction', round(avg(rating),2),
    'rework_rate', round(100.0*count(*) filter (where was_rework)/nullif(count(*),0),1))
  from public.ai_price_observations
  where category = _category and not is_outlier and observed_at > now() - interval '365 days'
$$;
revoke all on function public.ai_service_memory(text) from anon;

-- 27: memória do cliente (apenas o próprio ou equipe)
create or replace function public.ai_client_memory(_client_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare cid uuid := coalesce(_client_id, public.get_my_profile_id());
begin
  if not (public.ai_is_staff() or cid = public.get_my_profile_id()) then raise exception 'forbidden'; end if;
  return (
    select jsonb_build_object(
      'client_id', cid,
      'services', count(*),
      'avg_ticket', round(avg(final_price),2),
      'categories', (select coalesce(jsonb_agg(t),'[]'::jsonb) from (
        select category, count(*) as n, max(observed_at) as last_at
          from public.ai_price_observations where client_id = cid
          group by category order by count(*) desc limit 8) t),
      'favorite_providers', (select coalesce(jsonb_agg(f.provider_id),'[]'::jsonb)
        from public.favorite_providers f where f.client_id = cid))
    from public.ai_price_observations where client_id = cid);
end $$;
revoke all on function public.ai_client_memory(uuid) from anon;

-- 33: comparação A/B entre versões
create or replace function public.ai_model_comparison(_days int default 90)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.ai_is_staff() then raise exception 'forbidden'; end if;
  return (
    select coalesce(jsonb_agg(x order by x.model_version), '[]'::jsonb) from (
      select p.model_version, p.ab_group, count(distinct p.id) as predictions,
        round(100.0*avg(abs(e.error_value)) filter (where e.error_type='price_error'),1) as price_mape,
        round(100.0*avg(e.error_value) filter (where e.error_type='price_error'),1) as price_bias,
        round(100.0*count(*) filter (where o.professional_feedback='sim')
          / nullif(count(*) filter (where o.professional_feedback is not null),0),1) as diagnosis_accuracy,
        round(avg(obs.rating),2) as satisfaction,
        round(100.0*count(*) filter (where obs.was_cancelled)/nullif(count(obs.id),0),1) as cancel_rate
      from public.ai_predictions p
      left join public.ai_learning_events e on e.prediction_id = p.id
      left join public.ai_outcomes o on o.prediction_id = p.id
      left join public.ai_price_observations obs on obs.service_id = p.service_id
      where p.created_at > now() - make_interval(days=>_days)
      group by p.model_version, p.ab_group) x);
end $$;
revoke all on function public.ai_model_comparison(int) from anon;

-- 29/30: feedback
create or replace function public.ai_submit_feedback(_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pid uuid := nullif(_payload->>'prediction_id','')::uuid; sid uuid := nullif(_payload->>'service_id','')::uuid;
begin
  if pid is null and sid is not null then
    select id into pid from public.ai_predictions where service_id = sid order by created_at desc limit 1;
  end if;
  return public.ai_record_outcome(_payload || jsonb_build_object('prediction_id', pid));
end $$;
revoke all on function public.ai_submit_feedback(jsonb) from anon;

-- 22: aprendizado com recusas -> prioridade temporária
create or replace function public.ai_provider_priority_penalty(_provider_id uuid, _urgency text default 'urgente')
returns numeric language sql stable security definer set search_path = public as $$
  select greatest(0.5, 1 - 0.5 * coalesce(
    (select count(*) filter (where so.status in ('declined','expired'))::numeric
       / nullif(count(*),0)
       from public.service_offers so
      where so.provider_id = _provider_id
        and so.created_at > now() - interval '30 days'), 0))
$$;
revoke all on function public.ai_provider_priority_penalty(uuid, text) from anon;