// Admin: ranking de profissionais (Módulo 6 — fila inteligente)
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";

export default function AdminRanking() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [recomputing, setRecomputing] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("provider_ranking_scores")
      .select("*, profiles!provider_ranking_scores_provider_id_fkey(display_name, city)")
      .order("score_total", { ascending: false })
      .limit(100);
    // Fallback se FK não existir: join manual
    if (!data || data.length === 0) {
      const { data: r2 } = await supabase
        .from("provider_ranking_scores")
        .select("*")
        .order("score_total", { ascending: false })
        .limit(100);
      const ids = (r2 ?? []).map((x: any) => x.provider_id);
      const { data: profs } = await supabase.from("profiles").select("id, display_name, city").in("id", ids);
      const pmap = new Map((profs ?? []).map((p: any) => [p.id, p]));
      setRows((r2 ?? []).map((x: any) => ({ ...x, profiles: pmap.get(x.provider_id) })));
    } else {
      setRows(data);
    }
    setLoading(false);
  }

  async function recompute() {
    setRecomputing(true);
    const { error } = await supabase.rpc("recompute_provider_ranking", { _provider_id: null });
    if (error) toast.error(error.message); else toast.success("Ranking recalculado");
    setRecomputing(false);
    load();
  }

  const filtered = rows.filter((r) =>
    !search || (r.profiles?.display_name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="container mx-auto py-8 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Ranking de Profissionais</h1>
        <Button onClick={recompute} disabled={recomputing}>
          {recomputing ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Recalcular agora
        </Button>
      </div>
      <Input placeholder="Buscar nome..." value={search} onChange={(e) => setSearch(e.target.value)} />
      <Card>
        <CardHeader><CardTitle>Top 100 — Score Total</CardTitle></CardHeader>
        <CardContent>
          {loading ? <Loader2 className="animate-spin" /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-muted-foreground border-b">
                  <tr>
                    <th className="text-left p-2">#</th>
                    <th className="text-left p-2">Profissional</th>
                    <th className="text-right p-2">Total</th>
                    <th className="text-right p-2">Avaliação</th>
                    <th className="text-right p-2">Anti-cancel</th>
                    <th className="text-right p-2">Proximidade</th>
                    <th className="text-right p-2">Especialização</th>
                    <th className="text-right p-2">Recorrência</th>
                    <th className="text-right p-2">Atualizado</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => (
                    <tr key={r.provider_id} className="border-b hover:bg-muted/30">
                      <td className="p-2">{i + 1}</td>
                      <td className="p-2">{r.profiles?.display_name ?? r.provider_id.slice(0,8)}<span className="text-muted-foreground text-xs ml-2">{r.profiles?.city ?? ""}</span></td>
                      <td className="text-right p-2 font-medium">{Number(r.score_total).toFixed(2)}</td>
                      <td className="text-right p-2">{(Number(r.score_rating)*100).toFixed(0)}%</td>
                      <td className="text-right p-2">{(Number(r.score_anti_cancel)*100).toFixed(0)}%</td>
                      <td className="text-right p-2">{(Number(r.score_proximity)*100).toFixed(0)}%</td>
                      <td className="text-right p-2">{(Number(r.score_specialization)*100).toFixed(0)}%</td>
                      <td className="text-right p-2">{(Number(r.score_recurrence)*100).toFixed(0)}%</td>
                      <td className="text-right p-2 text-xs text-muted-foreground">{new Date(r.computed_at).toLocaleString("pt-BR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && <p className="text-muted-foreground p-4">Sem dados. Clique em Recalcular.</p>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
