import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import CustomerDetail from "./pages/CustomerDetail";
import GaitAnalysis from "./pages/GaitAnalysis";
import ShipmentSessionList from "./pages/ShipmentSessionList";
import ShipmentBatchDetail from "./pages/ShipmentBatchDetail";
import SignIn from "./pages/SignIn";
import { AuthProvider, useAuth } from "./contexts/AuthContext";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  if (!user) {
    return <SignIn />;
  }
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path={"/"}>
        <AuthGuard><Home /></AuthGuard>
      </Route>
      <Route path={"/customer/:id"}>
        <AuthGuard><CustomerDetail /></AuthGuard>
      </Route>
      <Route path={"/customer/:id/analysis"}>
        <AuthGuard><GaitAnalysis /></AuthGuard>
      </Route>
      <Route path={"/shipments"}>
        <AuthGuard><ShipmentSessionList /></AuthGuard>
      </Route>
      <Route path={"/shipments/:id"}>
        <AuthGuard><ShipmentBatchDetail /></AuthGuard>
      </Route>
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
      >
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
