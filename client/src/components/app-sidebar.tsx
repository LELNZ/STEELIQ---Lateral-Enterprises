import { useCallback } from "react";
import { Briefcase, BookOpen, Settings, FileText, ChevronDown, BarChart3, Users, ShieldCheck, HardHat, Building2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useNavigationGuard } from "@/lib/navigation-guard";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
  const isLibraryActive = location.startsWith("/library");
  const isSettingsActive = location.startsWith("/settings");
  const isAdminActive = location.startsWith("/admin") || location.startsWith("/users");

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
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <Collapsible defaultOpen className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip="Estimates" isActive={isEstimatesActive}>
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
                            <span>LJ – Estimates</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton className="opacity-50 pointer-events-none" data-testid="link-sidebar-le-estimates">
                          <Briefcase className="w-3.5 h-3.5" />
                          <span>LE – Estimates <span className="text-[10px] text-muted-foreground">(Coming Soon)</span></span>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton className="opacity-50 pointer-events-none" data-testid="link-sidebar-ll-estimates">
                          <Briefcase className="w-3.5 h-3.5" />
                          <span>LL – Estimates <span className="text-[10px] text-muted-foreground">(Coming Soon)</span></span>
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

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.startsWith("/customers")} tooltip="Customers">
                  <Link href="/customers" onClick={(e) => guardedClick(e, "/customers")} data-testid="link-sidebar-customers">
                    <Users />
                    <span>Customers</span>
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

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isLibraryActive} tooltip="Library">
                  <Link href="/library" onClick={(e) => guardedClick(e, "/library")} data-testid="link-sidebar-library">
                    <BookOpen />
                    <span>Library</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {canManageUsers && (
                <Collapsible className="group/admin-collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton tooltip="Admin" isActive={isAdminActive} data-testid="button-sidebar-admin">
                        <ShieldCheck />
                        <span>Admin</span>
                        <ChevronDown className="ml-auto transition-transform group-data-[state=open]/admin-collapsible:rotate-180" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={location.startsWith("/admin") || location.startsWith("/users")}>
                            <Link href="/admin" onClick={(e) => guardedClick(e, "/admin")} data-testid="link-sidebar-admin-users">
                              <Building2 className="w-3.5 h-3.5" />
                              <span>Users</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
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
