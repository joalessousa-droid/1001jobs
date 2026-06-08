// Central de Notificações de emergências (Dashboard Executivo)
// - Bulk actions (marcar/excluir selecionados)
// - Filtro "somente não lidas"
// - Paginação incremental (carregar mais)
// - Modal de detalhes com payload completo e dados do prestador
import { useEffect, useMemo, useState } from "react";
import { Siren, CheckCheck, Trash2, MapPin, Filter, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { useEmergencyAlerts, type EmergencyInboxItem } from "@/hooks/useEmergencyAlerts";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const PAGE_SIZE = 20;

export function EmergencyNotificationsCenter() {
  const { items, unread, markRead, markAllRead, markManyRead, removeMany, clearAll } =
    useEmergencyAlerts();

  const [onlyUnread, setOnlyUnread] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<EmergencyInboxItem | null>(null);

  const filtered = useMemo(
    () => (onlyUnread ? items.filter((i) => !i.read) : items),
    [items, onlyUnread],
  );

  // Reset page when filter changes
  useEffect(() => { setPage(1); }, [onlyUnread, items.length === 0]);

  const visible = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = filtered.length > visible.length;

  const allVisibleSelected =
    visible.length > 0 && visible.every((i) => selected.has(i.id));

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  };
  const toggleAllVisible = (checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      visible.forEach((i) => { if (checked) next.add(i.id); else next.delete(i.id); });
      return next;
    });
  };

  const selectedIds = useMemo(
    () => Array.from(selected).filter((id) => items.some((i) => i.id === id)),
    [selected, items],
  );

  const bulkMarkRead = () => {
    if (selectedIds.length === 0) return;
    markManyRead(selectedIds);
    setSelected(new Set());
  };
  const bulkDelete = () => {
    if (selectedIds.length === 0) return;
    removeMany(selectedIds);
    setSelected(new Set());
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="relative gap-2"
            aria-label="Central de notificações de emergência"
          >
            <Siren className="h-4 w-4 text-red-500" />
            <span className="hidden sm:inline">Notificações</span>
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold animate-pulse">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[420px] p-0">
          {/* Header com contador ao vivo */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-sm font-semibold flex items-center gap-2">
              <Siren className="h-4 w-4 text-red-500" /> Emergências
              <Badge variant={unread > 0 ? "destructive" : "outline"} className="h-5 text-[10px]">
                {unread} não lida(s)
              </Badge>
            </span>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                >
                  <CheckCheck className="h-3 w-3" /> Marcar lidas
                </button>
              )}
              {items.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                >
                  <Trash2 className="h-3 w-3" /> Limpar tudo
                </button>
              )}
            </div>
          </div>

          {/* Filtros + bulk toolbar */}
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2 text-xs">
              <Filter className="h-3 w-3 text-muted-foreground" />
              <Switch
                id="only-unread"
                checked={onlyUnread}
                onCheckedChange={setOnlyUnread}
              />
              <Label htmlFor="only-unread" className="cursor-pointer">Somente não lidas</Label>
            </div>
            <div className="flex items-center gap-2 text-xs">
              {visible.length > 0 && (
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <Checkbox
                    checked={allVisibleSelected}
                    onCheckedChange={(v) => toggleAllVisible(!!v)}
                  />
                  <span className="text-muted-foreground">Todos visíveis</span>
                </label>
              )}
            </div>
          </div>

          {selectedIds.length > 0 && (
            <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-border bg-primary/5">
              <span className="text-xs font-medium">{selectedIds.length} selecionada(s)</span>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={bulkMarkRead}>
                  <CheckCheck className="h-3 w-3 mr-1" /> Marcar lidas
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-destructive hover:text-destructive"
                  onClick={bulkDelete}
                >
                  <Trash2 className="h-3 w-3 mr-1" /> Excluir
                </Button>
              </div>
            </div>
          )}

          {/* Lista paginada */}
          <ScrollArea className="max-h-[440px]">
            {filtered.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                {onlyUnread ? "Nenhuma emergência não lida." : "Nenhuma emergência recebida."}
              </div>
            ) : (
              <>
                <ul className="divide-y divide-border">
                  {visible.map((n) => {
                    const isSel = selected.has(n.id);
                    return (
                      <li
                        key={n.id}
                        className={`px-3 py-2.5 hover:bg-accent transition-colors ${
                          isSel ? "bg-primary/5" : ""
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <Checkbox
                            className="mt-1"
                            checked={isSel}
                            onCheckedChange={(v) => toggleOne(n.id, !!v)}
                            aria-label="Selecionar"
                          />
                          <span
                            className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${
                              n.read ? "bg-transparent" : "bg-red-500"
                            }`}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium truncate">
                                SOS {n.protocol || n.id.slice(0, 8)}
                              </p>
                              <Badge
                                variant={n.status === "open" ? "destructive" : "outline"}
                                className="text-[10px] h-5"
                              >
                                {n.status}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {n.role ? `${n.role} · ` : ""}
                              {formatDistanceToNow(new Date(n.triggered_at), {
                                addSuffix: true,
                                locale: ptBR,
                              })}
                            </p>
                            <div className="flex items-center gap-3 mt-1 text-[11px]">
                              <button
                                onClick={() => setDetail(n)}
                                className="text-primary hover:underline inline-flex items-center gap-1"
                              >
                                <Eye className="h-3 w-3" /> Detalhes
                              </button>
                              <Link
                                to="/admin/emergencias"
                                className="text-primary hover:underline"
                              >
                                Abrir central
                              </Link>
                              {n.latitude != null && n.longitude != null && (
                                <a
                                  href={`https://www.google.com/maps?q=${n.latitude},${n.longitude}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                                >
                                  <MapPin className="h-3 w-3" /> mapa
                                </a>
                              )}
                              {!n.read && (
                                <button
                                  onClick={() => markRead(n.id)}
                                  className="text-muted-foreground hover:text-foreground ml-auto"
                                >
                                  marcar lida
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {hasMore && (
                  <div className="p-2 border-t border-border">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Carregar mais ({filtered.length - visible.length} restantes)
                    </Button>
                  </div>
                )}
                <div className="px-3 py-1.5 text-[10px] text-muted-foreground text-center border-t border-border">
                  Mostrando {visible.length} de {filtered.length}
                </div>
              </>
            )}
          </ScrollArea>
        </DropdownMenuContent>
      </DropdownMenu>

      <EmergencyDetailDialog
        item={detail}
        onOpenChange={(o) => !o && setDetail(null)}
        onMarkRead={(id) => { markRead(id); setDetail(null); }}
      />
    </>
  );
}

// ── Modal de detalhes ────────────────────────────────────────────────
function EmergencyDetailDialog({
  item, onOpenChange, onMarkRead,
}: {
  item: EmergencyInboxItem | null;
  onOpenChange: (open: boolean) => void;
  onMarkRead: (id: string) => void;
}) {
  const [payload, setPayload] = useState<any | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!item) { setPayload(null); setProfile(null); return; }
    let active = true;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("emergency_alerts")
        .select("*")
        .eq("id", item.id)
        .maybeSingle();
      if (!active) return;
      setPayload(data);
      if (data?.user_id) {
        const { data: p } = await supabase
          .from("profiles")
          .select("id, display_name, user_type, phone, city, state, avatar_url")
          .eq("user_id", data.user_id)
          .maybeSingle();
        if (active) setProfile(p);
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [item]);

  if (!item) return null;

  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Siren className="h-5 w-5 text-red-500" />
            SOS {item.protocol || item.id.slice(0, 8)}
            <Badge variant={item.status === "open" ? "destructive" : "outline"}>
              {item.status}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Disparado{" "}
            {formatDistanceToNow(new Date(item.triggered_at), {
              addSuffix: true, locale: ptBR,
            })}{" "}
            · {new Date(item.triggered_at).toLocaleString("pt-BR")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Prestador / usuário */}
          <section>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
              Usuário / Prestador
            </h4>
            {loading && !profile ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : profile ? (
              <div className="rounded-md border p-3 text-sm space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{profile.display_name || "—"}</span>
                  <Badge variant="outline">{profile.user_type || "—"}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {[profile.city, profile.state].filter(Boolean).join(" / ") || "Sem localidade"}
                </p>
                {profile.phone && <p className="text-xs">📞 {profile.phone}</p>}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Perfil não encontrado{payload?.user_id ? ` (${payload.user_id.slice(0, 8)})` : ""}.
              </p>
            )}
          </section>

          {/* Localização */}
          {item.latitude != null && item.longitude != null && (
            <section>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                Localização
              </h4>
              <a
                href={`https://www.google.com/maps?q=${item.latitude},${item.longitude}`}
                target="_blank" rel="noreferrer"
                className="text-sm text-primary hover:underline inline-flex items-center gap-1"
              >
                <MapPin className="h-3 w-3" />
                {Number(item.latitude).toFixed(5)}, {Number(item.longitude).toFixed(5)}
              </a>
            </section>
          )}

          {/* Payload completo */}
          <section>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
              Payload do evento
            </h4>
            <pre className="text-[11px] bg-muted rounded-md p-3 overflow-x-auto max-h-64">
{JSON.stringify(payload ?? item, null, 2)}
            </pre>
          </section>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t">
          <Link
            to="/admin/emergencias"
            className="text-sm text-primary hover:underline"
          >
            Abrir central completa →
          </Link>
          {!item.read && (
            <Button size="sm" onClick={() => onMarkRead(item.id)}>
              <CheckCheck className="h-4 w-4 mr-1" /> Marcar como lida
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
