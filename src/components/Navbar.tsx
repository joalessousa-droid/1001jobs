import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useUnreadCount } from "@/hooks/useUnreadCount";
import { User, Search, MessageSquare, Gift, Megaphone, Menu, X } from "lucide-react";

const Navbar = () => {
  const { user } = useAuth();
  const unreadCount = useUnreadCount();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="container px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <Link to="/" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
            <span className="font-display text-lg text-left font-bold">1001JOBS</span>
          </Link>
        </div>

        <div className="hidden md:flex items-center gap-8">
          <Link to="/buscar" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5" />
            Buscar
          </Link>
          <Link to="/como-funciona" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Como funciona</Link>
          <Link to="/para-profissionais" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Para profissionais</Link>
          <Link to="/para-empresas" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Para empresas</Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link to="/buscar?mode=provider">
            <Button size="sm" variant="outline" className="text-xs sm:text-sm gap-1.5 border-primary text-primary hover:bg-primary hover:text-primary-foreground font-semibold">
              <Megaphone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Anuncie Grátis</span>
              <span className="sm:hidden">Anunciar</span>
            </Button>
          </Link>

          {user ? (
            <div className="flex items-center gap-1 sm:gap-2">
              <Link to="/afiliados" className="hidden sm:block">
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                  <Gift className="w-4 h-4" />
                </Button>
              </Link>
              <Link to="/chat" className="relative">
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                  <MessageSquare className="w-4 h-4" />
                </Button>
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>
              <Link to="/dashboard">
                <Button size="icon" className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg">
                  <User className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <Link to="/auth">
                <Button variant="ghost" size="sm" className="text-sm hidden sm:inline-flex">Entrar</Button>
              </Link>
              <Link to="/auth">
                <Button size="sm" className="text-xs sm:text-sm bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg">Cadastre-se</Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border/50 bg-background/95 backdrop-blur-xl px-6 py-4 space-y-1">
          <Link to="/buscar" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-foreground hover:bg-accent transition-colors">
            <Search className="w-4 h-4 text-muted-foreground" />
            Buscar
          </Link>
          <Link to="/como-funciona" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-foreground hover:bg-accent transition-colors">
            Como funciona
          </Link>
          <Link to="/para-profissionais" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-foreground hover:bg-accent transition-colors">
            Para profissionais
          </Link>
          <Link to="/para-empresas" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-foreground hover:bg-accent transition-colors">
            Para empresas
          </Link>
          {user && (
            <Link to="/afiliados" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-foreground hover:bg-accent transition-colors sm:hidden">
              <Gift className="w-4 h-4 text-muted-foreground" />
              Programa de afiliados
            </Link>
          )}
          {!user && (
            <Link to="/auth" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-foreground hover:bg-accent transition-colors sm:hidden">
              Entrar
            </Link>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
