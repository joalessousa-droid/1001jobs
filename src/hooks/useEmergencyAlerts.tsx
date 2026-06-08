// Realtime inbox de emergências com debounce/agrupamento + preferências
// por canal (badge/toast/ambos) e por tipo (role).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface EmergencyInboxItem {
  id: string;
  protocol: string | null;
  status: string;
  role?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  triggered_at: string;
  received_at: string;
  read: boolean;
}

export type EmergencyChannel = "badge" | "toast" | "both";

export interface EmergencyPrefs {
  channel: EmergencyChannel;
  // Mapa role -> habilitado. Roles não listados são considerados habilitados.
  types: Record<string, boolean>;
}

const STORAGE_KEY = "exec.emergencyInbox.v1";
const PREFS_KEY = "exec.emergencyInbox.prefs.v1";
const MAX_ITEMS = 200;
const DEBOUNCE_MS = 1500;

const DEFAULT_PREFS: EmergencyPrefs = { channel: "both", types: {} };

function load(): EmergencyInboxItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as EmergencyInboxItem[];
  } catch {
    return [];
  }
}
function persist(items: EmergencyInboxItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch { /* quota */ }
}
function loadPrefs(): EmergencyPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch { return DEFAULT_PREFS; }
}
function persistPrefs(p: EmergencyPrefs) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* noop */ }
}

function typeEnabled(prefs: EmergencyPrefs, role?: string | null): boolean {
  const key = role || "__unknown";
  return prefs.types[key] !== false; // default true
}

export function useEmergencyAlerts() {
  const [items, setItems] = useState<EmergencyInboxItem[]>(() => load());
  const [prefs, setPrefsState] = useState<EmergencyPrefs>(() => loadPrefs());
  const prefsRef = useRef(prefs);
  useEffect(() => { prefsRef.current = prefs; }, [prefs]);

  const pendingRef = useRef<EmergencyInboxItem[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastToastIdRef = useRef<string | number | null>(null);

  const setPrefs = useCallback((updater: EmergencyPrefs | ((p: EmergencyPrefs) => EmergencyPrefs)) => {
    setPrefsState((prev) => {
      const next = typeof updater === "function" ? (updater as any)(prev) : updater;
      persistPrefs(next);
      return next;
    });
  }, []);

  const flush = useCallback(() => {
    const batch = pendingRef.current;
    pendingRef.current = [];
    timerRef.current = null;
    if (batch.length === 0) return;
    const p = prefsRef.current;

    // Sempre agrega no inbox (histórico), exceto se canal = toast somente
    if (p.channel !== "toast") {
      setItems((prev) => {
        const map = new Map(prev.map((i) => [i.id, i]));
        for (const it of batch) if (!map.has(it.id)) map.set(it.id, it);
        const merged = Array.from(map.values()).sort(
          (a, b) => +new Date(b.triggered_at) - +new Date(a.triggered_at),
        );
        const trimmed = merged.slice(0, MAX_ITEMS);
        persist(trimmed);
        return trimmed;
      });
    }

    // Toast somente se canal incluir toast
    if (p.channel === "toast" || p.channel === "both") {
      const head = batch[0];
      const more = batch.length - 1;
      const title =
        batch.length === 1
          ? `Nova emergência ${head.protocol || ""}`.trim()
          : `${batch.length} novas emergências`;
      const description =
        batch.length === 1
          ? "Clique para abrir a central."
          : `Mais recente: ${head.protocol || head.id.slice(0, 8)}${more ? ` (+${more})` : ""}`;
      if (lastToastIdRef.current != null) {
        try { toast.dismiss(lastToastIdRef.current); } catch { /* noop */ }
      }
      lastToastIdRef.current = toast.error(title, {
        description,
        action: {
          label: "Abrir",
          onClick: () => window.location.assign("/admin/emergencias"),
        },
      });
    }
  }, []);

  const enqueue = useCallback((row: any) => {
    const item: EmergencyInboxItem = {
      id: String(row.id),
      protocol: row.protocol ?? null,
      status: row.status ?? "open",
      role: row.role ?? null,
      latitude: row.latitude ?? null,
      longitude: row.longitude ?? null,
      triggered_at: row.triggered_at ?? new Date().toISOString(),
      received_at: new Date().toISOString(),
      read: false,
    };
    // Filtra por tipo conforme preferência
    if (!typeEnabled(prefsRef.current, item.role)) return;
    if (pendingRef.current.find((p) => p.id === item.id)) return;
    pendingRef.current.push(item);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, DEBOUNCE_MS);
  }, [flush]);

  useEffect(() => {
    const ch = supabase
      .channel("emergency-inbox")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "emergency_alerts" },
        (payload) => enqueue(payload.new),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "emergency_alerts" },
        (payload) => {
          const row = payload.new as any;
          setItems((prev) => {
            if (!prev.some((i) => i.id === row.id)) return prev;
            const next = prev.map((i) =>
              i.id === row.id ? { ...i, status: row.status ?? i.status } : i,
            );
            persist(next);
            return next;
          });
        },
      )
      .subscribe();

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setItems(load());
      if (e.key === PREFS_KEY) setPrefsState(loadPrefs());
    };
    window.addEventListener("storage", onStorage);

    return () => {
      supabase.removeChannel(ch);
      window.removeEventListener("storage", onStorage);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enqueue]);

  const unread = useMemo(() => items.filter((i) => !i.read).length, [items]);

  // Lista de roles conhecidos (para UI de preferências)
  const knownRoles = useMemo(() => {
    const set = new Set<string>();
    for (const i of items) if (i.role) set.add(i.role);
    for (const k of Object.keys(prefs.types)) if (k !== "__unknown") set.add(k);
    return Array.from(set).sort();
  }, [items, prefs.types]);

  const markRead = useCallback((id: string) => {
    setItems((prev) => {
      const next = prev.map((i) => (i.id === id ? { ...i, read: true } : i));
      persist(next);
      return next;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setItems((prev) => {
      const next = prev.map((i) => ({ ...i, read: true }));
      persist(next);
      return next;
    });
  }, []);

  const markManyRead = useCallback((ids: string[]) => {
    const set = new Set(ids);
    setItems((prev) => {
      const next = prev.map((i) => (set.has(i.id) ? { ...i, read: true } : i));
      persist(next);
      return next;
    });
  }, []);

  const removeMany = useCallback((ids: string[]) => {
    const set = new Set(ids);
    setItems((prev) => {
      const next = prev.filter((i) => !set.has(i.id));
      persist(next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setItems([]);
    persist([]);
  }, []);

  return {
    items, unread, knownRoles,
    prefs, setPrefs,
    markRead, markAllRead, markManyRead, removeMany, clearAll,
  };
}
