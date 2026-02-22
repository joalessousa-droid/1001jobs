import { Button } from "@/components/ui/button";

const Navbar = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="container px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm font-display">1K</span>
          </div>
          <span className="font-display font-bold text-lg">1001Jobs</span>
        </div>

        <div className="hidden md:flex items-center gap-8">
          <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Como funciona</a>
          <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Para profissionais</a>
          <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Planos</a>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="text-sm">Entrar</Button>
          <Button size="sm" className="text-sm bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg">Cadastre-se</Button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
