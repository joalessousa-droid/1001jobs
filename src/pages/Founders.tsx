import { useEffect } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import {
  Sparkles, Users, Globe2, Rocket, HeartHandshake, ShieldCheck,
  Trophy, ArrowRight, Wallet, Building2,
} from "lucide-react";

const Founders = () => {
  const { t } = useTranslation();
  useEffect(() => {
    document.title = "Membros Fundadores | 1001JOBS — Você é um dos Fundadores";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute(
      "content",
      "Você não é apenas um usuário. Você é um Fundador. Faça parte da comunidade de pioneiros que está construindo a 1001JOBS — uma plataforma global de oportunidades e serviços financeiros."
    );
  }, []);

  const benefits = [
    { icon: Trophy, title: "Selo de Membro Fundador", body: "Reconhecimento vitalício no seu perfil como um dos primeiros pioneiros da comunidade 1001JOBS." },
    { icon: Sparkles, title: "Acesso prioritário", body: "Novos produtos, categorias e recursos chegam primeiro para quem ajudou a construir a plataforma." },
    { icon: HeartHandshake, title: "Programa de fidelidade", body: "Vantagens exclusivas em taxas, visibilidade e benefícios definidos ao longo da evolução da empresa." },
    { icon: Wallet, title: "1001Pay em primeira mão", body: "Condições diferenciadas para usar a carteira, receber e antecipar recebíveis dentro do ecossistema." },
    { icon: ShieldCheck, title: "Voz na construção", body: "Participação em iniciativas, pesquisas e decisões voltadas aos pioneiros da comunidade." },
    { icon: Rocket, title: "Crescer com a plataforma", body: "Você faz parte da história desde o começo — e cresce junto com a expansão global do projeto." },
  ];

  const pillars = [
    { label: "Visão", body: "Construir uma das maiores plataformas globais de oportunidades e serviços financeiros, conectando pessoas, empresas e tecnologia em um ambiente colaborativo, inovador e acessível." },
    { label: "Missão", body: "Democratizar o acesso ao trabalho, aos serviços e às oportunidades econômicas, criando um ecossistema em que cada pessoa possa crescer junto com a comunidade." },
    { label: "Compromisso", body: "Crescer com responsabilidade, transparência e foco no longo prazo, valorizando aqueles que acreditaram no projeto desde os seus primeiros passos." },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24">
        {/* HERO */}
        <section className="relative border-b border-border overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background pointer-events-none" />
          <div className="container relative px-6 py-20 md:py-28 max-w-5xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/5 mb-8">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Comunidade 1001JOBS</span>
            </div>
            <h1 className="font-display text-4xl md:text-6xl font-bold leading-[1.05] tracking-tight text-foreground mb-6">
              Você não é apenas um usuário.
              <br />
              <span className="text-primary">Você é um Fundador.</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-3xl mb-10">
              Bem-vindo à 1001JOBS, uma plataforma global criada para transformar a forma como as pessoas trabalham,
              empreendem, se conectam e acessam serviços financeiros. Acreditamos que as maiores empresas do futuro
              serão construídas por suas comunidades. Por isso nascemos com um princípio simples:{" "}
              <span className="text-foreground font-medium">quem ajuda a construir, também faz parte da história.</span>
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link to="/auth">
                <Button size="lg" className="gap-2 w-full sm:w-auto">
                  Torne-se um Membro Fundador <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link to="/investidores">
                <Button size="lg" variant="outline" className="gap-2 w-full sm:w-auto">
                  Ver relações com investidores
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* O QUE É */}
        <section className="border-b border-border">
          <div className="container px-6 py-20 max-w-5xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-3">O que é a 1001JOBS</p>
            <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-6">
              Um ecossistema digital de serviços
            </h2>
            <p className="text-muted-foreground max-w-3xl leading-relaxed mb-10">
              A 1001JOBS conecta profissionais, empresas, empreendedores, prestadores de serviços,
              oportunidades de trabalho e renda, e soluções financeiras por meio da{" "}
              <span className="text-foreground font-medium">1001Pay</span>. Nosso objetivo é criar um
              ambiente onde o crescimento da plataforma beneficie toda a comunidade que ajudou a construí-la
              desde o início.
            </p>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { icon: Users, label: "Profissionais" },
                { icon: Building2, label: "Empresas" },
                { icon: Rocket, label: "Empreendedores" },
                { icon: HeartHandshake, label: "Prestadores de serviços" },
                { icon: Globe2, label: "Oportunidades globais" },
                { icon: Wallet, label: "1001Pay — soluções financeiras" },
              ].map((item) => (
                <Card key={item.label} className="p-5 border-border bg-card flex items-center gap-3">
                  <item.icon className="w-5 h-5 text-primary shrink-0" />
                  <span className="text-sm font-medium text-foreground">{item.label}</span>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* BENEFÍCIOS EM DESTAQUE */}
        <section className="relative border-b border-border overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.03] via-transparent to-transparent pointer-events-none" />
          <div className="container relative px-6 py-20 max-w-5xl">
            <div className="max-w-3xl mb-12">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-3">{t("foundersBenefits.eyebrow")}</p>
              <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-4">
                {t("foundersBenefits.title")}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {t("foundersBenefits.subtitle")}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <Card className="relative md:col-span-2 lg:col-span-2 p-0 overflow-hidden border-primary/20 bg-card group hover:glow-border transition-all duration-500">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent pointer-events-none" />
                <div className="relative p-8 md:p-10 flex flex-col h-full justify-between">
                  <div>
                    <Badge className="mb-5 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15">
                      {t("foundersBenefits.featuredBadge")}
                    </Badge>
                    <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center mb-5">
                      <Sparkles className="w-7 h-7 text-primary" />
                    </div>
                    <h3 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-3 tracking-tight">
                      {t("foundersBenefits.b1Title")}
                    </h3>
                    <p className="text-muted-foreground leading-relaxed max-w-xl text-[17px]">
                      {t("foundersBenefits.b1Body")}
                    </p>
                  </div>
                </div>
              </Card>
              <Card className="relative p-0 overflow-hidden border-border bg-card group hover:border-primary/20 hover:glow-border transition-all duration-500">
                <div className="relative p-8 flex flex-col h-full">
                  <Badge className="mb-5 w-fit border border-gold/30 text-gold-foreground bg-gold/10 hover:bg-gold/15">
                    {t("foundersBenefits.exclusiveBadge")}
                  </Badge>
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <Wallet className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-display text-xl font-bold text-foreground mb-2 tracking-tight">
                    {t("foundersBenefits.b2Title")}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {t("foundersBenefits.b2Body")}
                  </p>
                </div>
              </Card>
              <Card className="relative p-0 overflow-hidden border-border bg-card group hover:border-primary/20 hover:glow-border transition-all duration-500">
                <div className="relative p-8 flex flex-col h-full">
                  <Badge className="mb-5 w-fit border border-primary/20 text-primary bg-primary/5 hover:bg-primary/10">
                    {t("foundersBenefits.exclusiveBadge")}
                  </Badge>
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <Trophy className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-display text-xl font-bold text-foreground mb-2 tracking-tight">
                    {t("foundersBenefits.b3Title")}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {t("foundersBenefits.b3Body")}
                  </p>
                </div>
              </Card>
              <Card className="relative p-0 overflow-hidden border-border bg-card group hover:border-primary/20 hover:glow-border transition-all duration-500">
                <div className="relative p-8 flex flex-col h-full">
                  <Badge className="mb-5 w-fit border border-primary/20 text-primary bg-primary/5 hover:bg-primary/10">
                    {t("foundersBenefits.exclusiveBadge")}
                  </Badge>
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <ShieldCheck className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-display text-xl font-bold text-foreground mb-2 tracking-tight">
                    {t("foundersBenefits.b4Title")}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {t("foundersBenefits.b4Body")}
                  </p>
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* SER FUNDADOR */}
        <section className="border-b border-border bg-muted/20">
          <div className="container px-6 py-20 max-w-5xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-3">Membros Fundadores</p>
            <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-6">
              O que significa ser um Fundador
            </h2>
            <p className="text-muted-foreground max-w-3xl leading-relaxed mb-12">
              Ser um Membro Fundador significa fazer parte dos primeiros apoiadores da plataforma e ter acesso
              a benefícios exclusivos definidos pela empresa ao longo de sua evolução — programas de fidelidade,
              vantagens especiais, acesso prioritário a novos produtos e participação em iniciativas destinadas
              aos pioneiros da comunidade. Seu apoio inicial representa um voto de confiança em uma visão de longo prazo:
              construir uma empresa global baseada em colaboração, inovação e geração de oportunidades.
            </p>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {benefits.map((b) => (
                <Card key={b.title} className="p-6 border-border bg-card">
                  <b.icon className="w-6 h-6 text-primary mb-4" />
                  <h3 className="font-display text-lg font-bold text-foreground mb-2 tracking-tight">{b.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{b.body}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* MANIFESTO */}
        <section className="border-b border-border">
          <div className="container px-6 py-20 max-w-4xl">
            <div className="space-y-6 text-center">
              {[
                ["Você não está apenas criando um perfil.", "Você está ajudando a construir uma comunidade."],
                ["Você não está apenas acessando uma plataforma.", "Você está participando do nascimento de um projeto global."],
                ["Você não é apenas um usuário.", "Você é um dos Fundadores da 1001JOBS."],
              ].map(([a, b], i) => (
                <div key={i}>
                  <p className="text-muted-foreground text-lg">{a}</p>
                  <p className="font-display text-xl md:text-2xl font-bold text-foreground tracking-tight">{b}</p>
                  {i < 2 && <Separator className="mt-6 mx-auto w-12 bg-primary h-0.5" />}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* VISÃO/MISSÃO/COMPROMISSO */}
        <section className="border-b border-border bg-muted/20">
          <div className="container px-6 py-20 max-w-5xl">
            <div className="grid md:grid-cols-3 gap-8">
              {pillars.map((p) => (
                <article key={p.label}>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-3">Nossa {p.label}</p>
                  <Separator className="mb-4 w-12 bg-primary h-0.5" />
                  <p className="text-muted-foreground leading-relaxed text-[15px]">{p.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section>
          <div className="container px-6 py-20 max-w-4xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-4">1001JOBS</p>
            <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight text-foreground mb-4">
              Mil oportunidades. Uma comunidade.
              <br />
              Um futuro construído juntos.
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto mb-10">
              Junte-se aos primeiros pioneiros e ajude a escrever o começo desta história.
            </p>
            <Link to="/auth">
              <Button size="lg" className="gap-2">
                Quero ser um Membro Fundador <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Founders;
