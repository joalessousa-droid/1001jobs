import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useTranslation } from "react-i18next";

const Terms = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-3xl mx-auto px-6 pt-28 pb-16 prose prose-sm prose-neutral dark:prose-invert">
        <h1 className="font-display">{t("terms.title")}</h1>
        <p className="text-muted-foreground">{t("terms.lastUpdate")}</p>
        <h2>{t("terms.s1Title")}</h2><p>{t("terms.s1Text")}</p>
        <h2>{t("terms.s2Title")}</h2><p>{t("terms.s2Text")}</p>
        <h2>{t("terms.s3Title")}</h2><p>{t("terms.s3Text")}</p>
        <h2>{t("terms.s4Title")}</h2><p>{t("terms.s4Text")}</p>
        <h2>{t("terms.s5Title")}</h2><p>{t("terms.s5Text")}</p>
        <h2>{t("terms.s6Title")}</h2><p>{t("terms.s6Text")}</p>
      </main>
      <Footer />
    </div>
  );
};

export default Terms;
