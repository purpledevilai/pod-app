import { rootStore, type RootStore } from '@/src/stores/root-store';
import React, { createContext, useContext, useEffect } from 'react';

const StoreCtx = createContext<RootStore>(rootStore);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  // bootstrap once on mount
  useEffect(() => { rootStore.bootstrap(); }, []);
  return <StoreCtx.Provider value={rootStore}>{children}</StoreCtx.Provider>;
}

export const useStores = () => useContext(StoreCtx);