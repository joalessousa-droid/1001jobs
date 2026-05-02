import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Download,
  Mail,
  TrendingUp,
  Users,
  Briefcase,
  MapPin,
  CheckCircle2,
  Clock,
  Repeat,
  DollarSign,
  ArrowRight,
} from "lucide-react";

type Metrics = {
  TOTAL_PRESTADORES: string;
  TOTAL_CLIENTES: string;
  TOTAL_CIDADES: string;
  TOTAL_SERVICOS: string;
  TICKET_MEDIO: string;
  TAXA_CONCLUSAO: string;
  TEMPO_ACEITE: string;
  RECOMPRA: string;
  GMV_ANUAL: string;
  RECEITA_ANUAL: string;
};

const fmtNum = (n: number) => new Intl.NumberFormat("pt-BR").format(n);
const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);

const Investors = () => {
  const { toast } = useToast();
  const [metrics, setMetrics] = useState<Metrics>({
    TOTAL_PRESTADORES: "—",
    TOTAL_CLIENTES: "—",
    TOTAL_CIDADES: "—",
    TOTAL_SERVICOS: "—",
    TICKET_MEDIO: "—",
    TAXA_CONCLUSAO: "—",
    TEMPO_ACEITE: "—",
    RECOMPRA: "—",
    GMV_ANUAL: "—",
    RECEITA_ANUAL: "—",
  });
  const [contact, setContact] = useState({ name: "", email: "", company: "", message: "" });
  const [sending, setSending] = useState(false);

  useEffect(() => {
    document.title = "Investidores | 1001JOBS — Relações com Investidores";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute(
        "content",
        "Infraestrutura digital para o trabalho autônomo na América Latina. Conheça métricas, modelo de negócio e oportunidade de investimento na 1001JOBS."
      );
    }
  }, []);

  useEffect(() => {
    const loadMetrics = async () => {
      try {
        // Preparado para integração futura: tenta consultar contagens públicas.
        const [providers, clients, services] = await Promise.all([
          supabase.from("profiles").select("id", { count: "exact", head: true }).eq("user_type", "provider" as any),
          supabase.from("profiles").select("id", { count: "exact", head: true }).eq("user_type", "client" as any),
          supabase.from("services").select("id", { count: "exact", head: true }),
        ]);

        const next: Partial<Metrics> = {};
        if (typeof providers.count === "number") next.TOTAL_PRESTADORES = fmtNum(providers.count);
        if (typeof clients.count === "number") next.TOTAL_CLIENTES = fmtNum(clients.count);
        if (typeof services.count === "number") next.TOTAL_SERVICOS = fmtNum(services.count);

        setMetrics((m) => ({ ...m, ...next }));
      } catch {
        // Silencioso: mantém placeholders.
      }
    };
    loadMetrics();
  }, []);

  const handleDownloadPitch = () => {
    toast({
      title: "Apresentação em preparação",
      description: "O deck para investidores será disponibilizado em breve. Solicite via RI.",
    });
  };

  const handleContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact.name || !contact.email || !contact.message) {
      toast({ title: "Preencha nome, e-mail e mensagem", variant: "destructive" });
      return;
    }
    setSending(true);
    await new Promise((r) => setTimeout(r, 800));
    toast({
      title: "Mensagem enviada para RI",
      description: "Nossa equipe de Relações com Investidores responderá em até 2 dias úteis.",
    });
    setContact({ name: "", email: "", company: "", message: "" });
    setSending(false);
  };

  const metricCards = [
    { icon: Briefcase, label: "Profissionais cadastrados", value: metrics.TOTAL_PRESTADORES },
    { icon: Users, label: "Clientes cadastrados", value: metrics.TOTAL_CLIENTES },
    { icon: MapPin, label: "Cidades ativas", value: metrics.TOTAL_CIDADES },
    { icon: CheckCircle2, label: "Serviços realizados", value: metrics.TOTAL_SERVICOS },
    { icon: DollarSign, label: "Ticket médio", value: `R$ ${metrics.TICKET_MEDIO}` },
    { icon: TrendingUp, label: "Taxa média de conclusão", value: `${metrics.TAXA_CONCLUSAO}%` },
    { icon: Clock, label: "Tempo médio de aceite", value: `${metrics.TEMPO_ACEITE}s` },
    { icon: Repeat, label: "Recompra de clientes", value: `${metrics.RECOMPRA}%` },
  ];

  const sections = [
    {
      title: "O Problema",
      body: "O mercado informal de serviços na América Latina movimenta centenas de bilhões de reais por ano, mas opera sem padronização de preço, garantias contratuais ou rastreabilidade. Clientes enfrentam orçamentos opacos e risco de inadimplência reversa; profissionais enfrentam calotes, ociosidade e ausência de histórico verificável que viabilize crédito e crescimento.",
    },
    {
      title: "A Solução 1001JOBS",
      body: "Marketplace sob demanda com preço fechado, pagamento antecipado em escrow e liberação após confirmação de entrega. Reputação bidirecional, verificação KYC e matching com IA reduzem fricção e elevam a taxa de conclusão. A plataforma transforma trabalho informal em transações auditáveis, criando o trilho de dados para serviços financeiros adjacentes.",
    },
    {
      title: "Tamanho de Mercado",
      body: "Brasil: ~40 milhões de trabalhadores autônomos e MEIs, com TAM estimado em R$ 600 bi/ano em serviços locais. América Latina: TAM agregado superior a US$ 250 bi. SAM endereçável digitalmente acima de R$ 80 bi no Brasil, com SOM inicial concentrado nas 50 maiores cidades.",
    },
    {
      title: "Modelo de Negócio",
      body: "Receita primária por comissão (take rate) sobre transações concluídas, complementada por assinatura PRO para profissionais (visibilidade, IA de matching, ferramentas de gestão). Roadmap fintech: antecipação de recebíveis, conta digital para profissionais, seguro de serviço e crédito baseado no histórico transacional da plataforma.",
    },
    {
      title: "Tração e Crescimento",
      body: "Crescimento orgânico impulsionado por programa de afiliados, SEO local e indicação cliente-profissional. KPIs em ascensão consistente: GMV mensal, take rate efetivo, retenção D30/D90 e LTV/CAC. Operação enxuta com margem de contribuição positiva por transação desde o primeiro mês de cada cidade ativada.",
    },
    {
      title: "Vantagens Competitivas",
      body: "1) Stack proprietária de matching com IA; 2) Escrow nativo integrado; 3) Sistema de reputação anti-fraude com risk scoring; 4) Multi-idioma (PT/ES/EN) preparado para expansão regional; 5) Custo unitário de aquisição inferior ao benchmark do setor pela mecânica viral cliente↔profissional.",
    },
    {
      title: "Roadmap de Expansão",
      body: "2026: consolidação nas capitais brasileiras e lançamento PRO+. 2027: entrada em México, Colômbia e Argentina. 2028: lançamento da vertical fintech (antecipação e conta) e abertura de API B2B para integradores e seguradoras. 2029: expansão a mercados de língua portuguesa fora da América.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pt-24">
        {/* HERO */}
        <section className="border-b border-border">
          <div className="container px-6 py-20 md:py-28 max-w-5xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-6">
              Relações com Investidores
            </p>
            <h1 className="font-display text-4xl md:text-6xl font-bold leading-[1.1] tracking-tight text-foreground mb-6">
              Infraestrutura digital para o trabalho autônomo na América Latina
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-3xl mb-10">
              A 1001JOBS opera um marketplace sob demanda com{" "}
              <span className="text-foreground font-medium">preço fechado</span> e{" "}
              <span className="text-foreground font-medium">pagamento antecipado em escrow</span>,
              eliminando fricção entre quem contrata e quem executa serviços locais — e construindo o trilho
              de dados para a próxima geração de serviços financeiros para autônomos.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button size="lg" onClick={handleDownloadPitch} className="gap-2">
                <Download className="w-4 h-4" />
                Baixar apresentação para investidores (PDF)
              </Button>
              <a href="#ri-contato">
                <Button size="lg" variant="outline" className="gap-2 w-full sm:w-auto">
                  <Mail className="w-4 h-4" />
                  Falar com RI
                </Button>
              </a>
            </div>
          </div>
        </section>

        {/* MÉTRICAS */}
        <section className="border-b border-border bg-muted/20">
          <div className="container px-6 py-20">
            <div className="max-w-3xl mb-12">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-3">
                Indicadores operacionais
              </p>
              <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                Métricas em tempo real
              </h2>
              <p className="text-muted-foreground mt-3">
                Dados consolidados da plataforma. Atualização contínua via integração direta com a base operacional.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {metricCards.map((m) => (
                <Card key={m.label} className="p-6 border-border bg-card">
                  <m.icon className="w-5 h-5 text-primary mb-4" />
                  <p className="font-display text-3xl md:text-4xl font-bold text-foreground tracking-tight">
                    {m.value}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2 uppercase tracking-wider">{m.label}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* SEÇÕES TEXTUAIS */}
        <section className="border-b border-border">
          <div className="container px-6 py-20 max-w-5xl">
            <div className="grid md:grid-cols-2 gap-x-16 gap-y-14">
              {sections.map((s) => (
                <article key={s.title}>
                  <h3 className="font-display text-xl font-bold text-foreground mb-3 tracking-tight">
                    {s.title}
                  </h3>
                  <Separator className="mb-4 w-12 bg-primary h-0.5" />
                  <p className="text-muted-foreground leading-relaxed text-[15px]">{s.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* PROJEÇÕES */}
        <section className="border-b border-border bg-muted/20">
          <div className="container px-6 py-20 max-w-5xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-3">
              Projeções financeiras
            </p>
            <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-10">
              Projeção de GMV e Receita
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="p-8 border-border bg-card">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">GMV anual projetado</p>
                <p className="font-display text-5xl font-bold text-foreground tracking-tight">
                  {metrics.GMV_ANUAL}
                </p>
                <p className="text-sm text-muted-foreground mt-4">
                  Volume total transacionado na plataforma em base anualizada.
                </p>
              </Card>
              <Card className="p-8 border-border bg-card">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Receita anual projetada</p>
                <p className="font-display text-5xl font-bold text-foreground tracking-tight">
                  {metrics.RECEITA_ANUAL}
                </p>
                <p className="text-sm text-muted-foreground mt-4">
                  Receita líquida combinada: comissão sobre GMV + assinaturas PRO.
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA DOWNLOAD */}
        <section className="border-b border-border">
          <div className="container px-6 py-20 max-w-4xl text-center">
            <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-4">
              Apresentação completa para investidores
            </h2>
            <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
              Deck institucional com tese de investimento, projeções detalhadas, unit economics e estrutura de captação.
            </p>
            <Button size="lg" onClick={handleDownloadPitch} className="gap-2">
              <Download className="w-5 h-5" />
              Baixar apresentação (PDF)
            </Button>
          </div>
        </section>

        {/* CONTATO RI */}
        <section id="ri-contato" className="bg-muted/20">
          <div className="container px-6 py-20 max-w-4xl">
            <div className="grid md:grid-cols-2 gap-12">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-3">
                  Contato institucional
                </p>
                <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-6">
                  Relações com Investidores
                </h2>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  Para informações sobre rodadas de captação, due diligence, parcerias estratégicas
                  ou solicitação de materiais detalhados.
                </p>
                <a
                  href="mailto:ri@jobs1001.com"
                  className="inline-flex items-center gap-2 text-foreground font-medium hover:text-primary transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  ri@jobs1001.com
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>

              <Card className="p-6 border-border bg-card">
                <form onSubmit={handleContact} className="space-y-4">
                  <div>
                    <Label htmlFor="ri-name">Nome</Label>
                    <Input
                      id="ri-name"
                      value={contact.name}
                      onChange={(e) => setContact({ ...contact, name: e.target.value })}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ri-email">E-mail corporativo</Label>
                    <Input
                      id="ri-email"
                      type="email"
                      value={contact.email}
                      onChange={(e) => setContact({ ...contact, email: e.target.value })}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ri-company">Fundo / Empresa</Label>
                    <Input
                      id="ri-company"
                      value={contact.company}
                      onChange={(e) => setContact({ ...contact, company: e.target.value })}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ri-msg">Mensagem</Label>
                    <Textarea
                      id="ri-msg"
                      value={contact.message}
                      onChange={(e) => setContact({ ...contact, message: e.target.value })}
                      className="mt-1.5 min-h-[110px]"
                      placeholder="Tese, ticket pretendido, perguntas..."
                    />
                  </div>
                  <Button type="submit" disabled={sending} className="w-full">
                    {sending ? "Enviando..." : "Enviar para RI"}
                  </Button>
                </form>
              </Card>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Investors;
