import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import type { Login, Register, User } from "@huella/shared-types";
import * as authApi from "../api/auth";
import { subscribe, getSession, saveSession, clearSession, loadSession } from "./session";

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  login(data: Login): Promise<void>;
  register(data: Register): Promise<void>;
  logout(): Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const session = useSyncExternalStore(subscribe, getSession, getSession);
  const isLoading = session === undefined;

  useEffect(() => {
    loadSession();
  }, []);

  async function login(data: Login) {
    const tokens = await authApi.login(data);
    await saveSession({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      user: tokens.user,
    });
  }

  async function register(data: Register) {
    const tokens = await authApi.register(data);
    await saveSession({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      user: tokens.user,
    });
  }

  async function logout() {
    const current = getSession();
    if (current) {
      await authApi.logout(current.refreshToken).catch(() => undefined);
    }
    await clearSession();
  }

  return (
    <AuthContext.Provider value={{ user: session?.user ?? null, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
