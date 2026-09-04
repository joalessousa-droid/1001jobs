import { Heart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useFavoriteProviders } from "@/hooks/useFavoriteProviders";
import { cn } from "@/lib/utils";

interface Props {
  providerId: string;
  providerName?: string | null;
  size?: "sm" | "icon";
  className?: string;
}

/** Botão "Favoritar profissional" (⭐ favoritos → chamar novamente). */
const FavoriteButton = ({ providerId, providerName, size = "sm", className }: Props) => {
  const { isFavorite, toggleFavorite, canFavorite } = useFavoriteProviders();
  const active = isFavorite(providerId);

  const onClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canFavorite) {
      toast.error("Entre na sua conta para favoritar profissionais.");
      return;
    }
    try {
      const added = await toggleFavorite(providerId);
      toast.success(
        added
          ? `${providerName ?? "Profissional"} adicionado aos favoritos.`
          : "Removido dos favoritos.",
      );
    } catch {
      toast.error("Não foi possível atualizar seus favoritos.");
    }
  };

  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      size={size === "icon" ? "icon" : "sm"}
      className={cn("gap-2", className)}
      aria-pressed={active}
      aria-label={active ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      data-testid="favorite-provider"
      onClick={onClick}
    >
      <Heart className={cn("w-4 h-4", active && "fill-current")} />
      {size !== "icon" && (active ? "Favorito" : "Favoritar")}
    </Button>
  );
};

export default FavoriteButton;
