import { describe, it, expect, vi } from "vitest";
import { evaluateTx, LIMITS } from "../../supabase/functions/_shared/txPolicy";

const rpc = vi.fn(async () => ({ data: [{ id: "p1", phone: "x" }], error: null }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

describe("regressão: dados pessoais só por caminho protegido", () => {
  it("lê perfis sensíveis pela função protegida, nunca direto da tabela", async () => {
    const { getPrivateProfile } = await import("@/lib/privateProfile");
    const { data } = await getPrivateProfile({ userId: "u1" });
    expect(rpc).toHaveBeenCalledWith("get_profiles_private", { _profile_ids: null, _user_ids: ["u1"] });
    expect(data?.id).toBe("p1");
  });
});

describe("regressão: política de transações da 1001Pay", () => {
  it("aprova valores baixos de baixo risco", () => {
    expect(evaluateTx({ amount: 80, riskScore: 10 }).decision).toBe("approve");
  });
  it("pede verificação extra acima do limite sem MFA", () => {
    expect(evaluateTx({ amount: LIMITS.stepUp + 1 }).decision).toBe("step_up");
  });
  it("aprova acima do limite com MFA e sem outros sinais", () => {
    expect(evaluateTx({ amount: LIMITS.stepUp + 1, mfaVerified: true }).decision).toBe("approve");
  });
  it("manda para revisão valores altos ou risco alto", () => {
    expect(evaluateTx({ amount: LIMITS.review, mfaVerified: true }).decision).toBe("manual_review");
    expect(evaluateTx({ amount: 50, riskScore: 90 }).decision).toBe("manual_review");
  });
  it("bloqueia acima do limite máximo", () => {
    expect(evaluateTx({ amount: LIMITS.block }).decision).toBe("block");
  });
  it("conta nova com valor relevante exige verificação", () => {
    expect(evaluateTx({ amount: 400, accountAgeDays: 1, mfaVerified: true }).decision).toBe("step_up");
  });
});
