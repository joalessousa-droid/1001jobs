import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

const Footer = () => {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-border py-16">
      <div className="container px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <span className="font-display font-semibold">1001JOBS</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link to="/termos" className="hover:text-foreground transition-colors">{t("footer.terms")}</Link>
            <Link to="/privacidade" className="hover:text-foreground transition-colors">{t("footer.privacy")}</Link>
            <Link to="/contato" className="hover:text-foreground transition-colors">{t("footer.contact")}</Link>
          </div>
          <p className="text-sm text-muted-foreground">{t("footer.rights")}</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
