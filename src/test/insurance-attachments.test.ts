// Testes unitários: validação de anexos (cliente) e rate limit (mock).
import { describe, it, expect } from "vitest";

const ALLOWED = new Set([
  "image/jpeg","image/png","image/webp","image/gif",
  "video/mp4","video/quicktime","video/webm",
  "application/pdf","application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const MAX_BYTES = 50 * 1024 * 1024;
const MAX_FILES = 20;

function validate(file: { type: string; size: number }, existing: number) {
  if (existing >= MAX_FILES) return "max_files";
  if (!ALLOWED.has(file.type)) return "mime_not_allowed";
  if (file.size > MAX_BYTES) return "too_large";
  if (file.size <= 0) return "empty";
  return null;
}

describe("insurance attachment validation", () => {
  it("rejects unknown mime type", () => {
    expect(validate({ type: "application/x-msdownload", size: 1024 }, 0)).toBe("mime_not_allowed");
  });
  it("rejects files over 50MB", () => {
    expect(validate({ type: "image/jpeg", size: MAX_BYTES + 1 }, 0)).toBe("too_large");
  });
  it("rejects empty files", () => {
    expect(validate({ type: "image/png", size: 0 }, 0)).toBe("empty");
  });
  it("rejects when max files reached", () => {
    expect(validate({ type: "image/png", size: 1024 }, MAX_FILES)).toBe("max_files");
  });
  it("accepts a valid jpeg", () => {
    expect(validate({ type: "image/jpeg", size: 100_000 }, 3)).toBeNull();
  });
  it("accepts videos and pdf", () => {
    expect(validate({ type: "video/mp4", size: 1_000_000 }, 0)).toBeNull();
    expect(validate({ type: "application/pdf", size: 5_000 }, 0)).toBeNull();
  });
});

describe("SOS rate limit semantics", () => {
  // Simula a janela de 60s checada no RPC
  function withinLast(seconds: number, eventsAgoSec: number[]) {
    return eventsAgoSec.filter((s) => s < seconds).length;
  }
  it("blocks a second SOS within 60s", () => {
    expect(withinLast(60, [5])).toBeGreaterThanOrEqual(1);
  });
  it("allows after window", () => {
    expect(withinLast(60, [120])).toBe(0);
  });
  it("blocks when 5+ in last hour", () => {
    expect(withinLast(3600, [10, 200, 500, 1500, 3000])).toBeGreaterThanOrEqual(5);
  });
});
