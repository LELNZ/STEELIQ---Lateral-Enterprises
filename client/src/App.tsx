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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { LogOut, KeyRound } from "lucide-react";
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
import Contacts from "@/pages/contacts";
import Users from "@/pages/users";
import OpJobsList from "@/pages/op-jobs-list";
import OpJobDetail from "@/pages/op-job-detail";
import InvoicesPage from "@/pages/invoices";
import ProjectsList from "@/pages/projects-list";
import ProjectDetail from "@/pages/project-detail";

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
      <Route path="/contacts" component={Contacts} />
      <Route path="/admin" component={Users} />
      <Route path="/users" component={Users} />
      <Route path="/op-jobs" component={OpJobsList} />
      <Route path="/op-jobs/:id" component={OpJobDetail} />
      <Route path="/invoices" component={InvoicesPage} />
      <Route path="/projects" component={ProjectsList} />
      <Route path="/projects/:id" component={ProjectDetail} />
      <Route path="/library" component={Library} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function ChangePasswordScreen() {
  const { user, logout, refreshUser } = useAuth();
  const { toast } = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/change-password", {
        currentPassword: current,
        newPassword: next,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Password change failed");
      }
      return res.json();
    },
    onSuccess: async () => {
      toast({ title: "Password changed", description: "You can now access SteelIQ." });
      await refreshUser();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const mismatch = confirm.length > 0 && next !== confirm;
  const canSubmit = current.length > 0 && next.length >= 6 && next === confirm && !mutation.isPending;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <div className="flex justify-center mb-3">
            <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
              <KeyRound className="h-6 w-6 text-amber-600" />
            </div>
          </div>
          <h1 className="text-xl font-semibold">Set Your Password</h1>
          <p className="text-sm text-muted-foreground">
            A temporary password was set for your account by an administrator.
            <br />Please set a new password to continue.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-5 space-y-4">
          <div className="text-xs text-muted-foreground bg-muted/40 rounded px-3 py-2">
            Signed in as <span className="font-mono font-medium text-foreground">{user?.username}</span>
          </div>

          <div className="space-y-3">
            <div>
              <Label>Current (Temporary) Password</Label>
              <Input
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                data-testid="input-current-password"
              />
            </div>
            <div>
              <Label>New Password <span className="text-muted-foreground">(min 6 chars)</span></Label>
              <Input
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                data-testid="input-new-password-required"
              />
            </div>
            <div>
              <Label>Confirm New Password</Label>
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={mismatch ? "border-destructive" : ""}
                data-testid="input-confirm-password-required"
              />
              {mismatch && <p className="text-xs text-destructive mt-1">Passwords do not match</p>}
            </div>
          </div>

          <Button
            className="w-full"
            onClick={() => mutation.mutate()}
            disabled={!canSubmit}
            data-testid="button-set-password"
          >
            {mutation.isPending ? "Saving…" : "Set New Password & Continue"}
          </Button>
        </div>

        <div className="text-center">
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={logout}>
            <LogOut className="h-3 w-3 mr-1" />
            Sign out
          </Button>
        </div>
      </div>
    </div>
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

  if (!user) {
    return <Login />;
  }

  if (user.mustChangePassword) {
    return <ChangePasswordScreen />;
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
              {user.divisionCode && (
                <span className="text-xs bg-muted px-2 py-0.5 rounded font-mono hidden sm:inline" data-testid="text-user-division">
                  {user.divisionCode}
                </span>
              )}
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
