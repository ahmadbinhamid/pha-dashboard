import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { clearToken, getToken, setToken } from "@/lib/api/client";
import { getProfile } from "@/lib/api/auth";
import { clearCartStorage } from "@/context/cart";
import { clearOrderDraft } from "@/lib/orderDraftStorage";
import type { AuthUser } from "@/types/auth";

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: AuthUser, token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(getToken);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(() => !!getToken());
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!getToken()) return;

    getProfile()
      .then((res) => setUser(res.data))
      .catch((err: Error & { status?: number }) => {
        // Only kill the session on a genuine auth failure (401).
        // Network errors, 500s, timeouts etc. should NOT log the user out —
        // the axios interceptor already handles the 401 → redirect case.
        if (err.status === 401) {
          queryClient.clear();
          clearToken();
          clearCartStorage();
          clearOrderDraft();
          setTokenState(null);
        }
      })
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setAuth = useCallback(
    (user: AuthUser, token: string) => {
      // The query client is a single app-wide instance shared across every
      // tenant session — without clearing it here, logging in as a
      // different tenant right after another one's session re-renders
      // whatever tenant-scoped queries (orders, products, dashboard stats,
      // ...) are still cached under the same query keys, until a manual
      // page refresh rebuilds the client from scratch. Found live.
      queryClient.clear();
      setToken(token);
      setTokenState(token);
      setUser(user);
    },
    [queryClient],
  );

  const logout = useCallback(() => {
    queryClient.clear();
    clearToken();
    clearCartStorage();
    clearOrderDraft();
    setTokenState(null);
    setUser(null);
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: !!token,
      isLoading,
      setAuth,
      logout,
    }),
    [user, token, isLoading, setAuth, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
