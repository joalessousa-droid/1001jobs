import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building, Mail, Lock, Phone, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RegisterData } from "../RegisterWizard";
import { maskCNPJ, maskCPF, maskPhone, validarCNPJ, validarCPF, validarSenhaForte, consultarCNPJ } from "@/lib/validators";
import { useToast } from "@/hooks/use-toast";
import PasswordStrengthMeter from "../PasswordStrengthMeter";
import PasswordInput from "../PasswordInput";

interface Props {
  data: RegisterData;
  update: (fields: Partial<RegisterData>) => void;
}

const StepBasicoPJ = ({ data, update }: Props) => {
  const { toast } = useToast();
  const [cnpjError, setCnpjError] = useState("");
  const [repCpfError, setRepCpfError] = useState("");
  const [pwErrors, setPwErrors] = useState<string[]>([]);
  const [lookingUp, setLookingUp] = useState(false);

  const handleCnpjChange = async (val: string) => {
    const masked = maskCNPJ(val);
    update({ cnpj: masked });
    const raw = masked.replace(/\D/g, '');
    if (raw.length === 14) {
      if (!validarCNPJ(raw)) {
        setCnpjError("CNPJ inválido");
        return;
      }
      setCnpjError("");
      // Auto-fill from BrasilAPI
      setLookingUp(true);
      try {
        const result = await consultarCNPJ(raw);
        update({
          razaoSocial: result.razao_social || "",
          nomeFantasia: result.nome_fantasia || "",
          dataAbertura: result.data_inicio_atividade || "",
          naturezaJuridica: result.natureza_juridica || "",
          cnae: result.cnae_fiscal_descricao || "",
          capitalSocial: result.capital_social?.toString() || "",
        });
        toast({ title: "CNPJ encontrado!", description: "Dados preenchidos automaticamente." });
      } catch {
        toast({ title: "CNPJ não encontrado na base pública", variant: "destructive" });
      } finally {
        setLookingUp(false);
      }
    } else {
      setCnpjError("");
    }
  };

  const handleRepCpf = (val: string) => {
    const masked = maskCPF(val);
    update({ repCpf: masked });
    const raw = masked.replace(/\D/g, '');
    if (raw.length === 11) setRepCpfError(validarCPF(raw) ? "" : "CPF inválido");
    else setRepCpfError("");
  };

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-muted-foreground mb-2">Dados da Empresa</p>

      <div>
        <Label>CNPJ *</Label>
        <div className="relative">
          <Input value={data.cnpj} onChange={(e) => handleCnpjChange(e.target.value)} placeholder="00.000.000/0000-00" className="h-11 bg-card border-border" />
          {lookingUp && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary" />}
        </div>
        {cnpjError && <p className="text-xs text-destructive mt-1">{cnpjError}</p>}
      </div>

      <div>
        <Label>Razão Social *</Label>
        <Input value={data.razaoSocial} onChange={(e) => update({ razaoSocial: e.target.value })} className="h-11 bg-card border-border" />
      </div>

      <div>
        <Label>Nome Fantasia</Label>
        <Input value={data.nomeFantasia} onChange={(e) => update({ nomeFantasia: e.target.value })} className="h-11 bg-card border-border" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Data de Abertura</Label>
          <Input type="date" value={data.dataAbertura} onChange={(e) => update({ dataAbertura: e.target.value })} className="h-11 bg-card border-border" />
        </div>
        <div>
          <Label>Capital Social</Label>
          <Input value={data.capitalSocial} onChange={(e) => update({ capitalSocial: e.target.value })} placeholder="R$ 0,00" className="h-11 bg-card border-border" />
        </div>
      </div>

      <div>
        <Label>Natureza Jurídica</Label>
        <Input value={data.naturezaJuridica} onChange={(e) => update({ naturezaJuridica: e.target.value })} className="h-11 bg-card border-border" />
      </div>

      <div>
        <Label>CNAE Principal</Label>
        <Input value={data.cnae} onChange={(e) => update({ cnae: e.target.value })} className="h-11 bg-card border-border" />
      </div>

      {/* Separator */}
      <div className="border-t border-border pt-4 mt-4">
        <p className="text-sm font-medium text-muted-foreground mb-3">Representante Legal</p>
      </div>

      <div>
        <Label>Nome completo *</Label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={data.repName} onChange={(e) => update({ repName: e.target.value })} className="pl-10 h-11 bg-card border-border" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>CPF *</Label>
          <Input value={data.repCpf} onChange={(e) => handleRepCpf(e.target.value)} placeholder="000.000.000-00" className="h-11 bg-card border-border" />
          {repCpfError && <p className="text-xs text-destructive mt-1">{repCpfError}</p>}
        </div>
        <div>
          <Label>Data de nascimento</Label>
          <Input type="date" value={data.repBirthDate} onChange={(e) => update({ repBirthDate: e.target.value })} className="h-11 bg-card border-border" />
        </div>
      </div>

      <div>
        <Label>E-mail *</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input type="email" value={data.repEmail} onChange={(e) => update({ repEmail: e.target.value })} placeholder="email@empresa.com" className="pl-10 h-11 bg-card border-border" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Telefone *</Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={data.repPhone} onChange={(e) => update({ repPhone: maskPhone(e.target.value) })} placeholder="(11) 99999-9999" className="pl-10 h-11 bg-card border-border" />
          </div>
        </div>
        <div>
          <Label>Cargo na empresa *</Label>
          <Input value={data.repRole} onChange={(e) => update({ repRole: e.target.value })} placeholder="Sócio, Diretor..." className="h-11 bg-card border-border" />
        </div>
      </div>

      <div>
        <Label>Senha *</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
          <PasswordInput value={data.password} onChange={(e) => {
            update({ password: e.target.value });
            setPwErrors(validarSenhaForte(e.target.value).errors);
          }} placeholder="Mínimo 8 caracteres" className="pl-10 h-11 bg-card border-border" />
        </div>
        <PasswordStrengthMeter password={data.password} />
      </div>
    </div>
  );
};

export default StepBasicoPJ;
