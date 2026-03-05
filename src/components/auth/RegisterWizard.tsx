import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isTemporaryEmail, validarSenhaForte } from "@/lib/validators";
import { collectFingerprint, getGeoFromIP } from "@/lib/deviceFingerprint";
import StepBasicoPF from "./steps/StepBasicoPF";
import StepBasicoPJ from "./steps/StepBasicoPJ";
import StepEndereco from "./steps/StepEndereco";
import StepProfissional from "./steps/StepProfissional";
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

  const update = (fields: Partial<RegisterData>) => setData((prev) => ({ ...prev, ...fields }));

  const isPJ = data.personType === "juridica";
  const isProvider = data.userType === "provider";

  // Steps vary by person/user type
  const steps = [
    { label: isPJ ? "Dados Empresariais" : "Dados Básicos" },
    { label: "Endereço" },
    ...(isProvider ? [{ label: "Dados Profissionais" }] : []),
  ];

  const totalSteps = steps.length;

  const handleNext = () => {
    if (step < totalSteps - 1) setStep(step + 1);
    else handleSubmit();
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleSubmit = async () => {
    // Validate email
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
        // Address
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
        options: {
          data: metadata,
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) throw error;

      // Update profile with extra fields after signup
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

        // Profile is created by trigger; update with extra fields + run risk score
        // Small delay for trigger to complete
        setTimeout(async () => {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id")
            .eq("user_id", authData.user!.id)
            .single();

          if (profiles) {
            await supabase.from("profiles").update(profileUpdate).eq("id", profiles.id);
          }

          // Collect device fingerprint and run risk scoring
          try {
            const [fingerprint, geo] = await Promise.all([
              collectFingerprint(),
              getGeoFromIP(),
            ]);

            await supabase.functions.invoke("risk-score", {
              body: { fingerprint, geo },
            });
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
    if (step === 1) {
      return <StepEndereco data={data} update={update} />;
    }
    if (step === 2 && isProvider) {
      return <StepProfissional data={data} update={update} />;
    }
    return null;
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Progress */}
      <div className="flex items-center gap-2 mb-8">
        {steps.map((s, i) => (
          <div key={i} className="flex-1">
            <div className={`h-1.5 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-muted"}`} />
            <p className={`text-xs mt-1 ${i <= step ? "text-foreground font-medium" : "text-muted-foreground"}`}>
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
          disabled={loading}
          className="flex-1 h-12 rounded-xl gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {step < totalSteps - 1 ? (
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
