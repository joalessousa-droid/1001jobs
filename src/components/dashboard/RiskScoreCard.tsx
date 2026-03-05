import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Shield, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

interface RiskAssessment {
  score: number;
  risk_level: string;
  status: string;
  factors: { code: string; label: string; points: number }[];
  created_at: string;
}

interface Props {
  userId: string;
}

const RiskScoreCard = ({ userId }: Props) => {
  const [assessment, setAssessment] = useState<RiskAssessment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("risk_assessments")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      setAssessment(data as RiskAssessment | null);
      setLoading(false);
    };
    fetch();
  }, [userId]);

  if (loading) return null;
  if (!assessment) return null;

  const getColor = () => {
    if (assessment.risk_level === "low") return "text-green-500";
    if (assessment.risk_level === "medium") return "text-yellow-500";
    return "text-red-500";
  };

  const getBgColor = () => {
    if (assessment.risk_level === "low") return "bg-green-500/10 border-green-500/20";
    if (assessment.risk_level === "medium") return "bg-yellow-500/10 border-yellow-500/20";
    return "bg-red-500/10 border-red-500/20";
  };

  const getIcon = () => {
    if (assessment.risk_level === "low") return <CheckCircle className="w-5 h-5 text-green-500" />;
    if (assessment.risk_level === "medium") return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    return <XCircle className="w-5 h-5 text-red-500" />;
  };

  const getLabel = () => {
    if (assessment.risk_level === "low") return "Risco Baixo";
    if (assessment.risk_level === "medium") return "Revisão Necessária";
    return "Risco Alto";
  };

  const getStatusLabel = () => {
    if (assessment.status === "auto_approved") return "Aprovado automaticamente";
    if (assessment.status === "manual_review") return "Em análise manual";
    return "Bloqueado preventivamente";
  };

  return (
    <div className={`p-5 rounded-2xl border ${getBgColor()}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold">Risk Score</h3>
        </div>
        <div className="flex items-center gap-2">
          {getIcon()}
          <span className={`font-bold text-lg ${getColor()}`}>{assessment.score}/100</span>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <span className={`text-sm font-medium ${getColor()}`}>{getLabel()}</span>
        <span className="text-xs text-muted-foreground">{getStatusLabel()}</span>
      </div>

      {/* Score bar */}
      <div className="w-full h-2 bg-muted rounded-full mb-4 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            assessment.risk_level === "low" ? "bg-green-500" :
            assessment.risk_level === "medium" ? "bg-yellow-500" : "bg-red-500"
          }`}
          style={{ width: `${assessment.score}%` }}
        />
      </div>

      {assessment.factors.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fatores detectados</p>
          {assessment.factors.map((f, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-foreground">{f.label}</span>
              <span className={`font-mono text-xs ${f.points >= 20 ? "text-red-500" : f.points >= 10 ? "text-yellow-500" : "text-muted-foreground"}`}>
                +{f.points}pts
              </span>
            </div>
          ))}
        </div>
      )}

      {assessment.factors.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum fator de risco detectado ✓</p>
      )}
    </div>
  );
};

export default RiskScoreCard;
