import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const CTASection = () => {
  return (
    <section className="py-32 relative">
      <div className="absolute inset-0 hero-glow opacity-50" />
      <div className="container px-6 relative">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-6xl font-bold font-display mb-6 leading-tight">
            O futuro do trabalho
            <br />
            <span className="text-gradient">começa aqui.</span>
          </h2>
          <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto">
            Junte-se à plataforma que está redefinindo como serviços são contratados na nova economia.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="h-14 px-10 text-base font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 gap-2 shadow-lg shadow-primary/25">
              Criar conta gratuita
              <ArrowRight className="w-5 h-5" />
            </Button>
            <Button size="lg" variant="outline" className="h-14 px-10 text-base font-semibold rounded-xl border-border hover:bg-secondary">
              Falar com o time
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
