// Central administrativa real: pessoas, tarefas e segurança em um só lugar.
import { useSearchParams, Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminPeoplePanel from "@/components/admin/AdminPeoplePanel";
import AdminTasksPanel from "@/components/admin/AdminTasksPanel";
import AdminSecurityPanel from "@/components/admin/AdminSecurityPanel";
import { Users, ClipboardList, ShieldAlert, Bot, Settings2 } from "lucide-react";

const VALID = ["pessoas", "tarefas", "seguranca"] as const;
type TabKey = (typeof VALID)[number];

interface Props {
  defaultTab?: TabKey;
}

const AdminCentral = ({ defaultTab = "pessoas" }: Props) => {
  const [params, setParams] = useSearchParams();
  const fromUrl = params.get("aba") as TabKey | null;
  const tab: TabKey = fromUrl && VALID.includes(fromUrl) ? fromUrl : defaultTab;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-24 pb-16" data-testid="admin-central">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold">Central administrativa</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Gerencie pessoas reais, tarefas e segurança da plataforma sem depender do painel de bots.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" asChild>
              <Link to="/admin/gestao"><Settings2 className="w-4 h-4" /> Gestão</Link>
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" asChild>
              <Link to="/admin/bots"><Bot className="w-4 h-4" /> Bots</Link>
            </Button>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setParams({ aba: v }, { replace: true })}>
          <TabsList>
            <TabsTrigger value="pessoas" className="gap-1.5" data-testid="admin-central-people">
              <Users className="w-4 h-4" /> Pessoas
            </TabsTrigger>
            <TabsTrigger value="tarefas" className="gap-1.5" data-testid="admin-central-tasks">
              <ClipboardList className="w-4 h-4" /> Tarefas
            </TabsTrigger>
            <TabsTrigger value="seguranca" className="gap-1.5" data-testid="admin-central-security">
              <ShieldAlert className="w-4 h-4" /> Segurança
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pessoas" className="mt-5">
            <AdminPeoplePanel />
          </TabsContent>
          <TabsContent value="tarefas" className="mt-5">
            <AdminTasksPanel />
          </TabsContent>
          <TabsContent value="seguranca" className="mt-5">
            <Card className="p-4 mb-4 text-sm text-muted-foreground">
              Perfis públicos, tarefas de demonstração e tarefas expiradas, com bloqueio imediato.
            </Card>
            <AdminSecurityPanel />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminCentral;
