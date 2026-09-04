import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, ShieldCheck, LogOut } from "lucide-react";

const AdminLogin = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = params.get("redirect") || "/admin/gestao";
  const { user, loading: authLoading, signOut } = useAuth();
  const { isAdmin, isModerator, loading: roleLoading } = useIsAdmin();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !roleLoading && user && (isAdmin || isModerator)) {
      navigate(redirect, { replace: true });
    }
  }, [authLoading, roleLoading, user, isAdmin, isModerator, navigate, redirect]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setSubmitting(false);
    if (error) {
      toast.error("Não foi possível entrar. Verifique e-mail e senha.");
      return;
    }
    toast.success("Bem-vindo de volta!");
  };

  const noAccess = user && !authLoading && !roleLoading && !isAdmin && !isModerator;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-md p-8" data-testid="admin-login">
        <div className="flex items-center gap-2 mb-6">
          <ShieldCheck className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-display font-bold">Painel administrativo</h1>
        </div>

        {noAccess ? (
          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              A conta <span className="font-medium text-foreground">{user?.email}</span> não possui permissão de
              administrador.
            </p>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => void signOut()}
              data-testid="admin-login-switch"
            >
              <LogOut className="w-4 h-4" /> Entrar com outra conta
            </Button>
            <Button asChild variant="ghost" className="w-full">
              <Link to="/">Voltar ao início</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="admin-email">E-mail</Label>
              <Input
                id="admin-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="admin-login-email"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="admin-password">Senha</Label>
              <Input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="admin-login-password"
              />
            </div>
            <Button type="submit" className="w-full gap-2" disabled={submitting} data-testid="admin-login-submit">
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />} Entrar
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Acesso restrito a administradores da plataforma.
            </p>
          </form>
        )}
      </Card>
    </div>
  );
};

export default AdminLogin;
