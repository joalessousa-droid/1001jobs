import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  rating: number;
  onRate?: (rating: number) => void;
  size?: "sm" | "md";
}

const StarRating = ({ rating, onRate, size = "sm" }: StarRatingProps) => {
  const starSize = size === "sm" ? "w-4 h-4" : "w-5 h-5";

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!onRate}
          onClick={() => onRate?.(star)}
          className={cn(
            "transition-colors",
            onRate ? "cursor-pointer hover:scale-110" : "cursor-default"
          )}
        >
          <Star
            className={cn(
              starSize,
              star <= rating
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground/30"
            )}
          />
        </button>
      ))}
    </div>
  );
};

export default StarRating;
