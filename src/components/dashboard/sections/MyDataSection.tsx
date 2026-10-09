import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { UserCog, Navigation, Trash2, Undo2 } from "lucide-react";

interface Props { onEditProfile: () => void }

type Req = { id: string; status: string; requested_at: string; scheduled_for: string };

/** Central de dados do cliente: editar dados, ver navegações/chegadas e pedir exclusão (LGPD, 180 dias). */
const MyDataSection = ({ onEditProfile }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [req, setReq] = useState<Req | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("account_deletion_requests" as never)
      .select("id,status,requested_at,scheduled_for")
      .eq("user_id", user.id).eq("status", "pending").maybeSingle();
    setReq((data as unknown as Req) ?? null);
  };
  useEffect(() => { void load(); }, [user]);

  const requestDeletion = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("request_account_deletion" as never, { _reason: reason || null } as never);
    setBusy(false);
    if (error) return toast({ title: "Não foi possível registrar o pedido", description: "Tente novamente em instantes. Nenhum dado foi alterado.", variant: "destructive" });
    toast({ title: "Pedido de exclusão registrado", description: "Seus dados serão excluídos em até 180 dias. Você pode cancelar enquanto estiver pendente." });
    void load();
  };

  const cancel = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("cancel_account_deletion" as never);
    setBusy(false);
    if (error) return toast({ title: "Não foi possível cancelar", variant: "destructive" });
    toast({ title: "Pedido de exclusão cancelado" });
    void load();
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold font-display">Meus dados</h2>

      <div className="p-6 rounded-2xl bg-card border border-border space-y-3">
        <h3 className="font-semibold flex items-center gap-2"><UserCog className="w-4 h-4" /> Dados pessoais</h3>
        <p className="text-sm text-muted-foreground">Altere nome, telefone, cidade, estado e foto.</p>
        <Button onClick={onEditProfile} variant="secondary">Alterar dados pessoais</Button>
      </div>

      <div className="p-6 rounded-2xl bg-card border border-border space-y-3">
        <h3 className="font-semibold flex items-center gap-2"><Navigation className="w-4 h-4" /> Navegações e chegadas</h3>
        <p className="text-sm text-muted-foreground">Veja quando seus profissionais iniciaram a navegação e chegaram ao local, com mapa e gráfico.</p>
        <Button asChild variant="secondary"><Link to="/minhas-navegacoes">Ver histórico</Link></Button>
      </div>

      <div className="p-6 rounded-2xl bg-card border border-destructive/40 space-y-3">
        <h3 className="font-semibold flex items-center gap-2 text-destructive"><Trash2 className="w-4 h-4" /> Excluir conta</h3>
        {req ? (
          <>
            <p className="text-sm">Pedido registrado em {new Date(req.requested_at).toLocaleDateString("pt-BR")}. Exclusão prevista até {new Date(req.scheduled_for).toLocaleDateString("pt-BR")}.</p>
            <Button variant="outline" onClick={cancel} disabled={busy} className="gap-2"><Undo2 className="w-4 h-4" /> Cancelar pedido</Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Seus dados pessoais serão excluídos em até 180 dias. Registros que a lei obriga a guardar (como pagamentos) são mantidos pelo prazo legal.</p>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo (opcional)" maxLength={500} />
            <AlertDialog>
              <AlertDialogTrigger asChild><Button variant="destructive" disabled={busy}>Solicitar exclusão da conta</Button></AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir sua conta?</AlertDialogTitle>
                  <AlertDialogDescription>Seus dados serão excluídos em até 180 dias. Você pode cancelar enquanto o pedido estiver pendente.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                  <AlertDialogAction onClick={requestDeletion}>Confirmar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>
    </div>
  );
};

export default MyDataSection;
