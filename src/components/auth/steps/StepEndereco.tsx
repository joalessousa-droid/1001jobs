import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, MapPin } from "lucide-react";
import type { RegisterData } from "../RegisterWizard";
import { maskCEP, consultarCEP } from "@/lib/validators";
import { useToast } from "@/hooks/use-toast";

interface Props {
  data: RegisterData;
  update: (fields: Partial<RegisterData>) => void;
}

const StepEndereco = ({ data, update }: Props) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleCepChange = async (val: string) => {
    const masked = maskCEP(val);
    update({ cep: masked });
    const raw = masked.replace(/\D/g, '');
    if (raw.length === 8) {
      setLoading(true);
      try {
        const result = await consultarCEP(raw);
        update({
          street: result.logradouro || "",
          neighborhood: result.bairro || "",
          city: result.localidade || "",
          state: result.uf || "",
        });
      } catch {
        toast({ title: "CEP não encontrado", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <MapPin className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-lg">Endereço</h3>
      </div>

      <div>
        <Label>CEP *</Label>
        <div className="relative">
          <Input value={data.cep} onChange={(e) => handleCepChange(e.target.value)} placeholder="00000-000" className="h-11 bg-card border-border" />
          {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary" />}
        </div>
      </div>

      <div>
        <Label>Logradouro *</Label>
        <Input value={data.street} onChange={(e) => update({ street: e.target.value })} className="h-11 bg-card border-border" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Número *</Label>
          <Input value={data.number} onChange={(e) => update({ number: e.target.value })} className="h-11 bg-card border-border" />
        </div>
        <div className="col-span-2">
          <Label>Complemento</Label>
          <Input value={data.complement} onChange={(e) => update({ complement: e.target.value })} placeholder="Apto, Bloco..." className="h-11 bg-card border-border" />
        </div>
      </div>

      <div>
        <Label>Bairro *</Label>
        <Input value={data.neighborhood} onChange={(e) => update({ neighborhood: e.target.value })} className="h-11 bg-card border-border" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Cidade *</Label>
          <Input value={data.city} onChange={(e) => update({ city: e.target.value })} className="h-11 bg-card border-border" />
        </div>
        <div>
          <Label>Estado *</Label>
          <Input value={data.state} onChange={(e) => update({ state: e.target.value })} placeholder="SP" maxLength={2} className="h-11 bg-card border-border" />
        </div>
      </div>
    </div>
  );
};

export default StepEndereco;
