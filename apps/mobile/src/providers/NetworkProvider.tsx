import NetInfo from "@react-native-community/netinfo";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { systemApi } from "../lib/api";

type NetworkContextValue = {
  isOnline: boolean;
  hasResolved: boolean;
  reconnectVersion: number;
  apiReachable: boolean | null;
  apiHasResolved: boolean;
  apiReconnectVersion: number;
  checkApiNow: () => Promise<boolean | null>;
};

const NetworkContext = createContext<NetworkContextValue | null>(null);
const API_PROBE_INTERVAL_MS = 3_000;

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [isOnline, setOnline] = useState(true);
  const [hasResolved, setResolved] = useState(false);
  const [reconnectVersion, setReconnectVersion] = useState(0);
  const [apiReachable, setApiReachable] = useState<boolean | null>(null);
  const [apiHasResolved, setApiHasResolved] = useState(false);
  const [apiReconnectVersion, setApiReconnectVersion] = useState(0);
  const probing = useRef(false);

  const checkApiNow = useCallback(async () => {
    if (!isOnline) {
      setApiReachable(null);
      setApiHasResolved(false);
      return null;
    }
    if (probing.current) return apiReachable;
    probing.current = true;
    try {
      const next = await systemApi.probe();
      setApiReachable((previous) => {
        if (previous === false && next) setApiReconnectVersion((value) => value + 1);
        return next;
      });
      setApiHasResolved(true);
      return next;
    } finally {
      probing.current = false;
    }
  }, [apiReachable, isOnline]);

  useEffect(() => NetInfo.addEventListener((state) => {
    const next = state.isConnected !== false && state.isInternetReachable !== false;
    setOnline((previous) => {
      if (!previous && next) setReconnectVersion((value) => value + 1);
      return next;
    });
    if (!next) {
      setApiReachable(null);
      setApiHasResolved(false);
    }
    setResolved(true);
  }), []);

  useEffect(() => {
    if (!isOnline) return;
    void checkApiNow();
    const timer = setInterval(() => void checkApiNow(), API_PROBE_INTERVAL_MS);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void checkApiNow();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [checkApiNow, isOnline]);

  const value = useMemo(() => ({
    isOnline,
    hasResolved,
    reconnectVersion,
    apiReachable,
    apiHasResolved,
    apiReconnectVersion,
    checkApiNow,
  }), [isOnline, hasResolved, reconnectVersion, apiReachable, apiHasResolved, apiReconnectVersion, checkApiNow]);

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (!context) throw new Error("useNetwork must be used inside NetworkProvider");
  return context;
}
