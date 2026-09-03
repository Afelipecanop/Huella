import { API_BASE_URL } from "../config";
import { getAccessToken, getRefreshToken, saveSession, clearSession, getSession } from "../auth/session";
import type { AuthTokens } from "@huella/shared-types";

export class ApiError extends Error {
  status: number;
  issues?: unknown;

  constructor(status: number, message: string, issues?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.issues = issues;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
};

// No pasa por apiRequest a propósito: si el refresh también devolviera 401,
// entrar de nuevo al manejo de 401 de abajo recursaría sin fin.
async function refreshSession(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) return false;

  const tokens = (await response.json()) as AuthTokens;
  await saveSession({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    user: tokens.user,
  });
  return true;
}

async function rawRequest(path: string, options: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = {};
  const accessToken = getAccessToken();
  if (accessToken) {
    headers.authorization = `Bearer ${accessToken}`;
  }
  // Solo se manda content-type cuando hay body: mandarlo en un DELETE sin body
  // hace que Fastify lo rechace con 400 "cannot be empty" (bug real que
  // encontramos probando la API a mano en la Fase 5).
  if (options.body !== undefined) {
    headers["content-type"] = "application/json";
  }

  return fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response = await rawRequest(path, options);

  // Un 401 en una ruta protegida intenta refrescar el access token una vez;
  // si la ruta era /auth/* ya viaja sin token, así que no debería 401 por esto.
  if (response.status === 401 && getSession()) {
    const refreshed = await refreshSession();
    if (refreshed) {
      response = await rawRequest(path, options);
    } else {
      await clearSession();
    }
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const data: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : `Error ${response.status}`;
    const issues =
      data && typeof data === "object" && "issues" in data
        ? (data as { issues: unknown }).issues
        : undefined;
    throw new ApiError(response.status, message, issues);
  }

  return data as T;
}
