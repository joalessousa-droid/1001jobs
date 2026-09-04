import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  diagnoseProblem,
  type AiDiagnosis,
  type AiDiagnoseInput,
} from "@/lib/ai1001";

export type AiStage = "idle" | "analyzing" | "clarification" | "diagnosed" | "error";

export function use1001AI() {
  const [stage, setStage] = useState<AiStage>("idle");
  const [diagnosis, setDiagnosis] = useState<AiDiagnosis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<{ question: string; answer: string }[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const lastInput = useRef<AiDiagnoseInput | null>(null);

  useEffect(() => {
    let alive = true;
    supabase
      .from("service_categories")
      .select("id, name")
      .then(({ data }) => {
        if (alive && data) setCategories(data as { id: string; name: string }[]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const run = useCallback(
    async (input: AiDiagnoseInput) => {
      setStage("analyzing");
      setError(null);
      const payload: AiDiagnoseInput = {
        ...input,
        categories: input.categories ?? categories.map((c) => c.name),
      };
      lastInput.current = payload;
      try {
        const result = await diagnoseProblem(payload);
        setDiagnosis(result);
        setStage(
          result.required_questions?.length && result.confidence < 0.75
            ? "clarification"
            : "diagnosed",
        );
        return result;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Falha ao analisar";
        setError(
          msg.includes("429") || msg.includes("rate")
            ? "Muitas solicitações agora. Tente novamente em instantes."
            : "Não consegui analisar agora. Você pode continuar manualmente pela busca.",
        );
        setStage("error");
        return null;
      }
    },
    [categories],
  );

  const answerQuestions = useCallback(
    async (newAnswers: { question: string; answer: string }[]) => {
      const merged = [...answers, ...newAnswers];
      setAnswers(merged);
      return run({ ...(lastInput.current ?? {}), answers: merged });
    },
    [answers, run],
  );

  const reset = useCallback(() => {
    setStage("idle");
    setDiagnosis(null);
    setError(null);
    setAnswers([]);
    lastInput.current = null;
  }, []);

  /** Mapeia a categoria sugerida pela IA para uma categoria real da plataforma. */
  const matchCategoryId = useCallback(
    (name?: string | null) => {
      if (!name) return null;
      const norm = (s: string) =>
        s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
      const target = norm(name);
      const exact = categories.find((c) => norm(c.name) === target);
      if (exact) return exact.id;
      const partial = categories.find(
        (c) => norm(c.name).includes(target) || target.includes(norm(c.name)),
      );
      return partial?.id ?? null;
    },
    [categories],
  );

  return { stage, diagnosis, error, answers, categories, run, answerQuestions, reset, matchCategoryId };
}
