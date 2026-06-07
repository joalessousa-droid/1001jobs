import { describe, it, expect } from "vitest";
import {
  buildEtaHistoryPoints,
  classifyTraffic,
  formatEta,
  formatRelative,
  resolveNumericEnv,
} from "@/lib/etaHistory";

describe("etaHistory pure helpers", () => {
  it("classifies traffic levels", () => {
    expect(classifyTraffic(0.9)).toBe("free");
    expect(classifyTraffic(1.1)).toBe("moderate");
    expect(classifyTraffic(1.5)).toBe("intense");
    expect(classifyTraffic(null)).toBeNull();
    expect(classifyTraffic(undefined)).toBeNull();
  });

  it("formats ETA in pt-BR friendly units", () => {
    expect(formatEta(null)).toBe("—");
    expect(formatEta(0)).toBe("—");
    expect(formatEta(30)).toBe("< 1 min");
    expect(formatEta(600)).toBe("10 min");
    expect(formatEta(3900)).toBe("1h 5min");
  });

  it("formats relative timestamps", () => {
    const now = new Date("2026-06-07T12:00:00Z").getTime();
    expect(formatRelative("2026-06-07T11:59:30Z", now)).toBe("há 30s");
    expect(formatRelative("2026-06-07T11:55:00Z", now)).toBe("há 5 min");
    expect(formatRelative("2026-06-07T10:00:00Z", now)).toBe("há 2h");
  });

  it("builds history with per-step delta and limit", () => {
    const points = buildEtaHistoryPoints(
      [
        { at: "2026-06-07T12:00:00Z", eta_seconds: 600 },
        { at: "2026-06-07T12:01:00Z", eta_seconds: 720 },
        { at: "2026-06-07T12:02:00Z", eta_seconds: 660 },
      ],
      10,
      new Date("2026-06-07T12:02:30Z").getTime(),
    );
    expect(points).toHaveLength(3);
    expect(points[0].deltaSec).toBeNull();
    expect(points[1].deltaSec).toBe(120);
    expect(points[2].deltaSec).toBe(-60);
    expect(points[2].relativeLabel).toBe("há 30s");
  });

  it("handles missing or invalid history safely", () => {
    expect(buildEtaHistoryPoints(null)).toEqual([]);
    expect(buildEtaHistoryPoints([])).toEqual([]);
    expect(
      buildEtaHistoryPoints([
        { at: "not-a-date", eta_seconds: 100 } as any,
        { at: "2026-06-07T12:00:00Z", eta_seconds: Number.NaN },
      ]),
    ).toEqual([]);
  });

  it("resolves numeric env vars within bounds", () => {
    expect(resolveNumericEnv(undefined, 30, 5, 300)).toBe(30);
    expect(resolveNumericEnv("60", 30, 5, 300)).toBe(60);
    expect(resolveNumericEnv("999", 30, 5, 300)).toBe(300);
    expect(resolveNumericEnv("1", 30, 5, 300)).toBe(5);
    expect(resolveNumericEnv("abc", 30, 5, 300)).toBe(30);
  });
});
