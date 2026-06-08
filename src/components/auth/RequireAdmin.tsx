// Guard de role: bloqueia acesso de não-admin/moderador a rotas administrativas.
import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Loader2, ShieldAlert } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Quando true, exige role "admin"; quando false (default), aceita "admin" ou "moderator". */
  strict?: boolean;
}

export function RequireAdmin({ children, strict = false }: Props) {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, isModerator, loading } = useIsAdmin();

  if (authLoading || loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  const ok = strict ? isAdmin : isAdmin || isModerator;
  if (!ok) {
    return (
      <div className="container mx-auto py-16 max-w-md text-center space-y-4">
        <ShieldAlert className="h-10 w-10 text-destructive mx-auto" />
        <h1 className="text-xl font-semibold">Acesso restrito</h1>
        <p className="text-sm text-muted-foreground">
          Esta área é exclusiva para administradores. Se você acredita que isso é um erro, contate o suporte.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
