import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfileId } from "@/hooks/useProfileId";

export type Frequency = "weekly" | "biweekly" | "monthly" | "custom";

export interface RecurringService {
  id: string;
  title: string;
  frequency: Frequency;
  interval_days: number;
  next_run_at: string;
  active: boolean;
  provider_id: string | null;
  category_id: string | null;
}

export const FREQUENCY_DAYS: Record<Frequency, number> = {
  weekly: 7,
  biweekly: 15,
  monthly: 30,
  custom: 30,
};

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
  custom: "Personalizado",
};

export function useRecurringServices() {
  const { profileId } = useProfileId();
  const [items, setItems] = useState<RecurringService[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profileId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("recurring_services")
      .select("id, title, frequency, interval_days, next_run_at, active, provider_id, category_id")
      .eq("client_id", profileId)
      .order("next_run_at", { ascending: true });
    setItems((data ?? []) as RecurringService[]);
    setLoading(false);
  }, [profileId]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = useCallback(
    async (input: {
      title: string;
      frequency: Frequency;
      interval_days?: number;
      provider_id?: string | null;
      category_id?: string | null;
    }) => {
      if (!profileId) throw new Error("Entre na sua conta.");
      const days = input.interval_days ?? FREQUENCY_DAYS[input.frequency];
      const next = new Date(Date.now() + days * 86400000).toISOString();
      const { data, error } = await supabase
        .from("recurring_services")
        .insert({
          client_id: profileId,
          title: input.title,
          frequency: input.frequency,
          interval_days: days,
          next_run_at: next,
          provider_id: input.provider_id ?? null,
          category_id: input.category_id ?? null,
        })
        .select("id, title, frequency, interval_days, next_run_at, active, provider_id, category_id")
        .single();
      if (error) throw error;
      setItems((i) => [...i, data as RecurringService]);
      return data as RecurringService;
    },
    [profileId],
  );

  const toggleActive = useCallback(async (id: string, active: boolean) => {
    await supabase.from("recurring_services").update({ active }).eq("id", id);
    setItems((i) => i.map((x) => (x.id === id ? { ...x, active } : x)));
  }, []);

  const remove = useCallback(async (id: string) => {
    await supabase.from("recurring_services").delete().eq("id", id);
    setItems((i) => i.filter((x) => x.id !== id));
  }, []);

  return { items, loading, create, toggleActive, remove, reload: load, canManage: !!profileId };
}
