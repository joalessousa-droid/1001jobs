const stats = [
  { value: "1001+", label: "Categorias de serviço" },
  { value: "R$ 0", label: "Para começar" },
  { value: "100%", label: "Pagamento seguro" },
  { value: "24/7", label: "Suporte disponível" },
];

const Stats = () => {
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
