import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface Conversation {
  id: string;
  otherUser: {
    id: string;
    display_name: string;
    avatar_url: string | null;
  };
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

interface ConversationListProps {
  myProfileId: string;
  selectedId: string | null;
  onSelect: (conversationId: string) => void;
}

const ConversationList = ({ myProfileId, selectedId, onSelect }: ConversationListProps) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = async () => {
    const { data } = await supabase
      .from("conversations")
      .select(`
        id, updated_at,
        p1:profiles!conversations_participant_1_fkey(id, display_name, avatar_url),
        p2:profiles!conversations_participant_2_fkey(id, display_name, avatar_url)
      `)
      .or(`participant_1.eq.${myProfileId},participant_2.eq.${myProfileId}`)
      .order("updated_at", { ascending: false });

    if (!data) {
      setLoading(false);
      return;
    }

    const mapped: Conversation[] = await Promise.all(
      data.map(async (c: any) => {
        const otherUser = c.p1?.id === myProfileId ? c.p2 : c.p1;

        // Get last message
        const { data: msgs } = await supabase
          .from("messages")
          .select("content, created_at, read, sender_id")
          .eq("conversation_id", c.id)
          .order("created_at", { ascending: false })
          .limit(1);

        const lastMsg = msgs?.[0];

        // Count unread
        const { count } = await supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .eq("conversation_id", c.id)
          .eq("read", false)
          .neq("sender_id", myProfileId);

        return {
          id: c.id,
          otherUser: otherUser || { id: "", display_name: "Usuário", avatar_url: null },
          lastMessage: lastMsg?.content || null,
          lastMessageAt: lastMsg?.created_at || c.updated_at,
          unreadCount: count || 0,
        };
      })
    );

    setConversations(mapped);
    setLoading(false);
  };

  useEffect(() => {
    fetchConversations();
  }, [myProfileId]);

  // Listen for new messages to refresh list
  useEffect(() => {
    const channel = supabase
      .channel("conv-list")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        fetchConversations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [myProfileId]);

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="p-8 text-center">
        <MessageSquare className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Nenhuma conversa ainda</p>
        <p className="text-xs text-muted-foreground mt-1">
          Inicie uma conversa pelo perfil de um profissional
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {conversations.map((conv) => (
        <button
          key={conv.id}
          onClick={() => onSelect(conv.id)}
          className={cn(
            "w-full flex items-center gap-3 p-4 text-left transition-colors hover:bg-secondary/50",
            selectedId === conv.id && "bg-secondary"
          )}
        >
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarImage src={conv.otherUser.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
              {conv.otherUser.display_name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm text-foreground truncate">
                {conv.otherUser.display_name}
              </span>
              {conv.lastMessageAt && (
                <span className="text-xs text-muted-foreground shrink-0 ml-2">
                  {new Date(conv.lastMessageAt).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                  })}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground truncate flex-1">
                {conv.lastMessage || "Nova conversa"}
              </p>
              {conv.unreadCount > 0 && (
                <span className="shrink-0 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">
                  {conv.unreadCount}
                </span>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
};

export default ConversationList;
