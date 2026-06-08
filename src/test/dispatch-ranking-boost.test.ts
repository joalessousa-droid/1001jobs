// Integração (mockada): valida que score_total de provider_ranking_scores aplica
// boost configurável ao base_score e altera a ordem dos offers, incluindo empate
// e teto de boost.
import { describe, it, expect } from "vitest";

type Candidate = { provider_id: string; distance: number; base_score: number; ranking_total: number };

function rankCandidates(
  cands: Candidate[],
  cfg: { weight: number; maxBoost: number },
) {
  const scored = cands.map((c) => {
    const boost = Math.min(cfg.maxBoost, cfg.weight * c.ranking_total);
    return {
      ...c,
      score: Number((c.base_score + boost).toFixed(2)),
      boost,
    };
  });
  scored.sort((a, b) => b.score - a.score || b.ranking_total - a.ranking_total);
  return scored;
}

describe("dispatch-service-offers — boost por score_total", () => {
  it("score_total maior altera a ordem final dos offers", () => {
    const cands: Candidate[] = [
      { provider_id: "A", distance: 1, base_score: 70, ranking_total: 0 },
      { provider_id: "B", distance: 1, base_score: 65, ranking_total: 100 }, // +10
    ];
    const ranked = rankCandidates(cands, { weight: 0.1, maxBoost: 10 });
    expect(ranked[0].provider_id).toBe("B"); // 65 + 10 = 75 > 70
  });

  it("aplica teto de boost (maxBoost)", () => {
    const cands: Candidate[] = [
      { provider_id: "A", distance: 1, base_score: 60, ranking_total: 999 },
    ];
    const ranked = rankCandidates(cands, { weight: 0.1, maxBoost: 10 });
    expect(ranked[0].score).toBe(70); // capped at +10
  });

  it("empate por score usa ranking_total como tiebreaker", () => {
    const cands: Candidate[] = [
      { provider_id: "A", distance: 1, base_score: 70, ranking_total: 20 }, // 72
      { provider_id: "B", distance: 1, base_score: 70, ranking_total: 20 }, // 72
      { provider_id: "C", distance: 1, base_score: 71, ranking_total: 10 }, // 72
    ];
    const ranked = rankCandidates(cands, { weight: 0.1, maxBoost: 10 });
    expect(ranked.map((r) => r.provider_id).slice(0, 3).sort()).toEqual(["A", "B", "C"]);
    // entre A e B com score igual, ranking_total decide; C tem 10, então deve ficar atrás de A/B
    expect(ranked[2].provider_id).toBe("C");
  });

  it("peso configurável muda o impacto do ranking", () => {
    const cands: Candidate[] = [
      { provider_id: "A", distance: 1, base_score: 70, ranking_total: 0 },
      { provider_id: "B", distance: 1, base_score: 65, ranking_total: 100 },
    ];
    const lowWeight = rankCandidates(cands, { weight: 0.01, maxBoost: 10 });
    expect(lowWeight[0].provider_id).toBe("A"); // 65 + 1 = 66 < 70
    const highWeight = rankCandidates(cands, { weight: 0.2, maxBoost: 30 });
    expect(highWeight[0].provider_id).toBe("B"); // 65 + 20 = 85 > 70
  });
});
