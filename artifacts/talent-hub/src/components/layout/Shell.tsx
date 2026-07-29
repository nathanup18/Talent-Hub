import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard,
  Users,
  Link as LinkIcon,
  Building2,
  Sparkles,
  UserCircle,
  LogOut,
  Settings,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey } from "@workspace/api-client-react";
import { BASE_URL } from "@/lib/api";
import logoFooterWhite from "@assets/logo-footer-white.png";

export function Shell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const handleLogout = async () => {
    await fetch(`${BASE_URL}api/auth/logout`, { method: "POST", credentials: "include" });
    // Hard navigate — tears down all React state and query cache cleanly
    window.location.href = "/login";
  };

  if (!user) return <>{children}</>;

  const isAdmin = user.role === "admin";

  const navItems = isAdmin
    ? [
        // Admins browse the same pools founders do (with inline edit/delete),
        // plus the all-requests screen and the domain allowlist.
        { label: "Talent Pool", href: "/dashboard", icon: Users },
        { label: "Prospective", href: "/prospective", icon: Sparkles },
        { label: "All Requests", href: "/admin/intro-requests", icon: LinkIcon },
        { label: "Domains", href: "/admin/domains", icon: Building2 },
      ]
    : [
        { label: "Talent Pool", href: "/dashboard", icon: Users },
        { label: "Prospective", href: "/prospective", icon: Sparkles },
        { label: "My Requests", href: "/my-requests", icon: LinkIcon },
      ];

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      {/* Entire top bar (logo+nav+profile on desktop, logo+profile on mobile) + mobile pill row
          are wrapped together so the whole block sticks as one unit */}
      <div className="sticky top-0 z-30 bg-secondary text-secondary-foreground">
        <header>
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center gap-2">
              <img src={logoFooterWhite} alt="Active Impact" className="h-8 object-contain" />
              <span className="font-semibold text-lg ml-2 border-l border-white/20 pl-4">
                Talent Hub
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive =
                  location === item.href ||
                  (item.href !== "/admin" &&
                    item.href !== "/dashboard" &&
                    location.startsWith(item.href));
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

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors outline-none">
                  <UserCircle className="w-7 h-7 shrink-0" />
                  <div className="hidden sm:block text-left">
                    <div className="text-sm font-medium leading-tight">{user.name}</div>
                    <div className="text-xs text-white/55 leading-tight">
                      {user.role === "admin" ? "Admin" : user.company}
                    </div>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="flex items-center gap-2 cursor-pointer">
                    <Settings className="w-4 h-4" />
                    Edit Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive flex items-center gap-2 cursor-pointer"
                  onClick={handleLogout}
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Mobile nav — inside the sticky wrapper so it scrolls with the header as one block */}
        <div className="md:hidden border-t border-white/10 overflow-x-auto no-scrollbar">
          <div className="flex px-4 py-2 gap-2 min-w-max">
            {navItems.map((item) => {
              const isActive =
                location === item.href ||
                (item.href !== "/admin" &&
                  item.href !== "/dashboard" &&
                  location.startsWith(item.href));
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
      </div>

      <main className="flex-1 flex flex-col w-full max-w-7xl mx-auto p-4 md:p-8">
        {children}
      </main>
    </div>
  );
}
