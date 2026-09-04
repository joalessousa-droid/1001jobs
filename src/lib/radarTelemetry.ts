/**
 * Telemetria de isolamento do Radar Ao Vivo.
 *
 * Registra, por tela, quantos itens de origem "radar" foram removidos de
 * listas, contadores e notificações fora da área do Radar. Serve para
 * auditoria e depuração — nada é enviado para fora do navegador.
 */

export interface RadarFilterEvent {
  /** Tela/contexto onde a filtragem aconteceu (ex.: "recent-tasks"). */
  screen: string;
  /** Tipo do que foi filtrado. */
  kind: "requests" | "notifications";
  /** Total recebido antes do filtro. */
  received: number;
  /** Quantidade removida por ser do Radar. */
  filtered: number;
  /** Timestamp ISO do evento. */
  at: string;
}

const STORAGE_KEY = "radar_filter_telemetry_v1";
const MAX_EVENTS = 200;

const counters = new Map<string, number>();
const events: RadarFilterEvent[] = [];

const key = (screen: string, kind: RadarFilterEvent["kind"]) => `${kind}:${screen}`;

const persist = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
  } catch {
    /* storage indisponível (modo privado / SSR) */
  }
};

/** Registra uma filtragem de itens do Radar fora da área do Radar. */
export const trackRadarFiltered = (
  screen: string,
  kind: RadarFilterEvent["kind"],
  received: number,
  filtered: number,
): RadarFilterEvent | null => {
  if (filtered <= 0) return null;

  const k = key(screen, kind);
  counters.set(k, (counters.get(k) ?? 0) + filtered);

  const event: RadarFilterEvent = {
    screen,
    kind,
    received,
    filtered,
    at: new Date().toISOString(),
  };
  events.push(event);
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
  persist();

  if (typeof console !== "undefined") {
    console.debug(
      `[radar-isolation] ${kind} filtrados em "${screen}": ${filtered}/${received} (acumulado: ${counters.get(k)})`,
    );
  }
  return event;
};

/** Contagem acumulada por tela (chave "kind:screen"). */
export const getRadarFilterCounters = (): Record<string, number> =>
  Object.fromEntries(counters.entries());

/** Últimos eventos registrados nesta sessão. */
export const getRadarFilterEvents = (): RadarFilterEvent[] => [...events];

/** Limpa contadores e histórico (usado em testes e no painel de depuração). */
export const resetRadarFilterTelemetry = () => {
  counters.clear();
  events.length = 0;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
};
