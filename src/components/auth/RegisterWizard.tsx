import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isTemporaryEmail, validarSenhaForte } from "@/lib/validators";
import { collectFingerprint, getGeoFromIP } from "@/lib/deviceFingerprint";
import { recordLGPDConsent, uploadKYCDocument, logAuditEvent } from "@/lib/auditLog";
import StepBasicoPF from "./steps/StepBasicoPF";
import StepBasicoPJ from "./steps/StepBasicoPJ";
import StepEndereco from "./steps/StepEndereco";
import StepKYC from "./steps/StepKYC";
import StepProfissional from "./steps/StepProfissional";
import StepLGPD from "./steps/StepLGPD";
import StepOtp from "./steps/StepOtp";

export type PersonType = "fisica" | "juridica";
export type UserType = "client" | "provider";

export interface RegisterData {
  personType: PersonType;
  userType: UserType;
  // PF fields
  displayName: string;
  cpf: string;
  dateOfBirth: string;
  motherName: string;
  email: string;
  phone: string;
  password: string;
  // PJ fields
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  dataAbertura: string;
  naturezaJuridica: string;
  cnae: string;
  capitalSocial: string;
  // Representative (PJ)
  repName: string;
  repCpf: string;
  repBirthDate: string;
  repEmail: string;
  repPhone: string;
  repRole: string;
  // Address
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  // Professional (provider only)
  yearsExperience: string;
  professionalRegistration: string;
  bio: string;
  // Referral
  referralCode: string;
}

const initialData: RegisterData = {
  personType: "fisica",
  userType: "client",
  displayName: "", cpf: "", dateOfBirth: "", motherName: "",
  email: "", phone: "", password: "",
  razaoSocial: "", nomeFantasia: "", cnpj: "", dataAbertura: "",
  naturezaJuridica: "", cnae: "", capitalSocial: "",
  repName: "", repCpf: "", repBirthDate: "", repEmail: "", repPhone: "", repRole: "",
  cep: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "",
  yearsExperience: "", professionalRegistration: "", bio: "",
  referralCode: "",
};

const RegisterWizard = () => {
  const [searchParams] = useSearchParams();
  const initialType = searchParams.get("type") === "provider" ? "provider" : "client";
  const referral = searchParams.get("ref") || "";

  const [data, setData] = useState<RegisterData>({
    ...initialData,
    userType: initialType as UserType,
    referralCode: referral,
  });
  const [step, setStep] = useState(0);
  const [otpStep, setOtpStep] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // KYC files
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfieWithDocFile, setSelfieWithDocFile] = useState<File | null>(null);

  // LGPD consents
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [dataProcessingAccepted, setDataProcessingAccepted] = useState(false);

  const update = (fields: Partial<RegisterData>) => setData((prev) => ({ ...prev, ...fields }));

  const isPJ = data.personType === "juridica";
  const isProvider = data.userType === "provider";

  // Steps: Dados → Endereço → KYC → [Profissional] → LGPD
  const steps = [
    { label: isPJ ? "Dados Empresariais" : "Dados Básicos" },
    { label: "Endereço" },
    { label: "Verificação KYC" },
    ...(isProvider ? [{ label: "Dados Profissionais" }] : []),
    { label: "Consentimento" },
  ];

  const totalSteps = steps.length;

  const validateCurrentStep = (): boolean => {
    // Last step (LGPD) validation
    const lgpdStepIdx = totalSteps - 1;
    if (step === lgpdStepIdx) {
      if (!termsAccepted || !privacyAccepted || !dataProcessingAccepted) {
        toast({ title: "Consentimento obrigatório", description: "Aceite todos os termos para continuar.", variant: "destructive" });
        return false;
      }
    }

    // KYC step validation (step 2)
    if (step === 2) {
      if (!documentFile) {
        toast({ title: "Documento obrigatório", description: "Envie seu documento com foto (RG ou CNH).", variant: "destructive" });
        return false;
      }
      if (!selfieFile) {
        toast({ title: "Selfie obrigatória", description: "Tire uma selfie em tempo real.", variant: "destructive" });
        return false;
      }
    }

    return true;
  };

  const handleNext = () => {
    if (!validateCurrentStep()) return;
    if (step < totalSteps - 1) setStep(step + 1);
    else handleSubmit();
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleSubmit = async () => {
    if (!termsAccepted || !privacyAccepted || !dataProcessingAccepted) {
      toast({ title: "Consentimento obrigatório", description: "Aceite todos os termos.", variant: "destructive" });
      return;
    }

    const email = isPJ ? data.repEmail || data.email : data.email;
    if (isTemporaryEmail(email)) {
      toast({ title: "E-mail temporário não permitido", variant: "destructive" });
      return;
    }

    const pwCheck = validarSenhaForte(data.password);
    if (!pwCheck.valid) {
      toast({ title: "Senha fraca", description: pwCheck.errors.join(", "), variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const displayName = isPJ ? data.nomeFantasia || data.razaoSocial : data.displayName;

      const metadata: Record<string, any> = {
        display_name: displayName,
        user_type: data.userType,
        referral_code: data.referralCode || undefined,
        person_type: data.personType,
        cep: data.cep, address_street: data.street, address_number: data.number,
        address_complement: data.complement, address_neighborhood: data.neighborhood,
        city: data.city, state: data.state,
      };

      if (isPJ) {
        Object.assign(metadata, {
          razao_social: data.razaoSocial, nome_fantasia: data.nomeFantasia,
          cpf_cnpj: data.cnpj, data_abertura: data.dataAbertura,
          natureza_juridica: data.naturezaJuridica, cnae: data.cnae,
          capital_social: data.capitalSocial,
          representative_name: data.repName, representative_cpf: data.repCpf,
          representative_birth_date: data.repBirthDate,
          representative_email: data.repEmail, representative_phone: data.repPhone,
          representative_role: data.repRole,
        });
      } else {
        Object.assign(metadata, {
          cpf_cnpj: data.cpf, date_of_birth: data.dateOfBirth,
          mother_name: data.motherName, phone: data.phone,
        });
      }

      if (isProvider) {
        Object.assign(metadata, {
          years_experience: data.yearsExperience ? parseInt(data.yearsExperience) : null,
          professional_registration: data.professionalRegistration || null,
          bio: data.bio || null,
        });
      }

      const { data: authData, error } = await supabase.auth.signUp({
        email,
        password: data.password,
        options: { data: metadata, emailRedirectTo: window.location.origin },
      });

      if (error) throw error;

      if (authData.user) {
        const profileUpdate: Record<string, any> = {
          cep: data.cep, address_street: data.street, address_number: data.number,
          address_complement: data.complement, address_neighborhood: data.neighborhood,
          city: data.city, state: data.state, person_type: data.personType,
          phone: isPJ ? data.repPhone : data.phone,
        };

        if (isPJ) {
          Object.assign(profileUpdate, {
            razao_social: data.razaoSocial, nome_fantasia: data.nomeFantasia,
            cpf_cnpj: data.cnpj, data_abertura: data.dataAbertura || null,
            natureza_juridica: data.naturezaJuridica, cnae: data.cnae,
            capital_social: data.capitalSocial ? parseFloat(data.capitalSocial) : null,
            representative_name: data.repName, representative_cpf: data.repCpf,
            representative_birth_date: data.repBirthDate || null,
            representative_email: data.repEmail, representative_phone: data.repPhone,
            representative_role: data.repRole,
          });
        } else {
          Object.assign(profileUpdate, {
            cpf_cnpj: data.cpf,
            date_of_birth: data.dateOfBirth || null,
            mother_name: data.motherName,
          });
        }

        if (isProvider) {
          Object.assign(profileUpdate, {
            years_experience: data.yearsExperience ? parseInt(data.yearsExperience) : null,
            professional_registration: data.professionalRegistration || null,
            bio: data.bio || null,
          });
        }

        // Update profile + upload KYC + record consents + risk score
        setTimeout(async () => {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id")
            .eq("user_id", authData.user!.id)
            .single();

          if (profiles) {
            await supabase.from("profiles").update(profileUpdate).eq("id", profiles.id);

            // Upload KYC documents
            const kycUploads: Promise<any>[] = [];
            if (documentFile) {
              kycUploads.push(uploadKYCDocument({
                userId: authData.user!.id, profileId: profiles.id,
                file: documentFile, documentType: "document",
              }));
            }
            if (selfieFile) {
              kycUploads.push(uploadKYCDocument({
                userId: authData.user!.id, profileId: profiles.id,
                file: selfieFile, documentType: "selfie",
              }));
            }
            if (selfieWithDocFile) {
              kycUploads.push(uploadKYCDocument({
                userId: authData.user!.id, profileId: profiles.id,
                file: selfieWithDocFile, documentType: "selfie_with_doc",
              }));
            }
            await Promise.all(kycUploads);

            // Record LGPD consents
            await Promise.all([
              recordLGPDConsent({ consentType: "terms", accepted: true }),
              recordLGPDConsent({ consentType: "privacy", accepted: true }),
              recordLGPDConsent({ consentType: "data_processing", accepted: true }),
            ]);

            // Log signup audit event
            await logAuditEvent({
              action: "signup",
              entityType: "profile",
              entityId: profiles.id,
              details: { person_type: data.personType, user_type: data.userType },
            });

            // Update verification status to pending (KYC submitted)
            await supabase.from("profiles")
              .update({ verification_status: "pending" })
              .eq("id", profiles.id);
          }

          // Risk scoring
          try {
            const [fingerprint, geo] = await Promise.all([
              collectFingerprint(), getGeoFromIP(),
            ]);
            await supabase.functions.invoke("risk-score", { body: { fingerprint, geo } });
          } catch (fpErr) {
            console.warn("Risk scoring failed (non-blocking):", fpErr);
          }
        }, 2000);
      }

      if (authData.session) {
        navigate("/dashboard");
      } else {
        setOtpStep(true);
        toast({ title: "Código enviado!", description: "Verifique seu e-mail e insira o código de 6 dígitos." });
      }
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (otpStep) {
    return <StepOtp email={isPJ ? data.repEmail || data.email : data.email} />;
  }

  const renderStep = () => {
    if (step === 0) {
      return isPJ
        ? <StepBasicoPJ data={data} update={update} />
        : <StepBasicoPF data={data} update={update} />;
    }
    if (step === 1) return <StepEndereco data={data} update={update} />;
    if (step === 2) {
      return (
        <StepKYC
          isPJ={isPJ}
          documentFile={documentFile}
          selfieFile={selfieFile}
          selfieWithDocFile={selfieWithDocFile}
          onDocumentChange={setDocumentFile}
          onSelfieChange={setSelfieFile}
          onSelfieWithDocChange={setSelfieWithDocFile}
        />
      );
    }
    // Provider step (if provider, it's step 3)
    if (isProvider && step === 3) return <StepProfissional data={data} update={update} />;
    // LGPD step (last step)
    const lgpdIdx = totalSteps - 1;
    if (step === lgpdIdx) {
      return (
        <StepLGPD
          termsAccepted={termsAccepted}
          privacyAccepted={privacyAccepted}
          dataProcessingAccepted={dataProcessingAccepted}
          onTermsChange={setTermsAccepted}
          onPrivacyChange={setPrivacyAccepted}
          onDataProcessingChange={setDataProcessingAccepted}
        />
      );
    }
    return null;
  };

  const isLastStep = step === totalSteps - 1;
  const canSubmit = isLastStep && termsAccepted && privacyAccepted && dataProcessingAccepted;

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Progress */}
      <div className="flex items-center gap-1 mb-8">
        {steps.map((s, i) => (
          <div key={i} className="flex-1">
            <div className={`h-1.5 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-muted"}`} />
            <p className={`text-[10px] mt-1 truncate ${i <= step ? "text-foreground font-medium" : "text-muted-foreground"}`}>
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {/* Type selector (only on step 0) */}
      {step === 0 && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            type="button"
            onClick={() => update({ personType: "fisica" })}
            className={`p-3 rounded-xl border text-left text-sm transition-all ${data.personType === "fisica" ? "border-primary bg-primary/10 font-semibold" : "border-border hover:border-primary/30"}`}
          >
            Pessoa Física
          </button>
          <button
            type="button"
            onClick={() => update({ personType: "juridica" })}
            className={`p-3 rounded-xl border text-left text-sm transition-all ${data.personType === "juridica" ? "border-primary bg-primary/10 font-semibold" : "border-border hover:border-primary/30"}`}
          >
            Pessoa Jurídica
          </button>
        </div>
      )}

      {renderStep()}

      {/* Navigation */}
      <div className="flex gap-3 mt-8">
        {step > 0 && (
          <Button variant="outline" onClick={handleBack} className="flex-1 h-12 rounded-xl gap-2">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Button>
        )}
        <Button
          onClick={handleNext}
          disabled={loading || (isLastStep && !canSubmit)}
          className="flex-1 h-12 rounded-xl gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {!isLastStep ? (
            <>Próximo <ArrowRight className="w-4 h-4" /></>
          ) : loading ? "Criando conta..." : (
            <>Criar conta <Check className="w-4 h-4" /></>
          )}
        </Button>
      </div>
    </div>
  );
};

export default RegisterWizard;
