import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import ConversationList from "@/components/chat/ConversationList";
import MessageThread from "@/components/chat/MessageThread";
import { MessageSquare } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

const Chat = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const [myProfileId, setMyProfileId] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  // Get profile ID
  useEffect(() => {
    if (user) {
      supabase.rpc("get_my_profile_id").then(({ data }) => {
        if (data) setMyProfileId(data);
        setLoading(false);
      });
    }
  }, [user]);

  // Handle ?with=profileId to start/open a conversation
  useEffect(() => {
    const withProfileId = searchParams.get("with");
    if (!withProfileId || !myProfileId) return;

    const findOrCreateConversation = async () => {
      // Check existing conversation
      const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .or(
          `and(participant_1.eq.${myProfileId},participant_2.eq.${withProfileId}),and(participant_1.eq.${withProfileId},participant_2.eq.${myProfileId})`
        )
        .maybeSingle();

      if (existing) {
        setSelectedConversation(existing.id);
      } else {
        const { data: newConv } = await supabase
          .from("conversations")
          .insert({ participant_1: myProfileId, participant_2: withProfileId })
          .select("id")
          .single();

        if (newConv) setSelectedConversation(newConv.id);
      }
    };

    findOrCreateConversation();
  }, [searchParams, myProfileId]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!myProfileId) return null;

  const showList = !isMobile || !selectedConversation;
  const showThread = !isMobile || !!selectedConversation;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <div className="flex-1 flex pt-16 max-w-6xl w-full mx-auto">
        {/* Conversation List */}
        {showList && (
          <div className={`border-r border-border bg-card ${isMobile ? "w-full" : "w-80 shrink-0"}`}>
            <div className="p-4 border-b border-border">
              <h2 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                Mensagens
              </h2>
            </div>
            <ConversationList
              myProfileId={myProfileId}
              selectedId={selectedConversation}
              onSelect={setSelectedConversation}
            />
          </div>
        )}

        {/* Message Thread */}
        {showThread && (
          <div className="flex-1 flex flex-col min-h-0">
            {selectedConversation ? (
              <MessageThread
                conversationId={selectedConversation}
                myProfileId={myProfileId}
                onBack={isMobile ? () => setSelectedConversation(null) : undefined}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-muted-foreground font-medium">
                    Selecione uma conversa
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Ou inicie uma pelo perfil de um profissional
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;
