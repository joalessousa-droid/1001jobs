import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { RadarProvider } from "@/hooks/useProviderRadar";

interface Props {
  center: [number, number];
  radiusKm: number;
  providers: RadarProvider[];
  newIds?: string[];
  urgent?: boolean;
  searching?: boolean;
  highlightId?: string | null;
  /** rota real (ruas) do profissional a caminho */
  routePath?: { lat: number; lng: number }[];
  /** posição atual do profissional em deslocamento */
  movingPosition?: { lat: number; lng: number } | null;
  onSelect?: (p: RadarProvider) => void;
  className?: string;
}

const ACCENT = "hsl(160, 84%, 44%)";
const URGENT = "hsl(0, 84%, 60%)";

const clientIcon = (urgent: boolean, searching: boolean) =>
  L.divIcon({
    className: "radar-client-icon",
    html: `<div class="radar-client ${urgent ? "radar-client--urgent" : ""} ${searching ? "radar-client--searching" : ""}">
      <span class="radar-wave"></span><span class="radar-wave radar-wave--2"></span><span class="radar-wave radar-wave--3"></span>
      <span class="radar-core"></span>
    </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

const providerIcon = (p: RadarProvider, isNew: boolean, highlighted: boolean) => {
  const initial = (p.display_name ?? "?").trim().charAt(0).toUpperCase();
  return L.divIcon({
    className: "radar-provider-icon",
    html: `<div class="radar-provider ${isNew ? "radar-provider--enter" : ""} ${highlighted ? "radar-provider--highlight" : ""}">
      ${p.avatar_url ? `<img src="${p.avatar_url}" alt="" />` : `<span>${initial}</span>`}
    </div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });
};

const RadarMap = ({
  center,
  radiusKm,
  providers,
  newIds = [],
  urgent = false,
  searching = false,
  highlightId = null,
  routePath,
  movingPosition = null,
  onSelect,
  className,
}: Props) => {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const clientMarker = useRef<L.Marker | null>(null);
  const circle = useRef<L.Circle | null>(null);
  const markers = useRef<Map<string, L.Marker>>(new Map());
  const routeLine = useRef<L.Polyline | null>(null);
  const movingMarker = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { center, zoom: 13, zoomControl: true, attributionControl: false });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 19 }).addTo(m);
    L.control
      .attribution({ position: "bottomright", prefix: false })
      .addAttribution('© <a href="https://www.openstreetmap.org/copyright">OSM</a> © CARTO')
      .addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
      markers.current.clear();
    };
  }, []);

  // Client marker + radius circle
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (!clientMarker.current) {
      clientMarker.current = L.marker(center, { icon: clientIcon(urgent, searching), zIndexOffset: 1000 }).addTo(m);
    } else {
      clientMarker.current.setLatLng(center);
      clientMarker.current.setIcon(clientIcon(urgent, searching));
    }
    if (circle.current) circle.current.remove();
    circle.current = L.circle(center, {
      radius: radiusKm * 1000,
      color: urgent ? URGENT : ACCENT,
      fillColor: urgent ? URGENT : ACCENT,
      fillOpacity: 0.06,
      weight: 1.5,
      dashArray: "6 5",
    }).addTo(m);
    m.flyToBounds(circle.current.getBounds(), { padding: [30, 30], duration: 0.6 });
  }, [center[0], center[1], radiusKm, urgent, searching]);

  // Provider markers (incremental — avoids re-rendering the whole layer)
  useEffect(() => {
    const m = map.current;
    if (!m || !layer.current) return;
    const seen = new Set<string>();
    providers.forEach((p) => {
      seen.add(p.provider_id);
      const pos: [number, number] = [p.latitude, p.longitude];
      const existing = markers.current.get(p.provider_id);
      if (existing) {
        const cur = existing.getLatLng();
        if (Math.abs(cur.lat - pos[0]) > 1e-5 || Math.abs(cur.lng - pos[1]) > 1e-5) existing.setLatLng(pos);
        if (highlightId === p.provider_id) existing.setIcon(providerIcon(p, false, true));
        return;
      }
      const marker = L.marker(pos, {
        icon: providerIcon(p, newIds.includes(p.provider_id), highlightId === p.provider_id),
      });
      marker.bindTooltip(
        `${p.display_name ?? "Profissional"} • ${p.distance_km.toFixed(1)} km`,
        { direction: "top", offset: [0, -16], className: "radar-tooltip" }
      );
      marker.on("click", () => onSelect?.(p));
      marker.addTo(layer.current!);
      markers.current.set(p.provider_id, marker);
    });
    markers.current.forEach((mk, id) => {
      if (!seen.has(id)) {
        mk.remove();
        markers.current.delete(id);
      }
    });
  }, [providers, newIds, highlightId, onSelect]);

  // Rota real + marcador em deslocamento
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (routeLine.current) { routeLine.current.remove(); routeLine.current = null; }
    if (routePath && routePath.length > 1) {
      routeLine.current = L.polyline(
        routePath.map((p) => [p.lat, p.lng] as [number, number]),
        { color: ACCENT, weight: 4, opacity: 0.85 }
      ).addTo(m);
      m.fitBounds(routeLine.current.getBounds(), { padding: [40, 40] });
    }
  }, [routePath]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (!movingPosition) {
      if (movingMarker.current) { movingMarker.current.remove(); movingMarker.current = null; }
      return;
    }
    const pos: [number, number] = [movingPosition.lat, movingPosition.lng];
    if (movingMarker.current) movingMarker.current.setLatLng(pos);
    else
      movingMarker.current = L.marker(pos, {
        zIndexOffset: 900,
        icon: L.divIcon({
          className: "radar-moving-icon",
          html: `<div class="radar-provider radar-provider--highlight"><span>\u{1F697}</span></div>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        }),
      }).addTo(m);
  }, [movingPosition?.lat, movingPosition?.lng]);

  return <div ref={el} className={className} />;
};

export default RadarMap;
