import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Copy, Gift, Users, DollarSign, Award, Ticket, Loader2 } from "lucide-react";

interface DashboardData {
  total_commissions: number;
  paid_commissions: number;
  total_referrals: number;
  affiliate_code: string;
  level: string;
}

interface Commission {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  profiles: { display_name: string } | null;
}

const levelColors: Record<string, string> = {
  bronze: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  silver: "bg-gray-400/10 text-gray-300 border-gray-400/20",
  gold: "bg-[hsl(var(--gold))]/10 text-[hsl(var(--gold))] border-[hsl(var(--gold))]/20",
  diamond: "bg-cyan-400/10 text-cyan-300 border-cyan-400/20",
};

const AffiliateDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [data, setData] = useState<DashboardData | null>(null);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingCoupon, setGeneratingCoupon] = useState(false);

  const levelKeys = ["bronze", "silver", "gold", "diamond"] as const;

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user]);

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

  const copyCode = () => {
    if (data?.affiliate_code) {
      navigator.clipboard.writeText(data.affiliate_code);
      toast.success(t("affiliate.codeCopied"));
    }
  };

  const copyLink = () => {
    if (data?.affiliate_code) {
      const link = `${window.location.origin}/auth?ref=${data.affiliate_code}`;
      navigator.clipboard.writeText(link);
      toast.success(t("affiliate.linkCopied"));
    }
  };

  const generateCoupon = async () => {
    setGeneratingCoupon(true);
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) return;

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/affiliate?action=generate-coupon`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
      }
    );
    const result = await res.json();
    setGeneratingCoupon(false);

    if (result.coupon) {
      toast.success(`${t("affiliate.couponGenerated")} ${result.coupon}`);
      navigator.clipboard.writeText(result.coupon);
    } else {
      toast.error(t("affiliate.couponError"));
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16">
        <div className="container px-6 max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground">
                {t("affiliate.title")} <span className="text-gradient">{t("affiliate.titleHighlight")}</span>
              </h1>
              <p className="text-muted-foreground mt-1">{t("affiliate.subtitle")}</p>
            </div>
            {data && (
              <Badge className={`text-sm px-3 py-1 ${levelColors[data.level] || levelColors.bronze}`}>
                <Award className="w-3.5 h-3.5 mr-1" />
                {t(`affiliate.${data.level}`)}
              </Badge>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <Card className="p-5 bg-card border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("affiliate.pendingCommissions")}</p>
                  <p className="text-xl font-bold text-foreground">R$ {data?.total_commissions?.toFixed(2) || "0.00"}</p>
                </div>
              </div>
            </Card>
            <Card className="p-5 bg-card border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("affiliate.paidCommissions")}</p>
                  <p className="text-xl font-bold text-foreground">R$ {data?.paid_commissions?.toFixed(2) || "0.00"}</p>
                </div>
              </div>
            </Card>
            <Card className="p-5 bg-card border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("affiliate.totalReferrals")}</p>
                  <p className="text-xl font-bold text-foreground">{data?.total_referrals || 0}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Affiliate Code & Actions */}
          <Card className="p-6 bg-card border-border mb-8">
            <h2 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
              <Gift className="w-4 h-4 text-primary" />
              {t("affiliate.yourCode")}
            </h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 flex items-center gap-2 bg-background rounded-xl border border-border px-4 py-3">
                <code className="text-lg font-mono font-bold text-primary flex-1">{data?.affiliate_code}</code>
                <Button variant="ghost" size="icon" onClick={copyCode}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <Button onClick={copyLink} variant="outline" className="gap-2">
                <Copy className="w-4 h-4" />
                {t("affiliate.copyLink")}
              </Button>
              <Button onClick={generateCoupon} disabled={generatingCoupon} className="gap-2">
                <Ticket className="w-4 h-4" />
                {generatingCoupon ? t("affiliate.generating") : t("affiliate.generateCoupon")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-3">{t("affiliate.shareDesc")}</p>
          </Card>

          {/* Level Progress */}
          <Card className="p-6 bg-card border-border mb-8">
            <h2 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
              <Award className="w-4 h-4 text-primary" />
              {t("affiliate.levels")}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {levelKeys.map((lvl) => (
                <div
                  key={lvl}
                  className={`rounded-xl border p-3 text-center transition-all ${
                    data?.level === lvl ? levelColors[lvl] + " ring-1 ring-current" : "border-border text-muted-foreground"
                  }`}
                >
                  <p className="text-xs font-medium">{t(`affiliate.${lvl}`)}</p>
                  <p className="text-[10px] mt-1 opacity-70">{t(`affiliate.${lvl}Range`)}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Commissions History */}
          <Card className="p-6 bg-card border-border">
            <h2 className="font-display font-semibold text-foreground mb-4">{t("affiliate.history")}</h2>
            {commissions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{t("affiliate.noCommissions")}</p>
            ) : (
              <div className="space-y-3">
                {commissions.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-3 rounded-xl bg-background border border-border">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {(c.profiles as any)?.display_name || "Usuário"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(c.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={c.status === "paid" ? "default" : "outline"} className="text-xs">
                        {c.status === "paid" ? t("affiliate.paid") : t("affiliate.pending")}
                      </Badge>
                      <span className="text-sm font-semibold text-primary">R$ {c.amount.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AffiliateDashboard;
