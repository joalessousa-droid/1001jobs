import { Shield, Globe, TrendingUp, Wallet, Award, Layers } from "lucide-react";

const features = [
  {
    icon: Shield,
    title: "Pagamento intermediado",
    description: "O valor fica retido até a conclusão do serviço. Proteção total para ambos os lados.",
  },
  {
    icon: Award,
    title: "Reputação inteligente",
    description: "Sistema de avaliação multicritério que destaca os melhores profissionais organicamente.",
  },
  {
    icon: Globe,
    title: "Híbrido: digital + presencial",
    description: "Serviços remotos e locais na mesma plataforma, com geolocalização integrada.",
  },
  {
    icon: Wallet,
    title: "Modelo justo",
    description: "Plano gratuito com taxa por transação. Planos premium para mais visibilidade e recursos.",
  },
  {
    icon: TrendingUp,
    title: "Previsibilidade de renda",
    description: "Ferramentas que ajudam profissionais a construir receita recorrente e estável.",
  },
  {
    icon: Layers,
    title: "Disputas e garantias",
    description: "Sistema estruturado de resolução de conflitos para garantir entrega e satisfação.",
  },
];

const Features = () => {
  return (
    <section className="py-32 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.02] to-transparent" />
      <div className="container px-6 relative">
        <div className="text-center mb-20">
          <h2 className="text-4xl md:text-5xl font-bold font-display mb-4">
            Por que a <span className="text-gradient">1001Jobs</span>?
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Infraestrutura completa para o futuro do trabalho flexível.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group p-8 rounded-2xl bg-card border border-border hover:border-primary/20 hover:glow-border transition-all duration-500"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold font-display mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
