import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import logo from "@/assets/logo-1001jobs.png";

const Footer = () => {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-border py-16">
      <div className="container px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <img src={logo} alt="1001JOBS" className="h-24 w-auto dark:invert" />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <Link to="/termos" className="hover:text-foreground transition-colors">{t("footer.terms")}</Link>
            <Link to="/privacidade" className="hover:text-foreground transition-colors">{t("footer.privacy")}</Link>
            <Link to="/contato" className="hover:text-foreground transition-colors">{t("footer.contact")}</Link>
            <Link to="/parceiros" className="hover:text-foreground transition-colors">Parceiros</Link>
            <Link to="/investidores" className="hover:text-foreground transition-colors">Investidores</Link>
          </div>
          <p className="text-sm text-muted-foreground">{t("footer.rights")}</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
