// src/providers/AuthProvider.tsx
import { api, clearAuthTokens, refreshAccessToken, setAuthTokens } from '@/src/services/api';
import { requestCode, verifyCode } from '@/src/services/auth';
import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

type Tokens = { access: string; refresh: string };
type Session = { userId: string; email: string } | null;

const KEYS = { access: 'pod_access', refresh: 'pod_refresh' };

const Ctx = createContext<any>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session>(null);
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    (async () => {
      const [access, refresh] = await Promise.all([
        SecureStore.getItemAsync(KEYS.access),
        SecureStore.getItemAsync(KEYS.refresh),
      ]);
      console.log('AuthProvider: bootstrapping with tokens', { access, refresh });
      if (access && refresh) {
        setAuthTokens({ access, refresh });
        // Optionally validate/refresh on boot:
        const ok = await safeRefreshOnBoot(refresh);
        if (ok) setSession(await api.me()); // fetch current user
        else await signOutInternal();
      }
      setBootstrapped(true);
    })();
  }, []);

  async function safeRefreshOnBoot(refresh: string) {
    try {
      const newAccess = await refreshAccessToken(refresh);
      setAuthTokens({ access: newAccess, refresh });
      await SecureStore.setItemAsync(KEYS.access, newAccess);
      return true;
    } catch { return false; }
  }

  async function startEmailLogin(email: string) {
    await requestCode(email);
    return true;
  }

  async function confirmCode(email: string, code: string) {
    const { access, refresh, user } = await verifyCode(email, code);
    setAuthTokens({ access, refresh });
    await SecureStore.setItemAsync(KEYS.access, access);
    await SecureStore.setItemAsync(KEYS.refresh, refresh);
    setSession(user);
  }

  async function signOutInternal() {
    setSession(null);
    clearAuthTokens();
    await Promise.all([
      SecureStore.deleteItemAsync(KEYS.access),
      SecureStore.deleteItemAsync(KEYS.refresh),
    ]);
  }

  const value = useMemo(() => ({
    session,
    startEmailLogin,
    confirmCode,
    signOut: signOutInternal,
  }), [session]);

  return <Ctx.Provider value={{ ...value, bootstrapped }}>{children}</Ctx.Provider>;
}

export const useSession = () => {
  const { session, ...rest } = useContext(Ctx);
  return { session, ...rest };
};
export const useAuthBootstrapReady = () => useContext(Ctx)?.bootstrapped;
