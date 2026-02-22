import { Search, UserCheck, CreditCard, Star } from "lucide-react";

const steps = [
  {
    icon: Search,
    number: "01",
    title: "Busque o serviço",
    description: "Encontre profissionais qualificados por categoria, localização ou avaliação.",
  },
  {
    icon: UserCheck,
    number: "02",
    title: "Escolha o profissional",
    description: "Compare perfis verificados, portfólios e avaliações reais de outros clientes.",
  },
  {
    icon: CreditCard,
    number: "03",
    title: "Contrate com segurança",
    description: "O pagamento fica retido até a conclusão e aprovação do serviço.",
  },
  {
    icon: Star,
    number: "04",
    title: "Avalie e construa confiança",
    description: "Seu feedback alimenta o sistema de reputação inteligente da plataforma.",
  },
];

const HowItWorks = () => {
  return (
    <section className="py-32 relative">
      <div className="container px-6">
        <div className="text-center mb-20">
          <h2 className="text-4xl md:text-5xl font-bold font-display mb-4">
            Como <span className="text-gradient">funciona</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Simplicidade do início ao fim. Sem burocracia, sem surpresas.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
          {steps.map((step) => (
            <div
              key={step.number}
              className="group relative p-8 rounded-2xl bg-card border border-border hover:border-primary/30 transition-all duration-300"
            >
              <span className="text-6xl font-bold font-display text-primary/10 absolute top-4 right-6">
                {step.number}
              </span>
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                <step.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold font-display mb-3">{step.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
