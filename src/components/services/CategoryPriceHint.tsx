import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { TrendingUp } from "lucide-react";

interface Pricing {
  min_price: number;
  suggested_price: number;
  max_price: number | null;
  unit: string;
  currency: string;
}

const UNIT_LABEL: Record<string, string> = {
  hour: "/hora",
  visit: "/visita",
  project: "/projeto",
  service: "/serviço",
};

const CategoryPriceHint = ({ categoryId }: { categoryId: string | null | undefined }) => {
  const [p, setP] = useState<Pricing | null>(null);

  useEffect(() => {
    if (!categoryId) return;
    supabase
      .from("category_pricing")
      .select("min_price, suggested_price, max_price, unit, currency")
      .eq("category_id", categoryId)
      .maybeSingle()
      .then(({ data }) => data && setP(data as any));
  }, [categoryId]);

  if (!p) return null;

  return (
    <div className="flex items-center gap-2 text-xs">
      <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary gap-1">
        <TrendingUp className="w-3 h-3" />
        Sugerido: {p.currency} {Number(p.suggested_price).toFixed(0)}{UNIT_LABEL[p.unit] ?? ""}
      </Badge>
      <span className="text-muted-foreground">
        Faixa: {p.currency} {Number(p.min_price).toFixed(0)}
        {p.max_price ? ` – ${Number(p.max_price).toFixed(0)}` : "+"}
      </span>
    </div>
  );
};

export default CategoryPriceHint;
