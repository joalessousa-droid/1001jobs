// Módulo 12 — Central administrativa de SOS.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Siren } from "lucide-react";
import { toast } from "sonner";

export default function AdminEmergency() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("open");

  async function load() {
    setLoading(true);
    const q = supabase.from("emergency_alerts").select("*").order("triggered_at", { ascending: false }).limit(200);
    const { data } = filter ? await q.eq("status", filter as any) : await q;
    setItems(data ?? []);
    setLoading(false);

    // realtime: novos alertas
    const ch = supabase.channel("emergency_alerts_live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "emergency_alerts" },
        (payload) => setItems((prev) => [payload.new as any, ...prev]))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }
  useEffect(() => { const c = load(); return () => { (c as any)?.then?.((fn: any) => fn?.()); }; }, [filter]);

  const counts = useMemo(() => {
    const by: Record<string, number> = { open: 0, acknowledged: 0, closed: 0 };
    for (const a of items) by[a.status] = (by[a.status] ?? 0) + 1;
    return by;
  }, [items]);

  async function update(a: any, status: string) {
    const { data: u } = await supabase.auth.getUser();
    const patch: any = { status };
    if (status === "acknowledged") { patch.acknowledged_by = u?.user?.id; patch.acknowledged_at = new Date().toISOString(); }
    if (status === "closed") { patch.closed_by = u?.user?.id; patch.closed_at = new Date().toISOString(); }
    const { error } = await supabase.from("emergency_alerts").update(patch).eq("id", a.id);
    if (error) return toast.error(error.message);
    toast.success("Atualizado");
    load();
  }

  return (
    <div className="container mx-auto py-8 space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2"><Siren className="h-6 w-6 text-red-500" /> Central de emergências</h1>

      <div className="grid grid-cols-3 gap-3">
        {Object.entries(counts).map(([k, v]) => (
          <Card key={k}><CardContent className="p-3">
            <p className="text-xs text-muted-foreground">{k}</p>
            <p className="text-2xl font-bold">{v}</p>
          </CardContent></Card>
        ))}
      </div>

      <div className="flex items-center gap-2">
        {["open","acknowledged","closed",""].map((s) => (
          <Button key={s} size="sm" variant={filter === s ? "default" : "outline"} onClick={() => setFilter(s)}>
            {s || "Todos"}
          </Button>
        ))}
      </div>

      {loading ? <Loader2 className="animate-spin" /> : (
        <div className="space-y-3">
          {items.map((a) => (
            <Card key={a.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2">
                    <Siren className="h-4 w-4 text-red-500" /> {a.protocol}
                  </span>
                  <Badge variant={a.status === "open" ? "destructive" : "outline"}>{a.status}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <p><b>Papel:</b> {a.role} · <b>Hora:</b> {new Date(a.triggered_at).toLocaleString()}</p>
                <p><b>Usuário:</b> {a.user_id}</p>
                {a.latitude != null && (
                  <p>
                    <b>Local:</b> {a.latitude.toFixed(5)}, {a.longitude.toFixed(5)}
                    {a.accuracy_meters ? ` (±${a.accuracy_meters}m)` : ""}{" "}
                    <a className="underline text-primary" target="_blank" rel="noreferrer"
                       href={`https://www.google.com/maps?q=${a.latitude},${a.longitude}`}>abrir mapa</a>
                  </p>
                )}
                <div className="flex gap-2 pt-2">
                  {a.status === "open" && <Button size="sm" onClick={() => update(a, "acknowledged")}>Reconhecer</Button>}
                  {a.status !== "closed" && <Button size="sm" variant="outline" onClick={() => update(a, "closed")}>Fechar</Button>}
                </div>
              </CardContent>
            </Card>
          ))}
          {items.length === 0 && <p className="text-sm text-muted-foreground">Nenhum alerta no filtro atual.</p>}
        </div>
      )}
    </div>
  );
}
