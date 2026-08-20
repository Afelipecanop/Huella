import { API_BASE_URL, DEV_USER_ID } from "../config";

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

// Solo se manda content-type cuando hay body: mandarlo en un DELETE sin body
// hace que Fastify lo rechace con 400 "cannot be empty" (bug real que
// encontramos probando la API a mano en la Fase 5).
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { "x-user-id": DEV_USER_ID };
  if (options.body !== undefined) {
    headers["content-type"] = "application/json";
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

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
