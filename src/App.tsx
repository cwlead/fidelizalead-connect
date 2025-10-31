import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Contacts from "./pages/Contacts";
import Campaigns from "./pages/Campaigns";
import Sequences from "./pages/Sequences";
import Loyalty from "./pages/Loyalty";
import WhatsApp from "./pages/WhatsApp";
import Groups from "./pages/Groups";
import Integrations from "./pages/Integrations";
import Onboarding from "./pages/Onboarding";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

// 👇 novo: editor de sequência (detalhe)
import SequenceEditor from "@/components/sequences/SequenceEditor";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<Login />} />

            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
                  <Onboarding />
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/contatos"
              element={
                <ProtectedRoute>
                  <Contacts />
                </ProtectedRoute>
              }
            />

            <Route
              path="/campanhas"
              element={
                <ProtectedRoute>
                  <Campaigns />
                </ProtectedRoute>
              }
            />

            <Route
              path="/sequencias"
              element={
                <ProtectedRoute>
                  <Sequences />
                </ProtectedRoute>
              }
            />

            {/* 👇 nova rota: editor de sequência */}
            <Route
              path="/sequencias/:id"
              element={
                <ProtectedRoute>
                  <SequenceEditor />
                </ProtectedRoute>
              }
            />

            <Route
              path="/fidelidade"
              element={
                <ProtectedRoute>
                  <Loyalty />
                </ProtectedRoute>
              }
            />

            <Route
              path="/whatsapp"
              element={
                <ProtectedRoute>
                  <WhatsApp />
                </ProtectedRoute>
              }
            />

            <Route
              path="/grupos"
              element={
                <ProtectedRoute>
                  <Groups />
                </ProtectedRoute>
              }
            />

            <Route
              path="/integracoes"
              element={
                <ProtectedRoute>
                  <Integrations />
                </ProtectedRoute>
              }
            />

            <Route
              path="/relatorios"
              element={
                <ProtectedRoute>
                  <Reports />
                </ProtectedRoute>
              }
            />

            <Route
              path="/configuracoes"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
