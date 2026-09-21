import { describe, it, expect, vi } from "vitest";
import {
  availableNavApps,
  buildNavLinks,
  detectPlatform,
  distanceMeters,
  evaluateArrival,
  openNavApp,
  DEFAULT_GEOFENCE,
  type GeoSample,
} from "@/lib/navigationApps";

const DEST = { lat: -23.5505, lng: -46.6333 };

const sample = (lat: number, lng: number, tsSeconds: number, speed = 0): GeoSample => ({
  latitude: lat, longitude: lng, accuracy: 10, speed, timestamp: tsSeconds * 1000,
});

describe("deep links de navegação", () => {
  it("detecta a plataforma pelo user agent", () => {
    expect(detectPlatform("Mozilla/5.0 (Linux; Android 14)")).toBe("android");
    expect(detectPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)")).toBe("ios");
    expect(detectPlatform("Mozilla/5.0 (Macintosh)")).toBe("web");
  });

  it("gera links de Waze e Google Maps com coordenadas", () => {
    const links = buildNavLinks({ ...DEST }, "android");
    expect(links.map((l) => l.id)).toEqual(["google_maps", "waze"]);
    expect(links[0].deepLink).toContain("geo:-23.5505,-46.6333");
    expect(links[1].deepLink).toContain("waze://?ll=-23.5505,-46.6333");
    expect(links[1].webLink).toContain("waze.com/ul");
  });

  it("usa o endereço textual como fallback quando não há coordenadas", () => {
    const links = buildNavLinks({ address: "Av. Paulista, 1000" }, "ios");
    expect(links[0].deepLink).toContain("comgooglemaps://");
    expect(links[0].deepLink).toContain(encodeURIComponent("Av. Paulista, 1000"));
  });

  it("não oferece nenhum app quando não há destino algum", () => {
    expect(availableNavApps({ address: "" }, "android")).toHaveLength(0);
  });

  it("oferece os dois apps quando há destino (usuário escolhe)", () => {
    expect(availableNavApps({ ...DEST }, "ios")).toHaveLength(2);
  });

  it("no desktop usa diretamente as versões web", () => {
    const links = availableNavApps({ ...DEST }, "web");
    links.forEach((l) => expect(l.deepLink).toBe(l.webLink));
  });

  it("abre o deep link e mantém a versão web como fallback", () => {
    vi.useFakeTimers();
    const open = vi.fn();
    const [gmaps] = buildNavLinks({ ...DEST }, "android");
    openNavApp(gmaps, { open, fallbackMs: 1000 });
    expect(open).toHaveBeenCalledWith(gmaps.deepLink);
    vi.advanceTimersByTime(1200);
    expect(open).toHaveBeenCalledWith(gmaps.webLink);
    vi.useRealTimers();
  });
});

describe("geofence de chegada", () => {
  it("calcula distância em metros", () => {
    expect(Math.round(distanceMeters(DEST.lat, DEST.lng, DEST.lat + 0.001, DEST.lng))).toBeGreaterThan(100);
  });

  it("detecta aproximação sem confirmar chegada", () => {
    const res = evaluateArrival([sample(DEST.lat + 0.0005, DEST.lng, 100, 5)], DEST);
    expect(res.inside).toBe(true);
    expect(res.detected).toBe(true);
    expect(res.arrived).toBe(false);
  });

  it("não confirma chegada quando só passou pelo raio", () => {
    const samples = [sample(DEST.lat + 0.01, DEST.lng, 0, 12), sample(DEST.lat, DEST.lng, 5, 12)];
    expect(evaluateArrival(samples, DEST).arrived).toBe(false);
  });

  it("confirma chegada com permanência e baixa velocidade", () => {
    const samples = [
      sample(DEST.lat + 0.01, DEST.lng, 0, 10),
      sample(DEST.lat, DEST.lng, 10, 1),
      sample(DEST.lat, DEST.lng, 10 + DEFAULT_GEOFENCE.dwellSeconds + 5, 0),
    ];
    const res = evaluateArrival(samples, DEST);
    expect(res.arrived).toBe(true);
    expect(res.dwellSeconds).toBeGreaterThanOrEqual(DEFAULT_GEOFENCE.dwellSeconds);
  });

  it("respeita raio e permanência configuráveis", () => {
    const cfg = { ...DEFAULT_GEOFENCE, radiusM: 30, dwellSeconds: 5 };
    const far = evaluateArrival([sample(DEST.lat + 0.0007, DEST.lng, 0, 0)], DEST, cfg);
    expect(far.inside).toBe(false);
    const near = evaluateArrival([sample(DEST.lat, DEST.lng, 0, 0), sample(DEST.lat, DEST.lng, 10, 0)], DEST, cfg);
    expect(near.arrived).toBe(true);
  });

  it("ignora amostras com precisão ruim quando há alternativas", () => {
    const bad: GeoSample = { latitude: DEST.lat, longitude: DEST.lng, accuracy: 2000, speed: 0, timestamp: 0 };
    const good: GeoSample = { latitude: DEST.lat + 0.05, longitude: DEST.lng, accuracy: 8, speed: 0, timestamp: 1000 };
    expect(evaluateArrival([bad, good], DEST).inside).toBe(false);
  });
});
