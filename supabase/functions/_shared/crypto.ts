// Etapa 23 (crypto agility): toda operação criptográfica passa por aqui, com
// o algoritmo versionado no resultado — trocar o algoritmo não exige reescrever chamadores.
// Usa apenas WebCrypto padrão (nenhum algoritmo próprio).
const enc = new TextEncoder();
const b64u = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

export const CURRENT = { hash: "sha256", sign: "hs256", enc: "a256gcm" } as const;

export async function hash(data: string): Promise<string> {
  return `sha256:${b64u(await crypto.subtle.digest("SHA-256", enc.encode(data)))}`;
}

export async function sign(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return `hs256:${b64u(await crypto.subtle.sign("HMAC", key, enc.encode(data)))}`;
}

/** Chave por domínio (identidade, kyc, localização, financeiro...) derivada de uma chave-mestra via HKDF. */
async function domainKey(master: string, domain: string) {
  const base = await crypto.subtle.importKey("raw", enc.encode(master), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: enc.encode("1001jobs"), info: enc.encode(domain) },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"],
  );
}

export async function encrypt(master: string, domain: string, plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await domainKey(master, domain), enc.encode(plain));
  return `a256gcm:${domain}:${b64u(iv.buffer)}:${b64u(ct)}`;
}

export async function decrypt(master: string, token: string): Promise<string> {
  const [alg, domain, iv, ct] = token.split(":");
  if (alg !== "a256gcm") throw new Error("unsupported_algorithm");
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64u(iv) }, await domainKey(master, domain), fromB64u(ct));
  return new TextDecoder().decode(pt);
}
