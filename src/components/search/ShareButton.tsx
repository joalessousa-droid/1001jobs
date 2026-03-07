import { useState } from "react";
import { Share2, Copy, Check, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";

interface ShareButtonProps {
  url: string;
  title: string;
  text?: string;
  size?: "sm" | "icon";
}

const ShareButton = ({ url, title, text, size = "sm" }: ShareButtonProps) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const fullUrl = url.startsWith("http") ? url : `${window.location.origin}${url}`;
  const shareText = text || title;

  const openExternal = (url: string, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const newWindow = window.open(url, "_blank", "noopener,noreferrer");
    if (!newWindow) {
      // Fallback: create a temporary link to avoid navigating the current page
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    setOpen(false);
  };

  const handleNativeShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (navigator.share) {
      try {
        await navigator.share({ title, text: shareText, url: fullUrl });
        setOpen(false);
      } catch {}
    }
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    toast({ title: "Link copiado!" });
    setTimeout(() => setCopied(false), 2000);
  };

  const shareWhatsApp = (e: React.MouseEvent) => {
    openExternal(`https://wa.me/?text=${encodeURIComponent(`${shareText}\n${fullUrl}`)}`, e);
  };

  const shareTelegram = (e: React.MouseEvent) => {
    openExternal(`https://t.me/share/url?url=${encodeURIComponent(fullUrl)}&text=${encodeURIComponent(shareText)}`, e);
  };

  const shareLinkedIn = (e: React.MouseEvent) => {
    openExternal(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(fullUrl)}`, e);
  };

  const shareX = (e: React.MouseEvent) => {
    openExternal(`https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(fullUrl)}`, e);
  };

  const shareFacebook = (e: React.MouseEvent) => {
    openExternal(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(fullUrl)}`, e);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size={size === "icon" ? "icon" : "sm"}
          className="text-muted-foreground hover:text-foreground hover:bg-accent h-8 w-8 p-0 rounded-full border border-border bg-card/80 backdrop-blur-sm"
          title="Compartilhar"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
        >
          <Share2 className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-2" align="end" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-1">
          <button
            onClick={shareWhatsApp}
            className="flex items-center gap-2.5 w-full rounded-md px-2.5 py-2 text-sm hover:bg-accent transition-colors text-foreground"
          >
            <MessageCircle className="w-4 h-4 text-[hsl(142,70%,45%)]" />
            WhatsApp
          </button>
          <button
            onClick={shareTelegram}
            className="flex items-center gap-2.5 w-full rounded-md px-2.5 py-2 text-sm hover:bg-accent transition-colors text-foreground"
          >
            <svg className="w-4 h-4 text-[hsl(200,80%,50%)]" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
            Telegram
          </button>
          <button
            onClick={shareFacebook}
            className="flex items-center gap-2.5 w-full rounded-md px-2.5 py-2 text-sm hover:bg-accent transition-colors text-foreground"
          >
            <svg className="w-4 h-4 text-[hsl(220,46%,48%)]" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            Facebook
          </button>
          <button
            onClick={shareX}
            className="flex items-center gap-2.5 w-full rounded-md px-2.5 py-2 text-sm hover:bg-accent transition-colors text-foreground"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            X (Twitter)
          </button>
          <button
            onClick={shareLinkedIn}
            className="flex items-center gap-2.5 w-full rounded-md px-2.5 py-2 text-sm hover:bg-accent transition-colors text-foreground"
          >
            <svg className="w-4 h-4 text-[hsl(210,80%,45%)]" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
            LinkedIn
          </button>
          <div className="border-t border-border my-1" />
          <button
            onClick={handleCopy}
            className="flex items-center gap-2.5 w-full rounded-md px-2.5 py-2 text-sm hover:bg-accent transition-colors text-foreground"
          >
            {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copiado!" : "Copiar link"}
          </button>
          {navigator.share && (
            <button
              onClick={handleNativeShare}
              className="flex items-center gap-2.5 w-full rounded-md px-2.5 py-2 text-sm hover:bg-accent transition-colors text-foreground"
            >
              <Share2 className="w-4 h-4" />
              Mais opções...
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ShareButton;
