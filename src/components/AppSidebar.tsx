import {
  LayoutDashboard,
  List,
  FolderKanban,
  Target,
  Wallet,
  Repeat,
  Settings,
  TrendingUp,
  Building2,
  FileText,
  BarChart3,
  Sparkles,
  LogOut,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/logo.png";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "./ui/button";

const controlItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Transações", url: "/transactions", icon: List },
  { title: "Categorias", url: "/categories", icon: FolderKanban },
  { title: "Recorrentes", url: "/recurring", icon: Repeat },
  { title: "Bancos", url: "/banks", icon: Building2 },
];

const planningItems = [
  { title: "Metas", url: "/goals", icon: Target },
  { title: "Orçamentos", url: "/budgets", icon: Wallet },
  { title: "Investimentos", url: "/investments", icon: TrendingUp },
];

const analysisItems = [
  { title: "Previsões", url: "/forecast", icon: Sparkles },
  { title: "Gráficos", url: "/charts", icon: BarChart3 },
  { title: "Relatórios", url: "/reports", icon: FileText },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut } = useAuth();

  const isActive = (path: string) => location.pathname === path;

  const renderGroup = (label: string, items: typeof controlItems) => (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[10px] uppercase tracking-wider">{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild isActive={isActive(item.url)}>
                <NavLink
                  to={item.url}
                  end
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors"
                  activeClassName="bg-primary/10 text-primary font-medium"
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="text-sm">{item.title}</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-border/50 p-3">
        <Link to="/dashboard" className="flex items-center gap-2">
          <img src={logo} alt="LemeFinance" className="h-7 w-auto" loading="lazy" />
          {!collapsed && (
            <span className="font-semibold text-sm bg-gradient-primary bg-clip-text text-transparent">
              LemeFinance
            </span>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {renderGroup("Controle", controlItems)}
        {renderGroup("Planejamento", planningItems)}
        {renderGroup("Análise", analysisItems)}
      </SidebarContent>

      <SidebarFooter className="border-t border-border/50 p-2 space-y-1">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive("/settings")}>
              <NavLink
                to="/settings"
                end
                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors"
                activeClassName="bg-primary/10 text-primary font-medium"
              >
                <Settings className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="text-sm">Configurações</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <button
                onClick={signOut}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-destructive/10 text-destructive transition-colors w-full"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="text-sm">Sair</span>}
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
