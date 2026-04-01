import { useCallback } from "react";
import {
  Briefcase, BookOpen, Settings, FileText, ChevronDown, BarChart3, Users,
  ShieldCheck, HardHat, Building2, Contact, ReceiptText, FolderOpen,
  Calendar, ShoppingCart, Factory, Truck, CheckSquare, LineChart, Lock,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useNavigationGuard } from "@/lib/navigation-guard";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

function PlaceholderItem({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        className="opacity-40 cursor-not-allowed pointer-events-none"
        tooltip={`${label} — Coming Soon`}
      >
        <Icon />
        <span>{label}</span>
        <Lock className="ml-auto h-3 w-3 opacity-60" />
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const [location, navigate] = useLocation();
  const { checkGuard } = useNavigationGuard();
  const { user } = useAuth();
  const canManageUsers = user?.role === "admin" || user?.role === "owner";

  const { data: orgSettings } = useQuery<any>({
    queryKey: ["/api/settings/org"],
    staleTime: 60_000,
  });
  const businessDisplayName = orgSettings?.businessDisplayName || "Lateral Enterprises";

  const guardedClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    const guard = checkGuard();
    if (guard.blocked) {
      e.preventDefault();
      const msg = guard.message || "You have unsaved changes. Leave without saving?";
      if (window.confirm(msg)) {
        navigate(href);
      }
    }
  }, [checkGuard, navigate]);

  const isEstimatesActive = location === "/" || location.startsWith("/job");
  const isQuotesActive = location === "/quotes" || location.startsWith("/quote/");
  const isJobsActive = location.startsWith("/op-jobs");
  const isContactsActive = location.startsWith("/contacts");
  const isLibraryActive = location.startsWith("/library");
  const isSettingsActive = location.startsWith("/settings");
  const isAdminActive = location.startsWith("/admin") || location.startsWith("/users");
  const isProjectsActive = location.startsWith("/projects");
  const isInvoicesActive = location.startsWith("/invoices");
  const isCustomersActive = location.startsWith("/customers");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="group-data-[collapsible=icon]:hidden">
          <span className="text-base font-bold tracking-tight leading-none">STEELIQ</span>
          <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{businessDisplayName}</p>
        </div>
        <span className="hidden group-data-[collapsible=icon]:block text-xs font-bold tracking-tight">SI</span>
      </SidebarHeader>

      <SidebarContent>

        {/* ── SALES ──────────────────────────────── */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/60 px-2 pb-1 group-data-[collapsible=icon]:hidden">
            Sales
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <Collapsible defaultOpen className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip="Estimates" isActive={isEstimatesActive} data-testid="button-sidebar-estimates-group">
                      <BarChart3 />
                      <span>Estimates</span>
                      <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={isEstimatesActive}>
                          <Link href="/" onClick={(e) => guardedClick(e, "/")} data-testid="link-sidebar-lj-estimates">
                            <Briefcase className="w-3.5 h-3.5" />
                            <span>LJ – Joinery</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton className="opacity-40 pointer-events-none" data-testid="link-sidebar-le-estimates">
                          <Briefcase className="w-3.5 h-3.5" />
                          <span>LE – Engineering <span className="text-[10px] text-muted-foreground">(soon)</span></span>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={location.startsWith("/laser-quote")} data-testid="link-sidebar-ll-estimates">
                          <Link href="/laser-quote/new" onClick={(e) => guardedClick(e, "/laser-quote/new")}>
                            <Briefcase className="w-3.5 h-3.5" />
                            <span>LL – Laser</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isQuotesActive} tooltip="Quotes">
                  <Link href="/quotes" onClick={(e) => guardedClick(e, "/quotes")} data-testid="link-sidebar-quotes">
                    <FileText />
                    <span>Quotes</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ── DELIVERY ───────────────────────────── */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/60 px-2 pb-1 group-data-[collapsible=icon]:hidden">
            Delivery
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isProjectsActive} tooltip="Projects">
                  <Link href="/projects" onClick={(e) => guardedClick(e, "/projects")} data-testid="link-sidebar-projects">
                    <FolderOpen />
                    <span>Projects</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isJobsActive} tooltip="Jobs">
                  <Link href="/op-jobs" onClick={(e) => guardedClick(e, "/op-jobs")} data-testid="link-sidebar-jobs">
                    <HardHat />
                    <span>Jobs</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ── FINANCE ────────────────────────────── */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/60 px-2 pb-1 group-data-[collapsible=icon]:hidden">
            Finance
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isInvoicesActive} tooltip="Invoices">
                  <Link href="/invoices" onClick={(e) => guardedClick(e, "/invoices")} data-testid="link-sidebar-invoices">
                    <ReceiptText />
                    <span>Invoices</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ── MASTER DATA ────────────────────────── */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/60 px-2 pb-1 group-data-[collapsible=icon]:hidden">
            Master Data
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isLibraryActive} tooltip="Library">
                  <Link href="/library" onClick={(e) => guardedClick(e, "/library")} data-testid="link-sidebar-library">
                    <BookOpen />
                    <span>Library</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isCustomersActive} tooltip="Customers">
                  <Link href="/customers" onClick={(e) => guardedClick(e, "/customers")} data-testid="link-sidebar-customers">
                    <Users />
                    <span>Customers</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isContactsActive} tooltip="Contacts">
                  <Link href="/contacts" onClick={(e) => guardedClick(e, "/contacts")} data-testid="link-sidebar-contacts">
                    <Contact />
                    <span>Contacts</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ── COMING SOON ────────────────────────── */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/40 px-2 pb-1 group-data-[collapsible=icon]:hidden">
            Platform Roadmap
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <PlaceholderItem icon={Calendar} label="Scheduling" />
              <PlaceholderItem icon={ShoppingCart} label="Procurement" />
              <PlaceholderItem icon={Factory} label="Manufacture" />
              <PlaceholderItem icon={Truck} label="Dispatch" />
              <PlaceholderItem icon={CheckSquare} label="Closeout" />
              <PlaceholderItem icon={LineChart} label="Reporting" />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ── SYSTEM ─────────────────────────────── */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/60 px-2 pb-1 group-data-[collapsible=icon]:hidden">
            System
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {canManageUsers && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isAdminActive} tooltip="Users">
                    <Link href="/admin" onClick={(e) => guardedClick(e, "/admin")} data-testid="link-sidebar-admin-users">
                      <ShieldCheck />
                      <span>Users</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isSettingsActive} tooltip="Settings">
                  <Link href="/settings" onClick={(e) => guardedClick(e, "/settings")} data-testid="link-sidebar-settings">
                    <Settings />
                    <span>Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>
    </Sidebar>
  );
}
