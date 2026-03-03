import { Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from "react-i18next";

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface SearchFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedCategory: string;
  onCategoryChange: (value: string) => void;
  selectedCity: string;
  onCityChange: (value: string) => void;
  sortBy: string;
  onSortChange: (value: string) => void;
  categories: Category[];
  cities: string[];
}

const SearchFilters = ({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  selectedCity,
  onCityChange,
  sortBy,
  onSortChange,
  categories,
  cities,
}: SearchFiltersProps) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t("search.searchPlaceholder")}
          className="pl-10 h-12 bg-card border-border"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={selectedCategory} onValueChange={onCategoryChange}>
          <SelectTrigger className="w-[180px] bg-card border-border">
            <SelectValue placeholder={t("search.category")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("search.allCategories")}</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedCity} onValueChange={onCityChange}>
          <SelectTrigger className="w-[160px] bg-card border-border">
            <SelectValue placeholder={t("search.city")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("search.allCities")}</SelectItem>
            {cities.map((city) => (
              <SelectItem key={city} value={city}>{city}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={onSortChange}>
          <SelectTrigger className="w-[160px] bg-card border-border">
            <SlidersHorizontal className="w-4 h-4 mr-2" />
            <SelectValue placeholder={t("search.sort")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">{t("search.sortName")}</SelectItem>
            <SelectItem value="rating">{t("search.sortRating")}</SelectItem>
            <SelectItem value="price_asc">{t("search.sortPriceAsc")}</SelectItem>
            <SelectItem value="price_desc">{t("search.sortPriceDesc")}</SelectItem>
            <SelectItem value="recent">{t("search.sortRecent")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default SearchFilters;
