import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Briefcase } from "lucide-react";
import type { RegisterData } from "../RegisterWizard";

interface Props {
  data: RegisterData;
  update: (fields: Partial<RegisterData>) => void;
}

const StepProfissional = ({ data, update }: Props) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Briefcase className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-lg">Dados Profissionais</h3>
      </div>

      <div>
        <Label>Descrição profissional</Label>
        <Textarea
          value={data.bio}
          onChange={(e) => update({ bio: e.target.value })}
          placeholder="Descreva sua experiência e especialidades..."
          className="bg-card border-border min-h-[100px]"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Anos de experiência</Label>
          <Input
            type="number"
            value={data.yearsExperience}
            onChange={(e) => update({ yearsExperience: e.target.value })}
            placeholder="Ex: 5"
            className="h-11 bg-card border-border"
          />
        </div>
        <div>
          <Label>Registro profissional</Label>
          <Input
            value={data.professionalRegistration}
            onChange={(e) => update({ professionalRegistration: e.target.value })}
            placeholder="CREA, OAB, CRM..."
            className="h-11 bg-card border-border"
          />
        </div>
      </div>

      <div className="p-4 rounded-xl bg-muted/50 border border-border">
        <p className="text-sm text-muted-foreground">
          💡 Após o cadastro, você poderá adicionar suas categorias de serviço, portfólio e fotos no painel do profissional.
        </p>
      </div>
    </div>
  );
};

export default StepProfissional;
