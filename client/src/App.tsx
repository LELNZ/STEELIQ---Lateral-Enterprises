import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SettingsProvider } from "@/lib/settings-context";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { NavigationGuardProvider } from "@/lib/navigation-guard";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";
import NotFound from "@/pages/not-found";
import JobsList from "@/pages/jobs-list";
import QuoteBuilder from "@/pages/quote-builder";
import Settings from "@/pages/settings";
import QuoteSummary from "@/pages/quote-summary";
import ExecSummary from "@/pages/exec-summary";
import Library from "@/pages/library";
import QuotesList from "@/pages/quotes-list";
import QuoteDetail from "@/pages/quote-detail";
import QuotePreview from "@/pages/quote-preview";
import Login from "@/pages/login";
import Customers from "@/pages/customers";

function Router() {
  return (
    <Switch>
      <Route path="/" component={JobsList} />
      <Route path="/job/new" component={QuoteBuilder} />
      <Route path="/job/:id/summary" component={QuoteSummary} />
      <Route path="/job/:id/exec-summary" component={ExecSummary} />
      <Route path="/job/:id" component={QuoteBuilder} />
      <Route path="/quotes" component={QuotesList} />
      <Route path="/quotes/:id/preview" component={QuotePreview} />
      <Route path="/quote/:id/preview" component={QuotePreview} />
      <Route path="/quote/:id" component={QuoteDetail} />
      <Route path="/customers" component={Customers} />
      <Route path="/library" component={Library} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppShell() {
  const { user, loading, logout } = useAuth();
  const [location] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!user && location !== "/login") {
    return <Login />;
  }

  if (!user) {
    return <Login />;
  }

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0 min-h-0">
          <header className="flex items-center gap-2 p-2 border-b sticky top-0 z-50 bg-background">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-muted-foreground hidden sm:inline" data-testid="text-logged-in-user">
                {user.displayName || user.username}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={logout}
                data-testid="button-logout"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>
          <main className="flex-1 overflow-auto min-h-0">
            <Router />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SettingsProvider>
          <NavigationGuardProvider>
            <TooltipProvider>
              <AppShell />
              <Toaster />
            </TooltipProvider>
          </NavigationGuardProvider>
        </SettingsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
