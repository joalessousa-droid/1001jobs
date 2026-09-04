/**
 * Isolamento das tarefas do Radar Ao Vivo.
 *
 * Tarefas criadas pelo Radar (origin = "radar") não devem aparecer em
 * "Tarefas Recentes", nas listas de busca, no painel de demandas ou no
 * sino de notificações — elas vivem apenas dentro da área do Radar.
 */

import { trackRadarFiltered } from "./radarTelemetry";

export const RADAR_ORIGIN = "radar";
export const STANDARD_ORIGIN = "standard";

export interface OriginAware {
  origin?: string | null;
}

/** Verdadeiro quando a solicitação nasceu no Radar Ao Vivo. */
export const isRadarRequest = (row: OriginAware | null | undefined): boolean =>
  (row?.origin ?? STANDARD_ORIGIN) === RADAR_ORIGIN;

/** Remove tarefas do Radar de qualquer lista pública/convencional. */
export const excludeRadarRequests = <T extends OriginAware>(
  rows: T[] | null | undefined,
  screen?: string,
): T[] => {
  const all = rows ?? [];
  const kept = all.filter((r) => !isRadarRequest(r));
  if (screen) trackRadarFiltered(screen, "requests", all.length, all.length - kept.length);
  return kept;
};


export interface NotificationLike {
  type?: string | null;
  link?: string | null;
  metadata?: any;
}

/** Notificações geradas pelo fluxo do Radar (ofertas, preços, despacho). */
export const isRadarNotification = (n: NotificationLike | null | undefined): boolean => {
  if (!n) return false;
  const type = (n.type ?? "").toLowerCase();
  if (type.startsWith("radar") || type.includes("service_offer") || type.includes("radar_")) return true;
  const meta = n.metadata ?? {};
  if (meta?.origin === RADAR_ORIGIN || meta?.source === RADAR_ORIGIN || meta?.radar === true) return true;
  const link = (n.link ?? "").toLowerCase();
  return link.startsWith("/radar");
};

/** Notificações exibidas fora do Radar (sino global, badges do painel). */
export const excludeRadarNotifications = <T extends NotificationLike>(
  items: T[] | null | undefined,
  screen?: string,
): T[] => {
  const all = items ?? [];
  const kept = all.filter((n) => !isRadarNotification(n));
  if (screen) trackRadarFiltered(screen, "notifications", all.length, all.length - kept.length);
  return kept;
};

/** Notificações que só devem aparecer dentro do Radar Ao Vivo. */
export const onlyRadarNotifications = <T extends NotificationLike>(
  items: T[] | null | undefined
): T[] => (items ?? []).filter((n) => isRadarNotification(n));
