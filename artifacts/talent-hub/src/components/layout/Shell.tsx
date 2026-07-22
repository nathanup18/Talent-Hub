import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useLogout } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { LogOut, LayoutDashboard, Users, Link as LinkIcon, Building2, Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import logoFooterWhite from "@assets/logo-footer-white.png";

export function Shell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const logoutMutation = useLogout();
  const queryClient = useQueryClient();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.clear();
        setLocation("/login");
      }
    });
  };

  if (!user) return <>{children}</>;

  const isAdmin = user.role === "admin";

  const navItems = isAdmin ? [
    { label: "Overview", href: "/admin", icon: LayoutDashboard },
    { label: "Intro Requests", href: "/admin/intro-requests", icon: LinkIcon },
    { label: "Candidates", href: "/admin/candidates", icon: Users },
    { label: "Domains", href: "/admin/domains", icon: Building2 },
  ] : [
    { label: "Discover", href: "/dashboard", icon: Users },
    { label: "Prospective", href: "/prospective", icon: Sparkles },
    { label: "My Requests", href: "/my-requests", icon: LinkIcon },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <header className="bg-secondary text-secondary-foreground sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href={isAdmin ? "/admin" : "/dashboard"} className="flex items-center gap-2">
            <img src={logoFooterWhite} alt="Active Impact" className="h-8 object-contain" />
            <span className="font-semibold text-lg ml-2 border-l border-white/20 pl-4">Talent Hub</span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location === item.href || (item.href !== "/admin" && item.href !== "/dashboard" && location.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors text-sm font-medium ${
                    isActive 
                      ? "bg-white/10 text-white" 
                      : "text-white/70 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right">
              <div className="text-sm font-medium text-white">{user.name}</div>
              <div className="text-xs text-white/60">{user.role === 'admin' ? 'Admin' : user.company}</div>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleLogout}
              className="text-white/70 hover:text-white hover:bg-white/10"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile nav */}
      <div className="md:hidden bg-secondary border-t border-white/10 overflow-x-auto no-scrollbar">
        <div className="flex px-4 py-2 gap-2 min-w-max">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors text-sm font-medium ${
                  isActive 
                    ? "bg-white/10 text-white" 
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      <main className="flex-1 flex flex-col w-full max-w-7xl mx-auto p-4 md:p-8">
        {children}
      </main>
    </div>
  );
}
