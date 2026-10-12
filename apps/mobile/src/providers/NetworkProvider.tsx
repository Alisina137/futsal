import NetInfo from "@react-native-community/netinfo";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { systemApi } from "../lib/api";
import {advanceApiProbe,initialApiProbeState,API_PROBE_INTERVAL_MS} from "../lib/api-reachability";

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
export function NetworkProvider({ children }: { children: ReactNode }) {
  const [isOnline, setOnline] = useState(true);
  const [hasResolved, setResolved] = useState(false);
  const [reconnectVersion, setReconnectVersion] = useState(0);
  const [apiReachable, setApiReachable] = useState<boolean | null>(null);
  const [apiHasResolved, setApiHasResolved] = useState(false);
  const [apiReconnectVersion, setApiReconnectVersion] = useState(0);
  const probing = useRef(false);
  const apiReachableRef = useRef<boolean | null>(null);
  const apiProbeHistory = useRef(initialApiProbeState());
  const isOnlineRef = useRef(true);
  // A pending health fetch from before a connectivity change must not publish
  // a stale response after Wi-Fi/data disconnects or reconnects.
  const probeEpoch = useRef(0);

  const commitApiReachability = useCallback((next: boolean | null) => {
    apiReachableRef.current = next;
    setApiReachable(next);
  }, []);

  const resetApiProbeHistory = useCallback(() => {
    apiProbeHistory.current = initialApiProbeState();
    probeEpoch.current += 1;
  }, []);

  const checkApiNow = useCallback(async () => {
    if (!isOnlineRef.current) return null;
    // One health check at a time, even if AppState and the timer fire together.
    if (probing.current) return apiReachableRef.current;

    const epoch=probeEpoch.current;
    probing.current = true;
    try {
      const succeeded=await systemApi.probe();
      if (epoch!==probeEpoch.current || !isOnlineRef.current) return null;

      const result=advanceApiProbe(apiProbeHistory.current,succeeded,Date.now());
      apiProbeHistory.current=result.state;
      if (result.state.reachable!==apiReachableRef.current)
        commitApiReachability(result.state.reachable);
      if (result.state.reachable!==null) setApiHasResolved(true);
      if (result.recovered) setApiReconnectVersion(value=>value+1);
      return succeeded;
    } finally {
      probing.current = false;
    }
  }, [commitApiReachability]);

  useEffect(() => NetInfo.addEventListener((state) => {
    const next = state.isConnected !== false && state.isInternetReachable !== false;
    const previous=isOnlineRef.current;
    if (next!==previous) {
      isOnlineRef.current=next;
      resetApiProbeHistory();
      commitApiReachability(null);
      setApiHasResolved(false);
      if (!previous && next) setReconnectVersion(value=>value+1);
    }
    setOnline(next);
    setResolved(true);
  }), [commitApiReachability, resetApiProbeHistory]);

  useEffect(() => {
    if (!isOnline) return;
    void checkApiNow();
    const timer = setInterval(() => {
      // Backgrounded apps can have throttled timers and unreliable probes.
      if (AppState.currentState === "active") void checkApiNow();
    }, API_PROBE_INTERVAL_MS);
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
