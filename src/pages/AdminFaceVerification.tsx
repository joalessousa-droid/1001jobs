// Admin: log de tentativas de reconhecimento facial
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function AdminFaceVerification() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("face_verification_attempts")
        .select("*").order("attempt_at", { ascending: false }).limit(200);
      setRows(data ?? []);
      setLoading(false);
    })();
  }, []);

  const totals = rows.reduce((a, r) => {
    a[r.decision] = (a[r.decision] ?? 0) + 1;
    return a;
  }, {} as Record<string, number>);

  const color = (d: string) => d === "approved" ? "bg-green-500/20 text-green-300"
    : d === "review" ? "bg-yellow-500/20 text-yellow-300"
    : d === "blocked" ? "bg-red-500/20 text-red-300" : "bg-muted";

  return (
    <div className="container mx-auto py-8 space-y-4">
      <h1 className="text-2xl font-bold">Reconhecimento Facial — Auditoria</h1>
      <div className="grid grid-cols-4 gap-3">
        {["approved","review","blocked","error"].map((k) => (
          <Card key={k}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground capitalize">{k}</p>
              <p className="text-2xl font-bold">{totals[k] ?? 0}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle>Últimas 200 tentativas</CardTitle></CardHeader>
        <CardContent>
          {loading ? <Loader2 className="animate-spin" /> : (
            <table className="w-full text-sm">
              <thead className="text-muted-foreground border-b">
                <tr>
                  <th className="text-left p-2">Quando</th>
                  <th className="text-left p-2">Contexto</th>
                  <th className="text-right p-2">Similaridade</th>
                  <th className="text-left p-2">Decisão</th>
                  <th className="text-left p-2">IP</th>
                  <th className="text-left p-2">Notas</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-muted/30">
                    <td className="p-2 text-xs">{new Date(r.attempt_at).toLocaleString("pt-BR")}</td>
                    <td className="p-2">{r.context}</td>
                    <td className="text-right p-2">{r.similarity != null ? `${(Number(r.similarity)*100).toFixed(0)}%` : "-"}</td>
                    <td className="p-2"><Badge className={color(r.decision)}>{r.decision}</Badge></td>
                    <td className="p-2 text-xs text-muted-foreground">{r.ip_address ?? "-"}</td>
                    <td className="p-2 text-xs truncate max-w-xs">{r.notes ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
