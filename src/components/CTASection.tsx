import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

const CTASection = () => {
  const { t } = useTranslation();

  return (
    <section className="py-32 relative">
      <div className="absolute inset-0 hero-glow opacity-50" />
      <div className="container px-6 relative">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-6xl font-bold font-display mb-6 leading-tight">
            {t("cta.title1")}
            <br />
            <span className="text-gradient">{t("cta.title2")}</span>
          </h2>
          <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto">
            {t("cta.subtitle")}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/auth">
              <Button size="lg" className="h-14 px-10 text-base font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 gap-2 shadow-lg shadow-primary/25">
                {t("cta.btn1")}
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <Link to="/buscar">
              <Button size="lg" variant="outline" className="h-14 px-10 text-base font-semibold rounded-xl border-border hover:bg-secondary">
                {t("cta.btn2")}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
