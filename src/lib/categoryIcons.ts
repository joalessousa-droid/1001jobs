import {
  Utensils,
  Wrench,
  GraduationCap,
  Sparkles,
  Code2,
  Palette,
  Zap,
  Droplets,
  Truck,
  Camera,
  Leaf,
  SprayCan,
  Megaphone,
  Cog,
  Boxes,
  Paintbrush,
  Hammer,
  HeartPulse,
  LayoutGrid,
  type LucideIcon,
} from "lucide-react";

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

const ICONS: Record<string, LucideIcon> = {
  alimentacao: Utensils,
  "assistencia tecnica": Wrench,
  "aulas particulares": GraduationCap,
  "beleza & estetica": Sparkles,
  "beleza e estetica": Sparkles,
  "desenvolvimento web": Code2,
  "design grafico": Palette,
  eletricista: Zap,
  encanamento: Droplets,
  entregas: Truck,
  fotografia: Camera,
  jardinagem: Leaf,
  limpeza: SprayCan,
  "marketing digital": Megaphone,
  mecanica: Cog,
  mudancas: Boxes,
  pintura: Paintbrush,
  reformas: Hammer,
  saude: HeartPulse,
};

export const ALL_CATEGORIES_ICON = LayoutGrid;

export function categoryIcon(name: string): LucideIcon {
  return ICONS[normalize(name)] ?? Wrench;
}
