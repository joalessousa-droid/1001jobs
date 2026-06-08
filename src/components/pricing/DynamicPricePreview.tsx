import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";

type Breakdown = {
  multiplier: number; base_price: number; final_price: number;
  breakdown: Record<string, { factor: number; weight: number; count?: number; online?: number; hour?: number; dow?: number; city?: string; level?: string }>;
  limits: { min: number; max: number };
};

interface Props {
  basePrice: number;
  categoryId?: string | null;
  city?: string | null;
  urgency?: "low" | "normal" | "high" | "critical";
}

export function DynamicPricePreview({ basePrice, categoryId, city, urgency = "normal" }: Props) {
  const [data, setData] = useState<Breakdown | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("calculate_dynamic_price" as any, {
        _base_price: basePrice, _category_id: categoryId ?? null,
        _city: city ?? null, _urgency: urgency,
      });
      if (!cancel && !error) setData(data as unknown as Breakdown);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [basePrice, categoryId, city, urgency]);

  if (loading) return <Card><CardContent className="p-4 text-sm text-muted-foreground">Calculando preço…</CardContent></Card>;
  if (!data) return null;

  const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const mult = data.multiplier;
  const variant = mult > 1.15 ? "destructive" : mult < 0.95 ? "secondary" : "default";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          Preço dinâmico transparente <Info className="h-3 w-3 text-muted-foreground" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-xs text-muted-foreground line-through">{fmtBRL(data.base_price)}</div>
            <div className="text-2xl font-bold">{fmtBRL(data.final_price)}</div>
          </div>
          <Badge variant={variant as any}>×{mult.toFixed(2)}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          {Object.entries(data.breakdown).map(([k, v]) => (
            <div key={k} className="rounded border p-2">
              <div className="font-medium capitalize">{k}</div>
              <div className="text-muted-foreground">
                fator ×{Number(v.factor).toFixed(2)} · peso {Number(v.weight).toFixed(2)}
              </div>
              <div className="text-muted-foreground">
                {k === "demand" && `${v.count ?? 0} pedidos (60min)`}
                {k === "supply" && `${v.online ?? 0} pros online`}
                {k === "time" && `h${v.hour}, dow${v.dow}`}
                {k === "region" && (v.city || "—")}
                {k === "urgency" && (v.level || "normal")}
              </div>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-muted-foreground">
          Multiplicador limitado entre ×{data.limits.min} e ×{data.limits.max}. Recalculado em tempo real conforme demanda e oferta da região.
        </p>
      </CardContent>
    </Card>
  );
}
