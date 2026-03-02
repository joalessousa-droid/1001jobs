import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Mail, MapPin } from "lucide-react";

const Contact = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <main className="max-w-3xl mx-auto px-6 pt-28 pb-16">
      <h1 className="text-3xl font-display font-bold text-foreground mb-2">Contato</h1>
      <p className="text-muted-foreground mb-10">Tem dúvidas ou precisa de ajuda? Entre em contato conosco.</p>

      <div className="space-y-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Mail className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-medium text-foreground text-sm">E-mail</h3>
            <a href="mailto:contato@1001jobs.com" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              contato@1001jobs.com
            </a>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <MapPin className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-medium text-foreground text-sm">Localização</h3>
            <p className="text-sm text-muted-foreground">Brasil</p>
          </div>
        </div>
      </div>
    </main>
    <Footer />
  </div>
);

export default Contact;
