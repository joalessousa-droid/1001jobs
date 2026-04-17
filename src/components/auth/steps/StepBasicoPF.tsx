import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Mail, Lock, Phone, Briefcase } from "lucide-react";
import type { RegisterData, UserType } from "../RegisterWizard";
import { maskCPF, maskPhone, validarCPF, validarSenhaForte } from "@/lib/validators";
import { useState } from "react";
import PasswordStrengthMeter from "../PasswordStrengthMeter";

interface Props {
  data: RegisterData;
  update: (fields: Partial<RegisterData>) => void;
}

const StepBasicoPF = ({ data, update }: Props) => {
  const [cpfError, setCpfError] = useState("");
  const [pwErrors, setPwErrors] = useState<string[]>([]);

  const handleCpfChange = (val: string) => {
    const masked = maskCPF(val);
    update({ cpf: masked });
    const raw = masked.replace(/\D/g, '');
    if (raw.length === 11) {
      setCpfError(validarCPF(raw) ? "" : "CPF inválido");
    } else {
      setCpfError("");
    }
  };

  const handlePasswordChange = (val: string) => {
    update({ password: val });
    if (val.length > 0) {
      const check = validarSenhaForte(val);
      setPwErrors(check.errors);
    } else {
      setPwErrors([]);
    }
  };

  return (
    <div className="space-y-4">
      {/* User type */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => update({ userType: "client" })}
          className={`p-3 rounded-xl border text-left transition-all ${data.userType === "client" ? "border-primary bg-primary/10" : "border-border hover:border-primary/30"}`}
        >
          <User className={`w-4 h-4 mb-1 ${data.userType === "client" ? "text-primary" : "text-muted-foreground"}`} />
          <div className="font-semibold text-sm">Cliente</div>
          <div className="text-xs text-muted-foreground">Contratar serviços</div>
        </button>
        <button
          type="button"
          onClick={() => update({ userType: "provider" })}
          className={`p-3 rounded-xl border text-left transition-all ${data.userType === "provider" ? "border-primary bg-primary/10" : "border-border hover:border-primary/30"}`}
        >
          <Briefcase className={`w-4 h-4 mb-1 ${data.userType === "provider" ? "text-primary" : "text-muted-foreground"}`} />
          <div className="font-semibold text-sm">Profissional</div>
          <div className="text-xs text-muted-foreground">Oferecer serviços</div>
        </button>
      </div>

      <div>
        <Label>Nome completo *</Label>
        <div className="relative mt-1">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={data.displayName} onChange={(e) => update({ displayName: e.target.value })} placeholder="Seu nome completo" className="pl-10 h-11 bg-card border-border" required />
        </div>
      </div>

      <div>
        <Label>CPF *</Label>
        <Input value={data.cpf} onChange={(e) => handleCpfChange(e.target.value)} placeholder="000.000.000-00" className="h-11 bg-card border-border" />
        {cpfError && <p className="text-xs text-destructive mt-1">{cpfError}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Data de nascimento *</Label>
          <Input type="date" value={data.dateOfBirth} onChange={(e) => update({ dateOfBirth: e.target.value })} className="h-11 bg-card border-border" />
        </div>
        <div>
          <Label>Telefone celular *</Label>
          <div className="relative mt-0">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={data.phone} onChange={(e) => update({ phone: maskPhone(e.target.value) })} placeholder="(11) 99999-9999" className="pl-10 h-11 bg-card border-border" />
          </div>
        </div>
      </div>

      <div>
        <Label>Nome da mãe *</Label>
        <Input value={data.motherName} onChange={(e) => update({ motherName: e.target.value })} placeholder="Nome completo da mãe" className="h-11 bg-card border-border" />
      </div>

      <div>
        <Label>E-mail *</Label>
        <div className="relative mt-0">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input type="email" value={data.email} onChange={(e) => update({ email: e.target.value })} placeholder="seu@email.com" className="pl-10 h-11 bg-card border-border" />
        </div>
      </div>

      <div>
        <Label>Senha *</Label>
        <div className="relative mt-0">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input type="password" value={data.password} onChange={(e) => handlePasswordChange(e.target.value)} placeholder="Mínimo 8 caracteres" className="pl-10 h-11 bg-card border-border" />
        </div>
        <PasswordStrengthMeter password={data.password} />
      </div>
    </div>
  );
};

export default StepBasicoPF;
