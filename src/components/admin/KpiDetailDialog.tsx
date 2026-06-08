import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";

export interface KpiDetailRow {
  id: string;
  primary: string;
  secondary?: string;
  status?: string;
  amount?: number;
  date?: string;
  href?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  rows: KpiDetailRow[];
  loading?: boolean;
  groupByStatus?: boolean;
  manageHref?: string;
}

const BRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

export function KpiDetailDialog({
  open, onOpenChange, title, description, rows, loading, groupByStatus, manageHref,
}: Props) {
  const groups: Record<string, KpiDetailRow[]> = {};
  if (groupByStatus) {
    rows.forEach(r => {
      const k = r.status || "—";
      (groups[k] ||= []).push(r);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            <span>{title}</span>
            {manageHref && (
              <Link to={manageHref} className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
                Gerenciar <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-3">
          {loading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Carregando…</div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Nenhum registro no período.</div>
          ) : groupByStatus ? (
            <div className="space-y-4">
              {Object.entries(groups).map(([status, list]) => (
                <div key={status}>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="capitalize">{status}</Badge>
                    <span className="text-xs text-muted-foreground">{list.length}</span>
                  </div>
                  <RowList rows={list} />
                </div>
              ))}
            </div>
          ) : (
            <RowList rows={rows} />
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function RowList({ rows }: { rows: KpiDetailRow[] }) {
  return (
    <ul className="divide-y divide-border">
      {rows.map(r => (
        <li key={r.id} className="py-2 flex items-start justify-between gap-3 text-sm">
          <div className="min-w-0">
            <div className="font-medium truncate">
              {r.href ? <Link to={r.href} className="hover:underline">{r.primary}</Link> : r.primary}
            </div>
            {r.secondary && <div className="text-xs text-muted-foreground truncate">{r.secondary}</div>}
          </div>
          <div className="text-right whitespace-nowrap">
            {r.amount != null && <div className="font-semibold text-emerald-400">{BRL(r.amount)}</div>}
            {r.date && <div className="text-xs text-muted-foreground">{new Date(r.date).toLocaleString("pt-BR")}</div>}
          </div>
        </li>
      ))}
    </ul>
  );
}
