import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../server.js";
import { registerTestUser, authHeader } from "../test/helpers.js";

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

describe("GET /users/me", () => {
  it("devuelve el usuario autenticado sin exponer password_hash", async () => {
    const { accessToken, userId } = await registerTestUser(server);
    const res = await server.inject({ method: "GET", url: "/users/me", headers: authHeader(accessToken) });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(userId);
    expect(body.password_hash).toBeUndefined();
  });
});

describe("PATCH /users/me", () => {
  it("actualiza los campos propios", async () => {
    const { accessToken } = await registerTestUser(server);
    const res = await server.inject({
      method: "PATCH",
      url: "/users/me",
      headers: authHeader(accessToken),
      payload: { name: "Nuevo Nombre" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe("Nuevo Nombre");
  });

  it("rechaza un payload inválido con 400", async () => {
    const { accessToken } = await registerTestUser(server);
    const res = await server.inject({
      method: "PATCH",
      url: "/users/me",
      headers: authHeader(accessToken),
      payload: { default_currency: "not-a-currency" },
    });
    expect(res.statusCode).toBe(400);
  });
});
