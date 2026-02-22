const Footer = () => {
  return (
    <footer className="border-t border-border py-16">
      <div className="container px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xs font-display">1K</span>
            </div>
            <span className="font-display font-semibold">1001Jobs</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">Termos</a>
            <a href="#" className="hover:text-foreground transition-colors">Privacidade</a>
            <a href="#" className="hover:text-foreground transition-colors">Contato</a>
          </div>
          <p className="text-sm text-muted-foreground">© 2025 1001Jobs. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
