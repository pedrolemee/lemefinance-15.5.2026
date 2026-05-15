import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppLayout } from "@/components/AppLayout";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Transactions = lazy(() => import("./pages/Transactions"));
const Categories = lazy(() => import("./pages/Categories"));
const Goals = lazy(() => import("./pages/Goals"));
const Budgets = lazy(() => import("./pages/Budgets"));
const RecurringTransactions = lazy(() => import("./pages/RecurringTransactions"));
const Settings = lazy(() => import("./pages/Settings"));
const Investments = lazy(() => import("./pages/Investments"));
const Banks = lazy(() => import("./pages/Banks"));
const Charts = lazy(() => import("./pages/Charts"));
const Reports = lazy(() => import("./pages/Reports"));
const Forecast = lazy(() => import("./pages/Forecast"));
const Install = lazy(() => import("./pages/Install"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      gcTime: 1000 * 60 * 5,
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      retry: 1,
    },
  },
});

const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground animate-pulse">Carregando...</p>
    </div>
  </div>
);

const ProtectedPage = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <AppLayout>{children}</AppLayout>
  </ProtectedRoute>
);

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/dashboard" element={<ProtectedPage><Dashboard /></ProtectedPage>} />
                  <Route path="/transactions" element={<ProtectedPage><Transactions /></ProtectedPage>} />
                  <Route path="/categories" element={<ProtectedPage><Categories /></ProtectedPage>} />
                  <Route path="/goals" element={<ProtectedPage><Goals /></ProtectedPage>} />
                  <Route path="/budgets" element={<ProtectedPage><Budgets /></ProtectedPage>} />
                  <Route path="/recurring" element={<ProtectedPage><RecurringTransactions /></ProtectedPage>} />
                  <Route path="/settings" element={<ProtectedPage><Settings /></ProtectedPage>} />
                  <Route path="/investments" element={<ProtectedPage><Investments /></ProtectedPage>} />
                  <Route path="/banks" element={<ProtectedPage><Banks /></ProtectedPage>} />
                  <Route path="/charts" element={<ProtectedPage><Charts /></ProtectedPage>} />
                  <Route path="/reports" element={<ProtectedPage><Reports /></ProtectedPage>} />
                  <Route path="/forecast" element={<ProtectedPage><Forecast /></ProtectedPage>} />
                  <Route path="/install" element={<ProtectedPage><Install /></ProtectedPage>} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </TooltipProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
