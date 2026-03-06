import { Briefcase, BookOpen, Settings, FileText, ChevronDown, BarChart3 } from "lucide-react";
import { Link, useLocation } from "wouter";
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

export function AppSidebar() {
  const [location] = useLocation();

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
                          <Link href="/" data-testid="link-sidebar-lj-estimates">
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
                  <Link href="/quotes" data-testid="link-sidebar-quotes">
                    <FileText />
                    <span>Quotes</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isLibraryActive} tooltip="Library">
                  <Link href="/library" data-testid="link-sidebar-library">
                    <BookOpen />
                    <span>Library</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isSettingsActive} tooltip="Settings">
                  <Link href="/settings" data-testid="link-sidebar-settings">
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
