import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Loader2, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PortfolioItem {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
}

interface PortfolioManagerProps {
  userId: string;
  profileId: string;
}

const PortfolioManager = ({ userId, profileId }: PortfolioManagerProps) => {
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchItems();
  }, [profileId]);

  const fetchItems = async () => {
    const { data } = await supabase
      .from("portfolio_items")
      .select("id, title, description, image_url")
      .eq("provider_id", profileId)
      .order("created_at", { ascending: false });
    if (data) setItems(data);
    setLoading(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Selecione uma imagem", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Máximo 5MB", variant: "destructive" });
      return;
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleAdd = async () => {
    if (!title.trim()) {
      toast({ title: "Adicione um título", variant: "destructive" });
      return;
    }
    setUploading(true);

    let imageUrl: string | null = null;

    if (selectedFile) {
      const ext = selectedFile.name.split(".").pop();
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("portfolio").upload(path, selectedFile);
      if (error) {
        toast({ title: "Erro no upload", description: error.message, variant: "destructive" });
        setUploading(false);
        return;
      }
      const { data: { publicUrl } } = supabase.storage.from("portfolio").getPublicUrl(path);
      imageUrl = publicUrl;
    }

    const { error } = await supabase.from("portfolio_items").insert({
      provider_id: profileId,
      title: title.trim(),
      description: description.trim() || null,
      image_url: imageUrl,
    });

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Item adicionado!" });
      setTitle("");
      setDescription("");
      setSelectedFile(null);
      setPreviewUrl(null);
      fetchItems();
    }
    setUploading(false);
  };

  const handleDelete = async (item: PortfolioItem) => {
    // Delete image from storage if exists
    if (item.image_url) {
      const url = new URL(item.image_url);
      const pathParts = url.pathname.split("/storage/v1/object/public/portfolio/");
      if (pathParts[1]) {
        await supabase.storage.from("portfolio").remove([decodeURIComponent(pathParts[1])]);
      }
    }
    const { error } = await supabase.from("portfolio_items").delete().eq("id", item.id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      toast({ title: "Item removido" });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-display font-bold">Portfólio</h2>

      {/* Existing items */}
      {items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {items.map((item) => (
            <div key={item.id} className="group relative rounded-xl border border-border overflow-hidden bg-muted">
              {item.image_url ? (
                <img src={item.image_url} alt={item.title} className="w-full aspect-square object-cover" />
              ) : (
                <div className="w-full aspect-square flex items-center justify-center">
                  <ImageIcon className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                <p className="text-sm font-medium text-background truncate">{item.title}</p>
                <Button
                  size="icon"
                  variant="destructive"
                  className="absolute top-2 right-2 h-7 w-7"
                  onClick={() => handleDelete(item)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add new item */}
      <div className="p-4 rounded-xl border border-dashed border-border space-y-3">
        <div
          className="cursor-pointer rounded-lg bg-muted flex items-center justify-center aspect-video overflow-hidden"
          onClick={() => inputRef.current?.click()}
        >
          {previewUrl ? (
            <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-1 text-muted-foreground">
              <Plus className="w-6 h-6" />
              <span className="text-xs">Adicionar foto</span>
            </div>
          )}
        </div>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />

        <div>
          <Label htmlFor="portfolio-title" className="text-xs mb-1 block">Título</Label>
          <Input
            id="portfolio-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Reforma de cozinha"
            className="h-9 bg-background border-border"
          />
        </div>
        <div>
          <Label htmlFor="portfolio-desc" className="text-xs mb-1 block">Descrição (opcional)</Label>
          <Input
            id="portfolio-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detalhes do trabalho"
            className="h-9 bg-background border-border"
          />
        </div>
        <Button onClick={handleAdd} disabled={uploading} className="w-full gap-2">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          {uploading ? "Enviando..." : "Adicionar ao portfólio"}
        </Button>
      </div>
    </div>
  );
};

export default PortfolioManager;
