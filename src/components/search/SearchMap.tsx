import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  name: string;
  subtitle?: string;
  type: "provider" | "client";
}

interface SearchMapProps {
  markers: MapMarker[];
  center: [number, number];
  radius: number; // in km
  onMarkerClick?: (id: string) => void;
  className?: string;
}

const PRIMARY_COLOR = "hsl(160, 84%, 44%)";

const createCustomIcon = (type: "provider" | "client") => {
  const color = type === "provider" ? PRIMARY_COLOR : "hsl(220, 14%, 50%)";
  return L.divIcon({
    className: "custom-map-marker",
    html: `<div style="
      width: 32px; height: 32px;
      background: ${color};
      border: 3px solid white;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    "><div style="
      width: 100%; height: 100%;
      display: flex; align-items: center; justify-content: center;
      transform: rotate(45deg);
      color: white; font-weight: bold; font-size: 12px;
    ">${type === "provider" ? "P" : "C"}</div></div>`,
    iconSize: [32, 42],
    iconAnchor: [16, 42],
    popupAnchor: [0, -42],
  });
};

const SearchMap = ({ markers, center, radius, onMarkerClick, className }: SearchMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center,
      zoom: 12,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
    }).addTo(map);

    // Add attribution in a corner
    L.control.attribution({ position: "bottomright", prefix: false })
      .addAttribution('© <a href="https://www.openstreetmap.org/copyright">OSM</a> © <a href="https://carto.com/">CARTO</a>')
      .addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update center
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setView(center, mapInstanceRef.current.getZoom());
  }, [center]);

  // Update radius circle
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (circleRef.current) {
      circleRef.current.remove();
      circleRef.current = null;
    }

    if (radius > 0) {
      circleRef.current = L.circle(center, {
        radius: radius * 1000,
        color: PRIMARY_COLOR,
        fillColor: PRIMARY_COLOR,
        fillOpacity: 0.08,
        weight: 2,
        dashArray: "6 4",
      }).addTo(mapInstanceRef.current);

      // Fit bounds to circle
      mapInstanceRef.current.fitBounds(circleRef.current.getBounds(), { padding: [20, 20] });
    } else if (markers.length > 0) {
      // Fit to all markers
      const group = L.featureGroup(markers.map(m => L.marker([m.lat, m.lng])));
      mapInstanceRef.current.fitBounds(group.getBounds(), { padding: [40, 40] });
    } else {
      mapInstanceRef.current.setView(center, 4);
    }
  }, [center, radius, markers]);

  // Update markers
  useEffect(() => {
    if (!markersLayerRef.current) return;

    markersLayerRef.current.clearLayers();

    markers.forEach((m) => {
      const marker = L.marker([m.lat, m.lng], {
        icon: createCustomIcon(m.type),
      });

      marker.bindPopup(
        `<div style="font-family: 'Inter', sans-serif; min-width: 120px;">
          <strong style="font-size: 14px;">${m.name}</strong>
          ${m.subtitle ? `<br/><span style="color: #666; font-size: 12px;">${m.subtitle}</span>` : ""}
        </div>`,
        { className: "custom-popup" }
      );

      if (onMarkerClick) {
        marker.on("click", () => onMarkerClick(m.id));
      }

      marker.addTo(markersLayerRef.current!);
    });
  }, [markers, onMarkerClick]);

  return (
    <div className={className}>
      <div ref={mapRef} className="w-full h-full rounded-xl overflow-hidden" />
      <style>{`
        .custom-map-marker { background: transparent !important; border: none !important; }
        .custom-popup .leaflet-popup-content-wrapper {
          background: hsl(220, 18%, 8%);
          color: hsl(0, 0%, 95%);
          border-radius: 12px;
          border: 1px solid hsl(220, 14%, 16%);
          box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        }
        .custom-popup .leaflet-popup-tip { background: hsl(220, 18%, 8%); }
        .leaflet-control-zoom a {
          background: hsl(220, 18%, 8%) !important;
          color: hsl(0, 0%, 95%) !important;
          border-color: hsl(220, 14%, 16%) !important;
        }
        .leaflet-control-zoom a:hover {
          background: hsl(220, 14%, 16%) !important;
        }
      `}</style>
    </div>
  );
};

export default SearchMap;
