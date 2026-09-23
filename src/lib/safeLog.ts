// Mascaramento de dados pessoais antes de qualquer log no navegador.
// Camada aditiva: não altera fluxos, apenas evita vazamento de PII em console.

const SENSITIVE_KEYS = [
  "cpf", "cpf_cnpj", "cnpj", "password", "senha", "token", "access_token",
  "refresh_token", "authorization", "apikey", "api_key", "secret", "phone",
  "telefone", "email", "address", "endereco", "date_of_birth", "mother_name",
  "representative_cpf", "document_number", "latitude", "longitude", "card",
];

export const MASK = "[oculto]";

/** Substitui valores sensíveis por uma máscara, preservando a estrutura. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[profundo]";
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEYS.includes(k.toLowerCase()) ? MASK : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

/** Log de diagnóstico sem dados pessoais. */
export function safeLog(scope: string, payload?: unknown) {
  if (payload === undefined) console.log(`[${scope}]`);
  else console.log(`[${scope}]`, redact(payload));
}

/** Mensagem de erro amigável, sem expor detalhes internos do servidor. */
export function safeErrorMessage(error: unknown, fallback = "Não foi possível concluir. Tente novamente."): string {
  const raw = (error as { message?: string } | null)?.message ?? "";
  if (!raw) return fallback;
  const leaky = /(stack|at\s+\w+\.|postgres|pg_|supabase\.co|service_role|jwt|sql)/i.test(raw);
  return leaky ? fallback : raw;
}
