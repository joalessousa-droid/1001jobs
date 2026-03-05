import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { ArrowLeft, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  email: string;
}

const StepOtp = ({ email }: Props) => {
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleVerify = async () => {
    if (otpCode.length !== 6) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ email, token: otpCode, type: "email" });
      if (error) throw error;
      toast({ title: "E-mail verificado!", description: "Bem-vindo à 1001Jobs." });
      navigate("/dashboard");
    } catch (error: any) {
      toast({ title: "Código inválido", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email });
      if (error) throw error;
      toast({ title: "Código reenviado!" });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="absolute inset-0 hero-glow opacity-30" />
      <div className="w-full max-w-md relative z-10 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <Mail className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-3xl font-bold font-display mb-2">Verifique seu e-mail</h1>
        <p className="text-muted-foreground mb-2">Enviamos um código de 6 dígitos para</p>
        <p className="text-foreground font-medium mb-8">{email}</p>
        <div className="flex justify-center mb-6">
          <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode}>
            <InputOTPGroup>
              <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} />
              <InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>
        <Button onClick={handleVerify} disabled={loading || otpCode.length !== 6} className="w-full h-12 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl mb-4">
          {loading ? "Verificando..." : "Confirmar código"}
        </Button>
        <p className="text-sm text-muted-foreground">
          Não recebeu?{" "}
          <button onClick={handleResend} disabled={loading} className="text-primary hover:underline font-medium">Reenviar código</button>
        </p>
      </div>
    </div>
  );
};

export default StepOtp;
