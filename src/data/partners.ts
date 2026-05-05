import { GraduationCap, Briefcase, Users, Globe, BookOpen, type LucideIcon } from "lucide-react";

export type Partner = {
  slug: string;
  name: string;
  category: string;
  shortDescription: string;
  fullDescription: string;
  Icon: LucideIcon;
  website: string;
  links: { label: string; url: string }[];
  highlights: string[];
};

export const PARTNERS: Partner[] = [
  {
    slug: "senac",
    name: "Senac",
    category: "Educação Profissional",
    shortDescription: "Capacitação técnica em comércio, serviços e turismo para profissionais autônomos.",
    fullDescription:
      "O Serviço Nacional de Aprendizagem Comercial (Senac) é uma das maiores instituições de educação profissional da América Latina. Em parceria com a 1001Jobs, oferece trilhas de capacitação para profissionais autônomos em áreas como gastronomia, beleza, tecnologia, gestão e atendimento ao cliente, com certificação reconhecida nacionalmente.",
    Icon: GraduationCap,
    website: "https://www.senac.br",
    links: [
      { label: "Cursos livres Senac", url: "https://www.ead.senac.br" },
      { label: "Programa Empreender", url: "https://www.senac.br/empreender" },
      { label: "Encontrar unidade", url: "https://www.senac.br/unidades" },
    ],
    highlights: ["+600 cursos técnicos", "Presença em todos os estados", "Certificação reconhecida pelo MEC"],
  },
  {
    slug: "senai",
    name: "Senai",
    category: "Educação Industrial",
    shortDescription: "Formação técnica em indústria, manutenção e ofícios especializados.",
    fullDescription:
      "O Senai é referência em formação para a indústria e ofícios técnicos. A parceria com a 1001Jobs disponibiliza cursos de eletricista, encanador, refrigeração, mecânica, soldagem e automação para profissionais autônomos que querem ampliar repertório e atender demandas de maior valor agregado.",
    Icon: Briefcase,
    website: "https://www.senai.br",
    links: [
      { label: "Cursos online Senai", url: "https://ead.senai.br" },
      { label: "Mundo Senai", url: "https://www.mundosenai.com.br" },
    ],
    highlights: ["Foco em ofícios técnicos", "Laboratórios práticos", "Reconhecimento da indústria"],
  },
  {
    slug: "sescoop",
    name: "Sescoop",
    category: "Cooperativismo",
    shortDescription: "Apoio à formação cooperativa e desenvolvimento de pequenos empreendedores.",
    fullDescription:
      "O Sescoop atua na promoção da cultura cooperativista, oferecendo formação em gestão, governança e empreendedorismo coletivo. Através da 1001Jobs, profissionais autônomos podem se conectar a cooperativas regionais e acessar capacitações sobre formalização, MEI e tributação.",
    Icon: Users,
    website: "https://www.sescoop.coop.br",
    links: [
      { label: "Plataforma CapacitaCoop", url: "https://capacitacoop.com.br" },
      { label: "Sistema OCB", url: "https://www.ocb.org.br" },
    ],
    highlights: ["Formação em gestão coop.", "Rede nacional de cooperativas", "Apoio a MEIs"],
  },
  {
    slug: "google",
    name: "Google",
    category: "Tecnologia",
    shortDescription: "Ferramentas de produtividade, presença digital e cursos do Google Ateliê Digital.",
    fullDescription:
      "Profissionais cadastrados na 1001Jobs têm acesso ao Google Ateliê Digital, com trilhas gratuitas de marketing digital, presença online, vendas pela internet e ferramentas de produtividade. A parceria também inclui orientações para uso do Google Meu Negócio e divulgação local.",
    Icon: Globe,
    website: "https://learndigital.withgoogle.com",
    links: [
      { label: "Ateliê Digital", url: "https://learndigital.withgoogle.com/ateliedigital" },
      { label: "Google Meu Negócio", url: "https://www.google.com/business/" },
      { label: "Google Skillshop", url: "https://skillshop.withgoogle.com" },
    ],
    highlights: ["Cursos 100% gratuitos", "Certificações Google", "Foco em presença digital"],
  },
  {
    slug: "coursera",
    name: "Coursera",
    category: "Cursos Online",
    shortDescription: "Certificações internacionais em tecnologia, gestão e habilidades profissionais.",
    fullDescription:
      "Através do Coursera, profissionais da 1001Jobs acessam cursos e certificados profissionais de universidades como Stanford, Yale e empresas como IBM, Meta e Google, em áreas como dados, design, gestão de projetos e atendimento.",
    Icon: BookOpen,
    website: "https://www.coursera.org",
    links: [
      { label: "Catálogo Coursera", url: "https://www.coursera.org/browse" },
      { label: "Certificados Profissionais", url: "https://www.coursera.org/professional-certificates" },
    ],
    highlights: ["+5000 cursos", "Certificados reconhecidos globalmente", "Trilhas em português"],
  },
];

export const getPartner = (slug: string) => PARTNERS.find((p) => p.slug === slug);
