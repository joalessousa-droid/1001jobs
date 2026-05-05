import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Building2, ArrowRight, Send } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PARTNERS } from "@/data/partners";
import { trackPartnerEvent } from "@/lib/partnerTracking";

const leadSchema = z.object({
  name: z.string().trim().min(1, "Informe seu nome").max(200),
  institution: z.string().trim().min(1, "Informe a instituição").max(200),
  category: z.string().trim().min(1, "Informe a categoria").max(100),
  email: z.string().trim().email("E-mail inválido").max(320),
  message: z.string().trim().min(10, "Descreva a proposta (mín. 10 caracteres)").max(5000),
});

const Partners = () => {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", institution: "", category: "", email: "", message: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Parceiros Institucionais | 1001Jobs";
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = leadSchema.safeParse(form);
    if (!parsed.success) {
      toast({ title: "Verifique os campos", description: parsed.error.issues[0].message, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("partner_leads" as any).insert(parsed.data);
    setSubmitting(false);
    if (error) {
      toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Proposta enviada!", description: "Entraremos em contato em breve." });
    setForm({ name: "", institution: "", category: "", email: "", message: "" });
  };

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
            <Link
              key={p.slug}
              to={`/parceiros/${p.slug}`}
              onClick={() => trackPartnerEvent(p.slug, "card_click")}
              className="block group"
            >
              <Card className="p-6 h-full hover:border-primary transition-colors">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <p.Icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h2 className="font-semibold text-lg group-hover:text-primary transition-colors">{p.name}</h2>
                    <Badge variant="outline" className="mt-1 mb-3 text-xs">{p.category}</Badge>
                    <p className="text-sm text-muted-foreground leading-relaxed">{p.shortDescription}</p>
                    <span className="inline-flex items-center text-sm text-primary mt-3 group-hover:gap-2 transition-all">
                      Saiba mais <ArrowRight className="h-3 w-3 ml-1" />
                    </span>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </section>

        <section id="proposta" className="mt-16 bg-muted/30 rounded-2xl p-8 md:p-12">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="font-display text-2xl font-bold mb-3">Quer ser parceiro da 1001Jobs?</h2>
              <p className="text-muted-foreground">
                Conte sobre sua instituição e como podemos colaborar para capacitar profissionais autônomos.
              </p>
            </div>
            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="p-name">Nome do responsável *</Label>
                  <Input id="p-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={200} />
                </div>
                <div>
                  <Label htmlFor="p-inst">Instituição *</Label>
                  <Input id="p-inst" value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} maxLength={200} />
                </div>
                <div>
                  <Label htmlFor="p-cat">Categoria *</Label>
                  <Input id="p-cat" placeholder="Ex.: Educação, Tecnologia, Financeiro" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} maxLength={100} />
                </div>
                <div>
                  <Label htmlFor="p-email">E-mail *</Label>
                  <Input id="p-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={320} />
                </div>
              </div>
              <div>
                <Label htmlFor="p-msg">Mensagem *</Label>
                <Textarea id="p-msg" rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} maxLength={5000} />
              </div>
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                <a
                  href="mailto:parcerias@jobs1001.com"
                  onClick={() => trackPartnerEvent("__cta_email__", "email_cta_click")}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  ou escreva para parcerias@jobs1001.com
                </a>
                <Button type="submit" disabled={submitting}>
                  <Send className="h-4 w-4 mr-1" /> {submitting ? "Enviando..." : "Enviar proposta"}
                </Button>
              </div>
            </form>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Partners;
