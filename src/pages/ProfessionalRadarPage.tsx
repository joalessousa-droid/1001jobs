import Navbar from "@/components/Navbar";
import ProfessionalRadar from "@/components/radar/ProfessionalRadar";

const ProfessionalRadarPage = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <main className="container mx-auto px-4 pt-20 md:pt-24 pb-6">
      <ProfessionalRadar />
    </main>
  </div>
);

export default ProfessionalRadarPage;
