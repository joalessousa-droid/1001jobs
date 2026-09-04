import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, HeartOff } from "lucide-react";
import { useFavoriteProviders } from "@/hooks/useFavoriteProviders";

/** Lista de profissionais favoritos do cliente ("meus profissionais de confiança"). */
const FavoriteProvidersCard = () => {
  const { favorites, loading, toggleFavorite, canFavorite } = useFavoriteProviders();

  return (
    <Card className="p-4 md:p-6" data-testid="favorite-providers">
      <div className="flex items-center gap-2 mb-4">
        <Heart className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">Meus profissionais</h3>
      </div>

      {!canFavorite && (
        <p className="text-sm text-muted-foreground">Entre na sua conta para salvar favoritos.</p>
      )}
      {canFavorite && loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {canFavorite && !loading && favorites.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Você ainda não salvou nenhum profissional. Toque no coração no card do profissional.
        </p>
      )}

      <div className="space-y-3">
        {favorites.map((f) => (
          <div key={f.provider_id} className="flex items-center gap-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src={f.avatar_url ?? undefined} alt={f.display_name ?? "Profissional"} />
              <AvatarFallback>{(f.display_name ?? "P").slice(0, 1)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <Link
                to={`/profissional/${f.provider_id}`}
                className="font-medium truncate hover:underline"
              >
                {f.display_name ?? "Profissional"}
              </Link>
              <p className="text-xs text-muted-foreground truncate">{f.city ?? "—"}</p>
            </div>
            {f.provider_tier && (
              <Badge variant="secondary" className="text-[10px]">
                {f.provider_tier}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Remover ${f.display_name ?? "profissional"} dos favoritos`}
              onClick={() => toggleFavorite(f.provider_id)}
            >
              <HeartOff className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default FavoriteProvidersCard;
