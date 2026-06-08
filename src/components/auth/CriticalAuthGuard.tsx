// Reusable critical-action auth wrapper:
// - Requires an authenticated session.
// - Re-prompts password (re-auth) before sensitive pages render.
// - Optionally triggers face verification for elevated contexts.
import { ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ShieldCheck, ShieldAlert } from "lucide-react";
import { WebcamCapture } from "@/components/security/WebcamCapture";

interface Props {
  context: "login" | "payment" | "withdrawal" | "sensitive_change" | "kyc";
  requireFace?: boolean;
  children: ReactNode;
}

export function CriticalAuthGuard({ context, requireFace = false, children }: Props) {
  const { t } = useTranslation();
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [faceStatus, setFaceStatus] = useState<"idle" | "checking" | "approved" | "review" | "blocked">("idle");
  const [selfie, setSelfie] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  async function handleVerify() {
    if (!email || !password) return;
    setVerifying(true);
    setError(null);
    try {
      const { error: signErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signErr) {
        setError(t("critical.invalidPassword", "Senha incorreta."));
        return;
      }
      if (requireFace) {
        if (!selfie) {
          setError(t("critical.selfieRequired", "Capture sua selfie para continuar."));
          return;
        }
        setFaceStatus("checking");
        const { data, error: fnErr } = await supabase.functions.invoke("face-verify", {
          body: { context, selfie_base64: selfie },
        });
        if (fnErr) {
          setFaceStatus("review");
          setError(t("critical.faceUnavailable", "Verificação facial indisponível. Continue com cautela."));
        } else {
          const decision = (data as any)?.decision ?? "review";
          setFaceStatus(decision);
          if (decision === "blocked") {
            setError(t("critical.blocked", "Acesso bloqueado por segurança."));
            return;
          }
        }
      }
      setUnlocked(true);
    } catch (e: any) {
      setError(e.message ?? t("critical.error", "Erro ao verificar."));
    } finally {
      setVerifying(false);
    }
  }

  if (unlocked) return <>{children}</>;

  return (
    <div className="container mx-auto py-12 max-w-md">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {requireFace ? <ShieldAlert className="h-5 w-5 text-primary" /> : <ShieldCheck className="h-5 w-5 text-primary" />}
            {t("critical.title", "Confirmação de segurança")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("critical.description", "Esta área é sensível. Confirme sua identidade para continuar.")}
          </p>
          {email && (
            <div className="text-sm">
              <Label>{t("critical.account", "Conta")}</Label>
              <p className="font-medium">{email}</p>
            </div>
          )}
          <div>
            <Label htmlFor="critical-pwd">{t("critical.password", "Senha")}</Label>
            <Input
              id="critical-pwd"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleVerify()}
              autoFocus
            />
          </div>
          {faceStatus !== "idle" && (
            <Alert>
              <AlertDescription>
                {t("critical.face." + faceStatus, faceStatus)}
              </AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button
            onClick={handleVerify}
            disabled={verifying || !password || !email}
            className="w-full"
          >
            {verifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("critical.confirm", "Confirmar e continuar")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
