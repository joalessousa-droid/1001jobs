// Camada aditiva de segurança para as edge functions.
// Nada aqui altera regras de negócio: apenas origem permitida, limite de
// requisições, validação de corpo e mascaramento de dados sensíveis em logs.

/** Origens permitidas por padrão (produção, preview e desenvolvimento local). */
const STATIC_ALLOWED = [
  "https://jobs1001.lovable.app",
  "http://localhost:8080",
  "http://localhost:5173",
];

/** Domínios de preview/publicação aceitos por sufixo. */
const ALLOWED_SUFFIXES = [".lovable.app", ".lovableproject.com", ".lovable.dev"];

const EXTRA_ALLOWED = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

export const DEFAULT_ALLOW_HEADERS =
  "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true; // chamadas servidor-a-servidor não enviam Origin
  if (STATIC_ALLOWED.includes(origin) || EXTRA_ALLOWED.includes(origin)) return true;
  try {
    const host = new URL(origin).hostname;
    return ALLOWED_SUFFIXES.some((s) => host.endsWith(s));
  } catch {
    return false;
  }
}

/** Cabeçalhos CORS restritos à origem da requisição, quando permitida. */
export function corsFor(req: Request, allowHeaders: string = DEFAULT_ALLOW_HEADERS) {
  const origin = req.headers.get("origin");
  const allowed = isAllowedOrigin(origin);
  return {
    "Access-Control-Allow-Origin": allowed && origin ? origin : STATIC_ALLOWED[0],
    "Access-Control-Allow-Headers": allowHeaders,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  } as Record<string, string>;
}

/** Bloqueia navegadores em origens não autorizadas (não afeta cron/backend). */
export function enforceOrigin(req: Request): Response | null {
  const origin = req.headers.get("origin");
  if (isAllowedOrigin(origin)) return null;
  return new Response(JSON.stringify({ error: "origin_not_allowed" }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
}

/* ------------------------------ Rate limiting ----------------------------- */

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export interface RateLimitOptions {
  /** Identificador lógico (nome da função). */
  key: string;
  /** Número máximo de chamadas na janela. */
  limit: number;
  /** Janela em segundos. */
  windowSeconds: number;
}

export function clientKey(req: Request, userId?: string | null): string {
  if (userId) return `u:${userId}`;
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("cf-connecting-ip") ??
    "unknown";
  return `ip:${ip}`;
}

/** Limitador best-effort por instância. Retorna 429 quando estourado. */
export function rateLimit(
  req: Request,
  opts: RateLimitOptions,
  userId?: string | null,
): Response | null {
  if (req.method === "OPTIONS") return null; // preflight nunca é limitado
  const now = Date.now();
  const id = `${opts.key}:${clientKey(req, userId)}`;
  const bucket = buckets.get(id);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(id, { count: 1, resetAt: now + opts.windowSeconds * 1000 });
    return null;
  }
  bucket.count += 1;
  if (bucket.count > opts.limit) {
    const retry = Math.ceil((bucket.resetAt - now) / 1000);
    return new Response(JSON.stringify({ error: "rate_limited", retry_after: retry }), {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": String(retry) },
    });
  }
  return null;
}

/* ------------------------------- Validação -------------------------------- */

export const MAX_BODY_BYTES = 256 * 1024;

export class ValidationError extends Error {}

/** Lê o corpo JSON aplicando limite de tamanho. */
export async function readJson<T = Record<string, unknown>>(
  req: Request,
  maxBytes: number = MAX_BODY_BYTES,
): Promise<T> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new ValidationError("payload_too_large");
  const text = await req.text();
  if (new TextEncoder().encode(text).length > maxBytes) {
    throw new ValidationError("payload_too_large");
  }
  if (!text.trim()) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ValidationError("invalid_json");
  }
}

type FieldType = "string" | "number" | "boolean" | "object" | "array" | "uuid";

export interface FieldRule {
  type: FieldType;
  required?: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
  enum?: readonly string[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validação de esquema simples, sem dependências externas. */
export function validate<T extends Record<string, unknown>>(
  body: Record<string, unknown>,
  schema: Record<string, FieldRule>,
): T {
  for (const [field, rule] of Object.entries(schema)) {
    const value = body[field];
    if (value === undefined || value === null) {
      if (rule.required) throw new ValidationError(`campo obrigatório ausente: ${field}`);
      continue;
    }
    switch (rule.type) {
      case "uuid":
        if (typeof value !== "string" || !UUID_RE.test(value)) {
          throw new ValidationError(`campo inválido: ${field}`);
        }
        break;
      case "string": {
        if (typeof value !== "string") throw new ValidationError(`campo inválido: ${field}`);
        if (rule.maxLength && value.length > rule.maxLength) {
          throw new ValidationError(`campo muito longo: ${field}`);
        }
        if (rule.enum && !rule.enum.includes(value)) {
          throw new ValidationError(`valor não permitido: ${field}`);
        }
        break;
      }
      case "number": {
        if (typeof value !== "number" || Number.isNaN(value)) {
          throw new ValidationError(`campo inválido: ${field}`);
        }
        if (rule.min !== undefined && value < rule.min) throw new ValidationError(`valor abaixo do mínimo: ${field}`);
        if (rule.max !== undefined && value > rule.max) throw new ValidationError(`valor acima do máximo: ${field}`);
        break;
      }
      case "boolean":
        if (typeof value !== "boolean") throw new ValidationError(`campo inválido: ${field}`);
        break;
      case "array":
        if (!Array.isArray(value)) throw new ValidationError(`campo inválido: ${field}`);
        break;
      case "object":
        if (typeof value !== "object" || Array.isArray(value)) {
          throw new ValidationError(`campo inválido: ${field}`);
        }
        break;
    }
  }
  return body as T;
}

/* --------------------------- Logs sem dados PII --------------------------- */

const SENSITIVE_KEYS = [
  "cpf", "cpf_cnpj", "cnpj", "password", "senha", "token", "access_token",
  "refresh_token", "authorization", "apikey", "api_key", "secret", "phone",
  "telefone", "email", "address", "endereco", "date_of_birth", "mother_name",
  "representative_cpf", "document_number", "latitude", "longitude", "card",
];

/** Remove/máscara campos sensíveis antes de qualquer log. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[profundo]";
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEYS.includes(k.toLowerCase()) ? "[oculto]" : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

/** Log seguro: nunca imprime dados pessoais nem segredos. */
export function safeLog(scope: string, payload: unknown) {
  console.log(`[${scope}]`, JSON.stringify(redact(payload)));
}

/** Mensagem de erro para o cliente, sem vazar detalhes internos. */
export function publicError(err: unknown): string {
  if (err instanceof ValidationError) return err.message;
  return "erro_interno";
}
