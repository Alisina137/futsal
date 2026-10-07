import type { AccountProfileUpdateRequest, AuthResponse, LoginRequest, RegisterRequest } from "@leaguekick/contracts";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { ApiRequestError, authApi, setAccountAccessListener } from "../lib/api";
import { clearActiveUserApiCache, setApiCacheUserScope } from "../lib/api-cache";
import { clearStoredSession, readStoredSession, writeStoredSession } from "../lib/auth-storage";

type AuthStatus = "hydrating" | "anonymous" | "authenticated";
type AccountAccessState = "active" | "suspended";
type AccountCheckResult = "active" | "suspended" | "offline" | "signed_out" | "unchanged";

type AuthContextValue = {
  status: AuthStatus;
  accessState: AccountAccessState;
  session: AuthResponse | null;
  signIn: (input: LoginRequest) => Promise<AuthResponse>;
  register: (input: RegisterRequest) => Promise<AuthResponse>;
  updateProfile: (input: AccountProfileUpdateRequest) => Promise<AuthResponse>;
  signOut: () => Promise<void>;
  revalidate: () => Promise<AccountCheckResult>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const ACCOUNT_CHECK_INTERVAL_MS = 10_000;

function isSuspendedError(error: unknown) {
  return error instanceof ApiRequestError && error.code === "ACCOUNT_SUSPENDED";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("hydrating");
  const [accessState, setAccessState] = useState<AccountAccessState>("active");
  const [session, setSession] = useState<AuthResponse | null>(null);

  const adopt = useCallback(async (next: AuthResponse) => {
    setApiCacheUserScope(next.user.id);
    setSession(next);
    setStatus("authenticated");
    setAccessState("active");
    await writeStoredSession(next);
    return next;
  }, []);

  const clearSession = useCallback(async () => {
    await clearActiveUserApiCache();
    setSession(null);
    setStatus("anonymous");
    setAccessState("active");
    await clearStoredSession();
  }, []);

  useEffect(() => {
    setAccountAccessListener((event) => {
      if (event === "ACCOUNT_SUSPENDED") setAccessState("suspended");
    });
    return () => setAccountAccessListener(null);
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const stored = await readStoredSession();
      if (!active) return;
      if (!stored) {
        setStatus("anonymous");
        return;
      }

      setApiCacheUserScope(stored.user.id);
      setSession(stored);
      setStatus("authenticated");

      try {
        const refreshed = await authApi.refresh(stored.refreshToken);
        if (active) await adopt(refreshed);
      } catch (error) {
        if (!active) return;
        if (error instanceof ApiRequestError && error.isNetworkError) return;
        if (isSuspendedError(error)) {
          setAccessState("suspended");
          return;
        }
        await clearSession();
      }
    })();

    return () => {
      active = false;
    };
  }, [adopt, clearSession]);

  const refreshSession = useCallback(async (): Promise<AccountCheckResult> => {
    if (!session) return "signed_out";
    try {
      await adopt(await authApi.refresh(session.refreshToken));
      return "active";
    } catch (error) {
      if (error instanceof ApiRequestError && error.isNetworkError) return "offline";
      if (isSuspendedError(error)) {
        setAccessState("suspended");
        return "suspended";
      }
      await clearSession();
      return "signed_out";
    }
  }, [adopt, clearSession, session]);

  const checkAccount = useCallback(async (): Promise<AccountCheckResult> => {
    if (!session) return "signed_out";

    try {
      const { user } = await authApi.me(session.accessToken);
      setAccessState("active");
      const currentRoles = [...session.user.roles].sort().join(",");
      const nextRoles = [...user.roles].sort().join(",");
      if (currentRoles !== nextRoles) return refreshSession();
      if (JSON.stringify(session.user) !== JSON.stringify(user)) {
        await adopt({ ...session, user });
      }
      return "active";
    } catch (error) {
      if (error instanceof ApiRequestError && error.isNetworkError) return "offline";
      if (isSuspendedError(error)) {
        setAccessState("suspended");
        return "suspended";
      }
      if (error instanceof ApiRequestError && error.code === "INVALID_ACCESS_TOKEN") {
        return refreshSession();
      }
      if (error instanceof ApiRequestError && error.code === "ACCOUNT_UNAVAILABLE") {
        await clearSession();
        return "signed_out";
      }
      return "unchanged";
    }
  }, [adopt, clearSession, refreshSession, session]);

  useEffect(() => {
    if (status !== "authenticated" || !session) return;

    void checkAccount();
    const timer = setInterval(() => void checkAccount(), ACCOUNT_CHECK_INTERVAL_MS);
    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") void checkAccount();
    });

    return () => {
      clearInterval(timer);
      appStateSubscription.remove();
    };
  }, [checkAccount, session, status]);

  const signIn = useCallback(async (input: LoginRequest) => adopt(await authApi.login(input)), [adopt]);
  const register = useCallback(async (input: RegisterRequest) => adopt(await authApi.register(input)), [adopt]);

  const updateProfile = useCallback(async (input: AccountProfileUpdateRequest) => {
    if (!session) throw new Error("Authentication is required.");
    const { user } = await authApi.updateProfile(session.accessToken, input);
    return adopt({ ...session, user });
  }, [adopt, session]);

  const signOut = useCallback(async () => {
    const current = session;
    await clearSession();
    if (current) authApi.logout(current.refreshToken).catch(() => undefined);
  }, [clearSession, session]);

  const value = useMemo(
    () => ({
      status,
      accessState,
      session,
      signIn,
      register,
      updateProfile,
      signOut,
      revalidate: checkAccount,
    }),
    [status, accessState, session, signIn, register, updateProfile, signOut, checkAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
