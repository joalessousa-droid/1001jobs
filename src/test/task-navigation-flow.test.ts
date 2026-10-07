import { describe, it, expect } from "vitest";
import { buildNavLinks, resolveNavChoice, evaluateArrival, DEFAULT_GEOFENCE, type GeoSample } from "@/lib/navigationApps";

const dest = { lat: -23.55, lng: -46.63, address: "Av. Paulista, 1000" };
const all = buildNavLinks(dest, "android");

describe("Modo Navegação — cenários do fluxo", () => {
  it("lista Waze e Google Maps sem duplicatas", () => {
    expect(all.map((o) => o.id)).toEqual(["google_maps", "waze"]);
  });
  it("ambos disponíveis: usuário escolhe", () => {
    expect(resolveNavChoice(all).mode).toBe("choose");
  });
  it("só Waze: abre automático", () => {
    const c = resolveNavChoice(all.filter((o) => o.id === "waze"));
    expect(c.mode === "auto" && c.option.id).toBe("waze");
  });
  it("só Google Maps: abre automático", () => {
    const c = resolveNavChoice(all.filter((o) => o.id === "google_maps"));
    expect(c.mode === "auto" && c.option.id).toBe("google_maps");
  });
  it("nenhum disponível: avisa para instalar", () => {
    expect(resolveNavChoice([]).mode).toBe("none");
  });
  it("aproximação → chegada com permanência, localização processada continuamente", () => {
    const t0 = 1_000_000;
    const far: GeoSample = { latitude: -23.56, longitude: -46.63, timestamp: t0, speed: 10 };
    expect(evaluateArrival([far], dest).inside).toBe(false);
    const near = (s: number): GeoSample => ({ latitude: -23.5502, longitude: -46.6301, accuracy: 15, speed: 0, timestamp: t0 + s * 1000 });
    const detected = evaluateArrival([far, near(10)], dest);
    expect(detected.detected).toBe(true);
    expect(detected.arrived).toBe(false);
    const arrived = evaluateArrival([far, near(10), near(30), near(10 + DEFAULT_GEOFENCE.dwellSeconds)], dest);
    expect(arrived.arrived).toBe(true);
  });
});
