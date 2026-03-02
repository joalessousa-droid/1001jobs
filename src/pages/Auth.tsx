import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { ArrowLeft, Mail, Lock, User, Briefcase } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type UserType = "client" | "provider";
type AuthStep = "form" | "otp" | "forgot";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [userType, setUserType] = useState<UserType>("client");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<AuthStep>("form");
  const [otpCode, setOtpCode] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/dashboard");
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: displayName,
              user_type: userType,
            },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        // If auto-confirm is on, session is returned directly
        if (data.session) {
          navigate("/dashboard");
        } else {
          setStep("otp");
          toast({
            title: "Código enviado!",
            description: "Verifique seu e-mail e insira o código de 6 dígitos.",
          });
        }
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: "email",
      });
      if (error) throw error;
      toast({ title: "E-mail verificado!", description: "Bem-vindo à 1001Jobs." });
      navigate("/dashboard");
    } catch (error: any) {
      toast({
        title: "Código inválido",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email });
      if (error) throw error;
      toast({ title: "Código reenviado!", description: "Verifique seu e-mail novamente." });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast({ title: "Informe seu e-mail", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast({
        title: "E-mail enviado!",
        description: "Verifique sua caixa de entrada para redefinir a senha.",
      });
      setStep("form");
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Forgot password screen
  if (step === "forgot") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="absolute inset-0 hero-glow opacity-30" />
        <div className="w-full max-w-md relative z-10 text-center">
          <button
            onClick={() => setStep("form")}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>

          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Mail className="w-8 h-8 text-primary" />
          </div>

          <h1 className="text-3xl font-bold font-display mb-2">Esqueci a senha</h1>
          <p className="text-muted-foreground mb-8">
            Informe seu e-mail e enviaremos um link para redefinir sua senha.
          </p>

          <div className="text-left mb-4">
            <Label htmlFor="forgot-email">E-mail</Label>
            <div className="relative mt-1.5">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="pl-10 h-12 bg-card border-border"
                required
              />
            </div>
          </div>

          <Button
            onClick={handleForgotPassword}
            disabled={loading || !email}
            className="w-full h-12 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl"
          >
            {loading ? "Enviando..." : "Enviar link de recuperação"}
          </Button>
        </div>
      </div>
    );
  }
  if (step === "otp") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="absolute inset-0 hero-glow opacity-30" />
        <div className="w-full max-w-md relative z-10 text-center">
          <button
            onClick={() => setStep("form")}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>

          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Mail className="w-8 h-8 text-primary" />
          </div>

          <h1 className="text-3xl font-bold font-display mb-2">Verifique seu e-mail</h1>
          <p className="text-muted-foreground mb-2">
            Enviamos um código de 6 dígitos para
          </p>
          <p className="text-foreground font-medium mb-8">{email}</p>

          <div className="flex justify-center mb-6">
            <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>

          <Button
            onClick={handleVerifyOtp}
            disabled={loading || otpCode.length !== 6}
            className="w-full h-12 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl mb-4"
          >
            {loading ? "Verificando..." : "Confirmar código"}
          </Button>

          <p className="text-sm text-muted-foreground">
            Não recebeu?{" "}
            <button
              onClick={handleResendOtp}
              disabled={loading}
              className="text-primary hover:underline font-medium"
            >
              Reenviar código
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="absolute inset-0 hero-glow opacity-30" />

      <div className="w-full max-w-md relative z-10">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Link>

        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm font-display">1K</span>
          </div>
          <span className="font-display font-bold text-lg">1001Jobs</span>
        </div>

        <h1 className="text-3xl font-bold font-display mb-2">
          {isLogin ? "Entrar" : "Criar conta"}
        </h1>
        <p className="text-muted-foreground mb-8">
          {isLogin ? "Acesse sua conta na 1001Jobs" : "Comece a usar a plataforma"}
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {!isLogin && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setUserType("client")}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    userType === "client"
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <User className={`w-5 h-5 mb-2 ${userType === "client" ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="font-semibold text-sm">Cliente</div>
                  <div className="text-xs text-muted-foreground">Contratar serviços</div>
                </button>
                <button
                  type="button"
                  onClick={() => setUserType("provider")}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    userType === "provider"
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <Briefcase className={`w-5 h-5 mb-2 ${userType === "provider" ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="font-semibold text-sm">Profissional</div>
                  <div className="text-xs text-muted-foreground">Oferecer serviços</div>
                </button>
              </div>

              <div>
                <Label htmlFor="name">Nome</Label>
                <div className="relative mt-1.5">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Seu nome completo"
                    className="pl-10 h-12 bg-card border-border"
                    required
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <Label htmlFor="email">E-mail</Label>
            <div className="relative mt-1.5">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="pl-10 h-12 bg-card border-border"
                required
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Senha</Label>
              {isLogin && (
                <button
                  type="button"
                  onClick={() => setStep("forgot")}
                  className="text-xs text-primary hover:underline font-medium"
                >
                  Esqueci a senha
                </button>
              )}
            </div>
            <div className="relative mt-1.5">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pl-10 h-12 bg-card border-border"
                required
                minLength={6}
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl"
          >
            {loading ? "Carregando..." : isLogin ? "Entrar" : "Criar conta"}
          </Button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-3 text-muted-foreground">ou continue com</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="h-12 rounded-xl border-border hover:bg-secondary"
            onClick={async () => {
              const { error } = await lovable.auth.signInWithOAuth("google");
              if (error) toast({ title: "Erro", description: String(error), variant: "destructive" });
            }}
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Google
          </Button>
          <Button
            variant="outline"
            className="h-12 rounded-xl border-border hover:bg-secondary"
            onClick={async () => {
              const { error } = await lovable.auth.signInWithOAuth("apple");
              if (error) toast({ title: "Erro", description: String(error), variant: "destructive" });
            }}
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
            Apple
          </Button>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          {isLogin ? "Não tem conta?" : "Já tem conta?"}{" "}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-primary hover:underline font-medium"
          >
            {isLogin ? "Cadastre-se" : "Entrar"}
          </button>
        </p>
      </div>
    </div>
  );
};

export default Auth;
