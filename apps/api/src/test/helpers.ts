import type { FastifyInstance } from "fastify";

let counter = 0;

// Cada test de un recurso necesita un usuario autenticado real (ya no existe
// el atajo x-user-id) — este helper registra uno y devuelve su access token.
export async function registerTestUser(
  server: FastifyInstance,
  overrides: Partial<{ email: string; password: string; name: string; default_currency: string }> = {},
) {
  counter += 1;
  const payload = {
    email: `test-${Date.now()}-${counter}@huella.local`,
    password: "correcthorse",
    name: "Test User",
    default_currency: "COP",
    ...overrides,
  };

  const res = await server.inject({ method: "POST", url: "/auth/register", payload });
  const body = res.json() as { access_token: string; user: { id: string } };
  return { accessToken: body.access_token, userId: body.user.id, email: payload.email };
}

export function authHeader(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` };
}
