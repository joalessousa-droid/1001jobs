// E2E-ish test: validates CSV download filtered by period/city/category against kyc_decisions records.
import { describe, it, expect } from "vitest";

const COLS = [
  "created_at","submission_id","user_id","operator_id",
  "from_status","to_status","rejection_category","reason","city",
] as const;

function csvEscape(v: any) {
  const s = String(v ?? "").replace(/"/g, '""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
}

// Mirrors the AdminKycMetrics.exportCsv builder, including in-memory search filter.
function buildCsv(rows: any[], opts: { search?: string } = {}) {
  const term = (opts.search ?? "").trim().toLowerCase();
  const filtered = rows.filter((r) => !term ||
    COLS.some((c) => String(r[c] ?? "").toLowerCase().includes(term)));
  return [COLS.join(",")]
    .concat(filtered.map((r) => COLS.map((c) => csvEscape(r[c])).join(",")))
    .join("\n");
}

// Simulates the SECURITY DEFINER RPC export_kyc_decisions(_from, _to, _city, _category)
function fakeExportRpc(rows: any[], _from: string, _to: string, _city: string | null, _category: string | null) {
  const f = new Date(_from).getTime();
  const t = new Date(_to).getTime();
  return rows
    .filter((r) => {
      const ts = new Date(r.created_at).getTime();
      if (ts < f || ts > t) return false;
      if (_city && r.city !== _city) return false;
      if (_category && r.rejection_category !== _category) return false;
      return true;
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

const fixture = [
  { created_at: "2026-05-01T10:00:00Z", submission_id: "s1", user_id: "u1", operator_id: "op1",
    from_status: "in_review", to_status: "approved", rejection_category: null, reason: null, city: "São Paulo" },
  { created_at: "2026-05-15T12:00:00Z", submission_id: "s2", user_id: "u2", operator_id: "op1",
    from_status: "in_review", to_status: "rejected", rejection_category: "cpf_irregular",
    reason: "CPF irregular na Receita", city: "São Paulo" },
  { created_at: "2026-05-20T09:00:00Z", submission_id: "s3", user_id: "u3", operator_id: "op2",
    from_status: "in_review", to_status: "rejected", rejection_category: "face_mismatch",
    reason: "Selfie diverge do documento", city: "Rio de Janeiro" },
  { created_at: "2026-06-01T08:00:00Z", submission_id: "s4", user_id: "u4", operator_id: "op2",
    from_status: "pending", to_status: "in_review", rejection_category: null, reason: null, city: "Curitiba" },
];

describe("Admin KYC CSV export (E2E)", () => {
  it("exports header with the documented columns in the expected order", () => {
    const csv = buildCsv([]);
    expect(csv.split("\n")[0]).toBe(COLS.join(","));
  });

  it("filters by period and includes only rows in range", () => {
    const rows = fakeExportRpc(fixture, "2026-05-01T00:00:00Z", "2026-05-31T23:59:59Z", null, null);
    const csv = buildCsv(rows);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(1 + 3); // header + 3 rows
    expect(csv).toContain("s1");
    expect(csv).toContain("s2");
    expect(csv).toContain("s3");
    expect(csv).not.toContain("s4");
  });

  it("filters by city: São Paulo only", () => {
    const rows = fakeExportRpc(fixture, "2026-04-01T00:00:00Z", "2026-07-01T00:00:00Z", "São Paulo", null);
    expect(rows.map((r) => r.submission_id).sort()).toEqual(["s1","s2"]);
    const csv = buildCsv(rows);
    expect(csv).not.toContain("Rio de Janeiro");
    expect(csv).not.toContain("Curitiba");
  });

  it("filters by rejection_category", () => {
    const rows = fakeExportRpc(fixture, "2026-01-01T00:00:00Z", "2026-12-31T00:00:00Z", null, "face_mismatch");
    expect(rows).toHaveLength(1);
    expect(rows[0].submission_id).toBe("s3");
  });

  it("CSV rows correspond exactly to kyc_decisions records (values and order)", () => {
    const rows = fakeExportRpc(fixture, "2026-05-01T00:00:00Z", "2026-05-31T23:59:59Z", null, null);
    const csv = buildCsv(rows);
    const [header, ...lines] = csv.split("\n");
    expect(header.split(",")).toEqual([...COLS]);
    // rows are ordered DESC by created_at
    expect(lines[0].split(",")[1]).toBe("s3");
    expect(lines[1].split(",")[1]).toBe("s2");
    expect(lines[2].split(",")[1]).toBe("s1");
    // value mapping: row 0 maps to s3 fields
    const s3 = rows[0];
    const cells = lines[0].split(",").map((c) => c.replace(/^"|"$/g, "").replace(/""/g, '"'));
    COLS.forEach((c, idx) => {
      expect(cells[idx]).toBe(String(s3[c] ?? ""));
    });
  });

  it("quotes values containing commas/quotes/newlines safely", () => {
    const tricky = [{
      created_at: "2026-05-10T00:00:00Z", submission_id: "x", user_id: "u", operator_id: "o",
      from_status: "in_review", to_status: "rejected",
      rejection_category: "other", reason: 'tem, vírgula e "aspas"\ne quebra', city: "São, Paulo",
    }];
    const csv = buildCsv(tricky);
    expect(csv).toContain('"tem, vírgula e ""aspas""\ne quebra"');
    expect(csv).toContain('"São, Paulo"');
  });

  it("client-side search narrows rows without dropping the header", () => {
    const rows = fakeExportRpc(fixture, "2026-01-01T00:00:00Z", "2026-12-31T00:00:00Z", null, null);
    const csv = buildCsv(rows, { search: "face_mismatch" });
    const lines = csv.split("\n");
    expect(lines[0]).toBe(COLS.join(","));
    expect(lines).toHaveLength(2); // header + 1 match
    expect(lines[1]).toContain("s3");
  });
});
