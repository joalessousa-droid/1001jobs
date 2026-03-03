import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/buscar" element={<Search />} />
            {/* Redirects for old routes */}
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
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
