import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lock, RefreshCw, Timer } from "lucide-react";
import { toast } from "sonner";

interface Quote {
  id: string;
  base_price: number;
  multiplier: number;
  final_price: number;
  breakdown: Record<string, any>;
  expires_at: string;
}

interface Props {
  basePrice: number;
  categoryId?: string | null;
  city?: string | null;
  urgency?: "low" | "normal" | "high" | "critical";
  ttlMinutes?: number;
  onQuoteLocked?: (quote: Quote) => void;
}

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Checkout-time variant of DynamicPricePreview: shows the same transparent
 *  breakdown AND locks the price in `price_quotes` for a short window. */
export function CheckoutPriceBreakdown({
  basePrice, categoryId, city, urgency = "normal", ttlMinutes = 10, onQuoteLocked,
}: Props) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [remaining, setRemaining] = useState(0);

  const fetchQuote = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("quote_dynamic_price" as any, {
      _base_price: basePrice,
      _category_id: categoryId ?? null,
      _city: city ?? null,
      _urgency: urgency,
      _ttl_minutes: ttlMinutes,
    });
    if (error) {
      toast.error("Não foi possível travar o preço.");
      setLoading(false);
      return;
    }
    const q = data as unknown as Quote;
    setQuote(q);
    onQuoteLocked?.(q);
    setLoading(false);
  }, [basePrice, categoryId, city, urgency, ttlMinutes, onQuoteLocked]);

  useEffect(() => { fetchQuote(); }, [fetchQuote]);

  useEffect(() => {
    if (!quote) return;
    const tick = () => setRemaining(Math.max(0, new Date(quote.expires_at).getTime() - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [quote]);

  if (loading || !quote) {
    return <Card><CardContent className="p-4 text-sm text-muted-foreground">Calculando e travando preço…</CardContent></Card>;
  }

  const mm = Math.floor(remaining / 60000).toString().padStart(2, "0");
  const ss = Math.floor((remaining % 60000) / 1000).toString().padStart(2, "0");
  const expired = remaining <= 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2"><Lock className="h-4 w-4" /> Preço travado</span>
          <Badge variant={expired ? "destructive" : "secondary"} className="font-mono">
            <Timer className="h-3 w-3 mr-1" />{mm}:{ss}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-xs text-muted-foreground line-through">{fmtBRL(quote.base_price)}</div>
            <div className="text-2xl font-bold">{fmtBRL(quote.final_price)}</div>
          </div>
          <Badge variant="outline">×{Number(quote.multiplier).toFixed(2)}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          {Object.entries(quote.breakdown).map(([k, v]: any) => (
            <div key={k} className="rounded border p-2">
              <div className="font-medium capitalize">{k}</div>
              <div className="text-muted-foreground">
                fator ×{Number(v.factor).toFixed(2)} · peso {Number(v.weight).toFixed(2)}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{expired ? "Cotação expirada — atualize antes de confirmar." : `Garantido por ${ttlMinutes} min.`}</span>
          <Button size="sm" variant="ghost" onClick={fetchQuote}>
            <RefreshCw className="h-3 w-3 mr-1" /> Recalcular
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
