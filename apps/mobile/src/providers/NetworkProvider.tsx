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
const API_FAILURE_THRESHOLD = 3;
const API_RECOVERY_THRESHOLD = 2;

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [isOnline, setOnline] = useState(true);
  const [hasResolved, setResolved] = useState(false);
  const [reconnectVersion, setReconnectVersion] = useState(0);
  const [apiReachable, setApiReachable] = useState<boolean | null>(null);
  const [apiHasResolved, setApiHasResolved] = useState(false);
  const [apiReconnectVersion, setApiReconnectVersion] = useState(0);
  const probing = useRef(false);
  const apiReachableRef = useRef<boolean | null>(null);
  const consecutiveApiFailures = useRef(0);
  const consecutiveApiSuccesses = useRef(0);

  const commitApiReachability = useCallback((next: boolean | null) => {
    apiReachableRef.current = next;
    setApiReachable(next);
  }, []);

  const resetApiProbeHistory = useCallback(() => {
    consecutiveApiFailures.current = 0;
    consecutiveApiSuccesses.current = 0;
  }, []);

  const checkApiNow = useCallback(async () => {
    if (!isOnline) {
      resetApiProbeHistory();
      commitApiReachability(null);
      setApiHasResolved(false);
      return null;
    }
    if (probing.current) return apiReachableRef.current;

    probing.current = true;
    try {
      const probeSucceeded = await systemApi.probe();
      const previous = apiReachableRef.current;

      if (probeSucceeded) {
        consecutiveApiFailures.current = 0;
        consecutiveApiSuccesses.current += 1;

        if (previous === false) {
          if (consecutiveApiSuccesses.current >= API_RECOVERY_THRESHOLD) {
            commitApiReachability(true);
            setApiHasResolved(true);
            setApiReconnectVersion((value) => value + 1);
            consecutiveApiSuccesses.current = 0;
          }
        } else {
          // A successful first probe establishes normal operation. Recovery from a
          // confirmed outage still requires repeated success to prevent banner flicker.
          commitApiReachability(true);
          setApiHasResolved(true);
          consecutiveApiSuccesses.current = 0;
        }
      } else {
        consecutiveApiSuccesses.current = 0;
        consecutiveApiFailures.current += 1;

        // Keep the last known-good state through brief tunnel/API hiccups. Only
        // repeated failures are treated as a real server outage.
        if (consecutiveApiFailures.current >= API_FAILURE_THRESHOLD) {
          commitApiReachability(false);
          setApiHasResolved(true);
          consecutiveApiFailures.current = 0;
        }
      }

      return probeSucceeded;
    } finally {
      probing.current = false;
    }
  }, [commitApiReachability, isOnline, resetApiProbeHistory]);

  useEffect(() => NetInfo.addEventListener((state) => {
    const next = state.isConnected !== false && state.isInternetReachable !== false;
    setOnline((previous) => {
      if (!previous && next) setReconnectVersion((value) => value + 1);
      return next;
    });
    if (!next) {
      resetApiProbeHistory();
      commitApiReachability(null);
      setApiHasResolved(false);
    }
    setResolved(true);
  }), [commitApiReachability, resetApiProbeHistory]);

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
