import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GraduationCap, BookOpen, Video, ExternalLink } from "lucide-react";

const resources = [
  { title: "Como criar um perfil atraente", desc: "Dicas para se destacar na plataforma", icon: BookOpen, tag: "Artigo" },
  { title: "Estratégias de precificação", desc: "Como definir o valor dos seus serviços", icon: BookOpen, tag: "Artigo" },
  { title: "Atendimento ao cliente", desc: "Boas práticas para fidelizar clientes", icon: Video, tag: "Vídeo" },
  { title: "Marketing digital para profissionais", desc: "Atraia mais clientes com marketing online", icon: Video, tag: "Vídeo" },
  { title: "Como receber boas avaliações", desc: "Estratégias para encantar seus clientes", icon: BookOpen, tag: "Artigo" },
];

const EducationSection = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold font-display">Educação</h2>
        <p className="text-muted-foreground text-sm mt-1">Aprenda e cresça na plataforma</p>
      </div>

      <div className="space-y-3">
        {resources.map((r, i) => (
          <Card key={i} className="p-4 bg-card border-border">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <r.icon className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{r.title}</p>
                  <span className="text-[10px] bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">{r.tag}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{r.desc}</p>
              </div>
              <Button variant="ghost" size="icon" className="shrink-0">
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-6 bg-card border-border text-center">
        <GraduationCap className="w-10 h-10 text-primary mx-auto mb-3" />
        <h3 className="font-display font-semibold text-foreground">Central de Conhecimento</h3>
        <p className="text-sm text-muted-foreground mt-1">Em breve, mais cursos e materiais exclusivos!</p>
      </Card>
    </div>
  );
};

export default EducationSection;
