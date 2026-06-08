import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function AdminInsuranceRetention() {
  const [days, setDays] = useState<number>(90);
  const [rule, setRule] = useState<string>("on_terminal_status");
  const [rowId, setRowId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("app_settings").select("*").limit(1).maybeSingle();
      if (data) {
        setRowId((data as any).id);
        setDays(Number((data as any).insurance_retention_days ?? 90));
        setRule(String((data as any).insurance_retention_rule ?? "on_terminal_status"));
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    if (!rowId) { toast.error("Configurações ainda não inicializadas."); return; }
    if (days < 1 || days > 3650) { toast.error("Use entre 1 e 3650 dias."); return; }
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .update({ insurance_retention_days: days, insurance_retention_rule: rule } as any)
      .eq("id", rowId);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Política atualizada");
  };

  if (loading) return <div className="p-6">Carregando…</div>;

  return (
    <div className="container mx-auto max-w-2xl p-6 space-y-4">
      <h1 className="text-2xl font-bold">Política de retenção — Seguros</h1>

      <Card>
        <CardHeader><CardTitle>Configuração</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Dias de retenção após expiração</Label>
            <Input type="number" min={1} max={3650} value={days} onChange={(e) => setDays(Number(e.target.value))} />
            <p className="text-xs text-muted-foreground">Anexos serão removidos pelo job <code>insurance-cleanup</code> após esse prazo.</p>
          </div>

          <div className="space-y-1">
            <Label>Regra de expiração</Label>
            <Select value={rule} onValueChange={setRule}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="on_terminal_status">Ao atingir status terminal (aprovado/negado/encerrado)</SelectItem>
                <SelectItem value="on_close_only">Apenas ao encerrar (closed)</SelectItem>
                <SelectItem value="from_creation">A partir da criação do sinistro</SelectItem>
                <SelectItem value="never">Nunca expirar (apenas exclusão manual)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar política"}</Button>
        </CardContent>
      </Card>
    </div>
  );
}
