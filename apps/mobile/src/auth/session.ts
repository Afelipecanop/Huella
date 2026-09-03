import * as SecureStore from "expo-secure-store";
import type { User } from "@huella/shared-types";

export type Session = {
  accessToken: string;
  refreshToken: string;
  user: User;
};

const ACCESS_TOKEN_KEY = "huella_access_token";
const REFRESH_TOKEN_KEY = "huella_refresh_token";
const USER_KEY = "huella_user";

// `undefined` = todavía no se leyó SecureStore (arranque de la app);
// `null` = ya se leyó y no hay sesión guardada; `Session` = hay sesión.
export type SessionState = Session | null | undefined;

let current: SessionState = undefined;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

// Store framework-agnostic (no un context de React) para que client.ts pueda
// leer el token sin importar React, evitando un import circular entre
// src/api/* (que pasa por client.ts) y un AuthProvider basado en contexto.
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSession(): SessionState {
  return current;
}

export function getAccessToken(): string | null {
  return current?.accessToken ?? null;
}

export function getRefreshToken(): string | null {
  return current?.refreshToken ?? null;
}

export async function loadSession(): Promise<void> {
  const [accessToken, refreshToken, userJson] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.getItemAsync(USER_KEY),
  ]);

  if (accessToken && refreshToken && userJson) {
    current = { accessToken, refreshToken, user: JSON.parse(userJson) as User };
  } else {
    current = null;
  }
  notify();
}

export async function saveSession(session: Session): Promise<void> {
  current = session;
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, session.accessToken),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, session.refreshToken),
    SecureStore.setItemAsync(USER_KEY, JSON.stringify(session.user)),
  ]);
  notify();
}

export async function clearSession(): Promise<void> {
  current = null;
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.deleteItemAsync(USER_KEY),
  ]);
  notify();
}
