// Synthetic Seed Bot — Cria perfis e tarefas fictícias para povoar visualmente o marketplace.
// Executado periodicamente via pg_cron. Marca tudo com is_synthetic=true e expira em 30 dias.
//
// Modos (via JSON body):
//   { mode: "run" }                          → padrão (usado pelo cron): expira vencidos + repõe até target
//   { mode: "fill", targetProfiles, targetRequests, batch }
//                                            → força criação até um alvo (para setup de testes)
//   { mode: "reset" }                        → apaga TODAS as linhas sintéticas (perfis e tarefas)
//   { mode: "seed", targetProfiles, targetRequests, seed, adminToken }
//                                            → reset + fill determinístico (RNG semeada); usado por Playwright
//
// Segurança: os modos "reset" e "seed" exigem o header `x-admin-token` OU campo `adminToken`
// igual ao secret SYNTHETIC_BOT_ADMIN_TOKEN. Se o secret não estiver configurado, esses modos
// retornam 403.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireCaller } from "../_shared/guard.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_TOKEN = Deno.env.get("SYNTHETIC_BOT_ADMIN_TOKEN") ?? "";

// Targets padrão
const TARGET_ACTIVE_PROFILES = 750;
const TARGET_ACTIVE_REQUESTS = 750;
const CREATE_BATCH_PROFILES = 25;
const CREATE_BATCH_REQUESTS = 25;
const TTL_DAYS = 30;
const MAX_TARGET = 20000;      // teto de perfis/tarefas sintéticos ativos
const MAX_PER_CALL = 3000;     // teto de criações por invocação

// Data pools
const FIRST_NAMES = ["Ana","Bruno","Carla","Daniel","Eduarda","Felipe","Gabriela","Henrique","Isabela","João","Karina","Lucas","Mariana","Nicolas","Otávio","Patrícia","Rafael","Sofia","Thiago","Vanessa","William","Yara","Bianca","Caio","Diego","Elaine","Fábio","Gustavo","Helena","Igor","Juliana","Kaique","Larissa","Marcelo","Natália","Pedro","Renata","Rodrigo","Sabrina","Tatiana","Vinícius"];
const LAST_NAMES = ["Silva","Santos","Oliveira","Souza","Lima","Pereira","Ferreira","Almeida","Costa","Ribeiro","Rodrigues","Carvalho","Gomes","Martins","Araújo","Barbosa","Rocha","Dias","Nunes","Moreira","Cavalcanti","Machado","Correia","Teixeira","Pinto","Cardoso","Melo","Freitas","Ramos","Vieira"];
const FANTASY_PREFIX = ["Pro","Master","Top","Prime","Turbo","Express","Plus","Nova","Ultra","Elite","Bem","Casa","Rápido","Fácil","Total"];
const FANTASY_SUFFIX = ["Serviços","Soluções","Reparos","Obras","Design","Tech","House","Center","Reformas","Assistência","Digital","Consultoria","Store","Company","Group"];
const CITIES: [string,string,number,number][] = [
  ["São Paulo","SP",-23.5505,-46.6333],
  ["Rio de Janeiro","RJ",-22.9068,-43.1729],
  ["Belo Horizonte","MG",-19.9167,-43.9345],
  ["Curitiba","PR",-25.4284,-49.2733],
  ["Porto Alegre","RS",-30.0346,-51.2177],
  ["Salvador","BA",-12.9714,-38.5014],
  ["Fortaleza","CE",-3.7319,-38.5267],
  ["Recife","PE",-8.0476,-34.8770],
  ["Brasília","DF",-15.7801,-47.9292],
  ["Manaus","AM",-3.1190,-60.0217],
  ["Goiânia","GO",-16.6869,-49.2648],
  ["Florianópolis","SC",-27.5949,-48.5482],
  ["Campinas","SP",-22.9099,-47.0626],
  ["Vitória","ES",-20.3155,-40.3128],
  ["Natal","RN",-5.7945,-35.2110],
];
const CATEGORIES = [
  {id:"3333f72b-26c8-4597-bb45-660ac495a19c",name:"Limpeza"},
  {id:"07a97cd9-0815-4ac7-9c9b-4141a7490e9f",name:"Encanamento"},
  {id:"dd1e0a6f-0b04-4b60-aabb-bd415c0d9ad7",name:"Eletricista"},
  {id:"097bb1da-3151-4246-b6a7-2707c5ee8c47",name:"Pintura"},
  {id:"b8a4ae6f-4fad-4da2-bc11-8dfe2fe4a2ba",name:"Jardinagem"},
  {id:"7058a08c-ed98-4cb7-b192-e980c40e7056",name:"Mudanças"},
  {id:"e6fe8464-8f46-4266-a3a2-5d00cf4140db",name:"Design Gráfico"},
  {id:"c10254e3-a578-46b7-a593-5a21a0bb654e",name:"Desenvolvimento Web"},
  {id:"cf38fb88-b4b6-4120-9a0a-b7691671cd33",name:"Fotografia"},
  {id:"7b89d28a-69f8-4565-99b7-b598da871269",name:"Aulas Particulares"},
  {id:"e88e2114-4bb5-4c48-a71c-643c15e4717b",name:"Mecânica"},
  {id:"f4121d34-1629-49b6-9166-1ebef8763590",name:"Beleza & Estética"},
  {id:"766a7ea6-1d28-4e8b-8c8a-981b32fd7a7c",name:"Reformas"},
  {id:"5c304e73-5e5f-4b81-b50c-2da728d45e07",name:"Marketing Digital"},
  {id:"e1d4b8db-de21-4b29-a83e-b297ae553836",name:"Assistência Técnica"},
  {id:"3f15226b-105d-44a4-a1b3-578cac71dbd2",name:"Alimentação"},
  {id:"e3e7d8ac-f9b7-4787-bbeb-0d34fc57da6d",name:"Saúde"},
  {id:"bc1e8272-f085-48e6-9777-adbc4a31f622",name:"Entregas"},
];
const REQUEST_TEMPLATES: Record<string,string[]> = {
  "Limpeza":["Preciso de faxina completa em apartamento de 2 quartos.","Limpeza pós-obra urgente para casa de 100m².","Diarista para limpeza semanal."],
  "Encanamento":["Vazamento na pia da cozinha, preciso de reparo hoje.","Trocar registro do chuveiro.","Desentupimento de vaso sanitário."],
  "Eletricista":["Instalação de 3 pontos de tomada.","Chuveiro elétrico queimando disjuntor.","Troca de quadro de luz completo."],
  "Pintura":["Pintar sala e 2 quartos, tinta acrílica branca.","Repintura externa de sobrado.","Textura em parede da sala."],
  "Jardinagem":["Poda de árvore de médio porte.","Manutenção mensal de jardim residencial.","Plantio de grama esmeralda em quintal."],
  "Mudanças":["Mudança residencial local com 20 caixas e móveis desmontáveis.","Frete pequeno para transporte de sofá.","Mudança interestadual SP-RJ."],
  "Design Gráfico":["Preciso de logotipo para loja de roupas.","Identidade visual completa para startup.","Card para redes sociais."],
  "Desenvolvimento Web":["Landing page institucional em WordPress.","E-commerce Shopify configurado.","Sistema web em React."],
  "Fotografia":["Ensaio de casamento no interior.","Fotos de produto para catálogo.","Cobertura de aniversário infantil."],
  "Aulas Particulares":["Aulas de matemática ensino médio.","Reforço de inglês conversação.","Aulas de violão iniciante."],
  "Mecânica":["Revisão completa em carro popular.","Troca de embreagem.","Diagnóstico de barulho na suspensão."],
  "Beleza & Estética":["Manicure e pedicure domicílio.","Design de sobrancelhas.","Maquiagem para formatura."],
  "Reformas":["Reforma de banheiro completo.","Ampliação de cozinha.","Troca de piso na sala."],
  "Marketing Digital":["Gestão de Instagram e Facebook mensal.","Campanha Google Ads para clínica.","SEO para site institucional."],
  "Assistência Técnica":["Notebook não liga, preciso de diagnóstico.","Troca de tela de celular Samsung.","Manutenção em máquina de lavar."],
  "Alimentação":["Chef para jantar de 10 pessoas.","Buffet para aniversário infantil.","Marmitas fitness semanais."],
  "Saúde":["Fisioterapia domiciliar 3x por semana.","Cuidador para idoso período diurno.","Nutricionista para consulta online."],
  "Entregas":["Entrega expressa de documento.","Motoboy fixo diário.","Transporte de encomenda frágil."],
};
const BIOS = [
  "Profissional com experiência em atendimento residencial e comercial.",
  "Trabalho com foco em qualidade, pontualidade e preço justo.",
  "Atendimento humanizado e resultado garantido para cada cliente.",
  "Mais de 5 anos de experiência na área. Orçamento sem compromisso.",
  "Equipe própria, ferramentas e materiais inclusos quando necessário.",
];

// ── RNG semeada (mulberry32) para modo "seed" reprodutível ────────────────────
let RNG: () => number = Math.random;
function makeRng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function rand<T>(a: T[]): T { return a[Math.floor(RNG() * a.length)]; }
function randInt(min: number, max: number) { return Math.floor(RNG() * (max - min + 1)) + min; }
function jitter(v: number, r = 0.05) { return v + (RNG() - 0.5) * r; }
function slug() { return Math.floor(RNG() * 0xFFFFFFFF).toString(36).slice(0, 6); }

function makePersonName(): { display: string; personType: "fisica"|"juridica"; razao?: string; fantasia?: string } {
  const isPJ = RNG() < 0.35;
  if (isPJ) {
    const fantasia = `${rand(FANTASY_PREFIX)} ${rand(FANTASY_SUFFIX)}`;
    const razao = `${fantasia} LTDA`;
    return { display: fantasia, personType: "juridica", razao, fantasia };
  }
  const display = `${rand(FIRST_NAMES)} ${rand(LAST_NAMES)}`;
  return { display, personType: "fisica" };
}

async function createProfilesBatch(sb: any, n: number): Promise<number> {
  const rows: any[] = [];
  const expires = new Date(Date.now() + TTL_DAYS * 86400_000).toISOString();
  for (let i = 0; i < n; i++) {
    const [city, state, lat, lng] = rand(CITIES);
    const nm = makePersonName();
    rows.push({
      user_id: null,
      user_type: "provider",
      display_name: nm.display,
      person_type: nm.personType,
      razao_social: nm.razao ?? null,
      nome_fantasia: nm.fantasia ?? null,
      bio: rand(BIOS),
      city, state,
      latitude: jitter(lat, 0.15),
      longitude: jitter(lng, 0.15),
      is_active: true,
      verification_status: "verified",
      is_synthetic: true,
      synthetic_expires_at: expires,
      affiliate_code: `SYN${slug().toUpperCase()}`,
      years_experience: randInt(1, 15),
    });
  }
  const { data, error } = await sb.from("profiles").insert(rows).select("id");
  if (error) { console.error("profiles insert error", error); return 0; }
  const services: any[] = [];
  for (const p of data ?? []) {
    const nCats = randInt(1, 3);
    const used = new Set<string>();
    for (let i = 0; i < nCats; i++) {
      const cat = rand(CATEGORIES);
      if (used.has(cat.id)) continue;
      used.add(cat.id);
      services.push({ profile_id: p.id, category_id: cat.id });
    }
  }
  if (services.length) await sb.from("provider_services").insert(services);

  const { data: reviewers } = await sb.from("profiles").select("id").eq("is_synthetic", true).limit(300);
  const pool = (reviewers ?? []).map((r: any) => r.id);
  const reviewRows: any[] = [];
  const seen = new Set<string>();
  for (const p of data ?? []) {
    const n = randInt(0, 5);
    for (let i = 0; i < n && pool.length > 1; i++) {
      const rid = rand(pool);
      if (rid === p.id) continue;
      const key = `${rid}:${p.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const rating = randInt(3, 5);
      const comments = [
        "Excelente profissional, super recomendo!",
        "Trabalho muito bem feito, pontual e caprichoso.",
        "Atendeu tudo que precisava, ótimo custo-benefício.",
        "Serviço rápido e de qualidade.",
        "Voltarei a contratar com certeza.",
        "Muito educado e profissional.",
      ];
      reviewRows.push({
        reviewer_id: rid, reviewed_id: p.id, rating,
        comment: rand(comments),
        review_type: "client_to_provider",
        is_published: true,
        publish_at: new Date().toISOString(),
      });
    }
  }
  if (reviewRows.length) await sb.from("reviews").insert(reviewRows);
  return data?.length ?? 0;
}

async function createRequestsBatch(sb: any, n: number): Promise<number> {
  const { data: profs } = await sb
    .from("profiles").select("id, display_name, city, state")
    .eq("is_synthetic", true).eq("is_active", true).limit(200);
  if (!profs?.length) return 0;
  const rows: any[] = [];
  const expires = new Date(Date.now() + TTL_DAYS * 86400_000).toISOString();
  for (let i = 0; i < n; i++) {
    const p = rand(profs);
    const cat = rand(CATEGORIES);
    const templates = REQUEST_TEMPLATES[cat.name] ?? ["Preciso de serviço profissional na região."];
    rows.push({
      profile_id: p.id,
      requester_name: p.display_name,
      requester_type: RNG() < 0.3 ? "company" : "person",
      description: rand(templates),
      category_id: cat.id,
      budget: [null, 150, 300, 500, 800, 1500, 3000][randInt(0, 6)],
      city: p.city, state: p.state,
      origin: "standard",
      is_active: true,
      is_synthetic: true,
      synthetic_expires_at: expires,
    });
  }
  const { data, error } = await sb.from("service_requests").insert(rows).select("id");
  if (error) { console.error("requests insert error", error); return 0; }
  return data?.length ?? 0;
}

async function resetSynthetic(sb: any) {
  // Ordem: filhos → pais para evitar violação de FK
  await sb.from("service_requests").delete().eq("is_synthetic", true);
  const { data: syn } = await sb.from("profiles").select("id").eq("is_synthetic", true);
  const ids = (syn ?? []).map((r: any) => r.id);
  if (ids.length) {
    await sb.from("provider_services").delete().in("profile_id", ids);
    await sb.from("reviews").delete().or(`reviewer_id.in.(${ids.join(",")}),reviewed_id.in.(${ids.join(",")})`);
    await sb.from("profiles").delete().in("id", ids);
  }
  return ids.length;
}

async function fillUpTo(sb: any, targetProfiles: number, targetRequests: number, batch = 100) {
  let profilesCreated = 0;
  let requestsCreated = 0;
  // teto por invocação para não estourar o tempo da função
  // profiles
  while (true) {
    const { count } = await sb.from("profiles").select("id", { count: "exact", head: true })
      .eq("is_synthetic", true).eq("is_active", true);
    const gap = Math.min(MAX_PER_CALL - profilesCreated, Math.max(0, targetProfiles - (count ?? 0)));
    if (gap <= 0) break;
    profilesCreated += await createProfilesBatch(sb, Math.min(batch, gap));
  }
  // requests
  while (true) {
    const { count } = await sb.from("service_requests").select("id", { count: "exact", head: true })
      .eq("is_synthetic", true).eq("is_active", true);
    const gap = Math.min(MAX_PER_CALL - requestsCreated, Math.max(0, targetRequests - (count ?? 0)));
    if (gap <= 0) break;
    requestsCreated += await createRequestsBatch(sb, Math.min(batch, gap));
  }
  return { profilesCreated, requestsCreated };
}

// Aceita: token de serviço (Playwright/cron) OU usuário autenticado com papel admin/moderador.
async function checkAdmin(req: Request, body: any): Promise<boolean> {
  const header = req.headers.get("x-admin-token") ?? "";
  if (ADMIN_TOKEN && (header === ADMIN_TOKEN || body?.adminToken === ADMIN_TOKEN)) return true;
  const guard = await requireCaller(req, corsHeaders, { requireStaff: true });
  return guard.ok;
}

// Cria N tarefas sintéticas em lotes, respeitando o teto por invocação.
async function createTasks(sb: any, n: number, batch = 200): Promise<number> {
  const total = Math.max(0, Math.min(MAX_PER_CALL, n));
  let created = 0;
  while (created < total) {
    const made = await createRequestsBatch(sb, Math.min(batch, total - created));
    if (!made) break;
    created += made;
  }
  return created;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
    let body: any = {};
    try { body = await req.json(); } catch { /* cron sends empty */ }
    const mode: string = body?.mode ?? "run";

    // ── modos administrativos (reset / seed) ────────────────────────────────
    if (mode === "reset" || mode === "seed") {
      if (!(await checkAdmin(req, body))) {
        return new Response(JSON.stringify({ error: "forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const seed = Number(body?.seed ?? 42);
      RNG = mode === "seed" ? makeRng(seed) : Math.random;
      const removed = await resetSynthetic(sb);
      let profilesCreated = 0, requestsCreated = 0;
      if (mode === "seed") {
        const tp = Math.max(0, Math.min(MAX_TARGET, Number(body?.targetProfiles ?? 200)));
        const tr = Math.max(0, Math.min(MAX_TARGET, Number(body?.targetRequests ?? 200)));
        const r = await fillUpTo(sb, tp, tr, Number(body?.batch ?? 100));
        profilesCreated = r.profilesCreated;
        requestsCreated = r.requestsCreated;
      }
      await sb.from("synthetic_bot_state").insert({
        action: mode, profiles_created: profilesCreated, requests_created: requestsCreated,
        profiles_expired: removed, requests_expired: 0,
        active_profiles: profilesCreated, active_requests: requestsCreated,
        notes: `mode=${mode} seed=${body?.seed ?? "-"}`,
      });
      return new Response(JSON.stringify({ ok: true, mode, removed, profilesCreated, requestsCreated }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── modo "tasks" (gera um volume de tarefas de engajamento) ─────────────
    if (mode === "tasks") {
      if (!(await checkAdmin(req, body))) {
        return new Response(JSON.stringify({ error: "forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      RNG = Math.random;
      const requestsCreated = await createTasks(sb, Number(body?.count ?? 200), Number(body?.batch ?? 200));
      const { count: activeRequests } = await sb.from("service_requests")
        .select("id", { count: "exact", head: true }).eq("is_synthetic", true).eq("is_active", true);
      await sb.from("synthetic_bot_state").insert({
        action: "tasks", profiles_created: 0, requests_created: requestsCreated,
        profiles_expired: 0, requests_expired: 0,
        active_profiles: 0, active_requests: activeRequests ?? 0,
        notes: `geração manual de ${requestsCreated} tarefas`,
      });
      return new Response(JSON.stringify({ ok: true, mode, requestsCreated, activeRequests: activeRequests ?? 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── modo "fill" (idempotente até um alvo, sem apagar) ───────────────────
    if (mode === "fill") {
      if (!(await checkAdmin(req, body))) {
        return new Response(JSON.stringify({ error: "forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      RNG = Math.random;
      const tp = Math.max(0, Math.min(MAX_TARGET, Number(body?.targetProfiles ?? TARGET_ACTIVE_PROFILES)));
      const tr = Math.max(0, Math.min(MAX_TARGET, Number(body?.targetRequests ?? TARGET_ACTIVE_REQUESTS)));
      const r = await fillUpTo(sb, tp, tr, Number(body?.batch ?? 100));
      return new Response(JSON.stringify({ ok: true, mode, ...r }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── modo padrão "run" (cron) ────────────────────────────────────────────
    RNG = Math.random;
    const nowIso = new Date().toISOString();
    const { data: expReq } = await sb.from("service_requests")
      .delete().eq("is_synthetic", true).lt("synthetic_expires_at", nowIso).select("id");
    const { data: expProf } = await sb.from("profiles")
      .delete().eq("is_synthetic", true).lt("synthetic_expires_at", nowIso).select("id");
    const requestsExpired = expReq?.length ?? 0;
    const profilesExpired = expProf?.length ?? 0;

    const { count: activeProfiles } = await sb.from("profiles")
      .select("id", { count: "exact", head: true }).eq("is_synthetic", true).eq("is_active", true);
    const { count: activeRequests } = await sb.from("service_requests")
      .select("id", { count: "exact", head: true }).eq("is_synthetic", true).eq("is_active", true);

    const profGap = Math.max(0, TARGET_ACTIVE_PROFILES - (activeProfiles ?? 0));
    const reqGap = Math.max(0, TARGET_ACTIVE_REQUESTS - (activeRequests ?? 0));
    const nProf = Math.min(CREATE_BATCH_PROFILES, profGap);
    const nReq = Math.min(CREATE_BATCH_REQUESTS, reqGap);

    const profilesCreated = nProf > 0 ? await createProfilesBatch(sb, nProf) : 0;
    const requestsCreated = nReq > 0 ? await createRequestsBatch(sb, nReq) : 0;

    await sb.from("synthetic_bot_state").insert({
      action: "run",
      profiles_created: profilesCreated, requests_created: requestsCreated,
      profiles_expired: profilesExpired, requests_expired: requestsExpired,
      active_profiles: (activeProfiles ?? 0) + profilesCreated,
      active_requests: (activeRequests ?? 0) + requestsCreated,
    });

    return new Response(JSON.stringify({
      ok: true, profilesCreated, requestsCreated, profilesExpired, requestsExpired,
      activeProfiles: (activeProfiles ?? 0) + profilesCreated,
      activeRequests: (activeRequests ?? 0) + requestsCreated,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("synthetic-seed-bot error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
