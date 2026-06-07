import { useEffect, useRef } from "react";
import { useGoogleMaps, decodePolyline } from "@/hooks/useGoogleMaps";
import { Loader2 } from "lucide-react";

interface Props {
  providerLocation: { latitude: number; longitude: number } | null;
  destination: { lat: number; lng: number } | null;
  polyline?: string | null;
  className?: string;
  providerLabel?: string;
}

const LiveTrackingMap = ({ providerLocation, destination, polyline, className, providerLabel = "Profissional" }: Props) => {
  const { ready, error } = useGoogleMaps();
  const mapRef = useRef<HTMLDivElement | null>(null);
  const map = useRef<any>(null);
  const providerMarker = useRef<any>(null);
  const destMarker = useRef<any>(null);
  const polylineRef = useRef<any>(null);

  // Initialize map
  useEffect(() => {
    if (!ready || !mapRef.current || map.current) return;
    const g = (window as any).google;
    const center = providerLocation
      ? { lat: providerLocation.latitude, lng: providerLocation.longitude }
      : destination ?? { lat: -23.55, lng: -46.63 };
    map.current = new g.maps.Map(mapRef.current, {
      center, zoom: 14,
      disableDefaultUI: true, zoomControl: true,
      styles: [{ elementType: "labels.icon", stylers: [{ visibility: "off" }] }],
    });
  }, [ready, providerLocation, destination]);

  // Provider marker
  useEffect(() => {
    if (!ready || !map.current || !providerLocation) return;
    const g = (window as any).google;
    const pos = { lat: providerLocation.latitude, lng: providerLocation.longitude };
    if (!providerMarker.current) {
      providerMarker.current = new g.maps.Marker({
        map: map.current, position: pos, title: providerLabel,
        icon: {
          path: g.maps.SymbolPath.CIRCLE,
          scale: 9, fillColor: "#2563EB", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2,
        },
      });
    } else providerMarker.current.setPosition(pos);
  }, [ready, providerLocation, providerLabel]);

  // Destination marker
  useEffect(() => {
    if (!ready || !map.current || !destination) return;
    const g = (window as any).google;
    if (!destMarker.current) {
      destMarker.current = new g.maps.Marker({
        map: map.current, position: destination, title: "Destino",
      });
    } else destMarker.current.setPosition(destination);
  }, [ready, destination]);

  // Route polyline
  useEffect(() => {
    if (!ready || !map.current) return;
    const g = (window as any).google;
    if (polylineRef.current) { polylineRef.current.setMap(null); polylineRef.current = null; }
    if (!polyline) return;
    const path = decodePolyline(polyline);
    polylineRef.current = new g.maps.Polyline({
      path, geodesic: true, strokeColor: "#2563EB", strokeOpacity: 0.85, strokeWeight: 5, map: map.current,
    });
    const bounds = new g.maps.LatLngBounds();
    path.forEach((p) => bounds.extend(p));
    if (providerLocation) bounds.extend({ lat: providerLocation.latitude, lng: providerLocation.longitude });
    if (destination) bounds.extend(destination);
    map.current.fitBounds(bounds, 40);
  }, [ready, polyline, providerLocation, destination]);

  if (error) {
    return <div className={`flex items-center justify-center text-sm text-destructive p-6 ${className ?? ""}`}>{error}</div>;
  }
  return (
    <div className={`relative ${className ?? ""}`}>
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/20 z-10">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}
      <div ref={mapRef} className="w-full h-full rounded-2xl overflow-hidden" />
    </div>
  );
};

export default LiveTrackingMap;
