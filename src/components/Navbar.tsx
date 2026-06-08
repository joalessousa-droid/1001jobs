import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useUnreadCount } from "@/hooks/useUnreadCount";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import NotificationsBell from "@/components/NotificationsBell";
import { User, Search, MessageSquare, Gift, Megaphone, Menu, X, Sun, Moon, ClipboardList, Briefcase, ShieldCheck } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";
import LanguageSelector from "@/components/LanguageSelector";
import logoAsset from "@/assets/logo-1001jobs-v4.png.asset.json";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const FALLBACK_LOGO_TEXT = "1001Jobs";

const Navbar = () => {
  const { user } = useAuth();
  const unreadCount = useUnreadCount();
  const { isModerator } = useIsAdmin();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  const menuItems = [
    { to: "/buscar", label: t("nav.search"), icon: Search },
    { to: "/como-funciona", label: t("nav.howItWorks") },
    { to: "/para-profissionais", label: t("nav.forProfessionals") },
    { to: "/para-empresas", label: t("nav.forBusiness") },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="container px-3 sm:px-6 h-14 sm:h-16 md:h-20 flex items-center justify-between gap-2 sm:gap-4 min-w-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Menu"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={mobileOpen ? "close" : "open"}
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="block"
              >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </motion.span>
            </AnimatePresence>
          </button>
          <Link
            to="/"
            className="flex items-center gap-2 shrink-0 min-w-0"
            onClick={() => setMobileOpen(false)}
            aria-label="1001Jobs — página inicial"
          >
            {!logoError ? (
              <img
                src={logoAsset.url}
                alt="1001Jobs — every jobs here"
                data-testid="navbar-logo"
                width={388}
                height={119}
                loading="eager"
                fetchPriority="high"
                decoding="async"
                onLoad={() => setLogoLoaded(true)}
                onError={() => setLogoError(true)}
                className={`h-8 sm:h-10 md:h-12 w-auto max-w-[42vw] sm:max-w-[200px] md:max-w-[220px] object-contain select-none transition-opacity duration-300 ${
                  logoLoaded ? "opacity-100" : "opacity-0"
                }`}
                draggable={false}
              />
            ) : (
              <span className="h-8 sm:h-10 md:h-12 flex items-center text-lg sm:text-xl font-bold tracking-tight text-foreground">
                {FALLBACK_LOGO_TEXT}
              </span>
            )}
          </Link>
        </div>

        <div className="hidden md:flex items-center gap-8">
          {menuItems.map((item) => (
            <Link key={item.to} to={item.to} className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
              {item.icon && <item.icon className="w-3.5 h-3.5" />}
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 min-w-0">
          <LanguageSelector />
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="text-muted-foreground hover:text-foreground h-9 w-9"
            aria-label={t("nav.toggleTheme")}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={theme}
                initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.2 }}
                className="block"
              >
                {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </motion.span>
            </AnimatePresence>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="text-xs sm:text-sm gap-1.5 border-primary text-primary hover:bg-primary hover:text-primary-foreground font-semibold">
                <Megaphone className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t("nav.advertise")}</span>
                <span className="sm:hidden">{t("nav.advertiseMobile")}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem asChild>
                <Link to="/buscar?mode=provider" className="flex items-center gap-2 cursor-pointer">
                  <ClipboardList className="w-4 h-4" />
                  <div>
                    <p className="font-medium text-sm">Publicar Tarefa</p>
                    <p className="text-xs text-muted-foreground">Encontre profissionais</p>
                  </div>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/auth?type=provider" className="flex items-center gap-2 cursor-pointer">
                  <Briefcase className="w-4 h-4" />
                  <div>
                    <p className="font-medium text-sm">Cadastrar Profissional</p>
                    <p className="text-xs text-muted-foreground">Ofereça seus serviços</p>
                  </div>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {user ? (
            <div className="flex items-center gap-1 sm:gap-2">
              {isModerator && (
                <Link to="/admin/disputas" className="hidden sm:block">
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" aria-label="Admin">
                    <ShieldCheck className="w-4 h-4" />
                  </Button>
                </Link>
              )}
              <NotificationsBell />
              <Link to="/afiliados" className="hidden sm:block">
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" aria-label={t("nav.affiliates")}>
                  <Gift className="w-4 h-4" />
                </Button>
              </Link>
              <Link to="/chat" className="relative">
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" aria-label="Mensagens">
                  <MessageSquare className="w-4 h-4" />
                </Button>
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>
              <Link to="/dashboard">
                <Button size="icon" className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg" aria-label="Painel do usuário">
                  <User className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <Link to="/auth">
                <Button variant="ghost" size="sm" className="text-sm hidden sm:inline-flex">{t("nav.signIn")}</Button>
              </Link>
              <Link to="/auth">
                <Button size="sm" className="text-xs sm:text-sm bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg">{t("nav.signUp")}</Button>
              </Link>
            </>
          )}
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="md:hidden overflow-hidden border-t border-border/50 bg-background/95 backdrop-blur-xl"
          >
            <div className="px-6 py-4 space-y-1">
              {menuItems.map((item, i) => (
                <motion.div
                  key={item.to}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ delay: i * 0.05, duration: 0.2 }}
                >
                  <Link
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-foreground hover:bg-accent transition-colors"
                  >
                    {item.icon && <item.icon className="w-4 h-4 text-muted-foreground" />}
                    {item.label}
                  </Link>
                </motion.div>
              ))}
              {user && (
                <motion.div
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ delay: menuItems.length * 0.05, duration: 0.2 }}
                >
                  <Link to="/afiliados" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-foreground hover:bg-accent transition-colors sm:hidden">
                    <Gift className="w-4 h-4 text-muted-foreground" />
                    {t("nav.affiliates")}
                  </Link>
                </motion.div>
              )}
              {!user && (
                <motion.div
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ delay: menuItems.length * 0.05, duration: 0.2 }}
                >
                  <Link to="/auth" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-foreground hover:bg-accent transition-colors sm:hidden">
                    {t("nav.signIn")}
                  </Link>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
