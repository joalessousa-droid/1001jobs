import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Save, Building2, UserCheck, Clock, MapPin, Loader2 } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface Props {
  profileId: string;
}

const validateCPF = (cpf: string): boolean => {
  const clean = cpf.replace(/\D/g, "");
  if (clean.length !== 11 || /^(\d)\1+$/.test(clean)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(clean[i]) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== parseInt(clean[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(clean[i]) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  return rest === parseInt(clean[10]);
};

const validateCNPJ = (cnpj: string): boolean => {
  const clean = cnpj.replace(/\D/g, "");
  if (clean.length !== 14 || /^(\d)\1+$/.test(clean)) return false;
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(clean[i]) * weights1[i];
  let rest = sum % 11;
  if (rest < 2) rest = 0; else rest = 11 - rest;
  if (rest !== parseInt(clean[12])) return false;
  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(clean[i]) * weights2[i];
  rest = sum % 11;
  if (rest < 2) rest = 0; else rest = 11 - rest;
  return rest === parseInt(clean[13]);
};

const formatCPF = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};

const formatCNPJ = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d.replace(/(\d{2})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1/$2").replace(/(\d{4})(\d{1,2})$/, "$1-$2");
};

const formatCEP = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.replace(/(\d{5})(\d)/, "$1-$2");
};

const SecondaryProfileSection = ({ profileId }: Props) => {
  const { toast } = useToast();
  const [personType, setPersonType] = useState("fisica");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [cep, setCep] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [businessHours, setBusinessHours] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [docError, setDocError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("person_type, cpf_cnpj, cep, address_street, address_number, address_complement, address_neighborhood, business_hours")
      .eq("id", profileId)
      .single()
      .then(({ data }) => {
        if (data) {
          setPersonType((data as any).person_type || "fisica");
          setCpfCnpj((data as any).cpf_cnpj || "");
          setCep((data as any).cep || "");
          setStreet((data as any).address_street || "");
          setNumber((data as any).address_number || "");
          setComplement((data as any).address_complement || "");
          setNeighborhood((data as any).address_neighborhood || "");
          setBusinessHours((data as any).business_hours || "");
        }
        setLoading(false);
      });
  }, [profileId]);

  const handleCepChange = async (value: string) => {
    const formatted = formatCEP(value);
    setCep(formatted);
    const clean = value.replace(/\D/g, "");
    if (clean.length === 8) {
      setLoadingCep(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setStreet(data.logradouro || "");
          setNeighborhood(data.bairro || "");
        }
      } catch {
        // ignore
      }
      setLoadingCep(false);
    }
  };

  const handleDocChange = (value: string) => {
    if (personType === "fisica") {
      setCpfCnpj(formatCPF(value));
    } else {
      setCpfCnpj(formatCNPJ(value));
    }
    setDocError("");
  };

  const handleSave = async () => {
    const clean = cpfCnpj.replace(/\D/g, "");
    if (clean.length > 0) {
      if (personType === "fisica" && !validateCPF(clean)) {
        setDocError("CPF inválido");
        return;
      }
      if (personType === "juridica" && !validateCNPJ(clean)) {
        setDocError("CNPJ inválido");
        return;
      }
    }

    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        person_type: personType,
        cpf_cnpj: clean || null,
        cep: cep.replace(/\D/g, "") || null,
        address_street: street || null,
        address_number: number || null,
        address_complement: complement || null,
        address_neighborhood: neighborhood || null,
        business_hours: businessHours || null,
      } as any)
      .eq("id", profileId);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Dados complementares salvos!" });
    }
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold font-display">Dados Complementares</h2>
        <p className="text-muted-foreground text-sm mt-1">Informações fiscais, endereço comercial e horário de atendimento</p>
      </div>

      <div className="p-6 rounded-2xl bg-card border border-border space-y-5">
        <div>
          <Label className="flex items-center gap-2 mb-3">
            <UserCheck className="w-4 h-4 text-muted-foreground" /> Tipo de pessoa
          </Label>
          <RadioGroup value={personType} onValueChange={(v) => { setPersonType(v); setCpfCnpj(""); setDocError(""); }} className="flex gap-4">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="fisica" id="fisica" />
              <Label htmlFor="fisica" className="cursor-pointer">Pessoa Física</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="juridica" id="juridica" />
              <Label htmlFor="juridica" className="cursor-pointer">Pessoa Jurídica</Label>
            </div>
          </RadioGroup>
        </div>

        <div>
          <Label htmlFor="cpf_cnpj" className="flex items-center gap-2 mb-1.5">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            {personType === "fisica" ? "CPF" : "CNPJ"}
          </Label>
          <Input
            id="cpf_cnpj"
            value={cpfCnpj}
            onChange={(e) => handleDocChange(e.target.value)}
            className="h-12 bg-background border-border"
            placeholder={personType === "fisica" ? "000.000.000-00" : "00.000.000/0000-00"}
            maxLength={personType === "fisica" ? 14 : 18}
          />
          {docError && <p className="text-sm text-destructive mt-1">{docError}</p>}
        </div>

        <div className="border-t border-border pt-5">
          <Label className="flex items-center gap-2 mb-3">
            <MapPin className="w-4 h-4 text-muted-foreground" /> Endereço Comercial
          </Label>
          <div className="space-y-3">
            <div className="relative">
              <Input
                value={cep}
                onChange={(e) => handleCepChange(e.target.value)}
                className="h-12 bg-background border-border"
                placeholder="CEP: 00000-000"
                maxLength={9}
              />
              {loadingCep && <Loader2 className="w-4 h-4 animate-spin text-primary absolute right-3 top-4" />}
            </div>
            <Input value={street} onChange={(e) => setStreet(e.target.value)} className="h-12 bg-background border-border" placeholder="Rua / Avenida" />
            <div className="grid grid-cols-3 gap-3">
              <Input value={number} onChange={(e) => setNumber(e.target.value)} className="h-12 bg-background border-border" placeholder="Número" />
              <Input value={complement} onChange={(e) => setComplement(e.target.value)} className="h-12 bg-background border-border col-span-2" placeholder="Complemento" />
            </div>
            <Input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} className="h-12 bg-background border-border" placeholder="Bairro" />
          </div>
        </div>

        <div className="border-t border-border pt-5">
          <Label htmlFor="hours" className="flex items-center gap-2 mb-1.5">
            <Clock className="w-4 h-4 text-muted-foreground" /> Horário de Atendimento
          </Label>
          <Input
            id="hours"
            value={businessHours}
            onChange={(e) => setBusinessHours(e.target.value)}
            className="h-12 bg-background border-border"
            placeholder="Ex: Seg a Sex, 08:00 - 18:00"
          />
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full h-12 rounded-xl gap-2">
          <Save className="w-4 h-4" />
          {saving ? "Salvando..." : "Salvar dados complementares"}
        </Button>
      </div>
    </div>
  );
};

export default SecondaryProfileSection;
