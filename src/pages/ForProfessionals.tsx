import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  TrendingUp, Wallet, Award, Globe, Users, BarChart3, Camera, Shield, ArrowRight, CheckCircle2, Zap, Loader2,
} from "lucide-react";

const benefitIcons = [Users, Wallet, Award, Camera, BarChart3, Globe];

const ForProfessionals = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const benefits = Array.from({ length: 6 }, (_, i) => ({
    icon: benefitIcons[i],
    title: t(`forProfessionals.b${i + 1}Title`),
    description: t(`forProfessionals.b${i + 1}Desc`),
  }));

  const testimonials = [1, 2, 3].map((i) => ({
    name: t(`forProfessionals.t${i}Name`),
    role: t(`forProfessionals.t${i}Role`),
    text: t(`forProfessionals.t${i}Text`),
  }));

  const plans = [
    {
      name: t("forProfessionals.freePlan"),
      price: t("forProfessionals.freePrice"),
      period: t("forProfessionals.perMonth"),
      planKey: null as string | null,
      description: t("forProfessionals.freeDesc"),
      features: Array.from({ length: 5 }, (_, i) => t(`forProfessionals.freeF${i + 1}`)),
      cta: t("forProfessionals.freeCta"),
      highlight: false,
    },
    {
      name: t("forProfessionals.proPlan"),
      price: t("forProfessionals.proPrice"),
      period: t("forProfessionals.perMonth"),
      planKey: "pro",
      description: t("forProfessionals.proDesc"),
      features: Array.from({ length: 7 }, (_, i) => t(`forProfessionals.proF${i + 1}`)),
      cta: t("forProfessionals.proCta"),
      highlight: true,
    },
    {
      name: t("forProfessionals.businessPlan"),
      price: t("forProfessionals.businessPrice"),
      period: t("forProfessionals.perMonth"),
      planKey: "business",
      description: t("forProfessionals.businessDesc"),
      features: Array.from({ length: 6 }, (_, i) => t(`forProfessionals.businessF${i + 1}`)),
      cta: t("forProfessionals.businessCta"),
      highlight: false,
    },
  ];

  const handleSubscribe = async (planKey: string) => {
    if (!user) {
      toast.error(t("forProfessionals.loginRequired"));
      return;
    }
    setLoadingPlan(planKey);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ plan: planKey }),
        }
      );
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error || t("forProfessionals.paymentError"));
      }
    } catch {
      toast.error(t("forProfessionals.connectionError"));
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="pt-28 pb-16 relative">
        <div className="absolute inset-0 hero-glow opacity-30" />
        <div className="container px-6 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Zap className="w-4 h-4" />
            {t("forProfessionals.badge")}
          </div>
          <h1 className="text-4xl md:text-6xl font-bold font-display mb-4">
            {t("forProfessionals.title")} <span className="text-gradient">{t("forProfessionals.titleHighlight")}</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-8">
            {t("forProfessionals.subtitle")}
          </p>
          <Link to="/auth">
            <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl gap-2 text-base h-14 px-8">
              {t("forProfessionals.ctaBtn")} <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20">
        <div className="container px-6">
          <h2 className="text-3xl md:text-4xl font-bold font-display text-center mb-16">
            {t("forProfessionals.whyTitle")} <span className="text-gradient">{t("forProfessionals.whyHighlight")}</span>{t("forProfessionals.whyEnd")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {benefits.map((b) => (
              <div key={b.title} className="group p-8 rounded-2xl bg-card border border-border hover:border-primary/20 hover:glow-border transition-all duration-500">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-colors">
                  <b.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold font-display mb-2">{b.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{b.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20">
        <div className="container px-6">
          <h2 className="text-3xl md:text-4xl font-bold font-display text-center mb-12">
            {t("forProfessionals.testimonialsTitle")} <span className="text-gradient">{t("forProfessionals.testimonialsHighlight")}</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {testimonials.map((tt) => (
              <div key={tt.name} className="p-6 rounded-2xl bg-card border border-border">
                <p className="text-muted-foreground text-sm leading-relaxed mb-4">"{tt.text}"</p>
                <div>
                  <p className="font-semibold text-sm">{tt.name}</p>
                  <p className="text-xs text-muted-foreground">{tt.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20">
        <div className="container px-6">
          <h2 className="text-3xl md:text-4xl font-bold font-display text-center mb-4">
            {t("forProfessionals.pricingTitle")} <span className="text-gradient">{t("forProfessionals.pricingHighlight")}</span>
          </h2>
          <p className="text-muted-foreground text-center mb-12 max-w-xl mx-auto">
            {t("forProfessionals.pricingSubtitle")}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`p-8 rounded-2xl border transition-all ${
                  plan.highlight ? "bg-card border-primary/40 glow-border" : "bg-card border-border"
                }`}
              >
                {plan.highlight && (
                  <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
                    {t("forProfessionals.mostPopular")}
                  </span>
                )}
                <h3 className="text-xl font-bold font-display">{plan.name}</h3>
                <div className="flex items-baseline gap-1 my-3">
                  <span className="text-4xl font-bold font-display">{plan.price}</span>
                  <span className="text-muted-foreground text-sm">{plan.period}</span>
                </div>
                <p className="text-muted-foreground text-sm mb-6">{plan.description}</p>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                {plan.planKey ? (
                  <Button
                    onClick={() => handleSubscribe(plan.planKey!)}
                    disabled={loadingPlan === plan.planKey}
                    className={`w-full rounded-xl h-12 ${
                      plan.highlight
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    }`}
                  >
                    {loadingPlan === plan.planKey ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    {plan.cta}
                  </Button>
                ) : (
                  <Link to="/auth">
                    <Button
                      className={`w-full rounded-xl h-12 ${
                        plan.highlight
                          ? "bg-primary text-primary-foreground hover:bg-primary/90"
                          : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                      }`}
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container px-6 max-w-3xl mx-auto text-center">
          <div className="p-10 rounded-2xl bg-card border border-primary/20 glow-border">
            <TrendingUp className="w-12 h-12 text-primary mx-auto mb-4" />
            <h2 className="text-3xl font-bold font-display mb-3">{t("forProfessionals.readyTitle")}</h2>
            <p className="text-muted-foreground mb-6">{t("forProfessionals.readySubtitle")}</p>
            <Link to="/auth">
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl gap-2">
                {t("forProfessionals.readyCta")} <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default ForProfessionals;
