import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Search, UserCheck, CreditCard, Star, Shield, MessageCircle, CheckCircle2, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

const stepIcons = [Search, UserCheck, MessageCircle, CreditCard, Star];
const stepNumbers = ["01", "02", "03", "04", "05"];

const HowItWorksPage = () => {
  const { t } = useTranslation();

  const steps = Array.from({ length: 5 }, (_, i) => ({
    icon: stepIcons[i],
    number: stepNumbers[i],
    title: t(`howItWorksPage.s${i + 1}Title`),
    description: t(`howItWorksPage.s${i + 1}Desc`),
    details: [
      t(`howItWorksPage.s${i + 1}d1`),
      t(`howItWorksPage.s${i + 1}d2`),
      t(`howItWorksPage.s${i + 1}d3`),
    ],
  }));

  const faqs = [1, 2, 3, 4].map((i) => ({
    q: t(`howItWorksPage.faq${i}q`),
    a: t(`howItWorksPage.faq${i}a`),
  }));

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="pt-28 pb-16 relative">
        <div className="absolute inset-0 hero-glow opacity-30" />
        <div className="container px-6 text-center relative z-10">
          <h1 className="text-4xl md:text-6xl font-bold font-display mb-4">
            {t("howItWorksPage.title")} <span className="text-gradient">{t("howItWorksPage.titleHighlight")}</span> {t("howItWorksPage.titleEnd")}
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {t("howItWorksPage.subtitle")}
          </p>
        </div>
      </section>

      {/* Steps */}
      <section className="py-20">
        <div className="container px-6 max-w-4xl mx-auto space-y-12">
          {steps.map((step) => (
            <div
              key={step.number}
              className="group relative flex flex-col md:flex-row gap-8 p-8 rounded-2xl bg-card border border-border hover:border-primary/30 transition-all"
            >
              <div className="shrink-0 flex items-start gap-4">
                <span className="text-5xl font-bold font-display text-primary/20">{step.number}</span>
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <step.icon className="w-7 h-7 text-primary" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-semibold font-display mb-2">{step.title}</h3>
                <p className="text-muted-foreground mb-4">{step.description}</p>
                <ul className="space-y-2">
                  {step.details.map((d) => (
                    <li key={d} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Guarantee */}
      <section className="py-20">
        <div className="container px-6 max-w-4xl mx-auto">
          <div className="p-10 rounded-2xl bg-card border border-primary/20 glow-border text-center">
            <Shield className="w-12 h-12 text-primary mx-auto mb-4" />
            <h2 className="text-3xl font-bold font-display mb-3">{t("howItWorksPage.guaranteeTitle")}</h2>
            <p className="text-muted-foreground max-w-xl mx-auto mb-6">{t("howItWorksPage.guaranteeDesc")}</p>
            <Link to="/auth">
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl gap-2">
                {t("howItWorksPage.guaranteeCta")} <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20">
        <div className="container px-6 max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold font-display text-center mb-12">
            {t("howItWorksPage.faqTitle")} <span className="text-gradient">{t("howItWorksPage.faqHighlight")}</span>
          </h2>
          <div className="space-y-4">
            {faqs.map((faq) => (
              <details
                key={faq.q}
                className="group p-6 rounded-2xl bg-card border border-border hover:border-primary/20 transition-colors"
              >
                <summary className="font-semibold font-display cursor-pointer list-none flex items-center justify-between">
                  {faq.q}
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-open:rotate-90 transition-transform" />
                </summary>
                <p className="mt-3 text-muted-foreground text-sm leading-relaxed">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default HowItWorksPage;
