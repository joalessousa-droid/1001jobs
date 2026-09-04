import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, Trash2 } from "lucide-react";

interface MediaItem {
  id: string;
  kind: string;
  url: string;
  created_at: string;
}

interface Props {
  serviceId: string;
  /** profiles.id do profissional; quando informado e for o usuário atual, habilita upload. */
  providerId?: string | null;
  canUpload?: boolean;
}

/** Registro fotográfico ANTES e DEPOIS do serviço (evidência, portfólio e transparência). */
const BeforeAfterGallery = ({ serviceId, providerId, canUpload = false }: Props) => {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [uploading, setUploading] = useState<"before" | "after" | null>(null);
  const pending = useRef<"before" | "after">("before");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("service_media")
      .select("id, kind, url, created_at")
      .eq("service_id", serviceId)
      .order("created_at", { ascending: true });
    setItems((data ?? []) as MediaItem[]);
  }, [serviceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const pick = (kind: "before" | "after") => {
    pending.current = kind;
    fileRef.current?.click();
  };

  const upload = async (file?: File | null) => {
    if (!file || !providerId) return;
    const kind = pending.current;
    setUploading(kind);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `service-media/${serviceId}/${kind}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("portfolio").upload(path, file, {
        upsert: false,
        contentType: file.type,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("portfolio").getPublicUrl(path);
      const { error } = await supabase.from("service_media").insert({
        service_id: serviceId,
        provider_id: providerId,
        kind,
        url: pub.publicUrl,
      });
      if (error) throw error;
      toast.success(kind === "before" ? "Foto 'antes' registrada." : "Foto 'depois' registrada.");
      await load();
    } catch {
      toast.error("Não foi possível enviar a foto.");
    } finally {
      setUploading(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeItem = async (id: string) => {
    await supabase.from("service_media").delete().eq("id", id);
    setItems((i) => i.filter((x) => x.id !== id));
  };

  const before = items.filter((i) => i.kind === "before");
  const after = items.filter((i) => i.kind !== "before");

  return (
    <Card className="p-4 md:p-6" data-testid="before-after">
      <h3 className="font-semibold mb-4">Antes e depois</h3>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => upload(e.target.files?.[0])}
      />
      <div className="grid grid-cols-2 gap-4">
        {(["before", "after"] as const).map((kind) => {
          const list = kind === "before" ? before : after;
          return (
            <div key={kind}>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                {kind === "before" ? "Antes" : "Depois"}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {list.map((m) => (
                  <div key={m.id} className="relative">
                    <img
                      src={m.url}
                      alt={`Foto ${kind === "before" ? "antes" : "depois"} do serviço`}
                      loading="lazy"
                      className="w-full aspect-square object-cover rounded-md"
                    />
                    {canUpload && (
                      <button
                        type="button"
                        aria-label="Remover foto"
                        onClick={() => removeItem(m.id)}
                        className="absolute top-1 right-1 rounded-full bg-background/90 border border-border p-1"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
                {list.length === 0 && (
                  <p className="text-sm text-muted-foreground col-span-2">Sem fotos.</p>
                )}
              </div>
              {canUpload && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 gap-2"
                  disabled={uploading !== null}
                  onClick={() => pick(kind)}
                  data-testid={`upload-${kind}`}
                >
                  {uploading === kind ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                  Adicionar
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
};

export default BeforeAfterGallery;
