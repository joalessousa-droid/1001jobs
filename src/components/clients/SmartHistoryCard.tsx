import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, CalendarClock } from "lucide-react";
import { Link } from "react-router-dom";
import { differenceInDays } from "date-fns";

interface HistoryRow {
  id: string;
  title: string;
  status: string;
  created_at: string;
}

/** #29 — Histórico inteligente: a IA sugere revisão/repetição com base em serviços anteriores. */
const SmartHistoryCard = ({ history }: { history: HistoryRow[] }) => {
  const suggestion = useMemo(() => {
    const done = history
      .filter((h) => ["completed", "confirmed"].includes(h.status))
      .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
    for (const h of done) {
      const days = differenceInDays(new Date(), new Date(h.created_at));
      if (days >= 150) return { ...h, days };
    }
    return null;
  }, [history]);

  if (!suggestion) return null;

  const months = Math.round(suggestion.days / 30);

  return (
    <Card
      className="p-5 space-y-3 border-primary/30 bg-primary/5"
      data-testid="smart-history-suggestion"
    >
      <h3 className="font-display font-semibold flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-primary" />
        Sugestão 1001 AI
      </h3>
      <p className="text-sm text-muted-foreground">
        Você teve um serviço de <strong>{suggestion.title}</strong> há cerca de {months}{" "}
        {months === 1 ? "mês" : "meses"}. Deseja agendar uma nova revisão?
      </p>
      <Button asChild size="sm" className="gap-2" data-testid="smart-history-schedule">
        <Link to="/agendar">
          <CalendarClock className="w-4 h-4" /> Agendar revisão
        </Link>
      </Button>
    </Card>
  );
};

export default SmartHistoryCard;
