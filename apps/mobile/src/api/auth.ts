import { apiRequest } from "./client";
import type { Register, Login, AuthTokens } from "@huella/shared-types";

export function register(data: Register) {
  return apiRequest<AuthTokens>("/auth/register", { method: "POST", body: data });
}

export function login(data: Login) {
  return apiRequest<AuthTokens>("/auth/login", { method: "POST", body: data });
}

export function logout(refreshToken: string) {
  return apiRequest<void>("/auth/logout", { method: "POST", body: { refresh_token: refreshToken } });
}
