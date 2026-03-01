import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SettingsProvider } from "@/lib/settings-context";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import NotFound from "@/pages/not-found";
import JobsList from "@/pages/jobs-list";
import QuoteBuilder from "@/pages/quote-builder";
import Settings from "@/pages/settings";
import QuoteSummary from "@/pages/quote-summary";
import ExecSummary from "@/pages/exec-summary";
import Library from "@/pages/library";

function Router() {
  return (
    <Switch>
      <Route path="/" component={JobsList} />
      <Route path="/job/new" component={QuoteBuilder} />
      <Route path="/job/:id/summary" component={QuoteSummary} />
      <Route path="/job/:id/exec-summary" component={ExecSummary} />
      <Route path="/job/:id" component={QuoteBuilder} />
      <Route path="/library" component={Library} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <TooltipProvider>
          <SidebarProvider style={style as React.CSSProperties}>
            <div className="flex h-screen w-full">
              <AppSidebar />
              <div className="flex flex-col flex-1 min-w-0">
                <header className="flex items-center gap-2 p-2 border-b sticky top-0 z-50 bg-background">
                  <SidebarTrigger data-testid="button-sidebar-toggle" />
                </header>
                <main className="flex-1 overflow-auto">
                  <Router />
                </main>
              </div>
            </div>
          </SidebarProvider>
          <Toaster />
        </TooltipProvider>
      </SettingsProvider>
    </QueryClientProvider>
  );
}

export default App;
