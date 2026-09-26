// Guardas de autenticação compartilhadas pelas edge functions internas.
// Etapa 4 (Zero Trust): além do segredo legado, aceita tokens de serviço
// assinados (HMAC-SHA256) com emissor, destinatário (audience) e expiração curta.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

export type GuardResult =
  | { ok: true; userId: string | null; isCron: boolean; isStaff: boolean; service?: string }
  | { ok: false; response: Response };

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

/** Comparação em tempo constante (evita ataques de temporização). */
export function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  const len = Math.max(ea.length, eb.length);
  for (let i = 0; i < len; i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

function internalSecretOk(req: Request): boolean {
  const cron = Deno.env.get("CRON_SECRET");
  const internal = Deno.env.get("INTERNAL_FUNCTION_SECRET");
  const given = req.headers.get("x-cron-secret") ?? req.headers.get("x-internal-secret");
  if (!given) return false;
  return (!!cron && safeEqual(given, cron)) || (!!internal && safeEqual(given, internal));
}

/* --------------------------- Tokens de serviço --------------------------- */

const MAX_TTL_SECONDS = 300;
const b64u = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64u = (s: string) => atob(s.replace(/-/g, "+").replace(/_/g, "/"));

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64u(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)));
}

export interface ServiceClaims { iss: string; aud: string; iat: number; exp: number; scope?: string[] }

/** Emite um token de serviço de curta duração para chamar outra função. */
export async function mintServiceToken(iss: string, aud: string, ttlSeconds = 60, scope?: string[]): Promise<string | null> {
  const secret = Deno.env.get("INTERNAL_FUNCTION_SECRET");
  if (!secret) return null;
  const now = Math.floor(Date.now() / 1000);
  const payload = b64u(new TextEncoder().encode(JSON.stringify({ iss, aud, iat: now, exp: now + Math.min(ttlSeconds, MAX_TTL_SECONDS), scope })));
  return `${payload}.${await hmac(secret, payload)}`;
}

/** Valida assinatura, destinatário, expiração e (opcionalmente) emissores permitidos. */
export async function verifyServiceToken(token: string, audience: string, allowedIssuers?: string[]): Promise<ServiceClaims | null> {
  const secret = Deno.env.get("INTERNAL_FUNCTION_SECRET");
  if (!secret || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  if (!safeEqual(await hmac(secret, payload), sig)) return null;
  try {
    const c = JSON.parse(fromB64u(payload)) as ServiceClaims;
    const now = Math.floor(Date.now() / 1000);
    if (c.aud !== audience) return null;
    if (c.exp < now || c.iat > now + 30 || c.exp - c.iat > MAX_TTL_SECONDS) return null;
    if (allowedIssuers && !allowedIssuers.includes(c.iss)) return null;
    return c;
  } catch {
    return null;
  }
}

/**
 * Exige uma chamada confiável: usuário autenticado (opcionalmente admin/moderador),
 * um token de serviço assinado para esta função, ou o segredo legado (compatibilidade).
 */
export async function requireCaller(
  req: Request,
  corsHeaders: Record<string, string>,
  opts: { requireStaff?: boolean; allowInternalSecret?: boolean; audience?: string; allowedIssuers?: string[] } = {},
): Promise<GuardResult> {
  const { requireStaff = false, allowInternalSecret = true, audience, allowedIssuers } = opts;

  const svc = req.headers.get("x-service-token");
  if (svc && audience) {
    const claims = await verifyServiceToken(svc, audience, allowedIssuers);
    if (!claims) return { ok: false, response: json({ error: "invalid_service_token" }, 401, corsHeaders) };
    return { ok: true, userId: null, isCron: true, isStaff: true, service: claims.iss };
  }

  if (allowInternalSecret && internalSecretOk(req)) {
    return { ok: true, userId: null, isCron: true, isStaff: true };
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return { ok: false, response: json({ error: "unauthorized" }, 401, corsHeaders) };
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: userData } = await userClient.auth.getUser();
  const user = userData?.user;
  if (!user) {
    return { ok: false, response: json({ error: "unauthorized" }, 401, corsHeaders) };
  }

  let isStaff = false;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
  isStaff = (roles ?? []).some((r: { role: string }) => r.role === "admin" || r.role === "moderator");

  if (requireStaff && !isStaff) {
    return { ok: false, response: json({ error: "forbidden" }, 403, corsHeaders) };
  }

  return { ok: true, userId: user.id, isCron: false, isStaff };
}
