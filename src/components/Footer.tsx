import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="border-t border-border py-16">
      <div className="container px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <span className="font-display font-semibold">1001JOBS</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link to="/termos" className="hover:text-foreground transition-colors">Termos</Link>
            <Link to="/privacidade" className="hover:text-foreground transition-colors">Privacidade</Link>
            <Link to="/contato" className="hover:text-foreground transition-colors">Contato</Link>
          </div>
          <p className="text-sm text-muted-foreground">© 2025 1001Jobs. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;