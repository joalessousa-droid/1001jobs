do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname like 'ai\_%'
  loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated, service_role', f.sig);
  end loop;
end $$;

-- Backfill: histórico real de serviços concluídos -> memória de preços
insert into public.ai_price_observations(
  service_id, provider_id, client_id, category, state, city, urgency, complexity,
  hour_bucket, weekday, is_weekend, final_price, duration_actual_min, was_cancelled,
  rating, data_quality_score, source, observed_at)
select s.id, s.provider_id, s.client_id,
  coalesce(sc.name, 'geral'), pr.state, pr.city, 'normal', 'media',
  case when extract(hour from s.completed_at) < 6 then 'madrugada'
       when extract(hour from s.completed_at) < 12 then 'manha'
       when extract(hour from s.completed_at) < 18 then 'tarde' else 'noite' end,
  extract(dow from s.completed_at)::int,
  extract(dow from s.completed_at)::int in (0,6),
  s.agreed_price,
  case when s.started_at is not null then
    greatest(1, round(extract(epoch from (s.completed_at - s.started_at))/60)::int) end,
  false,
  (select avg(r.rating) from public.reviews r
     join public.completed_services cs on cs.id = r.completed_service_id
    where cs.service_id = s.id and r.is_published),
  public.ai_quality_score(s.agreed_price, null, null, false, null, 'platform'),
  'backfill', s.completed_at
from public.services s
left join public.service_categories sc on sc.id = s.category_id
left join public.profiles pr on pr.id = s.provider_id
where s.completed_at is not null and s.agreed_price is not null and s.agreed_price > 0
  and not exists (select 1 from public.ai_price_observations o where o.service_id = s.id);

-- Cancelamentos (peso reduzido pela qualidade do dado)
insert into public.ai_price_observations(
  service_id, provider_id, client_id, category, state, city, urgency, complexity,
  final_price, was_cancelled, cancel_reason, data_quality_score, source, observed_at)
select s.id, s.provider_id, s.client_id, coalesce(sc.name,'geral'), pr.state, pr.city,
  'normal','media', s.agreed_price, true, s.cancellation_reason,
  public.ai_quality_score(s.agreed_price, null, null, true, null, 'platform'),
  'backfill', s.cancelled_at
from public.services s
left join public.service_categories sc on sc.id = s.category_id
left join public.profiles pr on pr.id = s.provider_id
where s.cancelled_at is not null
  and not exists (select 1 from public.ai_price_observations o where o.service_id = s.id);