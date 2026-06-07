---
name: Tracking Module (Phase 1 — Uberization)
description: Realtime location, ETA and live map for accepted/in-progress services. Google Maps via Lovable connector. Tables provider_locations, provider_location_history, service_tracking with realtime publication.
type: feature
---
Live tracking is enabled for services in status `accepted` or `in_progress`.

- Providers opt in via `LocationSharingToggle`; hook `useProviderLocationSharing` upserts to `provider_locations` every 5s and appends to `provider_location_history`.
- Clients open `/servico/:serviceId/rastreio`. The page subscribes to provider_locations + service_tracking realtime via `useServiceTracking`.
- Destination is set by the provider on first open. Hook then triggers edge function `compute-eta` which calls Google Routes API through the connector gateway and writes ETA/distance/polyline to `service_tracking` (throttled to 30s).
- Map uses Google Maps JS API (`useGoogleMaps`), browser key from `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY`. Marker + polyline via legacy `google.maps.Marker` (no mapId).
- Access control: peer can read provider position only when `is_active_service_peer()` returns true (active service with same provider) OR the provider explicitly set `is_public=true`.
- The `/servico/:id/rastreio` route lives in `App.tsx`. The "Acompanhar" button in `ServiceCard` opens it.

Future phases (not yet built): geofencing, route history viewer, surge pricing, AI auto-dispatch radius.
