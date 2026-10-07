// Mapa de reserva (OpenStreetMap) usado quando o Google Maps não pode carregar no endereço atual.
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { decodePolyline } from "@/hooks/useGoogleMaps";

interface Props {
  providerLocation: { latitude: number; longitude: number } | null;
  destination: { lat: number; lng: number } | null;
  polyline?: string | null;
  className?: string;
  providerLabel?: string;
}

const LeafletTrackingMap = ({ providerLocation, destination, polyline, className, providerLabel = "Profissional" }: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!ref.current || map.current) return;
    map.current = L.map(ref.current, { zoomControl: true }).setView([-23.55, -46.63], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => { map.current?.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const m = map.current; const g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    const pts: [number, number][] = [];
    if (destination) {
      L.circleMarker([destination.lat, destination.lng], { radius: 9, color: "hsl(var(--destructive))", fillOpacity: 0.8 })
        .bindTooltip("Destino").addTo(g);
      pts.push([destination.lat, destination.lng]);
    }
    if (providerLocation) {
      L.circleMarker([providerLocation.latitude, providerLocation.longitude], { radius: 9, color: "hsl(var(--primary))", fillOpacity: 0.9 })
        .bindTooltip(providerLabel).addTo(g);
      pts.push([providerLocation.latitude, providerLocation.longitude]);
    }
    if (polyline) {
      const path = decodePolyline(polyline).map((p) => [p.lat, p.lng] as [number, number]);
      L.polyline(path, { color: "hsl(var(--primary))", weight: 5, opacity: 0.85 }).addTo(g);
      pts.push(...path);
    }
    if (pts.length === 1) m.setView(pts[0], 15);
    else if (pts.length > 1) m.fitBounds(L.latLngBounds(pts).pad(0.2));
  }, [providerLocation, destination, polyline, providerLabel]);

  return <div ref={ref} data-testid="tracking-map-fallback" className={`w-full h-full rounded-2xl overflow-hidden ${className ?? ""}`} />;
};

export default LeafletTrackingMap;
