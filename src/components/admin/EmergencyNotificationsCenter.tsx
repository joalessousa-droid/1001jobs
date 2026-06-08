// Central de Notificações de emergências para o Dashboard Executivo.
import { Siren, CheckCheck, Trash2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useEmergencyAlerts } from "@/hooks/useEmergencyAlerts";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";

export function EmergencyNotificationsCenter() {
  const { items, unread, markRead, markAllRead, clearAll } = useEmergencyAlerts();

  return (
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
      <DropdownMenuContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-sm font-semibold flex items-center gap-2">
            <Siren className="h-4 w-4 text-red-500" /> Emergências
            {unread > 0 && (
              <Badge variant="destructive" className="h-5 text-[10px]">
                {unread} nova(s)
              </Badge>
            )}
          </span>
          <div className="flex items-center gap-1">
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
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 ml-2"
              >
                <Trash2 className="h-3 w-3" /> Limpar
              </button>
            )}
          </div>
        </div>
        <ScrollArea className="max-h-[420px]">
          {items.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Nenhuma emergência recebida.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => (
                <li
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  className="px-3 py-2.5 hover:bg-accent transition-colors cursor-pointer"
                >
                  <div className="flex items-start gap-2">
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
                        <Link
                          to="/admin/emergencias"
                          className="text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Abrir na central
                        </Link>
                        {n.latitude != null && n.longitude != null && (
                          <a
                            href={`https://www.google.com/maps?q=${n.latitude},${n.longitude}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MapPin className="h-3 w-3" /> mapa
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
