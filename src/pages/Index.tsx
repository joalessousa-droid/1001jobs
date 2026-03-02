import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import Stats from "@/components/Stats";
import RecentProviders from "@/components/RecentProviders";
import HowItWorks from "@/components/HowItWorks";
import Features from "@/components/Features";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <HeroSection />
      <Stats />
      <RecentProviders />
      <HowItWorks />
      <Features />
      <CTASection />
      <Footer />
    </div>
  );
};

export default Index;
