import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Zap, MessageSquare, Star } from "lucide-react";
import { useUpgradePopup } from "@/hooks/useUpgradePopup";

const proPerks = [
  { icon: Zap, text: "Anúncios ilimitados" },
  { icon: Star, text: "Perfil destacado nas buscas" },
  { icon: MessageSquare, text: "Chat ilimitado com clientes" },
];

const UpgradeProPopup = () => {
  const { open, close, reason } = useUpgradePopup();
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border-primary/20 bg-card">
        <div className="relative p-6 pb-0">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Sparkles className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-xl font-display font-bold text-foreground">
            Desbloqueie todo o potencial!
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            {reason || (
              <>Com o <span className="font-semibold text-primary">Plano Pro</span> você atrai mais clientes e cresce mais rápido.</>
            )}
          </p>
        </div>

        <div className="px-6 py-4 space-y-3">
          {proPerks.map((perk) => (
            <div key={perk.text} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <perk.icon className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm text-foreground">{perk.text}</span>
            </div>
          ))}
        </div>

        <div className="p-6 pt-2 flex flex-col gap-2">
          <Button
            onClick={() => { close(); navigate("/dashboard?tab=subscription"); }}
            className="w-full h-11 rounded-xl font-semibold gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Assinar Pro — R$ 99/mês
          </Button>
          <Button
            variant="ghost"
            onClick={close}
            className="w-full text-sm text-muted-foreground hover:text-foreground"
          >
            Agora não
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UpgradeProPopup;
