import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Mail, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import SupportChat from "@/components/support/SupportChat";

const Contact = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-3xl mx-auto px-6 pt-28 pb-16">
        <h1 className="text-3xl font-display font-bold text-foreground mb-2">{t("contactPage.title")}</h1>
        <p className="text-muted-foreground mb-8">{t("contactPage.subtitle")}</p>

        <div className="mb-10">
          <SupportChat />
          <p className="text-xs text-muted-foreground mt-2">
            Respostas geradas por IA. Para temas sensíveis, escreva para contato@1001jobs.com.br.
          </p>
        </div>

        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium text-foreground text-sm">{t("contactPage.emailLabel")}</h3>
              <a href="mailto:contato@1001jobs.com.br" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                contato@1001jobs.com.br
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

