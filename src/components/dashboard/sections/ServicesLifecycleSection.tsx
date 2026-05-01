import { useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Briefcase, Loader2 } from "lucide-react";
import { useServices } from "@/hooks/useServices";
import ServiceCard from "@/components/services/ServiceCard";

interface Props {
  profileId: string;
  userType: "client" | "provider";
}

const ACTIVE = ["pending", "accepted", "in_progress", "completed"] as const;
const HISTORY = ["confirmed", "cancelled_by_client", "cancelled_by_provider", "disputed", "refunded"] as const;

const ServicesLifecycleSection = ({ profileId, userType }: Props) => {
  const { services, loading, refetch } = useServices(profileId, "all");
  const [tab, setTab] = useState<"active" | "history">("active");

  const active = useMemo(() => services.filter((s) => ACTIVE.includes(s.status as any)), [services]);
  const history = useMemo(() => services.filter((s) => HISTORY.includes(s.status as any)), [services]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold font-display flex items-center gap-2">
          <Briefcase className="w-6 h-6 text-primary" />
          Meus serviços
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          Acompanhe o ciclo de vida de cada serviço — do aceite até a confirmação ou disputa.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="active">Ativos ({active.length})</TabsTrigger>
          <TabsTrigger value="history">Histórico ({history.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-3 mt-4">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : active.length === 0 ? (
            <p className="text-center text-muted-foreground py-12 text-sm">
              Nenhum serviço ativo. Quando você {userType === "client" ? "contratar" : "aceitar"} um serviço, ele aparecerá aqui.
            </p>
          ) : (
            active.map((s) => (
              <ServiceCard key={s.id} service={s} viewerProfileId={profileId} onChanged={refetch} />
            ))
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-3 mt-4">
          {history.length === 0 ? (
            <p className="text-center text-muted-foreground py-12 text-sm">Sem histórico ainda.</p>
          ) : (
            history.map((s) => (
              <ServiceCard key={s.id} service={s} viewerProfileId={profileId} onChanged={refetch} />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ServicesLifecycleSection;
