import { useMemo } from "react";
import { Check, X } from "lucide-react";

interface Props {
  password: string;
}

export type StrengthLevel = "weak" | "medium" | "strong";

export function calcStrength(password: string): { level: StrengthLevel; score: number; checks: { label: string; ok: boolean }[] } {
  const checks = [
    { label: "Mínimo 8 caracteres", ok: password.length >= 8 },
    { label: "Letra maiúscula", ok: /[A-Z]/.test(password) },
    { label: "Letra minúscula", ok: /[a-z]/.test(password) },
    { label: "Número", ok: /[0-9]/.test(password) },
    { label: "Símbolo", ok: /[^A-Za-z0-9]/.test(password) },
  ];
  const passed = checks.filter((c) => c.ok).length;
  // Bonus for length >= 12
  const bonus = password.length >= 12 ? 1 : 0;
  const total = passed + bonus;

  let level: StrengthLevel = "weak";
  if (total >= 5) level = "strong";
  else if (total >= 3) level = "medium";

  const score = Math.min(100, Math.round((total / 6) * 100));
  return { level, score, checks };
}

const PasswordStrengthMeter = ({ password }: Props) => {
  const { level, score, checks } = useMemo(() => calcStrength(password), [password]);

  if (!password) return null;

  const colorClass =
    level === "strong"
      ? "bg-emerald-500"
      : level === "medium"
        ? "bg-amber-500"
        : "bg-destructive";

  const label =
    level === "strong" ? "Forte" : level === "medium" ? "Média" : "Fraca";

  const labelColor =
    level === "strong"
      ? "text-emerald-500"
      : level === "medium"
        ? "text-amber-500"
        : "text-destructive";

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${colorClass}`}
            style={{ width: `${score}%` }}
          />
        </div>
        <span className={`text-xs font-medium ${labelColor}`}>{label}</span>
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5">
        {checks.map((c, i) => (
          <li
            key={i}
            className={`flex items-center gap-1 text-[11px] ${c.ok ? "text-emerald-500" : "text-muted-foreground"}`}
          >
            {c.ok ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
            {c.label}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PasswordStrengthMeter;
