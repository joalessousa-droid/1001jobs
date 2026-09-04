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

// ---------------------------------------------------------------------------
// Telemetria de filtragem do Radar
// ---------------------------------------------------------------------------
import {
  getRadarFilterCounters,
  getRadarFilterEvents,
  resetRadarFilterTelemetry,
} from "@/lib/radarTelemetry";
import { excludeRadarNotifications as excludeRadarNotifs2, excludeRadarRequests as excludeRadarReqs2 } from "@/lib/radarVisibility";

describe("telemetria de isolamento do Radar", () => {
  beforeEach(() => resetRadarFilterTelemetry());

  it("conta tarefas do Radar filtradas por tela", () => {
    excludeRadarReqs2(
      [{ origin: "radar" }, { origin: "standard" }, { origin: "radar" }],
      "home-recent-tasks",
    );
    expect(getRadarFilterCounters()["requests:home-recent-tasks"]).toBe(2);
    const ev = getRadarFilterEvents();
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ screen: "home-recent-tasks", received: 3, filtered: 2 });
  });

  it("não registra evento quando nada é filtrado", () => {
    excludeRadarReqs2([{ origin: "standard" }], "search-unified");
    expect(getRadarFilterEvents()).toHaveLength(0);
  });

  it("conta notificações do Radar removidas do sino", () => {
    excludeRadarNotifs2(
      [{ type: "radar_offer" }, { type: "message" }],
      "notifications-bell",
    );
    expect(getRadarFilterCounters()["notifications:notifications-bell"]).toBe(1);
  });

  it("acumula contagens em chamadas repetidas", () => {
    excludeRadarReqs2([{ origin: "radar" }], "dashboard-recommendations");
    excludeRadarReqs2([{ origin: "radar" }], "dashboard-recommendations");
    expect(getRadarFilterCounters()["requests:dashboard-recommendations"]).toBe(2);
  });
});
