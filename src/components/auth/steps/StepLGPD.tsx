import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, FileText, Eye } from "lucide-react";
import { Link } from "react-router-dom";

interface Props {
  termsAccepted: boolean;
  privacyAccepted: boolean;
  dataProcessingAccepted: boolean;
  onTermsChange: (v: boolean) => void;
  onPrivacyChange: (v: boolean) => void;
  onDataProcessingChange: (v: boolean) => void;
}

const StepLGPD = ({
  termsAccepted, privacyAccepted, dataProcessingAccepted,
  onTermsChange, onPrivacyChange, onDataProcessingChange,
}: Props) => {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 mb-2">
        <Shield className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-lg">Consentimento e Privacidade</h3>
      </div>

      <p className="text-sm text-muted-foreground">
        Em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018), 
        precisamos do seu consentimento explícito para o tratamento de seus dados pessoais.
      </p>

      {/* Summary of data processing */}
      <div className="p-4 rounded-xl bg-muted/50 border border-border space-y-3">
        <p className="text-sm font-medium flex items-center gap-2">
          <Eye className="w-4 h-4 text-primary" /> Como seus dados serão utilizados:
        </p>
        <ul className="text-xs text-muted-foreground space-y-1.5 ml-6 list-disc">
          <li>Verificação de identidade e prevenção a fraudes</li>
          <li>Criação e manutenção do seu perfil na plataforma</li>
          <li>Comunicação sobre serviços, agendamentos e transações</li>
          <li>Cumprimento de obrigações legais e regulatórias</li>
          <li>Melhoria contínua dos serviços da plataforma</li>
        </ul>
        <p className="text-xs text-muted-foreground">
          <strong>Retenção:</strong> Seus dados serão mantidos enquanto sua conta estiver ativa. 
          Após exclusão da conta, os dados serão anonimizados em até 30 dias, exceto quando 
          houver obrigação legal de retenção.
        </p>
        <p className="text-xs text-muted-foreground">
          <strong>Segurança:</strong> Utilizamos criptografia em trânsito (HTTPS/TLS) e em repouso 
          para proteger seus dados. Senhas são armazenadas com hash bcrypt.
        </p>
      </div>

      {/* Consent checkboxes */}
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 rounded-xl border border-border hover:border-primary/30 transition-colors">
          <Checkbox
            id="terms"
            checked={termsAccepted}
            onCheckedChange={(v) => onTermsChange(v === true)}
            className="mt-0.5"
          />
          <div>
            <Label htmlFor="terms" className="text-sm font-medium cursor-pointer">
              Termos de Uso *
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Li e concordo com os{" "}
              <Link to="/terms" target="_blank" className="text-primary hover:underline">
                Termos de Uso
              </Link>{" "}
              da plataforma 1001Jobs.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-4 rounded-xl border border-border hover:border-primary/30 transition-colors">
          <Checkbox
            id="privacy"
            checked={privacyAccepted}
            onCheckedChange={(v) => onPrivacyChange(v === true)}
            className="mt-0.5"
          />
          <div>
            <Label htmlFor="privacy" className="text-sm font-medium cursor-pointer">
              Política de Privacidade *
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Li e concordo com a{" "}
              <Link to="/privacy" target="_blank" className="text-primary hover:underline">
                Política de Privacidade
              </Link>
              , incluindo a coleta e tratamento dos meus dados pessoais.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-4 rounded-xl border border-border hover:border-primary/30 transition-colors">
          <Checkbox
            id="data-processing"
            checked={dataProcessingAccepted}
            onCheckedChange={(v) => onDataProcessingChange(v === true)}
            className="mt-0.5"
          />
          <div>
            <Label htmlFor="data-processing" className="text-sm font-medium cursor-pointer">
              Tratamento de Dados Pessoais *
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Autorizo o tratamento dos meus dados pessoais, incluindo CPF, documentos de identidade 
              e dados biométricos (selfie) para fins de verificação de identidade e prevenção a fraudes, 
              conforme descrito acima.
            </p>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Você pode revogar seu consentimento a qualquer momento nas configurações de privacidade 
        da sua conta. A revogação não afeta a licitude do tratamento realizado anteriormente.
      </p>
    </div>
  );
};

export default StepLGPD;
