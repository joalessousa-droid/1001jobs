import { useEffect, useRef, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Mail, MapPin, Send } from "lucide-react";
import { useTranslation } from "react-i18next";
import SupportChat from "@/components/support/SupportChat";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const schema = z.object({
  name: z.string().trim().min(1, "Informe seu nome").max(200),
  email: z.string().trim().email("E-mail inválido").max(320),
  subject: z.string().trim().max(200).optional(),
  message: z.string().trim().min(10, "Mensagem muito curta (mín. 10)").max(5000),
});

const Contact = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [website, setWebsite] = useState(""); // honeypot
  const [submitting, setSubmitting] = useState(false);
  const mountedAt = useRef<number>(Date.now());

  useEffect(() => {
    mountedAt.current = Date.now();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Honeypot: bots usually fill all fields
    if (website.trim().length > 0) {
      toast({ title: "Mensagem enviada!", description: "Retornaremos em breve." });
      setForm({ name: "", email: "", subject: "", message: "" });
      return;
    }
    // Time trap: humans take >2s to fill the form
    if (Date.now() - mountedAt.current < 2000) {
      toast({ title: "Aguarde um instante", description: "Tente novamente em alguns segundos.", variant: "destructive" });
      return;
    }
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast({ title: "Verifique os campos", description: parsed.error.issues[0].message, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("contact_messages" as any).insert({
      ...parsed.data,
      user_agent: navigator.userAgent,
      referrer: document.referrer || null,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Mensagem enviada!", description: "Retornaremos em breve." });
    setForm({ name: "", email: "", subject: "", message: "" });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-3xl mx-auto px-6 pt-28 pb-16">
        <h1 className="text-3xl font-display font-bold text-foreground mb-2">{t("contactPage.title")}</h1>
        <p className="text-muted-foreground mb-8">{t("contactPage.subtitle")}</p>

        <div className="mb-10">
          <SupportChat />
          <p className="text-xs text-muted-foreground mt-2">
            Respostas geradas por IA. Para temas sensíveis, escreva para info@1001jobs.com.br.
          </p>
        </div>

        <Card className="p-6 mb-10">
          <h2 className="font-display text-xl font-semibold mb-4">Envie uma mensagem</h2>
          <form onSubmit={submit} className="space-y-4" autoComplete="off">
            {/* Honeypot field — hidden from humans */}
            <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
              <label htmlFor="website">Website</label>
              <input
                id="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="c-name">Nome *</Label>
                <Input id="c-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={200} />
              </div>
              <div>
                <Label htmlFor="c-email">E-mail *</Label>
                <Input id="c-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={320} />
              </div>
            </div>
            <div>
              <Label htmlFor="c-subject">Assunto</Label>
              <Input id="c-subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} maxLength={200} />
            </div>
            <div>
              <Label htmlFor="c-message">Mensagem *</Label>
              <Textarea id="c-message" rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} maxLength={5000} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={submitting}>
                <Send className="h-4 w-4 mr-1" /> {submitting ? "Enviando..." : "Enviar mensagem"}
              </Button>
            </div>
          </form>
        </Card>

        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium text-foreground text-sm">{t("contactPage.emailLabel")}</h3>
              <a href="mailto:info@1001jobs.com.br" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                info@1001jobs.com.br
              </a>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium text-foreground text-sm">{t("contactPage.locationLabel")}</h3>
              <p className="text-sm text-muted-foreground">{t("contactPage.location")}</p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Contact;
