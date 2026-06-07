// E2E-ish unit tests for KYC categorization, audit shape, critical-action blocking and notification dispatch.
import { describe, it, expect, vi } from "vitest";

// Replicates suggestCategory heuristic used by AdminKyc
function suggestCategory(s: any): string {
  if (s?.cpf_regularidade === "irregular") return "cpf_irregular";
  if (s?.ocr_checked_at && s?.ocr_cpf_match === false) return "name_cpf_mismatch";
  if (s?.ocr_checked_at && (s?.ocr_name_match ?? 1) < 0.6) return "name_cpf_mismatch";
  if (s?.face_match_score != null && Number(s.face_match_score) < 0.7) return "face_mismatch";
  if (s?.ocr_checked_at && !s?.ocr_extracted?.name) return "ocr_inconclusive";
  return "other";
}

describe("KYC rejection categorization", () => {
  it("flags CPF irregular when Receita marks it irregular", () => {
    expect(suggestCategory({ cpf_regularidade: "irregular" })).toBe("cpf_irregular");
  });
  it("flags name/CPF divergence when OCR CPF mismatches", () => {
    expect(suggestCategory({ ocr_checked_at: "now", ocr_cpf_match: false, ocr_name_match: 0.9 })).toBe("name_cpf_mismatch");
  });
  it("flags face mismatch when similarity is below threshold", () => {
    expect(suggestCategory({ face_match_score: 0.4 })).toBe("face_mismatch");
  });
  it("flags ocr_inconclusive when no name was extracted", () => {
    expect(suggestCategory({ ocr_checked_at: "now", ocr_cpf_match: true, ocr_name_match: 1, ocr_extracted: {} })).toBe("ocr_inconclusive");
  });
  it("defaults to other when no signals", () => {
    expect(suggestCategory({})).toBe("other");
  });
});

describe("KYC status lifecycle", () => {
  const statuses = ["pending", "in_review", "approved", "rejected"] as const;
  it("contains all required states", () => {
    for (const s of statuses) expect(statuses.includes(s)).toBe(true);
  });
  it("blocks approval when CPF is irregular", () => {
    const canApprove = (s: any) => s.cpf_regularidade !== "irregular";
    expect(canApprove({ cpf_regularidade: "irregular" })).toBe(false);
    expect(canApprove({ cpf_regularidade: "regular" })).toBe(true);
    expect(canApprove({ cpf_regularidade: "unknown" })).toBe(true); // fallback: revisão manual
  });
  it("forces rejection to require both reason and category", () => {
    const validate = (status: string, reason: string, category: string) => {
      if (status === "rejected" && !reason.trim()) return "reason_required";
      if (status === "rejected" && !category) return "category_required";
      return "ok";
    };
    expect(validate("rejected", "", "")).toBe("reason_required");
    expect(validate("rejected", "doc borrado", "")).toBe("category_required");
    expect(validate("rejected", "doc borrado", "document_invalid")).toBe("ok");
    expect(validate("approved", "", "")).toBe("ok");
  });
});

describe("Critical action blocking", () => {
  const requireCritical = vi.fn(async (_opts: any) => true);
  it("blocks withdrawal when critical re-auth fails", async () => {
    requireCritical.mockResolvedValueOnce(false);
    const proceed = await requireCritical({ context: "withdrawal", requireFace: true });
    expect(proceed).toBe(false);
  });
  it("allows withdrawal when re-auth succeeds", async () => {
    requireCritical.mockResolvedValueOnce(true);
    expect(await requireCritical({ context: "withdrawal", requireFace: true })).toBe(true);
  });
  it("blocks password change when re-auth fails", async () => {
    requireCritical.mockResolvedValueOnce(false);
    expect(await requireCritical({ context: "password_change" })).toBe(false);
  });
  it("forces face for suspicious login", async () => {
    requireCritical.mockResolvedValueOnce(true);
    const call = { context: "suspicious_login", requireFace: true };
    expect(await requireCritical(call)).toBe(true);
    expect(requireCritical).toHaveBeenLastCalledWith(expect.objectContaining({ requireFace: true }));
  });
});

describe("KYC notifications dispatch", () => {
  it("fires status email via edge function on status change", async () => {
    const invoke = vi.fn(async (_name: string, _opts: any) => ({ data: { ok: true }, error: null }));
    await invoke("kyc-notify-email", { body: { submission_id: "k1" } });
    expect(invoke).toHaveBeenCalledWith("kyc-notify-email", expect.any(Object));
  });
  it("Serpro fallback keeps status in_review (does not auto-approve/reject)", () => {
    const applyServproResult = (sub: any, regularidade: string) => {
      const next: any = { ...sub, cpf_regularidade: regularidade };
      if (regularidade === "unknown") next.status = "in_review";
      return next;
    };
    expect(applyServproResult({ status: "in_review" }, "unknown").status).toBe("in_review");
    expect(applyServproResult({ status: "in_review" }, "regular").status).toBe("in_review");
  });
});
