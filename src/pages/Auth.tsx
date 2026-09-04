import { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Mail, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import RegisterWizard from "@/components/auth/RegisterWizard";
import PasswordInput from "@/components/auth/PasswordInput";
import { useCriticalAction } from "@/hooks/useCriticalAction";
import authLogo from "@/assets/logo-1001jobs-auth.png.asset.json";

type AuthStep = "form" | "forgot";

const Auth = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const initialType = searchParams.get("type") === "provider" ? "provider" : "client";
  const [isLogin, setIsLogin] = useState(initialType !== "provider");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<AuthStep>("form");
  const navigate = useNavigate();
  const { toast } = useToast();
  const requireCritical = useCriticalAction();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // Avalia risco do login; se suspeito, exige confirmação crítica com biometria.
      try {
        const { data: risk } = await supabase.functions.invoke("risk-score", {
          body: { event: "login", email },
        });
        const score = Number((risk as any)?.score ?? 0);
        const suspicious = score >= 70 || (risk as any)?.suspicious === true;
        if (suspicious) {
          const ok = await requireCritical({ context: "suspicious_login", requireFace: true });
          if (!ok) {
            await supabase.auth.signOut();
            toast({ title: "Login bloqueado", description: "Não foi possível validar sua identidade.", variant: "destructive" });
            return;
          }
        }
      } catch { /* falha de risk-score não bloqueia login */ }
      navigate("/dashboard");
    } catch (error: any) {
      toast({ title: t("auth.error"), description: error.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleForgotPassword = async () => {
    if (!email) { toast({ title: t("auth.enterEmail"), variant: "destructive" }); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
      if (error) throw error;
      toast({ title: t("auth.emailSent"), description: t("auth.emailSentDesc") });
      setStep("form");
    } catch (error: any) {
      toast({ title: t("auth.error"), description: error.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  // Forgot password screen
  if (step === "forgot") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="absolute inset-0 hero-glow opacity-30" />
        <div className="w-full max-w-md relative z-10 text-center">
          <button onClick={() => setStep("form")} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" />{t("auth.back")}
          </button>
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6"><Mail className="w-8 h-8 text-primary" /></div>
          <h1 className="text-3xl font-bold font-display mb-2">{t("auth.forgotTitle")}</h1>
          <p className="text-muted-foreground mb-8">{t("auth.forgotDesc")}</p>
          <div className="text-left mb-4">
            <Label htmlFor="forgot-email">{t("auth.email")}</Label>
            <div className="relative mt-1.5">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input id="forgot-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("auth.emailPlaceholder")} className="pl-10 h-12 bg-card border-border" required />
            </div>
          </div>
          <Button onClick={handleForgotPassword} disabled={loading || !email} className="w-full h-12 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl">
            {loading ? t("auth.sending") : t("auth.sendLink")}
          </Button>
        </div>
      </div>
    );
  }

  // Registration wizard
  if (!isLogin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6 py-12">
        <div className="absolute inset-0 hero-glow opacity-30" />
        <div className="w-full max-w-lg relative z-10">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" />{t("auth.back")}
          </Link>
          <div className="flex items-center mb-6">
            <img
              src={authLogo.url}
              alt="1001Jobs — every jobs here"
              className="h-8 w-auto"
              data-testid="auth-logo"
              loading="eager"
              decoding="async"
            />
          </div>
          <h1 className="text-3xl font-bold font-display mb-2">Criar conta</h1>
          <p className="text-muted-foreground mb-8">Preencha seus dados para começar a usar a plataforma</p>

          <RegisterWizard />

          <p className="text-center text-sm text-muted-foreground mt-6">
            Já tem conta?{" "}
            <button onClick={() => setIsLogin(true)} className="text-primary hover:underline font-medium">Entrar</button>
          </p>
        </div>
      </div>
    );
  }

  // Login form
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="absolute inset-0 hero-glow opacity-30" />
      <div className="w-full max-w-md relative z-10">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" />{t("auth.back")}
        </Link>
        <div className="flex items-center mb-8">
          <img
            src={authLogo.url}
            alt="1001Jobs — every jobs here"
            className="h-8 w-auto"
            data-testid="auth-logo"
            loading="eager"
            decoding="async"
          />
        </div>
        <h1 className="text-3xl font-bold font-display mb-2">{t("auth.signIn")}</h1>
        <p className="text-muted-foreground mb-8">{t("auth.signInSubtitle")}</p>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <Label htmlFor="email">{t("auth.email")}</Label>
            <div className="relative mt-1.5">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("auth.emailPlaceholder")} className="pl-10 h-12 bg-card border-border" required />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <button type="button" onClick={() => setStep("forgot")} className="text-xs text-primary hover:underline font-medium">{t("auth.forgotPassword")}</button>
            </div>
            <div className="relative mt-1.5">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
              <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="pl-10 h-12 bg-card border-border" required minLength={6} />
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full h-12 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl">
            {loading ? t("auth.loading") : t("auth.signIn")}
          </Button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
          <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-3 text-muted-foreground">{t("auth.orContinue")}</span></div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" className="h-12 rounded-xl border-border hover:bg-secondary" onClick={async () => {
            const { error } = await lovable.auth.signInWithOAuth("google");
            if (error) toast({ title: t("auth.error"), description: String(error), variant: "destructive" });
          }}>
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Google
          </Button>
          <Button variant="outline" className="h-12 rounded-xl border-border hover:bg-secondary" onClick={async () => {
            const { error } = await lovable.auth.signInWithOAuth("apple");
            if (error) toast({ title: t("auth.error"), description: String(error), variant: "destructive" });
          }}>
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
            Apple
          </Button>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          {t("auth.noAccount")}{" "}
          <button onClick={() => setIsLogin(false)} className="text-primary hover:underline font-medium">{t("auth.signUp")}</button>
        </p>
      </div>
    </div>
  );
};

export default Auth;
