// Modo Navegação da Tarefa — deep links para apps externos de navegação (Waze / Google Maps).
// Funções puras para permitir testes automatizados sem DOM.

export type NavAppId = "google_maps" | "waze";

export interface NavDestination {
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
}

export interface NavAppOption {
  id: NavAppId;
  label: string;
  /** Deep link (app nativo) — pode falhar se o app não estiver instalado. */
  deepLink: string;
  /** URL web sempre funcional, usada como fallback. */
  webLink: string;
}

export type Platform = "android" | "ios" | "web";

export const detectPlatform = (ua?: string): Platform => {
  const s = (ua ?? (typeof navigator !== "undefined" ? navigator.userAgent : "")).toLowerCase();
  if (/android/.test(s)) return "android";
  if (/iphone|ipad|ipod/.test(s)) return "ios";
  return "web";
};

export const hasCoords = (d: NavDestination): d is { lat: number; lng: number; address?: string | null } =>
  typeof d.lat === "number" && Number.isFinite(d.lat) && typeof d.lng === "number" && Number.isFinite(d.lng);

/** Monta os links de navegação para o destino, usando coordenadas e, na falta delas, o endereço textual. */
export const buildNavLinks = (dest: NavDestination, platform: Platform = detectPlatform()): NavAppOption[] => {
  const coords = hasCoords(dest);
  const q = coords ? `${dest.lat},${dest.lng}` : (dest.address ?? "").trim();
  if (!q) return [];
  const enc = encodeURIComponent(q);

  const gmapsWeb = coords
    ? `https://www.google.com/maps/dir/?api=1&destination=${enc}&travelmode=driving`
    : `https://www.google.com/maps/search/?api=1&query=${enc}`;

  const gmapsDeep =
    platform === "ios"
      ? `comgooglemaps://?daddr=${enc}&directionsmode=driving`
      : platform === "android"
        ? coords
          ? `geo:${dest.lat},${dest.lng}?q=${enc}`
          : `geo:0,0?q=${enc}`
        : gmapsWeb;

  const wazeWeb = coords
    ? `https://www.waze.com/ul?ll=${dest.lat},${dest.lng}&navigate=yes`
    : `https://www.waze.com/ul?q=${enc}&navigate=yes`;

  const wazeDeep = coords ? `waze://?ll=${dest.lat},${dest.lng}&navigate=yes` : `waze://?q=${enc}&navigate=yes`;

  return [
    { id: "google_maps", label: "Google Maps", deepLink: platform === "web" ? gmapsWeb : gmapsDeep, webLink: gmapsWeb },
    { id: "waze", label: "Waze", deepLink: platform === "web" ? wazeWeb : wazeDeep, webLink: wazeWeb },
  ];
};

/**
 * Apps candidatos no dispositivo. Navegadores não expõem a lista de apps instalados,
 * então em mobile os dois são candidatos (com fallback web se o deep link não abrir)
 * e no desktop/PWA as versões web são sempre utilizáveis.
 */
export const availableNavApps = (dest: NavDestination, platform: Platform = detectPlatform()): NavAppOption[] =>
  buildNavLinks(dest, platform);

/** Abre o app escolhido; se o deep link não assumir em `fallbackMs`, cai para a versão web. */
export const openNavApp = (
  option: NavAppOption,
  opts: { fallbackMs?: number; open?: (url: string) => void } = {},
): void => {
  const open = opts.open ?? ((url: string) => window.open(url, "_blank", "noopener,noreferrer"));
  const fallbackMs = opts.fallbackMs ?? 1500;
  open(option.deepLink);
  if (option.deepLink === option.webLink) return;
  const start = Date.now();
  setTimeout(() => {
    // Se a aba continua visível, o app nativo provavelmente não abriu.
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    if (Date.now() - start < fallbackMs - 100) return;
    open(option.webLink);
  }, fallbackMs);
};

// ---------- Geofence de chegada ----------

export interface GeofenceConfig {
  radiusM: number;
  dwellSeconds: number;
  maxSpeedKmh: number;
  minAccuracyM: number;
}

export const DEFAULT_GEOFENCE: GeofenceConfig = {
  radiusM: 100,
  dwellSeconds: 45,
  maxSpeedKmh: 8,
  minAccuracyM: 120,
};

export interface GeoSample {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  /** m/s, como reportado pela Geolocation API. */
  speed?: number | null;
  timestamp: number;
}

export const distanceMeters = (aLat: number, aLng: number, bLat: number, bLng: number): number => {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

export interface ArrivalEvaluation {
  inside: boolean;
  distanceM: number;
  /** Tempo contínuo dentro do raio, em segundos. */
  dwellSeconds: number;
  stopped: boolean;
  /** Confirma chegada efetiva (dentro do raio + parado + permanência mínima). */
  arrived: boolean;
  /** Primeira entrada no raio (ainda sem confirmação) — estado ARRIVAL_DETECTED. */
  detected: boolean;
}

/**
 * Avalia a chegada a partir do histórico recente de posições (mais antigo primeiro).
 * Evita marcar chegada quando o GPS apenas cruzou o raio.
 */
export const evaluateArrival = (
  samples: GeoSample[],
  dest: { lat: number; lng: number },
  cfg: GeofenceConfig = DEFAULT_GEOFENCE,
): ArrivalEvaluation => {
  const empty: ArrivalEvaluation = { inside: false, distanceM: Number.POSITIVE_INFINITY, dwellSeconds: 0, stopped: false, arrived: false, detected: false };
  if (!samples.length) return empty;

  const usable = samples.filter((s) => (s.accuracy ?? 0) <= cfg.minAccuracyM || !s.accuracy);
  const list = usable.length ? usable : samples;
  const last = list[list.length - 1];
  const distanceM = distanceMeters(last.latitude, last.longitude, dest.lat, dest.lng);
  const inside = distanceM <= cfg.radiusM;
  if (!inside) return { ...empty, distanceM };

  // Permanência contínua dentro do raio.
  let firstInsideTs = last.timestamp;
  for (let i = list.length - 1; i >= 0; i--) {
    const d = distanceMeters(list[i].latitude, list[i].longitude, dest.lat, dest.lng);
    if (d > cfg.radiusM) break;
    firstInsideTs = list[i].timestamp;
  }
  const dwellSeconds = Math.max(0, (last.timestamp - firstInsideTs) / 1000);
  const speedKmh = last.speed != null && last.speed >= 0 ? last.speed * 3.6 : 0;
  const stopped = speedKmh <= cfg.maxSpeedKmh;
  const arrived = inside && stopped && dwellSeconds >= cfg.dwellSeconds;

  return { inside, distanceM, dwellSeconds, stopped, arrived, detected: inside && !arrived };
};
