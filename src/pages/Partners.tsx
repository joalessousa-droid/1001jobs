import { useEffect } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Briefcase, Users, Globe, BookOpen, Building2 } from "lucide-react";

type Partner = {
  name: string;
  category: string;
  description: string;
  url: string;
  Icon: any;
};

const PARTNERS: Partner[] = [
  {
    name: "Senac",
    category: "Educação Profissional",
    description: "Capacitação técnica em comércio, serviços e turismo para profissionais autônomos.",
    url: "https://www.senac.br",
    Icon: GraduationCap,
  },
  {
    name: "Senai",
    category: "Educação Industrial",
    description: "Formação técnica em indústria, manutenção e ofícios especializados.",
    url: "https://www.senai.br",
    Icon: Briefcase,
  },
  {
    name: "Sescoop",
    category: "Cooperativismo",
    description: "Apoio à formação cooperativa e desenvolvimento de pequenos empreendedores.",
    url: "https://www.sescoop.coop.br",
    Icon: Users,
  },
  {
    name: "Google",
    category: "Tecnologia",
    description: "Ferramentas de produtividade, presença digital e cursos do Google Ateliê Digital.",
    url: "https://learndigital.withgoogle.com",
    Icon: Globe,
  },
  {
    name: "Coursera",
    category: "Cursos Online",
    description: "Certificações internacionais em tecnologia, gestão e habilidades profissionais.",
    url: "https://www.coursera.org",
    Icon: BookOpen,
  },
];

const Partners = () => {
  useEffect(() => {
    document.title = "Parceiros Institucionais | 1001Jobs";
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container px-6 py-24 max-w-6xl">
        <header className="mb-12 text-center">
          <Badge variant="secondary" className="mb-4">
            <Building2 className="h-3 w-3 mr-1" /> Parcerias Institucionais
          </Badge>
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">
            Parceiros que impulsionam o trabalho autônomo
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Trabalhamos com instituições de educação, tecnologia e cooperativismo para oferecer
            capacitação, certificação e oportunidades aos profissionais da plataforma.
          </p>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {PARTNERS.map((p) => (
            <a key={p.name} href={p.url} target="_blank" rel="noopener noreferrer" className="block group">
              <Card className="p-6 h-full hover:border-primary transition-colors">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <p.Icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h2 className="font-semibold text-lg group-hover:text-primary transition-colors">
                      {p.name}
                    </h2>
                    <Badge variant="outline" className="mt-1 mb-3 text-xs">
                      {p.category}
                    </Badge>
                    <p className="text-sm text-muted-foreground leading-relaxed">{p.description}</p>
                  </div>
                </div>
              </Card>
            </a>
          ))}
        </section>

        <section className="mt-16 text-center bg-muted/30 rounded-2xl p-8 md:p-12">
          <h2 className="font-display text-2xl font-bold mb-3">Quer ser parceiro da 1001Jobs?</h2>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
            Buscamos instituições alinhadas à missão de profissionalizar o trabalho autônomo na
            América Latina. Entre em contato com nosso time de parcerias.
          </p>
          <a
            href="mailto:parcerias@jobs1001.com"
            className="inline-flex items-center justify-center h-11 px-8 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            parcerias@jobs1001.com
          </a>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Partners;
