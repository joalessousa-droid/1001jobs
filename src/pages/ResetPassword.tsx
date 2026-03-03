import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

const ResetPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    if (window.location.hash.includes("type=recovery")) setReady(true);
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) { toast({ title: t("resetPassword.mismatch"), variant: "destructive" }); return; }
    if (password.length < 6) { toast({ title: t("resetPassword.minLength"), variant: "destructive" }); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      toast({ title: t("resetPassword.changedSuccess") });
      setTimeout(() => navigate("/dashboard"), 2000);
    } catch (error: any) {
      toast({ title: t("auth.error"), description: error.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="absolute inset-0 hero-glow opacity-30" />
        <div className="w-full max-w-md relative z-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6"><CheckCircle className="w-8 h-8 text-primary" /></div>
          <h1 className="text-3xl font-bold font-display mb-2">{t("resetPassword.changed")}</h1>
          <p className="text-muted-foreground">{t("resetPassword.redirecting")}</p>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="absolute inset-0 hero-glow opacity-30" />
        <div className="w-full max-w-md relative z-10 text-center">
          <h1 className="text-2xl font-bold font-display mb-2">{t("resetPassword.invalidLink")}</h1>
          <p className="text-muted-foreground mb-6">{t("resetPassword.invalidLinkDesc")}</p>
          <Button onClick={() => navigate("/auth")} variant="outline" className="rounded-xl">{t("resetPassword.backToLogin")}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="absolute inset-0 hero-glow opacity-30" />
      <div className="w-full max-w-md relative z-10">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6"><Lock className="w-8 h-8 text-primary" /></div>
        <h1 className="text-3xl font-bold font-display mb-2 text-center">{t("resetPassword.title")}</h1>
        <p className="text-muted-foreground mb-8 text-center">{t("resetPassword.subtitle")}</p>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label htmlFor="password">{t("resetPassword.newPassword")}</Label>
            <div className="relative mt-1.5">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="pl-10 h-12 bg-card border-border" required minLength={6} />
            </div>
          </div>
          <div>
            <Label htmlFor="confirmPassword">{t("resetPassword.confirmPassword")}</Label>
            <div className="relative mt-1.5">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" className="pl-10 h-12 bg-card border-border" required minLength={6} />
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full h-12 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl">
            {loading ? t("resetPassword.saving") : t("resetPassword.resetBtn")}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
