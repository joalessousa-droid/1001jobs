// Página do profissional: ofertas ativas + histórico + KPIs
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

export default function ProviderOffers() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<any>(null);
  const [active, setActive] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("provider-offers")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "service_offers" },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function load() {
    const { data: m } = await supabase.rpc("get_my_offer_metrics");
    setMetrics(m);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setLoading(false); return; }
    const { data: prof } = await supabase.from("profiles").select("id").eq("user_id", u.user.id).maybeSingle();
    if (!prof) { setLoading(false); return; }
    const { data: act } = await supabase.from("service_offers")
      .select("*").eq("provider_id", prof.id)
      .in("status", ["pending","queued"])
      .order("offered_at", { ascending: false });
    setActive(act ?? []);
    const { data: hist } = await supabase.rpc("get_my_offer_history", {});
    setHistory(hist ?? []);
    setLoading(false);
  }

  const fmtTime = (offered: string, expires: string) => {
    const now = Date.now();
    const exp = new Date(expires).getTime();
    const left = Math.max(0, Math.floor((exp - now) / 1000));
    return left;
  };

  const color = (s: string) => ({
    pending: "bg-blue-500/20 text-blue-300",
    accepted: "bg-green-500/20 text-green-300",
    declined: "bg-red-500/20 text-red-300",
    expired: "bg-muted text-muted-foreground",
    superseded: "bg-muted text-muted-foreground",
    queued: "bg-yellow-500/20 text-yellow-300",
  } as Record<string,string>)[s] ?? "bg-muted";

  if (loading) return <div className="p-8"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="container mx-auto py-8 space-y-6">
      <h1 className="text-2xl font-bold">Minhas Ofertas</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Total (30d)</p>
          <p className="text-2xl font-bold">{metrics?.total_offers ?? 0}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Aceite</p>
          <p className="text-2xl font-bold">{((metrics?.acceptance_rate ?? 0)*100).toFixed(0)}%</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Tempo médio</p>
          <p className="text-2xl font-bold">{Number(metrics?.avg_response_seconds ?? 0).toFixed(1)}s</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Expiradas</p>
          <p className="text-2xl font-bold">{metrics?.expired ?? 0}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Ofertas ativas</CardTitle></CardHeader>
        <CardContent>
          {active.length === 0 ? <p className="text-muted-foreground">Nenhuma oferta ativa.</p> : (
            <div className="space-y-2">
              {active.map((o) => (
                <div key={o.id} className="p-3 rounded border flex items-center justify-between">
                  <div>
                    <Badge className={color(o.status)}>{o.status}</Badge>
                    <p className="text-sm mt-1">Oferta #{o.id.slice(0,8)}</p>
                    <p className="text-xs text-muted-foreground">Score {Number(o.match_score ?? 0).toFixed(1)}</p>
                  </div>
                  {o.status === "pending" && (
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">expira em</p>
                      <p className="text-2xl font-bold tabular-nums">{fmtTime(o.offered_at, o.expires_at)}s</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Histórico (30 dias)</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-muted-foreground border-b">
              <tr>
                <th className="text-left p-2">Quando</th>
                <th className="text-left p-2">Status</th>
                <th className="text-right p-2">Score</th>
                <th className="text-right p-2">Resp. (s)</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-b hover:bg-muted/30">
                  <td className="p-2 text-xs">{new Date(h.offered_at).toLocaleString("pt-BR")}</td>
                  <td className="p-2"><Badge className={color(h.status)}>{h.status}</Badge></td>
                  <td className="text-right p-2">{Number(h.match_score ?? 0).toFixed(1)}</td>
                  <td className="text-right p-2">
                    {h.responded_at ? Math.round((new Date(h.responded_at).getTime() - new Date(h.offered_at).getTime())/1000) : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
