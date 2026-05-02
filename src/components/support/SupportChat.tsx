import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Send, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/support-chat`;

const SUGGESTIONS = [
  "Como publico uma Tarefa?",
  "Como funciona o pagamento retido (escrow)?",
  "Como abro uma disputa?",
  "Como vira Profissional verificado?",
];

const SupportChat = () => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Olá! Sou a **Ana**, assistente da 1001Jobs. Posso responder dúvidas sobre como publicar Tarefas, pagamentos, disputas, avaliações e muito mais. Como posso ajudar?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef<string>(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `s_${Date.now()}_${Math.random().toString(36).slice(2)}`,
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Msg = { role: "user", content: trimmed };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);

    let assistantSoFar = "";
    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && last !== messages[messages.length - 1]) {
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: assistantSoFar } : m,
          );
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: next, sessionId: sessionIdRef.current }),
      });

      if (!resp.ok) {
        let msg = "Não consegui responder agora. Tente novamente.";
        if (resp.status === 429) msg = "Muitas mensagens em pouco tempo. Aguarde alguns segundos.";
        if (resp.status === 402) msg = "Limite de uso da IA atingido. Tente mais tarde.";
        try { const j = await resp.json(); if (j?.error) msg = j.error; } catch {}
        toast({ title: "Ops", description: msg, variant: "destructive" });
        setMessages(next);
        return;
      }
      if (!resp.body) throw new Error("Sem resposta");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;

      while (!done) {
        const { done: finished, value } = await reader.read();
        if (finished) break;
        buffer += decoder.decode(value, { stream: true });

        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) upsert(delta);
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error(e);
      toast({ title: "Erro", description: "Falha ao conversar com a Ana.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="overflow-hidden border-border/60">
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-muted/30">
        <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight">Ana — Assistente 1001Jobs</p>
          <p className="text-xs text-muted-foreground">
            Tira dúvidas sobre uso da plataforma · IA
          </p>
        </div>
      </div>

      <div ref={scrollRef} className="h-[420px] overflow-y-auto px-4 py-4 space-y-3 bg-background">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-muted text-foreground rounded-bl-sm"
              }`}
            >
              {m.role === "assistant" ? (
                <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0">
                  <ReactMarkdown>{m.content || "…"}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{m.content}</p>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" /> Ana está digitando…
          </div>
        )}
      </div>

      {messages.length <= 1 && (
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-muted transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="flex items-center gap-2 border-t p-3 bg-muted/20"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pergunte algo sobre a plataforma…"
          disabled={loading}
        />
        <Button type="submit" size="icon" disabled={loading || !input.trim()}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </form>
    </Card>
  );
};

export default SupportChat;
