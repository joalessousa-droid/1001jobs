// Mapeamento padronizado dos códigos de erro do banco para mensagens da UI.

export type InsuranceAttachmentErrorCode =
  | "attachment_invalid_size"
  | "attachment_too_large"
  | "attachment_mime_not_allowed"
  | "attachment_extension_not_allowed"
  | "attachment_max_files_reached"
  | "attachment_stage_size_exceeded"
  | "unknown";

export const INSURANCE_ERROR_MESSAGES: Record<InsuranceAttachmentErrorCode, string> = {
  attachment_invalid_size: "Arquivo inválido (tamanho 0).",
  attachment_too_large: "Arquivo excede 50 MB.",
  attachment_mime_not_allowed: "Tipo de arquivo não permitido.",
  attachment_extension_not_allowed: "Extensão de arquivo não permitida.",
  attachment_max_files_reached: "Limite de 20 anexos por sinistro atingido.",
  attachment_stage_size_exceeded: "Tamanho acumulado de anexos excede 200 MB.",
  unknown: "Falha ao validar o anexo.",
};

export function parseInsuranceError(err: unknown): { code: InsuranceAttachmentErrorCode; message: string; detail?: string } {
  const raw = (err as any)?.message || String(err ?? "");
  const codes = Object.keys(INSURANCE_ERROR_MESSAGES) as InsuranceAttachmentErrorCode[];
  for (const c of codes) {
    if (c !== "unknown" && raw.includes(c)) {
      const detail = raw.split(`${c}:`)[1]?.trim();
      return { code: c, message: INSURANCE_ERROR_MESSAGES[c], detail };
    }
  }
  return { code: "unknown", message: raw || INSURANCE_ERROR_MESSAGES.unknown };
}

// Detecção de tipo por conteúdo (magic bytes) — leitura dos primeiros 16 bytes.
const SIGNATURES: Array<{ mime: string; match: (b: Uint8Array) => boolean }> = [
  { mime: "image/jpeg", match: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/png", match: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { mime: "image/gif", match: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 },
  { mime: "image/webp", match: (b) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 },
  { mime: "application/pdf", match: (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 },
  { mime: "video/mp4", match: (b) => b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70 },
  { mime: "video/webm", match: (b) => b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3 },
];

export async function detectMimeFromContent(file: File): Promise<string | null> {
  const buf = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  for (const s of SIGNATURES) if (s.match(buf)) return s.mime;
  return null;
}

export const ATTACHMENT_LIMITS = {
  maxFileBytes: 50 * 1024 * 1024,
  maxStageBytes: 200 * 1024 * 1024,
  maxFiles: 20,
  allowedMimes: [
    "image/jpeg", "image/png", "image/webp", "image/gif",
    "video/mp4", "video/quicktime", "video/webm",
    "application/pdf", "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  allowedExt: ["jpg", "jpeg", "png", "webp", "gif", "mp4", "mov", "webm", "pdf", "doc", "docx"],
};

export function validateAttachmentClient(
  file: File,
  currentCount: number,
  currentTotalBytes: number,
  detectedMime: string | null,
): { ok: true } | { ok: false; code: InsuranceAttachmentErrorCode; message: string } {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (file.size <= 0) return { ok: false, code: "attachment_invalid_size", message: INSURANCE_ERROR_MESSAGES.attachment_invalid_size };
  if (file.size > ATTACHMENT_LIMITS.maxFileBytes) return { ok: false, code: "attachment_too_large", message: INSURANCE_ERROR_MESSAGES.attachment_too_large };
  if (!ATTACHMENT_LIMITS.allowedExt.includes(ext)) return { ok: false, code: "attachment_extension_not_allowed", message: INSURANCE_ERROR_MESSAGES.attachment_extension_not_allowed };
  const mime = detectedMime || file.type;
  if (!mime || !ATTACHMENT_LIMITS.allowedMimes.includes(mime)) {
    return { ok: false, code: "attachment_mime_not_allowed", message: INSURANCE_ERROR_MESSAGES.attachment_mime_not_allowed };
  }
  if (currentCount >= ATTACHMENT_LIMITS.maxFiles) return { ok: false, code: "attachment_max_files_reached", message: INSURANCE_ERROR_MESSAGES.attachment_max_files_reached };
  if (currentTotalBytes + file.size > ATTACHMENT_LIMITS.maxStageBytes) return { ok: false, code: "attachment_stage_size_exceeded", message: INSURANCE_ERROR_MESSAGES.attachment_stage_size_exceeded };
  return { ok: true };
}
