import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { UpgradePopupProvider } from "@/hooks/useUpgradePopup";
import UpgradeProPopup from "@/components/dashboard/UpgradeProPopup";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Search from "./pages/Search";
import HowItWorksPage from "./pages/HowItWorksPage";
import ForProfessionals from "./pages/ForProfessionals";
import ForBusiness from "./pages/ForBusiness";
import ProviderProfile from "./pages/ProviderProfile";
import Chat from "./pages/Chat";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Contact from "./pages/Contact";
import ResetPassword from "./pages/ResetPassword";
import AffiliateDashboard from "./pages/AffiliateDashboard";
import ServiceDispute from "./pages/ServiceDispute";
import AdminDisputes from "./pages/AdminDisputes";
import AdminPaymentAudit from "./pages/AdminPaymentAudit";
import AdminSupportChatMetrics from "./pages/AdminSupportChatMetrics";
import Investors from "./pages/Investors";
import AdminInvestorLeads from "./pages/AdminInvestorLeads";
import AdminInvestorAudit from "./pages/AdminInvestorAudit";
import Partners from "./pages/Partners";
import PartnerDetail from "./pages/PartnerDetail";
import AdminPartnerLeads from "./pages/AdminPartnerLeads";
import AdminContactMessages from "./pages/AdminContactMessages";
import NotFound from "./pages/NotFound";
import ServiceTracking from "./pages/ServiceTracking";
import AdminDispatchDashboard from "./pages/AdminDispatchDashboard";
import AdminDispatchFunnel from "./pages/AdminDispatchFunnel";
import AdminEtaMetrics from "./pages/AdminEtaMetrics";
import AdminEtaAlerts from "./pages/AdminEtaAlerts";
import AdminEtaConfig from "./pages/AdminEtaConfig";
import ProviderOffers from "./pages/ProviderOffers";
import PerfilKyc from "./pages/PerfilKyc";
import AdminKyc from "./pages/AdminKyc";
import AdminRanking from "./pages/AdminRanking";
import AdminFaceVerification from "./pages/AdminFaceVerification";
import AdminKycMetrics from "./pages/AdminKycMetrics";
import { CriticalAuthGuard } from "@/components/auth/CriticalAuthGuard";
import { CriticalActionProvider } from "@/hooks/useCriticalAction";


const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <UpgradePopupProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <CriticalActionProvider>
            <UpgradeProPopup />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/buscar" element={<Search />} />
              <Route path="/search" element={<Navigate to="/buscar" replace />} />
              <Route path="/servicos" element={<Navigate to="/buscar?mode=provider" replace />} />
              <Route path="/como-funciona" element={<HowItWorksPage />} />
              <Route path="/para-profissionais" element={<ForProfessionals />} />
              <Route path="/para-empresas" element={<ForBusiness />} />
              <Route path="/provider/:id" element={<ProviderProfile />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/termos" element={<Terms />} />
              <Route path="/privacidade" element={<Privacy />} />
              <Route path="/contato" element={<Contact />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/afiliados" element={<AffiliateDashboard />} />
              <Route path="/disputa/:disputeId" element={<ServiceDispute />} />
              <Route path="/admin/disputas" element={<AdminDisputes />} />
              <Route path="/admin/pagamentos" element={<AdminPaymentAudit />} />
              <Route path="/admin/chatbot" element={<AdminSupportChatMetrics />} />
              <Route path="/investidores" element={<Investors />} />
              <Route path="/admin/investidores" element={<AdminInvestorLeads />} />
              <Route path="/admin/investidores/auditoria" element={<AdminInvestorAudit />} />
              <Route path="/parceiros" element={<Partners />} />
              <Route path="/parceiros/:slug" element={<PartnerDetail />} />
              <Route path="/admin/parceiros" element={<AdminPartnerLeads />} />
              <Route path="/admin/contato" element={<AdminContactMessages />} />
              <Route path="/servico/:serviceId/rastreio" element={<ServiceTracking />} />
              <Route path="/admin/dispatch" element={<AdminDispatchDashboard />} />
              <Route path="/admin/dispatch/funil" element={<AdminDispatchFunnel />} />
              <Route path="/admin/eta" element={<AdminEtaMetrics />} />
              <Route path="/admin/eta/alertas" element={<AdminEtaAlerts />} />
              <Route path="/admin/eta/config" element={<AdminEtaConfig />} />
              <Route path="/profissional/ofertas" element={<ProviderOffers />} />
              <Route path="/perfil/kyc" element={<CriticalAuthGuard context="kyc"><PerfilKyc /></CriticalAuthGuard>} />
              <Route path="/admin/kyc" element={<AdminKyc />} />
              <Route path="/admin/ranking" element={<AdminRanking />} />
              <Route path="/admin/face-verification" element={<CriticalAuthGuard context="sensitive_change" requireFace><AdminFaceVerification /></CriticalAuthGuard>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </UpgradePopupProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
