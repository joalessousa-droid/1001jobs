import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  TrendingUp, Wallet, Award, Globe, Users, BarChart3, Camera, Shield, ArrowRight, CheckCircle2, Zap, Loader2,
} from "lucide-react";

const benefits = [
  {
    icon: Users,
    title: "Acesso a milhares de clientes",
    description: "Sua vitrine profissional visível para clientes da sua região buscando exatamente o que você oferece.",
  },
  {
    icon: Wallet,
    title: "Pagamento garantido",
    description: "O valor do serviço fica protegido na plataforma. Trabalhe com a certeza de que vai receber.",
  },
  {
    icon: Award,
    title: "Reputação que cresce",
    description: "Cada avaliação positiva aumenta sua posição no ranking e atrai mais clientes organicamente.",
  },
  {
    icon: Camera,
    title: "Portfólio profissional",
    description: "Mostre seus trabalhos com fotos, descrições e conquiste a confiança de novos clientes.",
  },
  {
    icon: BarChart3,
    title: "Painel de métricas",
    description: "Acompanhe visualizações do perfil, taxa de conversão e gerencie seus serviços em um só lugar.",
  },
  {
    icon: Globe,
    title: "Presencial e remoto",
    description: "Ofereça serviços locais ou remotos. A geolocalização conecta você a clientes próximos automaticamente.",
  },
];

const plans = [
  {
    name: "Grátis",
    price: "R$ 0",
    period: "/mês",
    planKey: null as string | null,
    description: "Comece sem custo e cresça no seu ritmo.",
    features: [
      "Perfil verificado",
      "Até 3 serviços cadastrados",
      "Portfólio com até 5 fotos",
      "Chat com clientes",
      "Taxa de 12% por transação",
    ],
    cta: "Começar grátis",
    highlight: false,
  },
  {
    name: "Pro",
    price: "R$ 49",
    period: "/mês",
    planKey: "pro",
    description: "Para quem quer mais visibilidade e recursos.",
    features: [
      "Tudo do plano Grátis",
      "Serviços ilimitados",
      "Portfólio ilimitado",
      "Selo Pro no perfil",
      "Destaque nos resultados",
      "Taxa reduzida de 8%",
      "Relatórios avançados",
    ],
    cta: "Assinar Pro",
    highlight: true,
  },
  {
    name: "Business",
    price: "R$ 149",
    period: "/mês",
    planKey: "business",
    description: "Para equipes e empresas de serviços.",
    features: [
      "Tudo do plano Pro",
      "Múltiplos profissionais",
      "Página da empresa",
      "API de integração",
      "Taxa de apenas 5%",
      "Suporte prioritário",
    ],
    cta: "Falar com vendas",
    highlight: false,
  },
];

const testimonials = [
  {
    name: "Marcos Silva",
    role: "Eletricista · São Paulo",
    text: "Em 3 meses na 1001Jobs, tripliquei meu faturamento. A plataforma traz clientes qualificados direto para mim.",
  },
  {
    name: "Ana Beatriz",
    role: "Designer de Interiores · Rio de Janeiro",
    text: "O portfólio profissional fez toda diferença. Os clientes chegam já sabendo o que esperar do meu trabalho.",
  },
  {
    name: "Carlos Mendes",
    role: "Desenvolvedor Web · Remoto",
    text: "Finalmente uma plataforma que protege o pagamento. Trabalho tranquilo sabendo que vou receber pelo serviço.",
  },
];

const ForProfessionals = () => {
  const { user } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handleSubscribe = async (planKey: string) => {
    if (!user) {
      toast.error("Faça login para assinar um plano.");
      return;
    }
    setLoadingPlan(planKey);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ plan: planKey }),
        }
      );
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error || "Erro ao iniciar pagamento.");
      }
    } catch {
      toast.error("Erro ao conectar com o pagamento.");
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="pt-28 pb-16 relative">
        <div className="absolute inset-0 hero-glow opacity-30" />
        <div className="container px-6 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Zap className="w-4 h-4" />
            Para profissionais
          </div>
          <h1 className="text-4xl md:text-6xl font-bold font-display mb-4">
            Transforme seu talento em <span className="text-gradient">receita recorrente</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-8">
            Cadastre-se gratuitamente, monte seu portfólio e comece a receber propostas de clientes na sua região.
          </p>
          <Link to="/auth">
            <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl gap-2 text-base h-14 px-8">
              Criar conta profissional <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20">
        <div className="container px-6">
          <h2 className="text-3xl md:text-4xl font-bold font-display text-center mb-16">
            Por que escolher a <span className="text-gradient">1001Jobs</span>?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {benefits.map((b) => (
              <div
                key={b.title}
                className="group p-8 rounded-2xl bg-card border border-border hover:border-primary/20 hover:glow-border transition-all duration-500"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-colors">
                  <b.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold font-display mb-2">{b.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{b.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20">
        <div className="container px-6">
          <h2 className="text-3xl md:text-4xl font-bold font-display text-center mb-12">
            Quem já usa, <span className="text-gradient">recomenda</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {testimonials.map((t) => (
              <div key={t.name} className="p-6 rounded-2xl bg-card border border-border">
                <p className="text-muted-foreground text-sm leading-relaxed mb-4">"{t.text}"</p>
                <div>
                  <p className="font-semibold text-sm">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20">
        <div className="container px-6">
          <h2 className="text-3xl md:text-4xl font-bold font-display text-center mb-4">
            Planos <span className="text-gradient">transparentes</span>
          </h2>
          <p className="text-muted-foreground text-center mb-12 max-w-xl mx-auto">
            Comece grátis e faça upgrade quando estiver pronto para crescer.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`p-8 rounded-2xl border transition-all ${
                  plan.highlight
                    ? "bg-card border-primary/40 glow-border"
                    : "bg-card border-border"
                }`}
              >
                {plan.highlight && (
                  <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
                    Mais popular
                  </span>
                )}
                <h3 className="text-xl font-bold font-display">{plan.name}</h3>
                <div className="flex items-baseline gap-1 my-3">
                  <span className="text-4xl font-bold font-display">{plan.price}</span>
                  <span className="text-muted-foreground text-sm">{plan.period}</span>
                </div>
                <p className="text-muted-foreground text-sm mb-6">{plan.description}</p>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                {plan.planKey ? (
                  <Button
                    onClick={() => handleSubscribe(plan.planKey!)}
                    disabled={loadingPlan === plan.planKey}
                    className={`w-full rounded-xl h-12 ${
                      plan.highlight
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    }`}
                  >
                    {loadingPlan === plan.planKey ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    {plan.cta}
                  </Button>
                ) : (
                  <Link to="/auth">
                    <Button
                      className={`w-full rounded-xl h-12 ${
                        plan.highlight
                          ? "bg-primary text-primary-foreground hover:bg-primary/90"
                          : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                      }`}
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container px-6 max-w-3xl mx-auto text-center">
          <div className="p-10 rounded-2xl bg-card border border-primary/20 glow-border">
            <TrendingUp className="w-12 h-12 text-primary mx-auto mb-4" />
            <h2 className="text-3xl font-bold font-display mb-3">Pronto para crescer?</h2>
            <p className="text-muted-foreground mb-6">
              Junte-se a milhares de profissionais que já estão construindo uma carreira mais estável e lucrativa na 1001Jobs.
            </p>
            <Link to="/auth">
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl gap-2">
                Criar minha conta <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default ForProfessionals;
