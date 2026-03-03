import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useTranslation } from "react-i18next";

const Privacy = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-3xl mx-auto px-6 pt-28 pb-16 prose prose-sm prose-neutral dark:prose-invert">
        <h1 className="font-display">{t("privacy.title")}</h1>
        <p className="text-muted-foreground">{t("privacy.lastUpdate")}</p>
        <h2>{t("privacy.s1Title")}</h2><p>{t("privacy.s1Text")}</p>
        <h2>{t("privacy.s2Title")}</h2><p>{t("privacy.s2Text")}</p>
        <h2>{t("privacy.s3Title")}</h2><p>{t("privacy.s3Text")}</p>
        <h2>{t("privacy.s4Title")}</h2><p>{t("privacy.s4Text")}</p>
        <h2>{t("privacy.s5Title")}</h2><p>{t("privacy.s5Text")}</p>
        <h2>{t("privacy.s6Title")}</h2><p>{t("privacy.s6Text")}</p>
      </main>
      <Footer />
    </div>
  );
};

export default Privacy;
