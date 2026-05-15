import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Link } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";
import { PageTransition } from "@/components/PageTransition";
import logo from "@/assets/logo.png";
import { useSidebar } from "@/components/ui/sidebar";

function HeaderContent() {
  return (
    <header className="h-12 flex items-center justify-between border-b bg-card/95 backdrop-blur-xl sticky top-0 z-50 px-2 sm:px-4">
      <div className="flex items-center gap-1">
        <SidebarTrigger />
        <Link to="/dashboard"><img src={logo} alt="LemeFinance" className="h-6 w-auto sm:hidden" loading="lazy" /></Link>
      </div>
      <div className="flex items-center gap-0.5 sm:gap-1">
        <NotificationBell />
        <ThemeToggle />
      </div>
    </header>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <HeaderContent />
          <main className="flex-1 overflow-x-hidden">
            <PageTransition>{children}</PageTransition>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}