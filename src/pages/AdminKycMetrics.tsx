// Admin: métricas de KYC com filtros.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, BarChart3 } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function AdminKycMetrics() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cities, setCities] = useState<string[]>([]);
  const [city, setCity] = useState<string>("");
  const today = new Date();
  const [from, setFrom] = useState(() => {
    const d = new Date(today); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => today.toISOString().slice(0, 10));

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_kyc_metrics", {
      _from: new Date(from).toISOString(),
      _to: new Date(to + "T23:59:59").toISOString(),
      _city: city || null,
    });
    if (!error) setData(data);
    setLoading(false);
  }

  useEffect(() => {
    supabase.from("profiles").select("city").not("city", "is", null).limit(1000)
      .then(({ data }) => {
        const uniq = Array.from(new Set((data ?? []).map((r: any) => r.city).filter(Boolean))).sort();
        setCities(uniq as string[]);
      });
    load();
  }, []);

  const totals = data?.totals ?? {};
  const daily = useMemo(() => (data?.daily ?? []).map((d: any) => ({ ...d, day: d.day?.slice(5) })), [data]);
  const reasons = data?.top_rejection_reasons ?? [];
  const categories = data?.by_category ?? [];
  const byCity = data?.by_city ?? [];

  const CAT_LABEL: Record<string, string> = {
    ocr_inconclusive: "OCR inconclusivo",
    cpf_irregular: "CPF irregular",
    name_cpf_mismatch: "Divergência CPF/nome",
    face_mismatch: "Biometria divergente",
    document_invalid: "Documento inválido",
    other: "Outro",
  };

  async function exportCsv() {
    const { data: rows, error } = await supabase.rpc("export_kyc_decisions", {
      _from: new Date(from).toISOString(),
      _to: new Date(to + "T23:59:59").toISOString(),
      _city: city || null,
    });
    if (error) return alert("Falha ao exportar: " + error.message);
    const cols = ["created_at","submission_id","user_id","operator_id","from_status","to_status","rejection_category","reason","city"];
    const csv = [cols.join(",")].concat((rows ?? []).map((r: any) =>
      cols.map((c) => {
        const v = (r as any)[c] ?? "";
        const s = String(v).replace(/"/g, '""');
        return /[",\n]/.test(s) ? `"${s}"` : s;
      }).join(",")
    )).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `kyc-decisoes-${from}-a-${to}${city ? "-" + city : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  const byCity = data?.by_city ?? [];

  return (
    <div className="container mx-auto py-8 space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="h-6 w-6" /> Métricas de KYC</h1>

      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div><Label>De</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><Label>Até</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div>
            <Label>Cidade</Label>
            <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={city} onChange={(e) => setCity(e.target.value)}>
              <option value="">Todas</option>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex items-end"><Button onClick={load} className="w-full">Aplicar</Button></div>
        </CardContent>
      </Card>

      {loading ? <Loader2 className="animate-spin" /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {[
              ["Total", totals.total ?? 0],
              ["Em análise", totals.in_review ?? 0],
              ["Aprovados", totals.approved ?? 0],
              ["Reprovados", totals.rejected ?? 0],
              ["Taxa aprov.", `${Math.round((totals.approval_rate ?? 0) * 100)}%`],
              ["Tempo médio", `${Math.round((totals.avg_review_seconds ?? 0) / 60)} min`],
            ].map(([k, v]) => (
              <Card key={k as string}><CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{k}</p>
                <p className="text-2xl font-bold">{v as any}</p>
              </CardContent></Card>
            ))}
          </div>

          <Card>
            <CardHeader><CardTitle>Evolução diária</CardTitle></CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={daily}>
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  <Bar dataKey="submitted" fill="hsl(var(--muted-foreground))" name="Enviados" />
                  <Bar dataKey="approved" fill="#22c55e" name="Aprovados" />
                  <Bar dataKey="rejected" fill="#ef4444" name="Reprovados" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Card>
              <CardHeader><CardTitle>Top motivos de reprovação</CardTitle></CardHeader>
              <CardContent>
                {reasons.length === 0 && <p className="text-sm text-muted-foreground">Sem dados.</p>}
                <ul className="space-y-1">
                  {reasons.map((r: any, i: number) => (
                    <li key={i} className="flex justify-between text-sm border-b border-border py-1">
                      <span className="truncate">{r.reason}</span><span className="font-medium">{r.count}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Por cidade</CardTitle></CardHeader>
              <CardContent>
                {byCity.length === 0 && <p className="text-sm text-muted-foreground">Sem dados.</p>}
                <ul className="space-y-1">
                  {byCity.slice(0, 20).map((r: any, i: number) => (
                    <li key={i} className="grid grid-cols-4 text-sm border-b border-border py-1">
                      <span className="truncate col-span-2">{r.city}</span>
                      <span className="text-right">{r.approved}/{r.total}</span>
                      <span className="text-right text-red-400">-{r.rejected}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
