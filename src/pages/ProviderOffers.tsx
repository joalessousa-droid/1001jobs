import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { IncomingOffersPanel } from "@/components/dispatch/IncomingOffersPanel";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Radar } from "lucide-react";

/** Tela do profissional: solicitações recebidas, aceite/recusa e disponibilidade */
const ProviderOffers = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container max-w-3xl mx-auto px-4 pt-24 pb-16 space-y-4" data-testid="provider-offers-page">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Radar className="w-5 h-5 text-primary" /> Minhas ofertas
          </h1>
          <p className="text-sm text-muted-foreground">
            Fique online para receber solicitações do Radar, envie seu preço e aceite ou recuse cada oferta.
          </p>
        </header>

        <IncomingOffersPanel />

        <Card className="p-4 text-xs text-muted-foreground">
          Ofertas expiram automaticamente. Enviar o preço mantém a oferta ativa até o cliente confirmar o valor.
        </Card>
      </main>
    </div>
  );
};

export default ProviderOffers;
