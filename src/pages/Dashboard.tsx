import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { useUpgradePopup } from "@/hooks/useUpgradePopup";
import DashboardSidebar, { type DashboardSection } from "@/components/dashboard/DashboardSidebar";
import ProfileSection from "@/components/dashboard/sections/ProfileSection";
import SecondaryProfileSection from "@/components/dashboard/sections/SecondaryProfileSection";
import AppointmentsSection from "@/components/dashboard/sections/AppointmentsSection";
import SubscriptionSection from "@/components/dashboard/sections/SubscriptionSection";
import SecuritySection from "@/components/dashboard/sections/SecuritySection";
import PrivacySection from "@/components/dashboard/sections/PrivacySection";
import EarningsSection from "@/components/dashboard/sections/EarningsSection";
import DemandsSection from "@/components/dashboard/sections/DemandsSection";
import ServicesSection from "@/components/dashboard/sections/ServicesSection";
import { IncomingOffersPanel } from "@/components/dispatch/IncomingOffersPanel";
import ReviewsSection from "@/components/dashboard/sections/ReviewsSection";
import EducationSection from "@/components/dashboard/sections/EducationSection";
import ContactSection from "@/components/dashboard/sections/ContactSection";
import RecommendationsSection from "@/components/dashboard/sections/RecommendationsSection";
import ServicesLifecycleSection from "@/components/dashboard/sections/ServicesLifecycleSection";
import AgendaEarningsSection from "@/components/dashboard/sections/AgendaEarningsSection";
import RadarHistoryPanel from "@/components/radar/RadarHistoryPanel";

interface Profile {
  id: string;
  display_name: string;
  user_type: "client" | "provider";
  bio: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  avatar_url: string | null;
  verification_status: string;
  latitude: number | null;
  longitude: number | null;
}

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBasicUser, setIsBasicUser] = useState(false);
  const { triggerUpgrade } = useUpgradePopup();
  const section = (searchParams.get("tab") as DashboardSection) || "profile";
  const setSection = (s: DashboardSection) => setSearchParams({ tab: s });

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setProfile(data as Profile);
            // Check if user has active subscription
            supabase
              .from("subscriptions")
              .select("id")
              .eq("profile_id", (data as Profile).id)
              .eq("status", "active")
              .maybeSingle()
              .then(({ data: sub }) => {
                setIsBasicUser(!sub);
              });
          }
          setLoading(false);
        });
    }
  }, [user]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile || !user) return null;

  const renderSection = () => {
    switch (section) {
      case "profile": return (
            <>
              <ProfileSection profile={profile} userId={user.id} onProfileUpdate={(p) => setProfile((prev) => prev ? { ...prev, ...p } : prev)} />
              <div className="mt-8">
                <SecondaryProfileSection profileId={profile.id} />
              </div>
            </>
          );
      case "appointments": return <AppointmentsSection profileId={profile.id} userType={profile.user_type} />;
      case "agenda": return <AgendaEarningsSection profileId={profile.id} userType={profile.user_type} />;
      case "subscription": return <SubscriptionSection profileId={profile.id} />;
      case "security": return <SecuritySection />;
      case "privacy": return <PrivacySection />;
      case "earnings": return <EarningsSection profileId={profile.id} />;
      case "demands": return <DemandsSection profileId={profile.id} />;
      case "services": return <ServicesSection profileId={profile.id} />;
      case "service-orders": return (
        <div className="space-y-6">
          {profile.user_type === 'provider' && <IncomingOffersPanel />}
          <ServicesLifecycleSection profileId={profile.id} userType={profile.user_type} />
          <RadarHistoryPanel profileId={profile.id} />
        </div>
      );
      case "recommendations": return <RecommendationsSection profileId={profile.id} />;
      case "reviews": return <ReviewsSection profileId={profile.id} />;
      case "education": return <EducationSection />;
      case "contact": return <ContactSection />;
      default: return <ProfileSection profile={profile} userId={user.id} onProfileUpdate={(p) => setProfile((prev) => prev ? { ...prev, ...p } : prev)} />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container px-4 sm:px-6 pt-24 pb-16 max-w-6xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-8">
          <DashboardSidebar active={section} onSelect={setSection} userType={profile.user_type} />
          <main className="flex-1 min-w-0">
            {renderSection()}
          </main>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
