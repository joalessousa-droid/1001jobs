import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { User, Search, MessageSquare } from "lucide-react";

const Navbar = () => {
  const { user } = useAuth();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="container px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          


          <span className="font-display text-lg text-left font-bold">1001JOBS</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          <Link to="/search" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5" />
            Buscar Profissionais
          </Link>
          <Link to="/como-funciona" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Como funciona</Link>
          <Link to="/para-profissionais" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Para profissionais</Link>
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-2">
              <Link to="/chat">
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                  <MessageSquare className="w-4 h-4" />
                </Button>
              </Link>
              <Link to="/dashboard">
                <Button size="sm" className="text-sm bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg gap-2">
                  <User className="w-4 h-4" />
                  Meu Perfil
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <Link to="/auth">
                <Button variant="ghost" size="sm" className="text-sm">Entrar</Button>
              </Link>
              <Link to="/auth">
                <Button size="sm" className="text-sm bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg">Cadastre-se</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>);

};

export default Navbar;