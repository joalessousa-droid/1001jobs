import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MatchScore {
  id: string;
  score: number;
  reasons: string[];
}

export function useMatchScores() {
  const [scores, setScores] = useState<Map<string, MatchScore>>(new Map());
  const [loading, setLoading] = useState(false);

  const fetchScoresForTask = useCallback(
    async (taskDescription: string, taskCategory: string, taskCity: string | null, taskBudget: number | null, providerIds: string[]) => {
      if (!taskDescription || providerIds.length === 0) return;
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("ai-match", {
          body: {
            mode: "professionals_for_task",
            task_description: taskDescription,
            task_category: taskCategory,
            task_city: taskCity,
            task_budget: taskBudget,
            provider_ids: providerIds.slice(0, 20),
          },
        });
        if (!error && data?.scores) {
          const map = new Map<string, MatchScore>();
          data.scores.forEach((s: MatchScore) => map.set(s.id, s));
          setScores(map);
        }
      } catch (e) {
        console.error("Match scores error:", e);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const fetchScoresForProfessional = useCallback(
    async (profileId: string, taskIds: string[]) => {
      if (!profileId || taskIds.length === 0) return;
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("ai-match", {
          body: {
            mode: "tasks_for_professional",
            profile_id: profileId,
            task_ids: taskIds.slice(0, 20),
          },
        });
        if (!error && data?.scores) {
          const map = new Map<string, MatchScore>();
          data.scores.forEach((s: MatchScore) => map.set(s.id, s));
          setScores(map);
        }
      } catch (e) {
        console.error("Match scores error:", e);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { scores, loading, fetchScoresForTask, fetchScoresForProfessional };
}
