import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../server.js";

let server: FastifyInstance;

beforeAll(async () => {
  server = buildServer();
  await server.ready();
});

afterAll(async () => {
  await server.close();
});

beforeEach(async () => {
  await server.prisma.refreshToken.deleteMany();
  await server.prisma.user.deleteMany();
});

function registerPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    email: "dev@huella.local",
    password: "correcthorse",
    name: "Dev Local",
    default_currency: "COP",
    ...overrides,
  };
}

async function register(overrides: Partial<Record<string, unknown>> = {}) {
  return server.inject({ method: "POST", url: "/auth/register", payload: registerPayload(overrides) });
}

describe("POST /auth/register", () => {
  it("crea el usuario y devuelve un par de tokens", async () => {
    const res = await register();
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.access_token).toEqual(expect.any(String));
    expect(body.refresh_token).toEqual(expect.any(String));
    expect(body.user.email).toBe("dev@huella.local");
    expect(body.user.password_hash).toBeUndefined();
  });

  it("rechaza un email duplicado con 409", async () => {
    await register();
    const res = await register();
    expect(res.statusCode).toBe(409);
  });

  it("rechaza un payload inválido con 400", async () => {
    const res = await register({ password: "short" });
    expect(res.statusCode).toBe(400);
  });
});

describe("POST /auth/login", () => {
  it("devuelve tokens con credenciales correctas", async () => {
    await register();
    const res = await server.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "dev@huella.local", password: "correcthorse" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().access_token).toEqual(expect.any(String));
  });

  it("rechaza password incorrecto con 401", async () => {
    await register();
    const res = await server.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "dev@huella.local", password: "wrong-password" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("rechaza email inexistente con el mismo 401 genérico", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "nadie@huella.local", password: "correcthorse" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe("Credenciales inválidas");
  });
});

describe("POST /auth/refresh", () => {
  it("rota el refresh token: emite un par nuevo y revoca el viejo", async () => {
    const registerRes = await register();
    const { refresh_token: oldRefresh } = registerRes.json();

    const refreshRes = await server.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refresh_token: oldRefresh },
    });
    expect(refreshRes.statusCode).toBe(200);
    const { refresh_token: newRefresh } = refreshRes.json();
    expect(newRefresh).not.toBe(oldRefresh);

    const reuseRes = await server.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refresh_token: oldRefresh },
    });
    expect(reuseRes.statusCode).toBe(401);
  });

  it("rechaza un refresh token inválido con 401", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refresh_token: "no-existe" },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("POST /auth/logout", () => {
  it("revoca el refresh token: un refresh posterior falla", async () => {
    const registerRes = await register();
    const { refresh_token: refreshToken } = registerRes.json();

    const logoutRes = await server.inject({
      method: "POST",
      url: "/auth/logout",
      payload: { refresh_token: refreshToken },
    });
    expect(logoutRes.statusCode).toBe(204);

    const refreshRes = await server.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refresh_token: refreshToken },
    });
    expect(refreshRes.statusCode).toBe(401);
  });
});

describe("requireUserPlugin (smoke test vía GET /users/me)", () => {
  it("rechaza sin header Authorization", async () => {
    const res = await server.inject({ method: "GET", url: "/users/me" });
    expect(res.statusCode).toBe(401);
  });

  it("rechaza un token inválido", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/users/me",
      headers: { authorization: "Bearer garbage" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("acepta un access token válido", async () => {
    const registerRes = await register();
    const { access_token: accessToken, user } = registerRes.json();

    const res = await server.inject({
      method: "GET",
      url: "/users/me",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(user.id);
  });
});
