// @refresh reset
import { createContext, useContext, ReactNode, useEffect, useState } from "react";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import type { CurrentUser } from "@workspace/api-client-react";
import { useLocation } from "wouter";

const ADMIN_MODE_KEY = "th_admin_mode";

type AuthContextType = {
  user: CurrentUser | null;
  isLoading: boolean;
  isError: boolean;
  // True only if the account has the admin role, regardless of the mode toggle.
  isRealAdmin: boolean;
  // Effective admin view: real admin AND admin mode is on. Drives admin UI.
  isAdmin: boolean;
  adminMode: boolean;
  setAdminMode: (on: boolean) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: user, isLoading, isError } = useGetMe({
    query: {
      retry: false,
      staleTime: 60_000,          // treat /me as fresh for 60s — prevents race refetches
      refetchOnWindowFocus: false, // don't re-fetch just because user switched tabs
      queryKey: getGetMeQueryKey(),
    }
  });

  // Admins default to admin mode on; they can toggle it off to act as a founder.
  const [adminMode, setAdminModeState] = useState<boolean>(() => {
    try {
      return localStorage.getItem(ADMIN_MODE_KEY) !== "off";
    } catch {
      return true;
    }
  });
  const setAdminMode = (on: boolean) => {
    try {
      localStorage.setItem(ADMIN_MODE_KEY, on ? "on" : "off");
    } catch {
      /* ignore */
    }
    setAdminModeState(on);
  };

  const isRealAdmin = user?.role === "admin";
  const isAdmin = !!isRealAdmin && adminMode;

  return (
    <AuthContext.Provider
      value={{ user: user ?? null, isLoading, isError, isRealAdmin: !!isRealAdmin, isAdmin, adminMode, setAdminMode }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  );
}

export function ProtectedRoute({
  children,
  adminOnly = false,
}: {
  children: ReactNode;
  adminOnly?: boolean;
}) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  // All hooks must run before any conditional returns
  useEffect(() => {
    if (isLoading) return;
    if (!user) { setLocation("/login"); return; }
    if (adminOnly && user.role !== "admin") { setLocation("/dashboard"); return; }
  }, [isLoading, user, adminOnly, setLocation]);

  if (isLoading) return <Spinner />;
  if (!user) return null;
  if (adminOnly && user.role !== "admin") return null;

  return <>{children}</>;
}
