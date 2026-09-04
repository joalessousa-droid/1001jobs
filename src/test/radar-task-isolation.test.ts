import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  excludeRadarNotifications,
  excludeRadarRequests,
  isRadarNotification,
  isRadarRequest,
  onlyRadarNotifications,
} from "@/lib/radarVisibility";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

/** Listas convencionais que NUNCA podem mostrar tarefas criadas no Radar. */
const PUBLIC_TASK_LISTS = [
  "src/components/RecentProviders.tsx",
  "src/pages/Search.tsx",
  "src/pages/SearchServices.tsx",
  "src/pages/SearchProviders.tsx",
  "src/components/dashboard/sections/RecommendationsSection.tsx",
  "src/components/dashboard/sections/DemandsSection.tsx",
];

describe("tarefas do Radar ficam restritas ao Radar", () => {
  it.each(PUBLIC_TASK_LISTS)("%s filtra origin = radar na consulta", (file) => {
    const src = read(file);
    expect(src).toMatch(/\.neq\(\s*["']origin["']\s*,\s*["']radar["']\s*\)/);
  });

  it("o radar marca suas próprias solicitações com origin radar", () => {
    const src = read("src/components/radar/ProfessionalRadar.tsx");
    expect(src).toMatch(/origin:\s*["']radar["']/);
  });

  it("identifica solicitações do radar", () => {
    expect(isRadarRequest({ origin: "radar" })).toBe(true);
    expect(isRadarRequest({ origin: "standard" })).toBe(false);
    expect(isRadarRequest({})).toBe(false);
    expect(isRadarRequest(null)).toBe(false);
  });

  it("remove tarefas do radar de uma lista pública", () => {
    const rows = [
      { id: "1", origin: "standard" },
      { id: "2", origin: "radar" },
      { id: "3" },
    ];
    expect(excludeRadarRequests(rows).map((r) => r.id)).toEqual(["1", "3"]);
    expect(excludeRadarRequests(null)).toEqual([]);
  });
});

describe("notificações e badges do Radar", () => {
  const radarByType = { type: "radar_offer", title: "x" };
  const radarByLink = { type: "generic", link: "/radar?req=1" };
  const radarByMeta = { type: "generic", metadata: { origin: "radar" } };
  const normal = { type: "service_completed", link: "/meus-servicos" };

  it("reconhece notificações originadas no radar", () => {
    expect(isRadarNotification(radarByType)).toBe(true);
    expect(isRadarNotification(radarByLink)).toBe(true);
    expect(isRadarNotification(radarByMeta)).toBe(true);
    expect(isRadarNotification(normal)).toBe(false);
  });

  it("o sino global não recebe notificações do radar", () => {
    const items = [radarByType, radarByLink, radarByMeta, normal];
    expect(excludeRadarNotifications(items)).toEqual([normal]);
    expect(onlyRadarNotifications(items)).toHaveLength(3);
  });

  it("useNotifications filtra o radar por padrão", () => {
    const src = read("src/hooks/useNotifications.tsx");
    expect(src).toContain("excludeRadarNotifications");
    expect(src).toContain("radarOnly");
  });
});
