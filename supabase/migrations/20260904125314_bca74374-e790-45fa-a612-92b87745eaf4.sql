revoke all on function public.ai_is_staff() from anon;

-- Config helper
create or replace function public.ai_cfg(_key text, _default jsonb)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select value from public.ai_config where key = _key), _default)
$$;
revoke all on function public.ai_cfg(text, jsonb) from anon, authenticated;

-- 37/42: Data quality score
create or replace function public.ai_quality_score(
  _final_price numeric, _estimated_price numeric, _duration_actual int,
  _was_cancelled boolean, _rating numeric, _source text
) returns numeric language plpgsql immutable set search_path = public as $$
declare s numeric := 1;
begin
  if _was_cancelled then s := s - 0.5; end if;
  if _final_price is null or _final_price <= 0 then s := s - 0.4; end if;
  if _duration_actual is null then s := s - 0.1; end if;
  if _rating is null then s := s - 0.05; end if;
  if coalesce(_source,'platform') <> 'platform' then s := s - 0.2; end if;
  if _estimated_price is null then s := s - 0.05; end if;
  return greatest(0, least(1, s));
end $$;

-- 38: temporal decay weight
create or replace function public.ai_decay_weight(_observed_at timestamptz)
returns numeric language sql stable set search_path = public as $$
  select power(0.5, extract(epoch from (now() - _observed_at)) / 86400.0
    / greatest(1, (public.ai_cfg('temporal_decay_half_life_days','180'::jsonb))::text::numeric))
$$;
revoke all on function public.ai_decay_weight(timestamptz) from anon;

-- 4/8/42: raw stats for a scope
create or replace function public.ai_price_stats(
  _category text, _level text, _value text, _urgency text default null,
  _complexity text default null, _days int default 365
) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  th jsonb := public.ai_cfg('confidence_thresholds','{"high":500,"medium":100,"low":20}'::jsonb);
  minq numeric := (public.ai_cfg('min_quality_score','0.4'::jsonb))::text::numeric;
  r record; conf text; t30 numeric; t90 numeric; t365 numeric;
begin
  select
    count(*)::int as n,
    avg(final_price) as mean,
    percentile_cont(0.5) within group (order by final_price) as median,
    percentile_cont(0.25) within group (order by final_price) as p25,
    percentile_cont(0.75) within group (order by final_price) as p75,
    min(final_price) as min_p, max(final_price) as max_p,
    coalesce(stddev_samp(final_price),0) as sd,
    sum(final_price * public.ai_decay_weight(observed_at)) / nullif(sum(public.ai_decay_weight(observed_at)),0) as weighted_mean,
    avg(data_quality_score) as quality
  into r
  from public.ai_price_observations o
  where o.category = _category
    and o.final_price is not null and o.final_price > 0
    and not o.is_outlier and not o.was_cancelled
    and o.data_quality_score >= minq
    and o.observed_at > now() - make_interval(days => _days)
    and (_urgency is null or o.urgency = _urgency)
    and (_complexity is null or o.complexity = _complexity)
    and (
      _level = 'country' and coalesce(o.country,'BR') = coalesce(_value,'BR')
      or _level = 'state' and o.state = _value
      or _level = 'city' and o.city = _value
      or _level = 'region' and o.region = _value
      or _level = 'neighborhood' and o.neighborhood = _value
    );

  conf := case
    when r.n >= (th->>'high')::int then 'alta'
    when r.n >= (th->>'medium')::int then 'media'
    when r.n >= (th->>'low')::int then 'baixa'
    else 'insuficiente' end;

  select percentile_cont(0.5) within group (order by final_price) into t30
    from public.ai_price_observations where category=_category and final_price>0 and not is_outlier
      and observed_at > now() - interval '30 days'
      and (_level<>'city' or city=_value) and (_level<>'state' or state=_value)
      and (_level<>'neighborhood' or neighborhood=_value);
  select percentile_cont(0.5) within group (order by final_price) into t90
    from public.ai_price_observations where category=_category and final_price>0 and not is_outlier
      and observed_at > now() - interval '90 days'
      and (_level<>'city' or city=_value) and (_level<>'state' or state=_value)
      and (_level<>'neighborhood' or neighborhood=_value);
  select percentile_cont(0.5) within group (order by final_price) into t365
    from public.ai_price_observations where category=_category and final_price>0 and not is_outlier
      and observed_at > now() - interval '365 days'
      and (_level<>'city' or city=_value) and (_level<>'state' or state=_value)
      and (_level<>'neighborhood' or neighborhood=_value);

  return jsonb_build_object(
    'level', _level, 'scope', _value, 'category', _category,
    'sample_size', coalesce(r.n,0), 'mean', round(coalesce(r.mean,0),2),
    'weighted_mean', round(coalesce(r.weighted_mean,0),2),
    'median', round(coalesce(r.median,0),2), 'p25', round(coalesce(r.p25,0),2),
    'p75', round(coalesce(r.p75,0),2), 'min', round(coalesce(r.min_p,0),2),
    'max', round(coalesce(r.max_p,0),2), 'stddev', round(coalesce(r.sd,0),2),
    'data_quality', round(coalesce(r.quality,0),3), 'confidence', conf,
    'trend', jsonb_build_object('d30', round(coalesce(t30,0),2), 'd90', round(coalesce(t90,0),2), 'd365', round(coalesce(t365,0),2)),
    'trend_direction', case when t30 is null or t90 is null or t90 = 0 then 'estavel'
      when t30 > t90 * 1.05 then 'alta' when t30 < t90 * 0.95 then 'baixa' else 'estavel' end
  );
end $$;
revoke all on function public.ai_price_stats(text,text,text,text,text,int) from anon;

-- 9/7/11/15/16: preço de mercado 1001 com fallback geográfico e autocorreção
create or replace function public.ai_market_price(
  _category text, _state text default null, _city text default null,
  _neighborhood text default null, _urgency text default 'normal',
  _complexity text default null, _hour_bucket text default null
) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  th jsonb := public.ai_cfg('confidence_thresholds','{"high":500,"medium":100,"low":20}'::jsonb);
  minn int := (th->>'low')::int;
  stats jsonb; used text; cf numeric := 1; corr record;
  prem numeric := 1; base_med numeric; urg_med numeric; minsamp int;
begin
  if _neighborhood is not null then
    stats := public.ai_price_stats(_category,'neighborhood',_neighborhood,null,_complexity,365);
    if (stats->>'sample_size')::int >= minn then used := 'neighborhood'; end if;
  end if;
  if used is null and _city is not null then
    stats := public.ai_price_stats(_category,'city',_city,null,_complexity,365);
    if (stats->>'sample_size')::int >= minn then used := 'city'; end if;
  end if;
  if used is null and _state is not null then
    stats := public.ai_price_stats(_category,'state',_state,null,_complexity,365);
    if (stats->>'sample_size')::int >= minn then used := 'state'; end if;
  end if;
  if used is null then
    stats := public.ai_price_stats(_category,'country','BR',null,_complexity,365);
    if (stats->>'sample_size')::int >= minn then used := 'country'; end if;
  end if;

  if used is null then
    return jsonb_build_object('available', false, 'confidence','insuficiente',
      'message','Ainda nao temos dados suficientes para estimar este servico com precisao.',
      'stats', coalesce(stats,'{}'::jsonb), 'level_used', 'none');
  end if;

  -- 15: prêmio de urgência aprendido
  minsamp := (public.ai_cfg('urgency_premium_min_sample','20'::jsonb))::text::numeric;
  if _urgency is not null and _urgency <> 'normal' then
    select percentile_cont(0.5) within group (order by final_price) into base_med
      from public.ai_price_observations where category=_category and urgency='normal'
        and final_price>0 and not is_outlier and observed_at > now() - interval '365 days';
    select percentile_cont(0.5) within group (order by final_price) into urg_med
      from public.ai_price_observations where category=_category and urgency=_urgency
        and final_price>0 and not is_outlier and observed_at > now() - interval '365 days';
    if base_med is not null and base_med > 0 and urg_med is not null
       and (select count(*) from public.ai_price_observations
            where category=_category and urgency=_urgency and not is_outlier
              and observed_at > now() - interval '365 days') >= minsamp then
      prem := least(2.5, greatest(1, urg_med / base_med));
    end if;
  end if;

  -- 11: correção sistemática validada
  select * into corr from public.ai_price_corrections
   where category = _category and status in ('auto','approved')
     and (scope_value is null or scope_value in (_neighborhood,_city,_state))
   order by case scope_level when 'neighborhood' then 1 when 'city' then 2 when 'state' then 3 else 4 end
   limit 1;
  if found then cf := corr.factor; end if;

  return jsonb_build_object(
    'available', true,
    'level_used', used,
    'confidence', stats->>'confidence',
    'sample_size', (stats->>'sample_size')::int,
    'median', round((stats->>'median')::numeric * cf * prem, 2),
    'range_min', round((stats->>'p25')::numeric * cf * prem, 2),
    'range_max', round((stats->>'p75')::numeric * cf * prem, 2),
    'urgency_premium', round(prem,3),
    'correction_factor', round(cf,3),
    'trend', stats->'trend',
    'trend_direction', stats->>'trend_direction',
    'stats', stats
  );
end $$;
revoke all on function public.ai_market_price(text,text,text,text,text,text,text) from anon;

-- 13: outlier detection sobre uma observação
create or replace function public.ai_flag_outliers(_category text)
returns int language plpgsql security definer set search_path = public as $$
declare k numeric := (public.ai_cfg('outlier_iqr_multiplier','2.5'::jsonb))::text::numeric;
  q1 numeric; q3 numeric; iqr numeric; c int;
begin
  select percentile_cont(0.25) within group (order by final_price),
         percentile_cont(0.75) within group (order by final_price)
    into q1, q3
    from public.ai_price_observations
   where category=_category and final_price>0 and observed_at > now() - interval '365 days';
  if q1 is null then return 0; end if;
  iqr := greatest(q3 - q1, 1);
  update public.ai_price_observations
     set is_outlier = true,
         outlier_reason = 'fora da faixa IQR ' || round(q1 - k*iqr,2) || '-' || round(q3 + k*iqr,2)
   where category=_category and final_price is not null
     and (final_price < q1 - k*iqr or final_price > q3 + k*iqr)
     and not is_outlier;
  get diagnostics c = row_count;
  if c > 0 then
    insert into public.ai_anomalies(kind, severity, subject_type, category, details)
    values ('price_outlier','medium','category',_category,
      jsonb_build_object('flagged', c, 'q1', q1, 'q3', q3));
  end if;
  return c;
end $$;
revoke all on function public.ai_flag_outliers(text) from anon;