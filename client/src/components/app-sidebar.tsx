import { useCallback } from "react";
import { Briefcase, BookOpen, Settings, FileText, ChevronDown, BarChart3, Users, ShieldCheck } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useNavigationGuard } from "@/lib/navigation-guard";
import { useAuth } from "@/lib/auth-context";
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
  const isLibraryActive = location.startsWith("/library");
  const isSettingsActive = location.startsWith("/settings");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <span className="text-base font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
          Pro-Quote
        </span>
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

              {canManageUsers && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location.startsWith("/users")} tooltip="Users">
                    <Link href="/users" onClick={(e) => guardedClick(e, "/users")} data-testid="link-sidebar-users">
                      <ShieldCheck />
                      <span>Users</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isLibraryActive} tooltip="Library">
                  <Link href="/library" onClick={(e) => guardedClick(e, "/library")} data-testid="link-sidebar-library">
                    <BookOpen />
                    <span>Library</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

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
