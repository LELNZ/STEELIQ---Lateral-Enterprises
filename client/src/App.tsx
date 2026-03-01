import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SettingsProvider } from "@/lib/settings-context";
import NotFound from "@/pages/not-found";
import JobsList from "@/pages/jobs-list";
import QuoteBuilder from "@/pages/quote-builder";
import Settings from "@/pages/settings";
import QuoteSummary from "@/pages/quote-summary";

function Router() {
  return (
    <Switch>
      <Route path="/" component={JobsList} />
      <Route path="/job/new" component={QuoteBuilder} />
      <Route path="/job/:id/summary" component={QuoteSummary} />
      <Route path="/job/:id" component={QuoteBuilder} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </SettingsProvider>
    </QueryClientProvider>
  );
}

export default App;
