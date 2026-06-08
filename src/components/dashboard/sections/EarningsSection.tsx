import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, Users, Award, Gift, Copy, Ticket, Loader2, Banknote } from "lucide-react";
import { toast } from "sonner";
import { useCriticalAction } from "@/hooks/useCriticalAction";

interface Props {
  profileId: string;
}

const levelLabels: Record<string, string> = { bronze: "Bronze", silver: "Prata", gold: "Ouro", diamond: "Diamante" };
const levelColors: Record<string, string> = {
  bronze: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  silver: "bg-gray-400/10 text-gray-300 border-gray-400/20",
  gold: "bg-[hsl(var(--gold))]/10 text-[hsl(var(--gold))] border-[hsl(var(--gold))]/20",
  diamond: "bg-cyan-400/10 text-cyan-300 border-cyan-400/20",
};

const EarningsSection = ({ profileId }: Props) => {
  const [data, setData] = useState<any>(null);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingCoupon, setGeneratingCoupon] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) return;
      const headers = { Authorization: `Bearer ${session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY };
      const base = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/affiliate`;
      const [dashRes, commRes] = await Promise.all([
        fetch(`${base}?action=dashboard`, { headers }).then((r) => r.json()),
        fetch(`${base}?action=commissions`, { headers }).then((r) => r.json()),
      ]);
      setData(dashRes);
      setCommissions(commRes || []);
      setLoading(false);
    };
    fetchData();
  }, [profileId]);

  const copyCode = () => {
    if (data?.affiliate_code) { navigator.clipboard.writeText(data.affiliate_code); toast.success("Código copiado!"); }
  };

  const copyLink = () => {
    if (data?.affiliate_code) {
      navigator.clipboard.writeText(`${window.location.origin}/auth?ref=${data.affiliate_code}`);
      toast.success("Link copiado!");
    }
  };

  const generateCoupon = async () => {
    setGeneratingCoupon(true);
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) return;
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/affiliate?action=generate-coupon`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
    });
    const result = await res.json();
    setGeneratingCoupon(false);
    if (result.coupon) { toast.success(`Cupom: ${result.coupon}`); navigator.clipboard.writeText(result.coupon); }
    else toast.error("Erro ao gerar cupom.");
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-display">Ganhos & Afiliados</h2>
          <p className="text-muted-foreground text-sm mt-1">Acompanhe comissões e indicações</p>
        </div>
        {data && (
          <Badge className={`text-sm px-3 py-1 ${levelColors[data.level] || levelColors.bronze}`}>
            <Award className="w-3.5 h-3.5 mr-1" /> {levelLabels[data.level] || data.level}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 bg-card border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><DollarSign className="w-5 h-5 text-primary" /></div>
            <div><p className="text-xs text-muted-foreground">Pendentes</p><p className="text-xl font-bold text-foreground">R$ {data?.total_commissions?.toFixed(2) || "0.00"}</p></div>
          </div>
        </Card>
        <Card className="p-5 bg-card border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center"><DollarSign className="w-5 h-5 text-emerald-400" /></div>
            <div><p className="text-xs text-muted-foreground">Pagas</p><p className="text-xl font-bold text-foreground">R$ {data?.paid_commissions?.toFixed(2) || "0.00"}</p></div>
          </div>
        </Card>
        <Card className="p-5 bg-card border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center"><Users className="w-5 h-5 text-blue-400" /></div>
            <div><p className="text-xs text-muted-foreground">Indicados</p><p className="text-xl font-bold text-foreground">{data?.total_referrals || 0}</p></div>
          </div>
        </Card>
      </div>

      <Card className="p-6 bg-card border-border">
        <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2"><Gift className="w-4 h-4 text-primary" /> Código de Indicação</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 flex items-center gap-2 bg-background rounded-xl border border-border px-4 py-3">
            <code className="text-lg font-mono font-bold text-primary flex-1">{data?.affiliate_code}</code>
            <Button variant="ghost" size="icon" onClick={copyCode}><Copy className="w-4 h-4" /></Button>
          </div>
          <Button onClick={copyLink} variant="outline" className="gap-2"><Copy className="w-4 h-4" /> Link</Button>
          <Button onClick={generateCoupon} disabled={generatingCoupon} className="gap-2"><Ticket className="w-4 h-4" /> {generatingCoupon ? "Gerando..." : "Cupom R$99"}</Button>
        </div>
      </Card>

      <Card className="p-6 bg-card border-border">
        <h3 className="font-display font-semibold text-foreground mb-4">Histórico de Comissões</h3>
        {commissions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma comissão ainda.</p>
        ) : (
          <div className="space-y-3">
            {commissions.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-xl bg-background border border-border">
                <div>
                  <p className="text-sm font-medium text-foreground">{c.profiles?.display_name || "Usuário"}</p>
                  <p className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={c.status === "paid" ? "default" : "outline"} className="text-xs">{c.status === "paid" ? "Pago" : "Pendente"}</Badge>
                  <span className="text-sm font-semibold text-primary">R$ {c.amount.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default EarningsSection;
