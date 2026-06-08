// Testes: política de retenção e construção do CSV de auditoria.
import { describe, it, expect } from "vitest";

function shouldPurge(retention_until: string | null, now = new Date()) {
  if (!retention_until) return false;
  return new Date(retention_until).getTime() < now.getTime();
}

function setRetentionOnClose(currentStatus: string, newStatus: string, current: string | null) {
  const terminal = ["approved","denied","closed"];
  if (terminal.includes(newStatus) && !current && currentStatus !== newStatus) {
    return new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
  }
  return current;
}

describe("insurance retention", () => {
  it("does not purge when retention is null (open claim)", () => {
    expect(shouldPurge(null)).toBe(false);
  });
  it("does not purge when retention is in the future", () => {
    const future = new Date(Date.now() + 86400_000).toISOString();
    expect(shouldPurge(future)).toBe(false);
  });
  it("purges when retention has passed", () => {
    const past = new Date(Date.now() - 86400_000).toISOString();
    expect(shouldPurge(past)).toBe(true);
  });
  it("sets retention_until on terminal transition", () => {
    const r = setRetentionOnClose("in_review", "approved", null);
    expect(r).not.toBeNull();
    const diff = new Date(r!).getTime() - Date.now();
    // ~90 days
    expect(diff).toBeGreaterThan(89 * 86400_000);
    expect(diff).toBeLessThan(91 * 86400_000);
  });
  it("does not reset retention if already set", () => {
    const existing = new Date(Date.now() + 10_000).toISOString();
    expect(setRetentionOnClose("open", "closed", existing)).toBe(existing);
  });
  it("does not set retention for non-terminal transitions", () => {
    expect(setRetentionOnClose("open", "in_review", null)).toBeNull();
  });
});

function buildCsv(rows: any[]) {
  const headers = ["created_at","protocol","claim_id","event_type","actor_user_id","is_admin","before","after","message"];
  const escape = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [headers.join(","), ...rows.map((r) => [
    r.created_at, r.protocol, r.claim_id, r.event_type, r.actor_user_id,
    r.is_admin, r.before_value, r.after_value, r.message,
  ].map(escape).join(","))].join("\n");
}

describe("insurance audit CSV", () => {
  it("escapes quotes and includes headers", () => {
    const csv = buildCsv([{
      created_at: "2026-06-08T10:00:00Z", protocol: "SIN-1", claim_id: "c1",
      event_type: "comment", actor_user_id: "u1", is_admin: true,
      before_value: "", after_value: "", message: 'Olá "mundo"',
    }]);
    const lines = csv.split("\n");
    expect(lines[0]).toContain("event_type");
    expect(lines[1]).toContain('"Olá ""mundo"""');
  });
  it("produces single header for empty result if called", () => {
    const csv = buildCsv([]);
    expect(csv.split("\n").length).toBe(1);
  });
});
