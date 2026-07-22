// @refresh reset
import { createContext, useContext, ReactNode, useEffect } from "react";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import type { CurrentUser } from "@workspace/api-client-react";
import { useLocation } from "wouter";

type AuthContextType = {
  user: CurrentUser | null;
  isLoading: boolean;
  isError: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: user, isLoading, isError } = useGetMe({
    query: {
      retry: false,
      queryKey: getGetMeQueryKey(),
    }
  });

  return (
    <AuthContext.Provider value={{ user: user ?? null, isLoading, isError }}>
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
    if (!user.emailVerified) { setLocation("/verify-email"); return; }
    if (adminOnly && user.role !== "admin") { setLocation("/dashboard"); return; }
  }, [isLoading, user, adminOnly, setLocation]);

  if (isLoading) return <Spinner />;
  if (!user) return null;
  if (!user.emailVerified) return null;
  if (adminOnly && user.role !== "admin") return null;

  return <>{children}</>;
}
