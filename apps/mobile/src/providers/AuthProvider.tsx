import type { AuthResponse, LoginRequest, RegisterRequest } from "@leaguekick/contracts";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiRequestError, authApi } from "../lib/api";
import { clearStoredSession, readStoredSession, writeStoredSession } from "../lib/auth-storage";

type AuthStatus = "hydrating" | "anonymous" | "authenticated";
type AuthContextValue = {
  status: AuthStatus;
  session: AuthResponse | null;
  signIn: (input: LoginRequest) => Promise<AuthResponse>;
  register: (input: RegisterRequest) => Promise<AuthResponse>;
  signOut: () => Promise<void>;
  revalidate: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("hydrating");
  const [session, setSession] = useState<AuthResponse | null>(null);

  const adopt = useCallback(async (next: AuthResponse) => {
    setSession(next);
    setStatus("authenticated");
    await writeStoredSession(next);
    return next;
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const stored = await readStoredSession();
      if (!active) return;
      if (!stored) { setStatus("anonymous"); return; }
      setSession(stored);
      setStatus("authenticated");
      try {
        const refreshed = await authApi.refresh(stored.refreshToken);
        if (active) await adopt(refreshed);
      } catch (error) {
        if (!active) return;
        if (error instanceof ApiRequestError && error.isNetworkError) return;
        setSession(null);
        setStatus("anonymous");
        await clearStoredSession();
      }
    })();
    return () => { active = false; };
  }, [adopt]);

  const signIn = useCallback(async (input: LoginRequest) => adopt(await authApi.login(input)), [adopt]);
  const register = useCallback(async (input: RegisterRequest) => adopt(await authApi.register(input)), [adopt]);

  const signOut = useCallback(async () => {
    const current = session;
    setSession(null);
    setStatus("anonymous");
    await clearStoredSession();
    if (current) authApi.logout(current.refreshToken).catch(() => undefined);
  }, [session]);

  const revalidate = useCallback(async () => {
    if (!session) return;
    try { await adopt(await authApi.refresh(session.refreshToken)); }
    catch (error) {
      if (error instanceof ApiRequestError && error.isNetworkError) return;
      setSession(null); setStatus("anonymous"); await clearStoredSession();
    }
  }, [adopt, session]);

  const value = useMemo(() => ({ status, session, signIn, register, signOut, revalidate }), [status, session, signIn, register, signOut, revalidate]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
