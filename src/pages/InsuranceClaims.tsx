// Módulo 11 — Tela do usuário: abrir e acompanhar sinistros.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function InsuranceClaims() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [description, setDescription] = useState("");
  const [estimated, setEstimated] = useState("");
  const [serviceId, setServiceId] = useState("");

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("insurance_claims")
      .select("*").order("created_at", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function open() {
    if (description.trim().length < 10) return toast.error("Descreva a ocorrência (mín. 10 caracteres).");
    setCreating(true);
    const { data, error } = await supabase.rpc("open_insurance_claim", {
      _description: description.trim(),
      _service_id: serviceId.trim() || null,
      _occurrence_date: new Date().toISOString(),
      _estimated_amount: estimated ? Number(estimated) : null,
    });
    setCreating(false);
    if (error) {
      if (String(error.message).includes("rate_limited"))
        return toast.error("Aguarde antes de abrir outro sinistro.");
      return toast.error(error.message);
    }
    toast.success(`Sinistro aberto — protocolo ${(data as any)?.protocol}`);
    setDescription(""); setEstimated(""); setServiceId("");
    load();
  }

  return (
    <div className="container mx-auto py-8 space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2"><ShieldAlert className="h-6 w-6" /> Seguro contra danos</h1>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-4 w-4" /> Abrir novo sinistro</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Descrição da ocorrência</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
              placeholder="O que aconteceu, quando e onde…" maxLength={2000} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label>Valor estimado (BRL)</Label><Input type="number" min={0} value={estimated} onChange={(e) => setEstimated(e.target.value)} /></div>
            <div><Label>ID do serviço relacionado (opcional)</Label><Input value={serviceId} onChange={(e) => setServiceId(e.target.value)} /></div>
          </div>
          <Button onClick={open} disabled={creating}>{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Abrir sinistro"}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Meus sinistros</CardTitle></CardHeader>
        <CardContent>
          {loading ? <Loader2 className="animate-spin" /> : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum sinistro registrado.</p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((c) => (
                <li key={c.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{c.protocol}</p>
                    <p className="text-sm text-muted-foreground truncate max-w-md">{c.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{c.status}</Badge>
                    <Link to={`/seguros/${c.id}`}><Button size="sm" variant="secondary">Acompanhar</Button></Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
