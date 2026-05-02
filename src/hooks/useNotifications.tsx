import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Notification {
  id: string;
  profile_id: string;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  metadata: any;
  read: boolean;
  created_at: string;
}

export const useNotifications = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [profileId, setProfileId] = useState<string | null>(null);
  const unread = items.filter((n) => !n.read).length;

  const load = useCallback(async (pid: string) => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("profile_id", pid)
      .order("created_at", { ascending: false })
      .limit(30);
    setItems((data as any[]) ?? []);
  }, []);

  useEffect(() => {
    if (!user) {
      setItems([]);
      setProfileId(null);
      return;
    }
    let active = true;
    supabase.rpc("get_my_profile_id").then(({ data }) => {
      if (!active || !data) return;
      setProfileId(data as string);
      load(data as string);
    });
    return () => {
      active = false;
    };
  }, [user, load]);

  useEffect(() => {
    if (!profileId) return;
    const ch = supabase
      .channel(`notifs-${profileId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `profile_id=eq.${profileId}`,
        },
        () => load(profileId),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [profileId, load]);

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
  };
  const markAllRead = async () => {
    if (!profileId) return;
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("profile_id", profileId)
      .eq("read", false);
  };

  return { items, unread, markRead, markAllRead };
};
