import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle, Send, Mail, HelpCircle } from "lucide-react";

const ContactSection = () => {
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!subject || !message) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    setSending(true);
    // Simulate sending
    await new Promise((r) => setTimeout(r, 1000));
    toast({ title: "Mensagem enviada!", description: "Responderemos em até 24 horas." });
    setSubject("");
    setMessage("");
    setSending(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold font-display">Fale Conosco</h2>
        <p className="text-muted-foreground text-sm mt-1">Estamos aqui para ajudar</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-5 bg-card border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Mail className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">E-mail</p>
              <p className="text-xs text-muted-foreground">suporte@1001jobs.com.br</p>
            </div>
          </div>
        </Card>
        <Card className="p-5 bg-card border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <HelpCircle className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">FAQ</p>
              <p className="text-xs text-muted-foreground">Perguntas frequentes</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6 bg-card border-border space-y-5">
        <div className="flex items-center gap-3 mb-2">
          <MessageCircle className="w-5 h-5 text-primary" />
          <p className="font-medium text-foreground">Enviar mensagem</p>
        </div>

        <div>
          <Label htmlFor="subject" className="mb-1.5 block">Assunto</Label>
          <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="h-12 bg-background border-border" placeholder="Ex: Dúvida sobre pagamento" />
        </div>
        <div>
          <Label htmlFor="msg" className="mb-1.5 block">Mensagem</Label>
          <Textarea id="msg" value={message} onChange={(e) => setMessage(e.target.value)} className="bg-background border-border min-h-[120px]" placeholder="Descreva sua dúvida ou problema..." />
        </div>

        <Button onClick={handleSend} disabled={sending} className="gap-2">
          <Send className="w-4 h-4" />
          {sending ? "Enviando..." : "Enviar mensagem"}
        </Button>
      </Card>
    </div>
  );
};

export default ContactSection;
