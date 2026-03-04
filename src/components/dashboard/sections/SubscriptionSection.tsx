import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, CheckCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  profileId: string;
}

const plans = [
  { key: "basico", name: "Básico", price: "R$ 0", priceNum: 0, features: ["Perfil básico", "Apenas 1 anúncio", "Chat limitado"] },
  { key: "pro", name: "Pro", price: "R$ 99/mês", priceNum: 9900, features: ["Perfil destacado", "Serviços ilimitados", "Chat ilimitado", "Suporte prioritário"], recommended: true },
  { key: "business", name: "Business", price: "R$ 149/mês", priceNum: 14900, features: ["Tudo do Pro", "Selo verificado", "Relatórios avançados", "API de integração"] },
];

const SubscriptionSection = ({ profileId }: Props) => {
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setSubscription(data);
      setLoading(false);
    };
    fetch();
  }, [profileId]);

  const handleSubscribe = async (planKey: string) => {
    if (planKey === "basico") return;
    setCheckoutLoading(planKey);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { plan: planKey },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else if (data?.error) {
        toast({ title: "Erro", description: data.error, variant: "destructive" });
      }
    } catch (err: any) {
      const msg = err?.message || "Erro ao iniciar pagamento";
      if (msg.includes("not configured")) {
        toast({ title: "Gateway em configuração", description: "O sistema de pagamento está sendo configurado. Tente novamente em breve.", variant: "destructive" });
      } else {
        toast({ title: "Erro", description: msg, variant: "destructive" });
      }
    }
    setCheckoutLoading(null);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold font-display">Assinatura</h2>
        <p className="text-muted-foreground text-sm mt-1">Gerencie seu plano e pagamentos</p>
      </div>

      {subscription && (
        <Card className="p-5 bg-card border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">Plano atual</p>
                <p className="text-xs text-muted-foreground">R$ {subscription.amount}/mês</p>
              </div>
            </div>
            <Badge variant={subscription.status === "active" ? "default" : "secondary"}>
              {subscription.status === "active" ? "Ativo" : subscription.status}
            </Badge>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((plan) => (
          <Card key={plan.name} className={`p-6 bg-card border-border relative ${plan.recommended ? "ring-2 ring-primary" : ""}`}>
            {plan.recommended && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full">
                Recomendado
              </span>
            )}
            <h3 className="font-display font-bold text-lg text-foreground">{plan.name}</h3>
            <p className="text-2xl font-bold text-primary mt-2">{plan.price}</p>
            <ul className="mt-4 space-y-2">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="w-3.5 h-3.5 text-primary shrink-0" /> {f}
                </li>
              ))}
            </ul>
            <Button
              className="w-full mt-6"
              variant={plan.recommended ? "default" : "outline"}
              disabled={plan.key === "basico" || checkoutLoading === plan.key}
              onClick={() => handleSubscribe(plan.key)}
            >
              {checkoutLoading === plan.key && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {plan.key === "basico" ? "Plano atual" : subscription ? "Alterar plano" : "Assinar"}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default SubscriptionSection;
