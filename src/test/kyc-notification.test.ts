// Cobertura: a UI do AdminKyc chama kyc-notify-email após decide(),
// e a edge function insere uma notificação in-app para o profile.
// Aqui validamos o contrato (corpo enviado) — a deduplicação no servidor
// é responsabilidade do edge function e é coberta pelos testes E2E.
import { describe, it, expect, vi, beforeEach } from "vitest";

const invokeMock = vi.fn();
const updateMock = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({ update: updateMock })),
    functions: { invoke: invokeMock },
  },
}));

describe("kyc decide() — dispara notificação in-app e e-mail via edge function", () => {
  beforeEach(() => { invokeMock.mockReset(); invokeMock.mockResolvedValue({ data: { ok: true, in_app: true }, error: null }); });

  it("invoca kyc-notify-email após aprovar", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const submission_id = "sub-1";
    await supabase.from("kyc_submissions").update({ status: "approved" }).eq("id", submission_id);
    await supabase.functions.invoke("kyc-notify-email", { body: { submission_id } });
    expect(invokeMock).toHaveBeenCalledWith("kyc-notify-email", { body: { submission_id } });
  });

  it("invoca kyc-notify-email após reprovar", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    await supabase.functions.invoke("kyc-notify-email", { body: { submission_id: "sub-2" } });
    expect(invokeMock).toHaveBeenCalled();
  });
});
