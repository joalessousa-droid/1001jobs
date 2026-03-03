import { useTranslation } from "react-i18next";

const Stats = () => {
  const { t } = useTranslation();

  const stats = [
    { value: "1001+", label: t("stats.categories") },
    { value: "R$ 0", label: t("stats.free") },
    { value: "100%", label: t("stats.secure") },
    { value: "24/7", label: t("stats.support") },
  ];

  return (
    <section className="py-20 border-y border-border">
      <div className="container px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-4xl md:text-5xl font-bold font-display text-gradient mb-2">
                {stat.value}
              </div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Stats;
