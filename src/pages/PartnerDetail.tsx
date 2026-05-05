import { useEffect } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink, CheckCircle2 } from "lucide-react";
import { getPartner } from "@/data/partners";
import { trackPartnerEvent } from "@/lib/partnerTracking";

const PartnerDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const partner = slug ? getPartner(slug) : undefined;

  useEffect(() => {
    if (partner) {
      document.title = `${partner.name} — Parceiro | 1001Jobs`;
      trackPartnerEvent(partner.slug, "card_click");
    }
  }, [partner]);

  if (!partner) return <Navigate to="/parceiros" replace />;

  const Icon = partner.Icon;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container px-6 py-24 max-w-4xl">
        <Link to="/parceiros" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4 mr-1" /> Todos os parceiros
        </Link>

        <header className="flex items-start gap-6 mb-10">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="h-10 w-10 text-primary" />
          </div>
          <div className="flex-1">
            <Badge variant="outline" className="mb-2">{partner.category}</Badge>
            <h1 className="font-display text-3xl md:text-4xl font-bold">{partner.name}</h1>
            <p className="text-muted-foreground mt-2">{partner.shortDescription}</p>
          </div>
        </header>

        <Card className="p-6 mb-8">
          <h2 className="font-semibold text-lg mb-3">Sobre a parceria</h2>
          <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{partner.fullDescription}</p>
        </Card>

        <Card className="p-6 mb-8">
          <h2 className="font-semibold text-lg mb-4">Destaques</h2>
          <ul className="space-y-2">
            {partner.highlights.map((h) => (
              <li key={h} className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-6 mb-8">
          <h2 className="font-semibold text-lg mb-4">Links relacionados</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <a
              href={partner.website}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackPartnerEvent(partner.slug, "website_click")}
              className="flex items-center justify-between p-3 rounded-lg border hover:border-primary transition-colors"
            >
              <span className="font-medium">Site oficial</span>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </a>
            {partner.links.map((l) => (
              <a
                key={l.url}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackPartnerEvent(partner.slug, "link_click")}
                className="flex items-center justify-between p-3 rounded-lg border hover:border-primary transition-colors"
              >
                <span className="text-sm">{l.label}</span>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </a>
            ))}
          </div>
        </Card>

        <div className="text-center">
          <Button asChild size="lg">
            <Link to="/parceiros#proposta">Propor parceria semelhante</Link>
          </Button>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PartnerDetail;
