import NetInfo from "@react-native-community/netinfo";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type NetworkContextValue = { isOnline: boolean; hasResolved: boolean; reconnectVersion: number };
const NetworkContext = createContext<NetworkContextValue | null>(null);

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [isOnline, setOnline] = useState(true);
  const [hasResolved, setResolved] = useState(false);
  const [reconnectVersion, setReconnectVersion] = useState(0);

  useEffect(() => NetInfo.addEventListener((state) => {
    const next = state.isConnected !== false && state.isInternetReachable !== false;
    setOnline((previous) => {
      if (!previous && next) setReconnectVersion((value) => value + 1);
      return next;
    });
    setResolved(true);
  }), []);

  const value = useMemo(() => ({ isOnline, hasResolved, reconnectVersion }), [isOnline, hasResolved, reconnectVersion]);
  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (!context) throw new Error("useNetwork must be used inside NetworkProvider");
  return context;
}
