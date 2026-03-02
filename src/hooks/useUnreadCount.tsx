import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const useUnreadCount = () => {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setCount(0);
      return;
    }

    let myProfileId: string | null = null;

    const fetchCount = async () => {
      if (!myProfileId) {
        const { data } = await supabase.rpc("get_my_profile_id");
        myProfileId = data;
      }
      if (!myProfileId) return;

      // Get all conversations I'm part of
      const { data: convs } = await supabase
        .from("conversations")
        .select("id")
        .or(`participant_1.eq.${myProfileId},participant_2.eq.${myProfileId}`);

      if (!convs || convs.length === 0) {
        setCount(0);
        return;
      }

      const convIds = convs.map((c) => c.id);

      const { count: unread } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .in("conversation_id", convIds)
        .eq("read", false)
        .neq("sender_id", myProfileId);

      setCount(unread || 0);
    };

    fetchCount();

    const channel = supabase
      .channel("unread-count")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        fetchCount();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return count;
};
