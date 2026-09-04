// Guardas de autenticação compartilhadas pelas edge functions internas.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

export type GuardResult =
  | { ok: true; userId: string | null; isCron: boolean; isStaff: boolean }
  | { ok: false; response: Response };

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

function internalSecretOk(req: Request): boolean {
  const cron = Deno.env.get("CRON_SECRET");
  const internal = Deno.env.get("INTERNAL_FUNCTION_SECRET");
  const given = req.headers.get("x-cron-secret") ?? req.headers.get("x-internal-secret");
  if (!given) return false;
  return (!!cron && given === cron) || (!!internal && given === internal);
}

/**
 * Exige uma chamada confiável: usuário autenticado (opcionalmente admin/moderador)
 * ou um chamador interno com o segredo compartilhado (cron / backend).
 */
export async function requireCaller(
  req: Request,
  corsHeaders: Record<string, string>,
  opts: { requireStaff?: boolean; allowInternalSecret?: boolean } = {},
): Promise<GuardResult> {
  const { requireStaff = false, allowInternalSecret = true } = opts;

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
