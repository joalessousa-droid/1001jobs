import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ProBadgeProps {
  profileId: string;
  /** Skip the DB check and just show the badge */
  isPro?: boolean;
  className?: string;
}

const ProBadge = ({ profileId, isPro, className = "" }: ProBadgeProps) => {
  const [show, setShow] = useState(isPro ?? false);

  useEffect(() => {
    if (isPro !== undefined) return;
    supabase
      .from("subscriptions")
      .select("id")
      .eq("profile_id", profileId)
      .eq("status", "active")
      .maybeSingle()
      .then(({ data }) => setShow(!!data));
  }, [profileId, isPro]);

  if (!show) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary/15 text-primary border border-primary/25 ${className}`}
          >
            <Sparkles className="w-3 h-3" />
            PRO
          </span>
        </TooltipTrigger>
        <TooltipContent>Assinante do Plano Pro</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default ProBadge;
