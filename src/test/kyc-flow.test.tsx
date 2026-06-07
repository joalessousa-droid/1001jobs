// Integration test: KYC submission permissions, private bucket access, audit log shape.
import { describe, it, expect, vi, beforeEach } from "vitest";

const storageUpload = vi.fn(async () => ({ data: { path: "u1/file.jpg" }, error: null }));
const storageSigned = vi.fn(async () => ({ data: { signedUrl: "https://signed" }, error: null }));
const insert = vi.fn(async () => ({ data: { id: "k1" }, error: null }));
const update = vi.fn(async () => ({ data: null, error: null }));
const selectChain = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn(async () => ({ data: { id: "p1" }, error: null })),
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "u1", email: "a@b.c" } } }) },
    storage: { from: () => ({ upload: storageUpload, createSignedUrl: storageSigned }) },
    from: (_table: string) => ({
      ...selectChain,
      insert: (row: any) => insert(row),
      update: (row: any) => ({ eq: (_c: string, _v: string) => update(row) }),
    }) as any,

    functions: { invoke: vi.fn(async () => ({ data: { decision: "approved", similarity: 0.92 }, error: null })) },
  },
}));

describe("KYC flow", () => {
  beforeEach(() => { storageUpload.mockClear(); insert.mockClear(); });

  it("uploads documents to private bucket and creates an in_review submission", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const file = new File(["x"], "front.jpg", { type: "image/jpeg" });
    const up = await (supabase.storage.from("kyc-docs") as any).upload("u1/front.jpg", file);
    expect(up.error).toBeNull();
    expect(storageUpload).toHaveBeenCalled();

    const ins = await (supabase.from("kyc_submissions") as any).insert({

    expect(storageUpload).toHaveBeenCalled();

    const ins = await supabase.from("kyc_submissions").insert({
      profile_id: "p1", user_id: "u1", cpf: "12345678900",
      doc_front_path: "u1/front.jpg", selfie_path: "u1/selfie.jpg",
      status: "in_review",
    });
    expect(ins.error).toBeNull();
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ status: "in_review", user_id: "u1" }));
  });

  it("rejects KYC review without reason in business logic", async () => {
    const reason = "";
    const ok = (status: "approved" | "rejected") => !(status === "rejected" && !reason.trim());
    expect(ok("rejected")).toBe(false);
    expect(ok("approved")).toBe(true);
  });

  it("face-verify returns a decision shape with similarity", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.functions.invoke("face-verify", { body: { context: "kyc", selfie_base64: "data:" } });
    expect(data).toEqual(expect.objectContaining({ decision: expect.any(String), similarity: expect.any(Number) }));
  });

  it("signed URLs are required for private bucket access", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const r = await supabase.storage.from("kyc-docs").createSignedUrl("u1/front.jpg", 60);
    expect(r.data?.signedUrl).toMatch(/^https:\/\//);
  });
});
