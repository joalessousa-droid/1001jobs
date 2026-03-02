import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Search, UserCheck, CreditCard, Star, Shield, MessageCircle, CheckCircle2, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const steps = [
  {
    icon: Search,
    number: "01",
    title: "Busque o serviço que precisa",
    description: "Use filtros por categoria, localização e avaliação para encontrar profissionais qualificados perto de você.",
    details: [
      "Mais de 50 categorias de serviços",
      "Filtro por distância e disponibilidade",
      "Resultados ordenados por reputação",
    ],
  },
  {
    icon: UserCheck,
    number: "02",
    title: "Compare e escolha",
    description: "Analise perfis verificados, portfólios com fotos reais e avaliações detalhadas de outros clientes.",
    details: [
      "Perfis com verificação de identidade",
      "Portfólios com fotos de trabalhos anteriores",
      "Avaliações com nota e comentários reais",
    ],
  },
  {
    icon: MessageCircle,
    number: "03",
    title: "Converse e alinhe",
    description: "Use o chat integrado para discutir detalhes, combinar preços e definir prazos antes de contratar.",
    details: [
      "Chat em tempo real na plataforma",
      "Compartilhamento de fotos e arquivos",
      "Histórico completo da conversa",
    ],
  },
  {
    icon: CreditCard,
    number: "04",
    title: "Contrate com segurança",
    description: "O pagamento fica retido na plataforma até você aprovar a conclusão do serviço.",
    details: [
      "Pagamento protegido por escrow",
      "Liberação somente após aprovação",
      "Reembolso em caso de não entrega",
    ],
  },
  {
    icon: Star,
    number: "05",
    title: "Avalie e recomende",
    description: "Após a conclusão, avalie o profissional e ajude outros clientes a fazer boas escolhas.",
    details: [
      "Avaliação por estrelas e comentário",
      "Influencia o ranking do profissional",
      "Transparência total para a comunidade",
    ],
  },
];

const faqs = [
  {
    q: "Preciso pagar para me cadastrar?",
    a: "Não. O cadastro é gratuito tanto para clientes quanto para profissionais. Cobramos apenas uma pequena taxa sobre transações concluídas.",
  },
  {
    q: "Como funciona a proteção do pagamento?",
    a: "O valor do serviço fica retido na plataforma (escrow). O profissional só recebe após o cliente aprovar a conclusão. Em caso de problemas, nosso time de mediação intervém.",
  },
  {
    q: "Posso cancelar um serviço contratado?",
    a: "Sim. Antes do início, o cancelamento é gratuito. Após o início, aplicamos nossa política de mediação para garantir justiça para ambas as partes.",
  },
  {
    q: "Os profissionais são verificados?",
    a: "Sim. Todos passam por verificação de identidade. Profissionais com selo 'Verificado' completaram etapas adicionais de validação.",
  },
];

const HowItWorksPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="pt-28 pb-16 relative">
        <div className="absolute inset-0 hero-glow opacity-30" />
        <div className="container px-6 text-center relative z-10">
          <h1 className="text-4xl md:text-6xl font-bold font-display mb-4">
            Como a <span className="text-gradient">1001Jobs</span> funciona
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Do primeiro clique à avaliação final — entenda cada etapa da experiência para clientes e profissionais.
          </p>
        </div>
      </section>

      {/* Steps */}
      <section className="py-20">
        <div className="container px-6 max-w-4xl mx-auto space-y-12">
          {steps.map((step, i) => (
            <div
              key={step.number}
              className="group relative flex flex-col md:flex-row gap-8 p-8 rounded-2xl bg-card border border-border hover:border-primary/30 transition-all"
            >
              <div className="shrink-0 flex items-start gap-4">
                <span className="text-5xl font-bold font-display text-primary/20">{step.number}</span>
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <step.icon className="w-7 h-7 text-primary" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-semibold font-display mb-2">{step.title}</h3>
                <p className="text-muted-foreground mb-4">{step.description}</p>
                <ul className="space-y-2">
                  {step.details.map((d) => (
                    <li key={d} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Guarantee */}
      <section className="py-20">
        <div className="container px-6 max-w-4xl mx-auto">
          <div className="p-10 rounded-2xl bg-card border border-primary/20 glow-border text-center">
            <Shield className="w-12 h-12 text-primary mx-auto mb-4" />
            <h2 className="text-3xl font-bold font-display mb-3">Garantia 1001Jobs</h2>
            <p className="text-muted-foreground max-w-xl mx-auto mb-6">
              Se o serviço não for entregue conforme combinado, devolvemos 100% do valor. Nossa equipe de mediação está disponível para resolver qualquer conflito.
            </p>
            <Link to="/auth">
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl gap-2">
                Comece agora <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20">
        <div className="container px-6 max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold font-display text-center mb-12">
            Perguntas <span className="text-gradient">frequentes</span>
          </h2>
          <div className="space-y-4">
            {faqs.map((faq) => (
              <details
                key={faq.q}
                className="group p-6 rounded-2xl bg-card border border-border hover:border-primary/20 transition-colors"
              >
                <summary className="font-semibold font-display cursor-pointer list-none flex items-center justify-between">
                  {faq.q}
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-open:rotate-90 transition-transform" />
                </summary>
                <p className="mt-3 text-muted-foreground text-sm leading-relaxed">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default HowItWorksPage;
