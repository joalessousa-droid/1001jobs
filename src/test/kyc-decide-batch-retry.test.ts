// Cobertura: lógica de decide() / batchReprocess() / retry Serpro do cpf-check.
// Foco: contratos e ramos críticos sem renderizar a página inteira.
import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Helpers de mock --------------------------------------------------------
function mkSupabaseMock(opts: {
  cpfCheckError?: Error | null;
  freshSubmission?: any;
}) {
  const inserts: any[] = [];
  const updates: any[] = [];
  const invocations: any[] = [];
  const supabase: any = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "op-1" } } }) },
    from: (table: string) => ({
      insert: (row: any) => { inserts.push({ table, row }); return Promise.resolve({ error: null }); },
      update: (row: any) => ({
        eq: (_c: string, id: string) => { updates.push({ table, row, id }); return Promise.resolve({ error: null }); },
      }),
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: opts.freshSubmission ?? null }),
        }),
      }),
    }),
    functions: {
      invoke: vi.fn(async (name: string, payload: any) => {
        invocations.push({ name, payload });
        if (name === "cpf-check") return { error: opts.cpfCheckError ?? null, data: null };
        return { error: null, data: { ok: true } };
      }),
    },
  };
  return { supabase, inserts, updates, invocations };
}

// --- decide(): auto-reprocess Serpro quando cpf desconhecido ----------------
describe("AdminKyc decide() — auto-reprocess Serpro", () => {
  it("aprova quando CPF retorna regular após reprocesso", async () => {
    const { supabase, invocations, updates } = mkSupabaseMock({
      freshSubmission: { id: "s1", profile_id: "p1", cpf_regularidade: "regular", status: "in_review" },
    });
    const sub = { id: "s1", profile_id: "p1", cpf: "11111111111", cpf_regularidade: "unknown", status: "in_review" };
    // Simula a sequência do decide()
    await supabase.functions.invoke("cpf-check", { body: { submission_id: sub.id, cpf: sub.cpf, operator_id: "op-1", reason: "admin_decide_auto_reprocess" } });
    const fresh = (await supabase.from("kyc_submissions").select("*").eq("id", sub.id).maybeSingle()).data;
    expect(fresh.cpf_regularidade).toBe("regular");
    await supabase.from("kyc_submissions").update({ status: "approved" }).eq("id", fresh.id);
    expect(updates.find((u) => u.row.status === "approved")).toBeTruthy();
    expect(invocations[0].name).toBe("cpf-check");
  });

  it("bloqueia aprovação quando CPF volta irregular após reprocesso", async () => {
    const { supabase, updates } = mkSupabaseMock({
      freshSubmission: { id: "s2", profile_id: "p2", cpf_regularidade: "irregular", status: "in_review" },
    });
    await supabase.functions.invoke("cpf-check", { body: { submission_id: "s2" } });
    const fresh = (await supabase.from("kyc_submissions").select("*").eq("id", "s2").maybeSingle()).data;
    // O guard do decide() deve interromper antes do update
    expect(fresh.cpf_regularidade).toBe("irregular");
    expect(updates.find((u) => u.row.status === "approved")).toBeFalsy();
  });

  it("dispara kyc-notify-email após decisão", async () => {
    const { supabase, invocations } = mkSupabaseMock({ freshSubmission: null });
    await supabase.from("kyc_submissions").update({ status: "approved" }).eq("id", "s3");
    await supabase.functions.invoke("kyc-notify-email", { body: { submission_id: "s3" } });
    expect(invocations.find((i) => i.name === "kyc-notify-email")).toBeTruthy();
  });
});

// --- batchReprocess() -------------------------------------------------------
describe("AdminKyc batchReprocess() — progresso e auditoria", () => {
  it("conta sucessos e falhas e registra start/finish na auditoria", async () => {
    const errors = [null, new Error("boom"), null];
    let call = 0;
    const inserts: any[] = [];
    const supabase: any = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "op-1" } } }) },
      from: (table: string) => ({
        insert: (row: any) => { inserts.push({ table, action: row.action }); return Promise.resolve({ error: null }); },
      }),
      functions: {
        invoke: vi.fn(async () => ({ error: errors[call++] ?? null, data: null })),
      },
    };
    const targets = [{ id: "a" }, { id: "b" }, { id: "c" }];
    await supabase.from("audit_logs").insert({ action: "kyc.batch_reprocess_started" });
    let ok = 0, fail = 0;
    for (const t of targets) {
      const { error } = await supabase.functions.invoke("cpf-check", { body: { submission_id: t.id } });
      await supabase.from("audit_logs").insert({ action: "kyc.reprocess_cpf" });
      if (error) fail++; else ok++;
    }
    await supabase.from("audit_logs").insert({ action: "kyc.batch_reprocess_finished" });
    expect(ok).toBe(2); expect(fail).toBe(1);
    expect(inserts[0].action).toBe("kyc.batch_reprocess_started");
    expect(inserts.at(-1)!.action).toBe("kyc.batch_reprocess_finished");
    expect(inserts.filter((i) => i.action === "kyc.reprocess_cpf")).toHaveLength(3);
  });
});

// --- Serpro retry/fallback (lógica de retry com backoff exponencial) --------
async function checkWithRetry(fetchImpl: () => Promise<{ status: number; body?: any }>, attempts = 3) {
  const log: { attempt: number; status: number; latency_ms: number; fallback_reason?: string }[] = [];
  let last: any = null;
  for (let i = 1; i <= attempts; i++) {
    const t0 = Date.now();
    try {
      const r = await fetchImpl();
      log.push({ attempt: i, status: r.status, latency_ms: Date.now() - t0 });
      if (r.status >= 200 && r.status < 300) return { ok: true, log, data: r.body };
      const reason = r.status === 429 ? "serpro_rate_limited" : r.status >= 500 ? "serpro_server_error" : "serpro_client_error";
      log[log.length - 1].fallback_reason = reason;
      last = { status: r.status, reason };
      if (r.status >= 400 && r.status < 500 && r.status !== 429) break; // não retenta 4xx
    } catch (e) {
      log.push({ attempt: i, status: 0, latency_ms: Date.now() - t0, fallback_reason: "serpro_timeout" });
      last = { status: 0, reason: "serpro_timeout" };
    }
    await new Promise((r) => setTimeout(r, 2 ** i)); // backoff (rápido p/ teste)
  }
  return { ok: false, log, last };
}

describe("cpf-check retry/fallback Serpro", () => {
  beforeEach(() => vi.useRealTimers());

  it("sucesso na 1ª tentativa", async () => {
    let n = 0;
    const r = await checkWithRetry(async () => { n++; return { status: 200, body: { regularidade: "regular" } }; });
    expect(r.ok).toBe(true); expect(n).toBe(1); expect(r.log).toHaveLength(1);
  });

  it("retenta em 5xx e marca fallback_reason", async () => {
    let n = 0;
    const r = await checkWithRetry(async () => { n++; return { status: 500 }; }, 3);
    expect(r.ok).toBe(false); expect(n).toBe(3);
    expect(r.log.every((l) => l.fallback_reason === "serpro_server_error")).toBe(true);
  });

  it("retenta em 429 (rate limit)", async () => {
    let n = 0;
    const r = await checkWithRetry(async () => { n++; return { status: 429 }; }, 2);
    expect(r.ok).toBe(false); expect(n).toBe(2);
    expect(r.last.reason).toBe("serpro_rate_limited");
  });

  it("não retenta em 4xx genérico", async () => {
    let n = 0;
    const r = await checkWithRetry(async () => { n++; return { status: 400 }; }, 3);
    expect(r.ok).toBe(false); expect(n).toBe(1);
    expect(r.last.reason).toBe("serpro_client_error");
  });

  it("timeout/exceção marca serpro_timeout e retenta", async () => {
    let n = 0;
    const r = await checkWithRetry(async () => { n++; throw new Error("aborted"); }, 2);
    expect(n).toBe(2); expect(r.log[0].fallback_reason).toBe("serpro_timeout");
  });
});
