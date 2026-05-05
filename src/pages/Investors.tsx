import { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
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
  Download, Mail, TrendingUp, Users, Briefcase, MapPin,
  CheckCircle2, Clock, Repeat, DollarSign, ArrowRight,
} from "lucide-react";

type Metrics = {
  TOTAL_PRESTADORES: number;
  TOTAL_CLIENTES: number;
  TOTAL_CIDADES: number;
  TOTAL_SERVICOS: number;
  TICKET_MEDIO: number;
  TAXA_CONCLUSAO: number;
  TEMPO_ACEITE: number;
  RECOMPRA: number;
  GMV_ANUAL: number;
  RECEITA_ANUAL: number;
};

const fmtNum = (n: number) => new Intl.NumberFormat("pt-BR").format(Math.round(n));
const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);
const fmtPct = (n: number) => `${n.toFixed(1).replace(".", ",")}%`;
const fmtSec = (n: number) => `${Math.round(n)}s`;

const Investors = () => {
  const { toast } = useToast();
  const [m, setM] = useState<Metrics | null>(null);
  const [contact, setContact] = useState({ name: "", email: "", company: "", message: "" });
  const [sending, setSending] = useState(false);

  useEffect(() => {
    document.title = "Investidores | 1001JOBS — Relações com Investidores";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content",
      "Infraestrutura digital para o trabalho autônomo na América Latina. Métricas, modelo de negócio e oportunidade de investimento na 1001JOBS.");
  }, []);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.functions.invoke("investor-metrics");
      if (!error && data) setM(data as Metrics);
    })();
  }, []);

  const sections = useMemo(() => ([
    { title: "O Problema", body: "O mercado informal de serviços na América Latina movimenta centenas de bilhões de reais por ano, mas opera sem padronização de preço, garantias contratuais ou rastreabilidade. Clientes enfrentam orçamentos opacos e risco de inadimplência reversa; profissionais enfrentam calotes, ociosidade e ausência de histórico verificável que viabilize crédito e crescimento." },
    { title: "A Solução 1001JOBS", body: "Marketplace sob demanda com preço fechado, pagamento antecipado em escrow e liberação após confirmação de entrega. Reputação bidirecional, verificação KYC e matching com IA reduzem fricção e elevam a taxa de conclusão. A plataforma transforma trabalho informal em transações auditáveis, criando o trilho de dados para serviços financeiros adjacentes." },
    { title: "Tamanho de Mercado", body: "Brasil: ~40 milhões de trabalhadores autônomos e MEIs, com TAM estimado em R$ 600 bi/ano em serviços locais. América Latina: TAM agregado superior a US$ 250 bi. SAM endereçável digitalmente acima de R$ 80 bi no Brasil, com SOM inicial concentrado nas 50 maiores cidades." },
    { title: "Modelo de Negócio", body: "Receita primária por comissão (take rate) sobre transações concluídas, complementada por assinatura PRO para profissionais. Roadmap fintech: antecipação de recebíveis, conta digital, seguro de serviço e crédito baseado no histórico transacional da plataforma." },
    { title: "Tração e Crescimento", body: "Crescimento orgânico impulsionado por programa de afiliados, SEO local e indicação cliente-profissional. KPIs em ascensão consistente: GMV mensal, take rate efetivo, retenção D30/D90 e LTV/CAC." },
    { title: "Vantagens Competitivas", body: "Stack proprietária de matching com IA; escrow nativo integrado; sistema de reputação anti-fraude com risk scoring; multi-idioma (PT/ES/EN); custo de aquisição inferior ao benchmark do setor pela mecânica viral cliente↔profissional." },
    { title: "Roadmap de Expansão", body: "2026: consolidação nas capitais brasileiras e lançamento PRO+. 2027: México, Colômbia e Argentina. 2028: lançamento da vertical fintech e abertura de API B2B. 2029: expansão a mercados de língua portuguesa fora da América." },
  ]), []);

  const handleDownloadPitch = () => {
    if (!m) {
      toast({ title: "Carregando métricas...", description: "Aguarde um instante." });
      return;
    }
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const margin = 56;
    let y = margin;

    const addPage = () => { doc.addPage(); y = margin; };
    const ensure = (h: number) => { if (y + h > H - margin) addPage(); };

    // Capa
    doc.setFillColor(15, 27, 61);
    doc.rect(0, 0, W, H, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold").setFontSize(10);
    doc.text("RELAÇÕES COM INVESTIDORES", margin, 120);
    doc.setFontSize(28);
    doc.text("1001JOBS", margin, 160);
    doc.setFontSize(20);
    const titleLines = doc.splitTextToSize("Infraestrutura digital para o trabalho autônomo na América Latina", W - margin * 2);
    doc.text(titleLines, margin, 220);
    doc.setFont("helvetica", "normal").setFontSize(11);
    doc.text(`Apresentação institucional · ${new Date().toLocaleDateString("pt-BR")}`, margin, H - 80);
    doc.text("ri@jobs1001.com.br", margin, H - 60);

    // Métricas
    addPage();
    doc.setTextColor(15, 27, 61).setFont("helvetica", "bold").setFontSize(18);
    doc.text("Indicadores operacionais", margin, y); y += 28;
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(90);
    doc.text("Dados consolidados da plataforma — atualização automática.", margin, y); y += 24;

    const kpis: [string, string][] = [
      ["Profissionais cadastrados", fmtNum(m.TOTAL_PRESTADORES)],
      ["Clientes cadastrados", fmtNum(m.TOTAL_CLIENTES)],
      ["Cidades ativas", fmtNum(m.TOTAL_CIDADES)],
      ["Serviços realizados", fmtNum(m.TOTAL_SERVICOS)],
      ["Ticket médio", fmtBRL(m.TICKET_MEDIO)],
      ["Taxa de conclusão", fmtPct(m.TAXA_CONCLUSAO)],
      ["Tempo médio de aceite", fmtSec(m.TEMPO_ACEITE)],
      ["Recompra de clientes", fmtPct(m.RECOMPRA)],
    ];
    const colW = (W - margin * 2 - 16) / 2;
    const rowH = 70;
    kpis.forEach((kp, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = margin + col * (colW + 16);
      const yy = y + row * (rowH + 12);
      doc.setDrawColor(220).setFillColor(248, 249, 252).rect(x, yy, colW, rowH, "FD");
      doc.setFont("helvetica", "bold").setFontSize(18).setTextColor(15, 27, 61);
      doc.text(kp[1], x + 14, yy + 32);
      doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(110);
      doc.text(kp[0].toUpperCase(), x + 14, yy + 52);
    });
    y += Math.ceil(kpis.length / 2) * (rowH + 12) + 10;

    // Projeções
    ensure(120);
    doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(15, 27, 61);
    doc.text("Projeção de GMV e Receita anual", margin, y); y += 22;
    [["GMV anual projetado", fmtBRL(m.GMV_ANUAL)], ["Receita anual projetada", fmtBRL(m.RECEITA_ANUAL)]].forEach(([label, val], i) => {
      const x = margin + i * (colW + 16);
      doc.setDrawColor(220).setFillColor(255, 255, 255).rect(x, y, colW, 80, "FD");
      doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(110);
      doc.text(label.toUpperCase(), x + 14, y + 22);
      doc.setFont("helvetica", "bold").setFontSize(22).setTextColor(15, 27, 61);
      doc.text(val, x + 14, y + 56);
    });
    y += 100;

    // Seções
    sections.forEach((s) => {
      ensure(80);
      doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(15, 27, 61);
      doc.text(s.title, margin, y); y += 6;
      doc.setDrawColor(15, 27, 61).setLineWidth(1.5).line(margin, y, margin + 30, y); y += 14;
      doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(60);
      const lines = doc.splitTextToSize(s.body, W - margin * 2);
      lines.forEach((ln: string) => { ensure(14); doc.text(ln, margin, y); y += 14; });
      y += 12;
    });

    // Contato
    ensure(80);
    doc.setFont("helvetica", "bold").setFontSize(14).setTextColor(15, 27, 61);
    doc.text("Contato — Relações com Investidores", margin, y); y += 18;
    doc.setFont("helvetica", "normal").setFontSize(11).setTextColor(60);
    doc.text("ri@jobs1001.com.br", margin, y);

    doc.save(`1001JOBS-Investidores-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast({ title: "Apresentação baixada", description: "PDF gerado com métricas atualizadas." });
  };

  const handleContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact.name || !contact.email || !contact.message) {
      toast({ title: "Preencha nome, e-mail e mensagem", variant: "destructive" });
      return;
    }
    setSending(true);
    const { data, error } = await supabase.functions.invoke("investor-lead", { body: contact });
    setSending(false);
    if (error || (data as any)?.error) {
      toast({ title: "Erro ao enviar", description: "Tente novamente em instantes.", variant: "destructive" });
      return;
    }
    toast({ title: "Mensagem enviada para RI", description: "Nossa equipe responderá em até 2 dias úteis." });
    setContact({ name: "", email: "", company: "", message: "" });
  };

  const v = (n: number | undefined, fmt: (x: number) => string) => (m ? fmt(n ?? 0) : "—");

  const metricCards = [
    { icon: Briefcase, label: "Profissionais cadastrados", value: v(m?.TOTAL_PRESTADORES, fmtNum) },
    { icon: Users, label: "Clientes cadastrados", value: v(m?.TOTAL_CLIENTES, fmtNum) },
    { icon: MapPin, label: "Cidades ativas", value: v(m?.TOTAL_CIDADES, fmtNum) },
    { icon: CheckCircle2, label: "Serviços realizados", value: v(m?.TOTAL_SERVICOS, fmtNum) },
    { icon: DollarSign, label: "Ticket médio", value: v(m?.TICKET_MEDIO, fmtBRL) },
    { icon: TrendingUp, label: "Taxa de conclusão", value: v(m?.TAXA_CONCLUSAO, fmtPct) },
    { icon: Clock, label: "Tempo médio de aceite", value: v(m?.TEMPO_ACEITE, fmtSec) },
    { icon: Repeat, label: "Recompra de clientes", value: v(m?.RECOMPRA, fmtPct) },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24">
        <section className="border-b border-border">
          <div className="container px-6 py-20 md:py-28 max-w-5xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-6">Relações com Investidores</p>
            <h1 className="font-display text-4xl md:text-6xl font-bold leading-[1.1] tracking-tight text-foreground mb-6">
              Infraestrutura digital para o trabalho autônomo na América Latina
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-3xl mb-10">
              A 1001JOBS opera um marketplace sob demanda com{" "}
              <span className="text-foreground font-medium">preço fechado</span> e{" "}
              <span className="text-foreground font-medium">pagamento antecipado em escrow</span>,
              eliminando fricção entre quem contrata e quem executa serviços locais.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button size="lg" onClick={handleDownloadPitch} className="gap-2">
                <Download className="w-4 h-4" />
                Baixar apresentação para investidores (PDF)
              </Button>
              <a href="#ri-contato">
                <Button size="lg" variant="outline" className="gap-2 w-full sm:w-auto">
                  <Mail className="w-4 h-4" /> Falar com RI
                </Button>
              </a>
            </div>
          </div>
        </section>

        <section className="border-b border-border bg-muted/20">
          <div className="container px-6 py-20">
            <div className="max-w-3xl mb-12">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-3">Indicadores operacionais</p>
              <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-foreground">Métricas em tempo real</h2>
              <p className="text-muted-foreground mt-3">Dados consolidados da plataforma. Atualização contínua via integração direta com a base operacional.</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {metricCards.map((c) => (
                <Card key={c.label} className="p-6 border-border bg-card">
                  <c.icon className="w-5 h-5 text-primary mb-4" />
                  <p className="font-display text-3xl md:text-4xl font-bold text-foreground tracking-tight">{c.value}</p>
                  <p className="text-xs text-muted-foreground mt-2 uppercase tracking-wider">{c.label}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-border">
          <div className="container px-6 py-20 max-w-5xl">
            <div className="grid md:grid-cols-2 gap-x-16 gap-y-14">
              {sections.map((s) => (
                <article key={s.title}>
                  <h3 className="font-display text-xl font-bold text-foreground mb-3 tracking-tight">{s.title}</h3>
                  <Separator className="mb-4 w-12 bg-primary h-0.5" />
                  <p className="text-muted-foreground leading-relaxed text-[15px]">{s.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-border bg-muted/20">
          <div className="container px-6 py-20 max-w-5xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-3">Projeções financeiras</p>
            <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-10">Projeção de GMV e Receita</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="p-8 border-border bg-card">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">GMV anual projetado</p>
                <p className="font-display text-5xl font-bold text-foreground tracking-tight">{v(m?.GMV_ANUAL, fmtBRL)}</p>
                <p className="text-sm text-muted-foreground mt-4">Volume total transacionado em base anualizada.</p>
              </Card>
              <Card className="p-8 border-border bg-card">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Receita anual projetada</p>
                <p className="font-display text-5xl font-bold text-foreground tracking-tight">{v(m?.RECEITA_ANUAL, fmtBRL)}</p>
                <p className="text-sm text-muted-foreground mt-4">Receita líquida combinada: comissão sobre GMV + assinaturas PRO.</p>
              </Card>
            </div>
          </div>
        </section>

        <section className="border-b border-border">
          <div className="container px-6 py-20 max-w-4xl text-center">
            <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-4">Apresentação completa para investidores</h2>
            <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">Deck institucional gerado dinamicamente com as métricas mais recentes da plataforma.</p>
            <Button size="lg" onClick={handleDownloadPitch} className="gap-2">
              <Download className="w-5 h-5" /> Baixar apresentação (PDF)
            </Button>
          </div>
        </section>

        <section id="ri-contato" className="bg-muted/20">
          <div className="container px-6 py-20 max-w-4xl">
            <div className="grid md:grid-cols-2 gap-12">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-3">Contato institucional</p>
                <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-6">Relações com Investidores</h2>
                <p className="text-muted-foreground mb-6 leading-relaxed">Para informações sobre rodadas de captação, due diligence, parcerias estratégicas ou solicitação de materiais detalhados.</p>
                <a href="mailto:ri@jobs1001.com.br" className="inline-flex items-center gap-2 text-foreground font-medium hover:text-primary transition-colors">
                  <Mail className="w-4 h-4" /> ri@jobs1001.com.br <ArrowRight className="w-4 h-4" />
                </a>
              </div>
              <Card className="p-6 border-border bg-card">
                <form onSubmit={handleContact} className="space-y-4">
                  <div><Label htmlFor="ri-name">Nome</Label>
                    <Input id="ri-name" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} className="mt-1.5" maxLength={200} /></div>
                  <div><Label htmlFor="ri-email">E-mail corporativo</Label>
                    <Input id="ri-email" type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} className="mt-1.5" maxLength={320} /></div>
                  <div><Label htmlFor="ri-company">Fundo / Empresa</Label>
                    <Input id="ri-company" value={contact.company} onChange={(e) => setContact({ ...contact, company: e.target.value })} className="mt-1.5" maxLength={200} /></div>
                  <div><Label htmlFor="ri-msg">Mensagem</Label>
                    <Textarea id="ri-msg" value={contact.message} onChange={(e) => setContact({ ...contact, message: e.target.value })} className="mt-1.5 min-h-[110px]" maxLength={5000} placeholder="Tese, ticket pretendido, perguntas..." /></div>
                  <Button type="submit" disabled={sending} className="w-full">{sending ? "Enviando..." : "Enviar para RI"}</Button>
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
