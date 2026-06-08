import { describe, it, expect } from "vitest";
import {
  validateAttachmentClient,
  detectMimeFromContent,
  parseInsuranceError,
  ATTACHMENT_LIMITS,
  INSURANCE_ERROR_MESSAGES,
} from "@/lib/insurance-errors";

function mkFile(name: string, type: string, size: number, header?: number[]): File {
  const head = new Uint8Array(header ?? []);
  const padLen = Math.max(0, size - head.length);
  const blob = new Blob([head, new Uint8Array(padLen)], { type });
  return new File([blob], name, { type });
}

describe("insurance attachment — magic bytes detection", () => {
  it("detects JPEG by content even with wrong file.type", async () => {
    const f = mkFile("photo.jpg", "application/octet-stream", 32, [0xff, 0xd8, 0xff, 0xe0]);
    expect(await detectMimeFromContent(f)).toBe("image/jpeg");
  });
  it("detects PNG by content", async () => {
    const f = mkFile("a.png", "", 32, [0x89, 0x50, 0x4e, 0x47]);
    expect(await detectMimeFromContent(f)).toBe("image/png");
  });
  it("detects PDF by content", async () => {
    const f = mkFile("doc.pdf", "", 32, [0x25, 0x50, 0x44, 0x46]);
    expect(await detectMimeFromContent(f)).toBe("application/pdf");
  });
  it("returns null when no signature matches", async () => {
    const f = mkFile("x.bin", "", 32, [0x00, 0x01, 0x02, 0x03]);
    expect(await detectMimeFromContent(f)).toBeNull();
  });
});

describe("insurance attachment — per-file limits", () => {
  it("attachment_invalid_size when empty", () => {
    const f = mkFile("a.jpg", "image/jpeg", 0);
    const r = validateAttachmentClient(f, 0, 0, "image/jpeg");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("attachment_invalid_size");
  });
  it("attachment_too_large when >50MB", () => {
    const f = mkFile("a.jpg", "image/jpeg", ATTACHMENT_LIMITS.maxFileBytes + 1);
    const r = validateAttachmentClient(f, 0, 0, "image/jpeg");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("attachment_too_large");
  });
  it("attachment_extension_not_allowed for .exe", () => {
    const f = mkFile("malware.exe", "image/jpeg", 1024);
    const r = validateAttachmentClient(f, 0, 0, "image/jpeg");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("attachment_extension_not_allowed");
  });
  it("attachment_mime_not_allowed for text/html", () => {
    const f = mkFile("page.html", "text/html", 1024);
    const r = validateAttachmentClient(f, 0, 0, "text/html");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("attachment_mime_not_allowed");
  });
  it("accepts a valid jpeg under limits", () => {
    const f = mkFile("ok.jpg", "image/jpeg", 1024);
    const r = validateAttachmentClient(f, 0, 0, "image/jpeg");
    expect(r.ok).toBe(true);
  });
});

describe("insurance attachment — per-claim (stage) limits", () => {
  it("attachment_max_files_reached at 20", () => {
    const f = mkFile("ok.jpg", "image/jpeg", 1024);
    const r = validateAttachmentClient(f, ATTACHMENT_LIMITS.maxFiles, 0, "image/jpeg");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("attachment_max_files_reached");
  });
  it("attachment_stage_size_exceeded when cumulative > 200MB", () => {
    const f = mkFile("ok.jpg", "image/jpeg", 10 * 1024 * 1024);
    const r = validateAttachmentClient(f, 5, ATTACHMENT_LIMITS.maxStageBytes - 1, "image/jpeg");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("attachment_stage_size_exceeded");
  });
});

describe("insurance error parser — UI messages from DB errors", () => {
  it.each([
    ["attachment_too_large", INSURANCE_ERROR_MESSAGES.attachment_too_large],
    ["attachment_mime_not_allowed:text/html", INSURANCE_ERROR_MESSAGES.attachment_mime_not_allowed],
    ["attachment_extension_not_allowed:exe", INSURANCE_ERROR_MESSAGES.attachment_extension_not_allowed],
    ["attachment_max_files_reached", INSURANCE_ERROR_MESSAGES.attachment_max_files_reached],
    ["attachment_stage_size_exceeded", INSURANCE_ERROR_MESSAGES.attachment_stage_size_exceeded],
    ["attachment_invalid_size", INSURANCE_ERROR_MESSAGES.attachment_invalid_size],
  ])("maps %s to consistent UI message", (raw, expected) => {
    const parsed = parseInsuranceError({ message: raw });
    expect(parsed.message).toBe(expected);
  });
  it("extracts detail (mime) when present", () => {
    const parsed = parseInsuranceError({ message: "attachment_mime_not_allowed:text/html" });
    expect(parsed.detail).toBe("text/html");
  });
  it("falls back to unknown on arbitrary errors", () => {
    const parsed = parseInsuranceError(new Error("boom"));
    expect(parsed.code).toBe("unknown");
  });
});
