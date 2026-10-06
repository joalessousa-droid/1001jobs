// Etapa 28: política de transações da 1001Pay. Só decide; não move dinheiro.
export type TxDecision = "approve" | "step_up" | "manual_review" | "block";

export interface TxContext {
  amount: number;          // BRL
  riskScore?: number;      // 0-100 (risk-score)
  mfaVerified?: boolean;
  accountAgeDays?: number;
  dailyTotal?: number;     // soma do dia, BRL
  hourLocal?: number;
}

export const LIMITS = { stepUp: 1000, review: 5000, daily: 10000, block: 50000 };

export function evaluateTx(c: TxContext): { decision: TxDecision; reasons: string[] } {
  const r: string[] = [];
  if (c.amount >= LIMITS.block) return { decision: "block", reasons: ["amount_over_hard_limit"] };
  if ((c.riskScore ?? 0) >= 80) return { decision: "manual_review", reasons: ["high_risk"] };
  if (c.amount >= LIMITS.review || (c.dailyTotal ?? 0) + c.amount > LIMITS.daily) r.push("high_value");
  if ((c.accountAgeDays ?? 999) < 3 && c.amount >= 300) r.push("new_account");
  if ((c.riskScore ?? 0) >= 50) r.push("medium_risk");
  if (c.hourLocal !== undefined && (c.hourLocal < 5) && c.amount >= 500) r.push("unusual_hour");
  if (r.includes("high_value")) return { decision: "manual_review", reasons: r };
  if (r.length || (c.amount >= LIMITS.stepUp && !c.mfaVerified)) return { decision: c.mfaVerified && r.length === 0 ? "approve" : "step_up", reasons: r.length ? r : ["mfa_required"] };
  return { decision: "approve", reasons: [] };
}
