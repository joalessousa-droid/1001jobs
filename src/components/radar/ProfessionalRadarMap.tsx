import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { RadarProfessional } from "@/hooks/useProfessionalRadar";

interface Props {
  center: [number, number];
  radiusKm: number;
  professionals: RadarProfessional[];
  newIds?: string[];
  urgent?: boolean;
  scanning?: boolean;
  highlightId?: string | null;
  /** rota ao vivo do profissional a caminho */
  routePath?: { lat: number; lng: number }[];
  /** posição atual do profissional em deslocamento */
  movingPosition?: { lat: number; lng: number } | null;
  onSelect?: (p: RadarProfessional) => void;
  className?: string;
}

const ACCENT = "hsl(160, 84%, 44%)";
const URGENT = "hsl(0, 84%, 60%)";

const clientIcon = (urgent: boolean, scanning: boolean) =>
  L.divIcon({
    className: "radar-client-icon",
    html: `<div class="radar-client ${urgent ? "radar-client--urgent" : ""} ${scanning ? "radar-client--searching" : ""}">
      <span class="radar-wave"></span><span class="radar-wave radar-wave--2"></span><span class="radar-wave radar-wave--3"></span>
      <span class="radar-core radar-core--morph"></span>
    </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

const escapeHtml = (v: string) =>
  v.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );

const professionalIcon = (p: RadarProfessional, isNew: boolean, highlighted: boolean) => {
  const name = (p.display_name ?? "Profissional").trim();
  const initial = escapeHtml(name.charAt(0).toUpperCase() || "?");
  const avatar = p.avatar_url
    ? `<img src="${escapeHtml(p.avatar_url)}" alt="" />`
    : `<span>${initial}</span>`;
  return L.divIcon({
    className: "radar-professional-icon",
    html: `<div class="radar-professional-wrap">
      <div class="radar-provider ${isNew ? "radar-provider--enter" : ""} ${highlighted ? "radar-provider--highlight" : ""}">${avatar}</div>
      <div class="radar-chip">${p.distance_km.toFixed(1)} km · ${p.eta_min} min</div>
    </div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
};

const ProfessionalRadarMap = ({
  center,
  radiusKm,
  professionals,
  newIds = [],
  urgent = false,
  scanning = false,
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
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { center, zoom: 13, zoomControl: true, attributionControl: false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(m);
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

  // Marcador do cliente + ondas concêntricas do raio
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (!clientMarker.current) {
      clientMarker.current = L.marker(center, {
        icon: clientIcon(urgent, scanning),
        zIndexOffset: 1000,
      }).addTo(m);
    } else {
      clientMarker.current.setLatLng(center);
      clientMarker.current.setIcon(clientIcon(urgent, scanning));
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
  }, [center[0], center[1], radiusKm, urgent, scanning]);

  // Marcadores individuais (atualização incremental)
  useEffect(() => {
    const m = map.current;
    if (!m || !layer.current) return;
    const seen = new Set<string>();
    professionals.forEach((p) => {
      seen.add(p.provider_id);
      const pos: [number, number] = [p.latitude, p.longitude];
      const existing = markers.current.get(p.provider_id);
      if (existing) {
        const cur = existing.getLatLng();
        if (Math.abs(cur.lat - pos[0]) > 1e-5 || Math.abs(cur.lng - pos[1]) > 1e-5) existing.setLatLng(pos);
        existing.setIcon(professionalIcon(p, false, highlightId === p.provider_id));
        return;
      }
      const marker = L.marker(pos, {
        icon: professionalIcon(p, newIds.includes(p.provider_id), highlightId === p.provider_id),
      });
      marker.on("click", () => selectRef.current?.(p));
      marker.addTo(layer.current!);
      markers.current.set(p.provider_id, marker);
    });
    markers.current.forEach((mk, id) => {
      if (!seen.has(id)) {
        mk.remove();
        markers.current.delete(id);
      }
    });
  }, [professionals, newIds, highlightId]);

  // Polilinha de rota ao vivo
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (routeLine.current) {
      routeLine.current.remove();
      routeLine.current = null;
    }
    if (routePath && routePath.length > 1) {
      routeLine.current = L.polyline(
        routePath.map((p) => [p.lat, p.lng] as [number, number]),
        { color: urgent ? URGENT : ACCENT, weight: 4, opacity: 0.85 }
      ).addTo(m);
      m.fitBounds(routeLine.current.getBounds(), { padding: [40, 40] });
    }
  }, [routePath, urgent]);

  // Profissional em deslocamento
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (!movingPosition) {
      if (movingMarker.current) {
        movingMarker.current.remove();
        movingMarker.current = null;
      }
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

  return <div ref={el} className={className} data-testid="professional-radar-map" />;
};

export default ProfessionalRadarMap;
