import { Shield, Globe, TrendingUp, Wallet, Award, Layers } from "lucide-react";
import { useTranslation } from "react-i18next";

const Features = () => {
  const { t } = useTranslation();

  const features = [
    { icon: Shield, title: t("features.f1Title"), description: t("features.f1Desc") },
    { icon: Award, title: t("features.f2Title"), description: t("features.f2Desc") },
    { icon: Globe, title: t("features.f3Title"), description: t("features.f3Desc") },
    { icon: Wallet, title: t("features.f4Title"), description: t("features.f4Desc") },
    { icon: TrendingUp, title: t("features.f5Title"), description: t("features.f5Desc") },
    { icon: Layers, title: t("features.f6Title"), description: t("features.f6Desc") },
  ];

  return (
    <section className="py-32 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.02] to-transparent" />
      <div className="container px-6 relative">
        <div className="text-center mb-20">
          <h2 className="text-4xl md:text-5xl font-bold font-display mb-4">
            {t("features.title")} <span className="text-gradient">{t("features.titleHighlight")}</span>{t("features.titleEnd")}
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            {t("features.subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {features.map((feature) => (
            <div key={feature.title} className="group p-8 rounded-2xl bg-card border border-border hover:border-primary/20 hover:glow-border transition-all duration-500">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold font-display mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
