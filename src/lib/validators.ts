// Brazilian document validators (client-side).
export function onlyDigits(s: string): string {
  return (s ?? "").replace(/\D/g, "");
}

// --- CPF ---
export function isValidCPF(input: string): boolean {
  const c = onlyDigits(input);
  if (c.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(c)) return false;
  const nums = c.split("").map((d) => parseInt(d, 10));
  let s = 0;
  for (let i = 0; i < 9; i++) s += nums[i] * (10 - i);
  let d1 = (s * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== nums[9]) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += nums[i] * (11 - i);
  let d2 = (s * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === nums[10];
}
export const validarCPF = isValidCPF;

export function formatCPF(input: string): string {
  const c = onlyDigits(input).slice(0, 11);
  return c
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}
export const maskCPF = formatCPF;

// --- CNPJ ---
export function validarCNPJ(input: string): boolean {
  const c = onlyDigits(input);
  if (c.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(c)) return false;
  const calc = (slice: number[]) => {
    const weights = slice.length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = slice.reduce((a, n, i) => a + n * weights[i], 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const n = c.split("").map(Number);
  return calc(n.slice(0, 12)) === n[12] && calc(n.slice(0, 13)) === n[13];
}

export function maskCNPJ(input: string): string {
  const c = onlyDigits(input).slice(0, 14);
  return c
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

// --- Phone & CEP ---
export function maskPhone(input: string): string {
  const c = onlyDigits(input).slice(0, 11);
  if (c.length <= 10) return c.replace(/(\d{2})(\d{4})(\d{0,4}).*/, "($1) $2-$3").trim();
  return c.replace(/(\d{2})(\d{5})(\d{0,4}).*/, "($1) $2-$3").trim();
}

export function maskCEP(input: string): string {
  return onlyDigits(input).slice(0, 8).replace(/(\d{5})(\d{1,3}).*/, "$1-$2");
}

// --- Email ---
const TEMP_EMAIL_DOMAINS = [
  "mailinator.com", "tempmail.com", "10minutemail.com", "guerrillamail.com",
  "yopmail.com", "trashmail.com", "throwawaymail.com", "fakeinbox.com",
  "getnada.com", "sharklasers.com", "dispostable.com", "maildrop.cc",
];
export function isTemporaryEmail(email: string): boolean {
  const e = (email ?? "").toLowerCase().trim();
  const at = e.lastIndexOf("@");
  if (at < 0) return false;
  const domain = e.slice(at + 1);
  return TEMP_EMAIL_DOMAINS.some((d) => domain === d || domain.endsWith("." + d));
}

// --- Senha forte ---
export interface SenhaCheck { ok: boolean; valid: boolean; errors: string[] }
export function validarSenhaForte(pwd: string): SenhaCheck {
  const errors: string[] = [];
  const p = pwd ?? "";
  if (p.length < 8) errors.push("Mínimo 8 caracteres");
  if (!/[A-Z]/.test(p)) errors.push("1 letra maiúscula");
  if (!/[a-z]/.test(p)) errors.push("1 letra minúscula");
  if (!/\d/.test(p)) errors.push("1 número");
  if (!/[^A-Za-z0-9]/.test(p)) errors.push("1 caractere especial");
  const ok = errors.length === 0;
  return { ok, valid: ok, errors };
}

// --- Consultas externas ---
export interface CEPResult {
  cep?: string; logradouro?: string; bairro?: string;
  localidade?: string; uf?: string; erro?: boolean;
}
export async function consultarCEP(cep: string): Promise<CEPResult | null> {
  const c = onlyDigits(cep);
  if (c.length !== 8) return null;
  try {
    const r = await fetch(`https://viacep.com.br/ws/${c}/json/`);
    if (!r.ok) return null;
    const j = await r.json();
    if (j?.erro) return null;
    return j as CEPResult;
  } catch { return null; }
}

export interface CNPJResult {
  razao_social?: string; nome_fantasia?: string;
  uf?: string; municipio?: string; cep?: string;
  logradouro?: string; bairro?: string; numero?: string;
  email?: string; ddd_telefone_1?: string;
  situacao_cadastral?: string | number;
  data_inicio_atividade?: string;
  natureza_juridica?: string;
  cnae_fiscal_descricao?: string;
  capital_social?: number | string;
  [k: string]: any;
}
export async function consultarCNPJ(cnpj: string): Promise<CNPJResult | null> {
  const c = onlyDigits(cnpj);
  if (c.length !== 14) return null;
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${c}`);
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}
