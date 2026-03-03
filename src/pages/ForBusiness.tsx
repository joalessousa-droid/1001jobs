import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Building2, Users, TrendingUp, Shield } from "lucide-react";
import { useTranslation } from "react-i18next";

const benefitIcons = [Users, TrendingUp, Shield, Building2];

const ForBusiness = () => {
  const { t } = useTranslation();

  const benefits = Array.from({ length: 4 }, (_, i) => ({
    icon: benefitIcons[i],
    title: t(`forBusiness.b${i + 1}Title`),
    description: t(`forBusiness.b${i + 1}Desc`),
  }));

  const steps = [1, 2, 3].map((i) => ({
    step: String(i),
    title: t(`forBusiness.step${i}`),
    desc: t(`forBusiness.step${i}Desc`),
  }));

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16">
        <div className="container px-6 max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-medium mb-6">
              <Building2 className="w-4 h-4" />
              {t("forBusiness.badge")}
            </div>
            <h1 className="text-4xl md:text-5xl font-bold font-display mb-4">
              {t("forBusiness.title")}
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t("forBusiness.subtitle")}
            </p>
            <div className="flex gap-3 justify-center mt-8">
              <Link to="/auth">
                <Button size="lg" className="gap-2 text-base">{t("forBusiness.registerBtn")}</Button>
              </Link>
              <Link to="/buscar?mode=provider">
                <Button size="lg" variant="outline" className="gap-2 text-base">{t("forBusiness.viewDemands")}</Button>
              </Link>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-6 mb-16">
            {benefits.map((b, i) => (
              <div key={i} className="rounded-2xl border border-border bg-card p-6 hover:border-primary/30 transition-colors">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <b.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{b.title}</h3>
                <p className="text-sm text-muted-foreground">{b.description}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <h2 className="text-2xl font-bold font-display mb-4">{t("forBusiness.howTitle")}</h2>
            <div className="grid sm:grid-cols-3 gap-6 mt-8">
              {steps.map((item) => (
                <div key={item.step} className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                    {item.step}
                  </div>
                  <h4 className="font-semibold">{item.title}</h4>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ForBusiness;
